// Implementation loop: authenticated HTTP boundary and cache import contract.
import { beforeEach, afterEach, expect, it } from 'vitest';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Miniflare } from 'miniflare';
import realApp from '../../worker/index.ts';
import { testIdentity } from '../helpers/libraryIdentity.ts';
let assertion = '';
const app = { request: (url: string, init?: RequestInit, bindings?: unknown) => realApp.request(url, { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), 'Cf-Access-Jwt-Assertion': assertion } }, bindings) };
import { Library } from '../../worker/library/index.ts';
import type { Env } from '../../worker/env.ts';
import { INGEST_OWNER, MAX_INGEST_BYTES } from '../../worker/api/library.ts';
import { pieceIdFor } from '../../worker/library/index.ts';
// Operator scripts are deliberately JavaScript and excluded from the app build.
// @ts-expect-error No declaration file for the Node operator tool.
import { planIngest, uploadPlan, endpointURL, validateConversion } from '../../tools/library-ingest.mjs';
import score from '../../scenarios/lab/00-document/01-minimal-single-note/document.mnx.json';

let directory: string; let mf: Miniflare; let env: Env;
const token = 'test-only-private-token';
const converters = Object.fromEntries(['guitarpro-mnx','musicxml-mnx'].map(producer => [producer, {
  producer, version: 'test-version', options: { git_sha: 'test', flags: ['--import'] }, convert: () => {
    const doc = structuredClone(score);
    Object.assign(doc, { _x: { mnxLab: { work: { title: 'Test song', artist: 'Test artist' } } } });
    Object.assign(doc.parts[0], { _x: { mnxLab: { capo: 3 } } }); return doc;
  }
}]));
const fetcher: typeof fetch = (input, init) => app.request(String(input), init, env);
const plan = async () => (await planIngest(directory))[0];
const upload = (p: Awaited<ReturnType<typeof plan>>, options: object = { converters }) => uploadPlan(p, 'http://localhost', token, fetcher, {}, options);
async function form(manifest: object, files: Map<string, Uint8Array>) {
  const f = new FormData(); f.set('manifest', JSON.stringify(manifest));
  for (const [key, value] of files) f.set(key, new Blob([value]), key);
  return f;
}
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'mnx-ingest-'));
  await writeFile(join(directory,'Song_ABC.gp'), 'synthetic GP input');
  await writeFile(join(directory,'Song_ABC.musicxml'), 'synthetic MusicXML input');
  await writeFile(join(directory,'Song_ABC.mp3'), 'synthetic recording');
  await writeFile(join(directory,'Song_ABC.sync.json'), JSON.stringify({ id: 'ABC', title: 'Sidecar song', artist: 'Sidecar artist', score_file: 'Song_ABC.gp', fetched_at: '2026-09-11', recordings: [
    { id: 1, source: 1, source_data: 'youtube123', name: 'Video', syncpoints: [[0,0]] },
    { id: 2, source: 2, media_file: 'Song_ABC.mp3', name: 'Audio', syncpoints: [[0,0]], cropped_duration: 10 }
  ] }));
  await writeFile(join(directory,'Song_ABC.lists.json'), JSON.stringify({ id: 'ABC', score_file: 'Song_ABC.gp', lists: [{ id: 'L1', path: 'Folder / List' }] }));
  mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("test")}}', compatibilityDate: '2026-06-01', d1Databases: ['DB'], r2Buckets: ['BUCKET'] });
  env = { LIBRARY_DB: await mf.getD1Database('DB'), LIBRARY_BUCKET: await mf.getR2Bucket('BUCKET'), LIBRARY_WRITE_TOKEN: token };
  const identity = await testIdentity(); Object.assign(env, identity.config); assertion = await identity.sign({}, true);
  await env.LIBRARY_DB.exec("CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,active INTEGER); INSERT INTO users VALUES('operator','owner@example.test',1)");
  for (const name of ['0001_library.sql', '0003_piece_views.sql']) {
    const sql = await readFile(new URL(`../../migrations/${name}`, import.meta.url),'utf8');
    await env.LIBRARY_DB.batch(sql.replace(/--[^\n]*/g,'').trim().split(/;\s*(?=CREATE\b)/).map(s => env.LIBRARY_DB.prepare(s)));
  }
}, 15000);
afterEach(async () => { await mf?.dispose(); await rm(directory, { recursive: true, force: true }); });

it('rejects unauthenticated reads, writes and unknown library routes before storage', async () => {
  for (const path of ['/api/library','/api/library/','/api/library/ingest/ABC','/api/library/pieces','/api/library/renditions/private']) {
    for (const method of ['GET','POST']) {
      const response = await app.request(path, { method }, { ...env, LIBRARY_WRITE_TOKEN: token });
      expect(response.status).toBe(401); expect(response.headers.get('cache-control')).toContain('no-store');
    }
  }
  const response = await app.request('/api/library/ingest/ABC', { headers: { Authorization: 'Bearer wrong' } }, env);
  expect(response.status).toBe(401);
});
it('fails closed when the server secret is absent', async () => {
  const response = await app.request('/api/library/ingest/ABC', { headers: { Authorization: `Bearer ${token}` } }, {});
  expect(response.status).toBe(503);
});
it('stores the sources only, projects tags from the sidecar and a validated conversion, and skips a replay', async () => {
  const p = await plan(); const first = await upload(p);
  expect(first.status).toBe('stored'); expect(first.snapshot.piece.owner).toBe(INGEST_OWNER);
  // The id is the service's, opaque and URL-safe, never the source identity; the source lives in its own columns.
  expect(first.snapshot.piece.id).toMatch(/^[0-9a-f]{16}$/); expect(first.snapshot.piece.id).toBe(await pieceIdFor('soundslice', 'ABC'));
  expect(first.snapshot.piece).toMatchObject({ source_kind: 'soundslice', source_id: 'ABC' });
  const named = await app.request('/api/library/ingest', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: await form({ ...p.manifest, id: 'chosen' }, p.files) }, env);
  expect(named.status).toBe(400);
  // Nothing derived is stored: the .gp and the MusicXML, no MNX.
  expect(first.snapshot.renditions.map((r: {format: string}) => r.format).sort()).toEqual(['gp', 'musicxml']);
  expect(first.snapshot.recordings).toHaveLength(2);
  expect(first.snapshot.renditions.find((r: {id: string}) => r.id === first.snapshot.piece.canonical_rendition_id).format).toBe('gp');
  expect(first.validation.report.map((e: {valid: boolean}) => e.valid)).toEqual([true, true]);
  expect(first.snapshot.tags.map((t: {dimension: string; value: string; origin: string; source_ref: string}) => `${t.dimension}:${t.value}:${t.origin}:${t.source_ref}`)).toEqual([
    'artist:Sidecar artist:derived:sidecar', 'capo:3:derived:guitarpro-mnx@test-version', 'list:Folder / List:asserted:L1', 'title:Sidecar song:derived:sidecar']);
  let posts = 0;
  const second = await uploadPlan(p, 'http://localhost', token, (input, init) => { if (init?.method === 'POST') posts++; return fetcher(input, init); }, {}, { converters });
  expect(second.status).toBe('skipped'); expect(posts).toBe(0); expect(second.snapshot).toEqual(first.snapshot);
  expect(second.validation).toBeNull();
});
it('re-validates and refreshes only the projection when the converter version changes, moving no bytes', async () => {
  const p = await plan(); await upload(p);
  const next = Object.fromEntries(Object.entries(converters).map(([k, v]) => [k, { ...v, version: 'v2', convert: () => { const d = v.convert(); Object.assign(d.parts[0], { _x: { mnxLab: { capo: 5 } } }); return d; } }]));
  const files: string[] = [];
  const result = await uploadPlan(p, 'http://localhost', token, async (input, init) => {
    if (init?.method === 'POST') for (const key of (init.body as FormData).keys()) files.push(key);
    return fetcher(input, init);
  }, {}, { converters: next });
  expect(result.status).toBe('stored'); expect(files).toEqual(['manifest']);
  expect(result.snapshot.tags.filter((t: {dimension: string}) => t.dimension === 'capo').map((t: {value: string; source_ref: string}) => `${t.value}:${t.source_ref}`)).toEqual(['5:guitarpro-mnx@v2']);
  expect(result.snapshot.renditions).toHaveLength(2);
});
it('stores a slice whose conversion does not validate, reports it, and projects no tag from it', async () => {
  const broken = Object.fromEntries(Object.entries(converters).map(([k, v]) => [k, { ...v, convert: () => ({ mnx: { version: 1 }, global: { measures: [{ ending: { numbers: [1] } }] }, parts: [] }) }]));
  const result = await upload(await plan(), { converters: broken });
  expect(result.status).toBe('stored');
  expect(result.validation.report.every((e: {valid: boolean}) => !e.valid)).toBe(true);
  expect(result.validation.report[0].errors.join(' ')).toContain('duration');
  expect(result.snapshot.tags.map((t: {dimension: string}) => t.dimension).sort()).toEqual(['artist', 'list', 'title']);
  expect(validateConversion(score)).toEqual([]);
});
it('refuses a canonical that is not the Soundslice .gp, in the tool and in the Worker', async () => {
  const p = await plan(); const first = await upload(p);
  const lib = new Library(env.LIBRARY_DB, env.LIBRARY_BUCKET);
  const xml = first.snapshot.renditions.find((r: {format: string}) => r.format === 'musicxml');
  await lib.writePiece(INGEST_OWNER, { id: first.snapshot.piece.id, expected_revision: 0, canonical: { mode: 'replace', rendition_id: xml.id } });
  await expect(upload(await plan())).rejects.toThrow('not the Soundslice .gp');
  const fresh = await plan(); fresh.manifest.canonical.rendition_id = fresh.manifest.renditions.find((r: {format: string}) => r.format === 'musicxml').id;
  fresh.manifest.source = { kind: 'soundslice', id: 'XYZ' };
  const response = await app.request('/api/library/ingest', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: await form(fresh.manifest, fresh.files) }, env);
  expect(response.status).toBe(409);
});
it('preserves renamed lists and missing recordings across a replay', async () => {
  const p = await plan(); const first = await upload(p);
  const lib = new Library(env.LIBRARY_DB, env.LIBRARY_BUCKET);
  await lib.writePiece(INGEST_OWNER, { id: first.snapshot.piece.id, expected_revision: 0,
    rename_tags: [{ dimension: 'list', value: 'Folder / List', to_dimension: 'collection', to_value: 'Renamed' }] });
  await rm(join(directory,'Song_ABC.mp3'));
  const second = await upload(await plan());
  expect(second.status).toBe('skipped');
  expect(second.snapshot.tags.some((t: {value: string}) => t.value === 'Renamed')).toBe(true);
  expect(second.snapshot.recordings).toHaveLength(2);
});
it('drops a companion recording the request cannot carry and keeps the score', async () => {
  // A 45 MiB Soundslice video was the first bundle over the 24 MiB request:
  // the recording goes with a warning, the slice still ingests, and a
  // recording the service already holds is retained (the missing-companion rule).
  const p0 = await plan(); const first = await upload(p0);
  expect(first.snapshot.recordings).toHaveLength(2);
  await writeFile(join(directory,'Song_ABC.mp3'), new Uint8Array(25 * 1024 * 1024));
  const warnings: string[] = []; const error = console.error;
  console.error = (message: string) => { warnings.push(String(message)); };
  try {
    const p = await plan();
    expect(p.manifest.recordings.map((r: { source_id: string }) => r.source_id)).toEqual(['1']);
    expect([...p.files.keys()].every(k => p.manifest.renditions.some((r: { file: string }) => r.file === k))).toBe(true);
    expect(p.bytes).toBeLessThan(24 * 1024 * 1024);
    expect(warnings.some(w => w.includes('Skipping recording 2 of ABC') && w.includes('existing recording is retained'))).toBe(true);
    const second = await upload(p);
    expect(second.snapshot.recordings).toHaveLength(2);
  } finally { console.error = error; }
});
it('accepts a hyphenated Soundslice slice id in the tool and the Worker', async () => {
  const p = await plan();
  p.manifest.source.id = '-gn-8c'; p.manifest.source.url = 'https://www.soundslice.com/slices/-gn-8c/';
  const first = await upload(p);
  expect(first.status).toBe('stored');
  expect(first.snapshot.piece.source_id).toBe('-gn-8c');
  const again = await upload(p);
  expect(again.status).toBe('skipped');
});
it('never lets request metadata choose an owner or replace canonical', async () => {
  const p = await plan();
  for (const extra of [{ owner: 'victim' }, { canonical: { mode: 'replace', rendition_id: p.manifest.canonical.rendition_id } }]) {
    const response = await app.request('/api/library/ingest', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: await form({ ...p.manifest, ...extra }, p.files) }, env);
    expect(response.status).toBe(400);
  }
  expect(await new Library(env.LIBRARY_DB, env.LIBRARY_BUCKET).listPieces(INGEST_OWNER)).toEqual([]);
});
it('operator metadata reads cannot see another owner', async () => {
  const lib = new Library(env.LIBRARY_DB, env.LIBRARY_BUCKET);
  await lib.writePiece('other', { id: 'private', expected_revision: null, source: { kind: 'soundslice', id: 'ABC' } });
  const response = await fetcher('http://localhost/api/library/ingest/ABC', { headers: { Authorization: `Bearer ${token}` } });
  expect(await response.json()).toEqual({ snapshot: null });
});
it('rejects stale revisions and tampered uploads without partial rows', async () => {
  const p = await plan(); await upload(p);
  const response = await app.request('/api/library/ingest', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: await form(p.manifest, p.files) }, env);
  expect(response.status).toBe(409);
  p.manifest.expected_revision = 0; p.manifest.renditions[0].sha256 = '0'.repeat(64);
  const bad = await app.request('/api/library/ingest', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: await form(p.manifest, p.files) }, env);
  expect(bad.status).toBe(400);
  expect((await new Library(env.LIBRARY_DB, env.LIBRARY_BUCKET).getPiece(INGEST_OWNER, await pieceIdFor('soundslice', 'ABC')))?.piece.revision).toBe(0);
});
it('bounds request bodies and rejects malformed manifests', async () => {
  const response = await app.request('/api/library/ingest', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data; boundary=x', 'Content-Length': String(MAX_INGEST_BYTES+1) }, body: 'x' }, env);
  expect(response.status).toBe(413);
  const bad = await app.request('/api/library/ingest', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: await form({ renditions: null }, new Map()) }, env);
  expect(bad.status).toBe(400);
});
it('uses stable identities and refuses sidecar disagreement and path traversal', async () => {
  expect((await plan()).manifest).toEqual((await plan()).manifest);
  await writeFile(join(directory,'Song_ABC.lists.json'), JSON.stringify({ id: 'OTHER', score_file: 'Song_ABC.gp', lists: [] }));
  await expect(plan()).rejects.toThrow('disagree');
  await rm(join(directory,'Song_ABC.lists.json'));
  await writeFile(join(directory,'Song_ABC.sync.json'), JSON.stringify({ id: 'ABC', score_file: 'Song_ABC.gp', recordings: [{ id: 2, source: 2, media_file: '../secret' }] }));
  await expect(plan()).rejects.toThrow('plain filenames');
});
it('never sends credentials to insecure endpoints or follows redirects', async () => {
  for (const value of ['http://example.com','https://user:secret@example.com','https://example.com/path']) expect(() => endpointURL(value)).toThrow();
  let calls = 0;
  await expect(uploadPlan(await plan(), 'https://example.com', token, async (_url: string, options: RequestInit) => {
    calls++; expect(options.redirect).toBe('error'); return new Response('private response', { status: 302 });
  })).rejects.toThrow('302');
  expect(calls).toBe(1);
});

it('preserves validated converter labels without accepting other proposed fields', async () => {
  const { parseMnx } = await import('../../worker/library/tags.ts');
  const { default: published } = await import('../../worker/generated/validate-mnx.mjs');
  const doc = structuredClone(score);
  Object.assign(doc.global.measures[0], { section: { label: 'Verse' }, rehearsal: { label: 'A' } });
  expect(published(doc)).toBe(false); // AI validation stays published-only.
  const bytes = new TextEncoder().encode(JSON.stringify(doc)).buffer;
  expect(parseMnx(bytes)).toEqual(doc);
  Object.assign(doc.global.measures[0], { section: { label: 42 } });
  expect(() => parseMnx(new TextEncoder().encode(JSON.stringify(doc)).buffer)).toThrow('Invalid section');
  Object.assign(doc.global.measures[0], { section: { label: 'Verse' }, invented: true });
  expect(() => parseMnx(new TextEncoder().encode(JSON.stringify(doc)).buffer)).toThrow('storage schema');
});

it('does not erase known raw-export provenance when the optional index is missing', async () => {
  const p = await plan();
  const exported = p.manifest.renditions.find((r: {format: string}) => r.format === 'gp');
  exported.provenance = { metadata_source: 'index.sqlite', source_sha256: 'a'.repeat(64), header: { Title: 'Test' } };
  exported.fetched_at = '2026-09-10';
  const first = await upload(p);
  const second = await upload(await plan());
  expect(second.status).toBe('skipped'); expect(second.snapshot).toEqual(first.snapshot);
});
it('enforces the actual stream limit without trusting Content-Length', async () => {
  const response = await app.request('/api/library/ingest', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data; boundary=x' }, body: new Uint8Array(MAX_INGEST_BYTES+1) }, env);
  expect(response.status).toBe(413);
});
