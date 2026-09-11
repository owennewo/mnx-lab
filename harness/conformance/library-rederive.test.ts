// Implementation loop: operator sweep through authenticated HTTP and real local D1/R2.
import { beforeEach, afterEach, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Miniflare } from 'miniflare';
import app from '../../worker/index.ts';
import { Library } from '../../worker/library/index.ts';
import type { Env } from '../../worker/env.ts';
import versions from '../../worker/library/converter-versions.json';
import { testIdentity } from '../helpers/libraryIdentity.ts';
import score from '../../scenarios/lab/00-document/01-minimal-single-note/document.mnx.json';
// @ts-expect-error Operator tools are deliberately Node JavaScript.
import { operatorClient, planRederive, sweep, compareDocuments } from '../../tools/library-rederive.mjs';
let mf: Miniflare; let env: Env; let machine: string; let browser: string; let lib: Library;
const token = 'test-private';
const bytes = (value: unknown) => new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n').buffer;
const hash = (b: ArrayBuffer) => createHash('sha256').update(new Uint8Array(b)).digest('hex');
const document = (title = 'Stored title') => ({ ...structuredClone(score), _x: { mnxLab: { work: { title } } } });
const options = { flags: ['--import'], encoding_date: false };
const converters = (title = 'Stored title') => Object.fromEntries(Object.entries(versions).map(([producer,version]) => [producer, { producer, version, options, convert: () => document(title) }]));
const fetcher: typeof fetch = (url, init) => app.request(String(url), init, env);
const client = () => operatorClient('http://localhost', token, { 'Cf-Access-Jwt-Assertion': machine }, fetcher);
const request = (path: string, method = 'GET', body?: BodyInit, jwt = machine) => app.request('http://localhost/api/library/ingest/rederive' + path,
  { method, body, headers: { Authorization: `Bearer ${token}`, 'Cf-Access-Jwt-Assertion': jwt } }, env);
const form = (manifest: object, files: Map<string, Uint8Array> = new Map()) => {
  const f = new FormData(); f.set('manifest', JSON.stringify(manifest));
  for (const [key,value] of files) f.set(key, new Blob([value]), key); return f;
};
async function seed(id = 'piece', owner = 'operator', version = 'old') {
  const old = new Library(env.LIBRARY_DB, env.LIBRARY_BUCKET, { 'guitarpro-mnx': version, 'musicxml-mnx': version });
  return old.writePiece(owner, { id, expected_revision: null,
    renditions: ['gp','musicxml'].flatMap(format => {
      const producer = format === 'gp' ? 'guitarpro-mnx' : 'musicxml-mnx';
      return [{ id: id+format, format, role: 'original', producer: 'upload', producer_version: null, producer_options: null, content: bytes('synthetic '+format) },
        { id: id+format+'child', format: 'mnx', role: 'derived', producer, producer_version: version, producer_options: options,
          derived_from: id+format, content: bytes(document()) }];
    }) as Parameters<Library['writePiece']>[1]['renditions'],
    canonical: { mode: 'initialize', rendition_id: id+'gp' }, tags: [{ dimension: 'list', value: 'Keep me' }],
    recordings: [{ id: id+'recording', kind: 'youtube', source_id: 'yt', external_id: 'video', syncpoints: [[0,0]] }]
  });
}
beforeEach(async () => {
  const identity = await testIdentity(); machine = await identity.sign({}, true); browser = await identity.sign();
  mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("test")}}', compatibilityDate: '2026-06-01', d1Databases: ['DB'], r2Buckets: ['BUCKET'] });
  env = { LIBRARY_DB: await mf.getD1Database('DB'), LIBRARY_BUCKET: await mf.getR2Bucket('BUCKET'), LIBRARY_WRITE_TOKEN: token, ...identity.config };
  for (const name of ['0001_library.sql','0002_users.sql']) {
    const sql = await readFile(new URL('../../migrations/'+name, import.meta.url), 'utf8');
    await env.LIBRARY_DB.batch(sql.replace(/--[^\n]*/g,'').trim().split(/;\s*(?=CREATE\b)/).map(s => env.LIBRARY_DB.prepare(s)));
  }
  await env.LIBRARY_DB.prepare("INSERT INTO users VALUES ('operator','owner@example.test',1,'now')").run();
  lib = new Library(env.LIBRARY_DB, env.LIBRARY_BUCKET, versions);
},15000);
afterEach(async () => { await mf?.dispose(); });

it('adds new-version evidence without duplicate blobs and replays without any row changes', async () => {
  const before = await seed(); const blobs = await env.LIBRARY_BUCKET.list();
  const reports: unknown[] = [];
  expect((await sweep(client(), converters(), { dryRun: true, report: (r: unknown) => reports.push(r) })).new_renditions).toBe(2);
  expect(await lib.getPiece('operator','piece')).toEqual(before);
  const first = await sweep(client(), converters(), { report: () => {} }); expect(first.failed).toBe(0); expect(first.changed).toBe(0);
  const after = (await lib.getPiece('operator','piece'))!;
  expect(after.renditions).toHaveLength(6); expect(after.piece.revision).toBe(1);
  expect(after.piece.canonical_rendition_id).toBe(before.piece.canonical_rendition_id);
  expect(after.recordings).toEqual(before.recordings); expect(after.tags).toEqual(before.tags);
  expect((await env.LIBRARY_BUCKET.list()).objects.map(o => o.key)).toEqual(blobs.objects.map(o => o.key));
  expect((await lib.readCanonicalMnx('operator','piece'))?.rendition.producer_version).toBe(versions['guitarpro-mnx']);
  expect((await sweep(client(), converters(), { report: () => {} })).new_renditions).toBe(0);
  expect(await lib.getPiece('operator','piece')).toEqual(after);
});
it('reports changed document paths and refreshes only canonical-derived tags', async () => {
  const before = await seed(); await lib.setAlias('operator','title','Stored title','Display title');
  const reports: {comparisons?: {outcome:string; paths:string[]}[]}[] = [];
  const result = await sweep(client(), converters('Changed title'), { report: (r: typeof reports[number]) => reports.push(r) });
  expect(result.changed).toBe(1); expect(reports[0].comparisons?.[0].paths).toContain('/_x/mnxLab/work/title');
  const after = (await lib.getPiece('operator','piece'))!;
  expect(after.tags.find(t => t.dimension==='title')?.value).toBe('Changed title');
  expect(after.tags.filter(t=>t.origin==='asserted')).toEqual(before.tags.filter(t=>t.origin==='asserted'));
  expect(after.renditions.filter(r=>before.renditions.some(b=>b.id===r.id))).toEqual(before.renditions);
  expect((await lib.listAliases('operator'))[0].canonical_value).toBe('Display title');
});
it('discounts only the root encoding stamp, keeps arrays ordered and bounds diff samples', async () => {
  expect(compareDocuments({ _x:{mnxLab:{encoding:{software:'old'}}}, parts:[] }, { parts:[], _x:{mnxLab:{encoding:{software:'new'}}} }).changes).toBe(0);
  expect(compareDocuments({ parts:[{encoding:'old'}] }, { parts:[{encoding:'new'}] }).changes).toBe(1);
  expect(compareDocuments({ a:[1,2] }, { a:[2,1] }).changes).toBe(2);
  const large = compareDocuments(Array(60).fill(0),Array(60).fill(1)); expect(large.changes).toBe(60); expect(large.paths).toHaveLength(40); expect(large.truncated).toBe(true);
  const snapshot = await seed();
  const c = converters(); c['guitarpro-mnx'].convert = () => ({...document(), _x:{mnxLab:{work:{title:'Stored title'},encoding:{software:'test'}}}});
  const plan = await planRederive(snapshot,c,(r: typeof snapshot.renditions[number])=>client().blob(r));
  expect(plan.comparisons.find((r: {format:string})=>r.format==='gp').outcome).toBe('encoding-or-serialization-only');
});
it('isolates machine reads and writes, rejects browser credentials and checks suspension', async () => {
  await seed(); await seed('private','other');
  expect((await client().page('')).pieces.map((p:{id:string})=>p.id)).toEqual(['piece']);
  for (const path of ['/pieces/private','/renditions/privategp']) expect((await request(path)).status).toBe(404);
  for (const path of ['/pieces','/pieces/piece','/renditions/piecegp']) {
    expect((await request(path,'GET',undefined,browser)).status).toBe(401);
    expect((await request(path,'GET',undefined,'')).status).toBe(401);
  }
  const bad = { id:'private',expected_revision:0,converter_versions:versions,renditions:[] };
  expect((await request('','POST',form(bad))).status).toBe(404);
  await env.LIBRARY_DB.prepare('UPDATE users SET active=0').run(); expect((await request('/pieces')).status).toBe(403);
});
it('rejects stale, wrong-version and cross-piece writes without altering originals', async () => {
  const before = await seed(); await seed('private','other');
  const plan = await planRederive(before,converters(),(r: typeof before.renditions[number])=>client().blob(r));
  for (const extra of [{owner:'other'}, {canonical:{mode:'replace',rendition_id:'piecegpchild'}}, {converter_versions:{'guitarpro-mnx':'wrong'}}, {expected_revision:10}]) {
    expect((await request('','POST',form({...plan.manifest,...extra},plan.files))).status).toBeGreaterThanOrEqual(400);
  }
  const r = {...plan.manifest.renditions[0],derived_from:'privategp'};
  expect((await request('','POST',form({...plan.manifest,renditions:[r]},plan.files))).status).toBe(400);
  expect(await lib.getPiece('operator','piece')).toEqual(before);
  await client().apply(plan); expect((await request('','POST',form(plan.manifest,plan.files))).status).toBe(409);
});
it('detects corrupt blobs and conversion failures with no partial piece writes, then continues', async () => {
  const first = await seed('a'); await seed('b');
  const original = first.renditions.find(r=>r.format==='gp')!;
  await env.LIBRARY_BUCKET.put(original.r2_key,bytes('corrupt'));
  const result = await sweep(client(),converters(),{ report:()=>{} }); expect(result.failed).toBe(2); // shared source hash affects both
  expect(await lib.getPiece('operator','a')).toEqual(first);
  await env.LIBRARY_BUCKET.put(original.r2_key,bytes('synthetic gp'));
  const base = client();
  const failing = {...base, blob: (r:{piece_id:string}) => { if(r.piece_id==='a')throw Error('private source payload');return base.blob(r); }};
  const reports: unknown[]=[];
  const resumed = await sweep(failing,converters(),{report:(r:unknown)=>reports.push(r)});
  expect(resumed.failed).toBe(1); expect(resumed.new_renditions).toBe(2);
  expect(JSON.stringify(reports)).not.toContain('private source payload'); expect((await lib.getPiece('operator','a'))?.piece.revision).toBe(0);
});
it('repairs derived tags for canonical MNX without creating conversions or moving its pointer', async () => {
  const before = await lib.writePiece('operator',{id:'mnx',expected_revision:null,renditions:[{id:'mnx-source',format:'mnx',role:'original',producer:'upload',producer_version:null,producer_options:null,content:bytes(document())}],canonical:{mode:'initialize',rendition_id:'mnx-source'}});
  await env.LIBRARY_DB.prepare("DELETE FROM tags WHERE piece_id='mnx' AND origin='derived'").run();
  expect((await sweep(client(),converters(),{report:()=>{}})).new_renditions).toBe(0);
  const after = (await lib.getPiece('operator','mnx'))!;expect(after.tags).toEqual(before.tags);expect(after.piece.canonical_rendition_id).toBe('mnx-source');expect(after.renditions).toEqual(before.renditions);
});
it('fails closed on mismatched deployed converter versions and verifies raw download checksums', async () => {
  await expect(sweep({...client(),page:async()=>({pieces:[],next:null,converter_versions:{}})},converters(),{report:()=>{}})).rejects.toThrow('matching converter');
  const malicious = operatorClient('https://example.test',token,{},async (_url:string,init:RequestInit)=>{expect(init.redirect).toBe('error');return new Response('tampered');});
  await expect(malicious.blob({id:'source',bytes:8,sha256:hash(bytes('expected'))})).rejects.toThrow('checksum');
});
it('does not create same-version history for encoding-only churn', async () => {
  await seed(); await sweep(client(),converters(),{report:()=>{}});
  const before = await lib.getPiece('operator','piece');
  const c = converters();
  for (const converter of Object.values(c)) converter.convert = () => ({...document(), _x:{mnxLab:{work:{title:'Stored title'},encoding:{software:'a changed stamp'}}}});
  const result = await sweep(client(),c,{report:()=>{}});
  expect(result.new_renditions).toBe(0); expect(await lib.getPiece('operator','piece')).toEqual(before);
});
it('rejects invalid MNX before any piece rows commit and traverses all cursor pages', async () => {
  const before = await seed(); const c = converters(); c['musicxml-mnx'].convert=()=>({invalid:'not MNX'});
  expect((await sweep(client(),c,{report:()=>{}})).failed).toBe(1);expect(await lib.getPiece('operator','piece')).toEqual(before);
  const visited:string[]=[];
  const fake = {
    page:async (after:string)=>({pieces:[{id:after===''?'a':'b'}],next:after===''?'a':null,converter_versions:versions}),
    snapshot:async(id:string)=>{visited.push(id);return {piece:{id,revision:0},renditions:[],tags:[]};},
    apply:async()=>{throw Error('dry-run attempted a write');}
  };
  expect((await sweep(fake,converters(),{dryRun:true,report:()=>{}})).pieces).toBe(2);expect(visited).toEqual(['a','b']);
});
it('does not echo malformed private credentials or accept symlinked credential files', async () => {
  const { mkdtemp, writeFile, symlink, rm } = await import('node:fs/promises');
  // @ts-expect-error Node operator tool.
  const { operatorCredentials } = await import('../../tools/library-ingest.mjs');
  const dir = await mkdtemp('/tmp/rederive-credentials-');
  try {
    await writeFile(dir+'/token','test-token',{mode:0o600});
    await writeFile(dir+'/access','{"client_secret":"private-sentinel",broken',{mode:0o600});
    await expect(operatorCredentials({endpoint:'https://example.test',tokenFile:dir+'/token',accessFile:dir+'/access'})).rejects.toThrow('Access token file contains invalid JSON');
    await symlink(dir+'/token',dir+'/link');
    await expect(operatorCredentials({endpoint:'http://localhost',tokenFile:dir+'/link'})).rejects.toThrow('regular file');
  } finally { await rm(dir,{recursive:true,force:true}); }
});
