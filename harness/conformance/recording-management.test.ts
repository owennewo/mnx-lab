import { beforeEach, afterEach, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { Library } from '../../worker/library/index.ts';
import { RecordingManager } from '../../worker/library/recordings.ts';
import { attachmentSync, recordingSyncChoices, storedSyncSegments, MAX_AUDIO_BYTES } from '../../src/model/recordingAttachment.ts';
import { SYNC_SEGMENTS_FORMAT, emptySyncSegments, placeEnd, placeStart, setBpm } from '../../src/model/syncSegments.ts';
import realApp from '../../worker/index.ts';
import { testIdentity } from '../helpers/libraryIdentity.ts';
let mf: Miniflare, db: D1Database, bucket: R2Bucket, manager: RecordingManager, library: Library;
const id = () => `studio-${crypto.randomUUID()}`;
const change = { name: 'Take', video: 'https://youtu.be/M7lc1UVf-VE', rawSync: [[0,0],[1,2],[2,3,240],[3,5]], selectedId: null };
const payload = new TextEncoder().encode('RIFF test audio integrity');
async function audio() { return { sha256: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', payload)), b => b.toString(16).padStart(2,'0')).join(''), bytes: payload.length, mime: 'audio/wav' }; }
function request(bytes = payload) { return new Request('http://localhost/upload', { method: 'PUT', headers: { 'content-length': String(bytes.length) }, body: bytes }); }
beforeEach(async () => {
  mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default { fetch() { return new Response("test") } }', compatibilityDate: '2026-06-01', d1Databases: ['DB'], r2Buckets: ['BUCKET'] }));
  db = await mf.getD1Database('DB'); const nativeBucket = await mf.getR2Bucket('BUCKET');
  // Miniflare's Node RPC drops a Node stream's known-length tag. Adapt only this
  // test boundary; recording-management-smoke exercises the real Worker stream.
  bucket = new Proxy(nativeBucket, { get(target,key) {
    if (key === 'put') return async (key: string, value: Parameters<R2Bucket['put']>[1], options: Parameters<R2Bucket['put']>[2]) => nativeBucket.put(key, value instanceof ReadableStream ? await new Response(value).arrayBuffer() : value, options);
    const v=Reflect.get(target,key); return typeof v==='function' ? v.bind(target) : v;
  } });
  for (const name of ['0001_library','0003_piece_views','0004_recording_management','0005_piece_lifecycle','0006_piece_prefs']) {
    const sql = readFileSync(new URL(`../../migrations/${name}.sql`, import.meta.url), 'utf8').replace(/--[^\n]*/g,'').trim();
    await db.batch(sql.split(/;\s*(?=(?:CREATE|ALTER)\b)/).map(s => db.prepare(s)));
  }
  library = new Library(db,bucket); manager = new RecordingManager(db,bucket);
  await library.writePiece('alice',{id:'piece',expected_revision:null});
},15000);
afterEach(async () => { await mf?.dispose(); });
it('requires explicit stable selection from wrappers and retains raw event timings and crop metadata', () => {
  const raw = { id:'score', recordings:[{id:8,name:'Same',syncpoints:[[0,2],[1,4,240,1]],crop_start:2,crop_end:8},{id:9,name:'Same',syncpoints:[[0,1],[1,5]],cropped_duration:10}] };
  expect(recordingSyncChoices(raw).map(c=>c.id)).toEqual(['8','9']);
  expect(()=>attachmentSync(raw,null)).toThrow('Choose');
  const s=attachmentSync(raw,'8'); expect(s.syncpoints).toEqual(raw.recordings[0].syncpoints); expect(s.provenance.raw).toEqual(raw); expect(s.provenance.crop_start).toBe(2);
  expect(attachmentSync(raw,'9').provenance).toMatchObject({crop_start:null,crop_end:null,cropped_duration:10});
  expect(()=>recordingSyncChoices({recordings:[{id:1},{id:'1'}]})).toThrow('unique');
  expect(()=>attachmentSync([[0,-1]],null)).toThrow();
});
it('stores a sync authored in Studio: the segments as provenance beside the derived tuples', async () => {
  const segments=placeEnd(setBpm(placeStart(emptySyncSegments(),2),0,120),10), syncpoints=[[0,2],[1,4],[2,6]];
  const authored=attachmentSync({format:SYNC_SEGMENTS_FORMAT,segments,syncpoints},null);
  expect(authored.syncpoints).toEqual(syncpoints); expect(authored.provenance).toMatchObject({format:SYNC_SEGMENTS_FORMAT,raw:segments,selectedId:null});
  // A score with no bars yet keeps its segments and has no tuples.
  expect(attachmentSync({format:SYNC_SEGMENTS_FORMAT,segments,syncpoints:null},null).syncpoints).toBeNull();
  expect(()=>attachmentSync({format:SYNC_SEGMENTS_FORMAT,segments:{...segments,cuts:[10,2]},syncpoints},null)).toThrow('increase');
  expect(()=>attachmentSync({format:SYNC_SEGMENTS_FORMAT,segments,syncpoints:[[0,-1]]},null)).toThrow();
  const recording=id(); await manager.save('alice','piece',recording,0,change);
  const saved=await manager.save('alice','piece',recording,1,{name:change.name,rawSync:{format:SYNC_SEGMENTS_FORMAT,segments,syncpoints}});
  expect(JSON.parse(saved.recordings[0].syncpoints!)).toEqual(syncpoints);
  expect(storedSyncSegments(saved.recordings[0].provenance)).toEqual(segments);
  // The same edit again is a lost-response retry, not a second revision.
  expect((await manager.save('alice','piece',recording,1,{name:change.name,rawSync:{format:SYNC_SEGMENTS_FORMAT,segments,syncpoints}})).piece.revision).toBe(2);
  expect(storedSyncSegments(null)).toBeNull(); expect(storedSyncSegments('{"format":"soundslice-sync-array","raw":[]}')).toBeNull(); expect(storedSyncSegments('not json')).toBeNull();
});
it('creates and edits YouTube while retaining recording identity, source bytes and stale-write protection', async () => {
  const recording=id(); const a=await manager.save('alice','piece',recording,0,change);
  expect(a.piece.revision).toBe(1); expect(a.recordings[0].external_id).toBe('M7lc1UVf-VE'); expect((await bucket.list()).objects).toHaveLength(0);
  expect((await manager.save('alice','piece',recording,0,change)).piece.revision).toBe(1);
  const b=await manager.save('alice','piece',recording,1,{name:'Renamed'});
  expect(b.recordings[0]).toMatchObject({id:recording,name:'Renamed',syncpoints:a.recordings[0].syncpoints,provenance:a.recordings[0].provenance});
  await expect(manager.save('alice','piece',recording,1,{name:'Stale'})).rejects.toMatchObject({code:'conflict'});
  await expect(manager.save('alice','piece',recording,2,{name:'New media',video:'dQw4w9WgXcQ'})).rejects.toMatchObject({code:'invalid'});
  await expect(manager.save('bob','piece',recording,2,{name:'Foreign'})).rejects.toMatchObject({code:'not_found'});
  await expect(manager.save('alice','piece',id(),2,{...change,video:'https://evil.test/watch?v=M7lc1UVf-VE'})).rejects.toMatchObject({code:'invalid'});
});
it('stores explicitly absent or partial timings and preserves imported identities on edits', async () => {
  await library.writePiece('alice',{id:'piece',expected_revision:0,recordings:[{id:'imported',source_id:'8',kind:'youtube',external_id:'M7lc1UVf-VE',syncpoints:[[0,2]]}]});
  const result=await manager.save('alice','piece','imported',1,{name:'My imported take',rawSync:null});
  expect(result.recordings[0]).toMatchObject({id:'imported',source_id:'8',syncpoints:null});
  const edited=await manager.save('alice','piece','imported',2,{name:'My imported take',rawSync:[[0,0],[1,2,240]]});
  expect(JSON.parse(edited.recordings[0].syncpoints!)).toEqual([[0,0],[1,2,240]]);
});
it('streams verified audio, retries after a lost response, and never detaches shared bytes', async () => {
  const recording=id(), a=await audio(); await manager.begin('alice','piece',recording,0,{name:'Audio',rawSync:null},a);
  expect((await library.getPiece('alice','piece'))?.recordings).toHaveLength(0);
  const result=await manager.upload('alice',recording,request());
  expect(result.recordings[0]).toMatchObject({id:recording,sha256:a.sha256,bytes:payload.length});
  expect((await manager.upload('alice',recording,request())).piece.revision).toBe(1);
  const other=id(); await manager.begin('alice','piece',other,1,{name:'Same bytes'},a); await manager.upload('alice',other,request());
  await manager.remove('alice','piece',recording,2);
  expect((await bucket.list()).objects).toHaveLength(1);
  expect(new Uint8Array(await (await library.readRecording('alice',other)).body!.getReader().read().then(r=>r.value!.buffer))).toEqual(payload);
  await expect(manager.remove('bob','piece',other,3)).rejects.toMatchObject({code:'not_found'});
});
it('rejects wrong lengths/checksums, foreign ownership, cancellation, expiry and stale upload revisions', async () => {
  const a=await audio(), recording=id(); await manager.begin('alice','piece',recording,0,{name:'Audio'},a);
  await expect(manager.upload('bob',recording,request())).rejects.toMatchObject({code:'not_found'});
  await expect(manager.upload('alice',recording,request(payload.slice(1)))).rejects.toMatchObject({code:'invalid'});
  await expect(manager.upload('alice',recording,request(new Uint8Array(payload.length)))).rejects.toThrow();
  expect((await bucket.list()).objects).toHaveLength(0);
  await manager.cancel('alice',recording); await expect(manager.upload('alice',recording,request())).rejects.toMatchObject({code:'conflict'});
  const expired=id(); await manager.begin('alice','piece',expired,0,{name:'Audio'},a); await db.prepare('UPDATE recording_uploads SET expires_at=? WHERE id=?').bind('2000',expired).run();
  await expect(manager.upload('alice',expired,request())).rejects.toMatchObject({code:'conflict'});
  const stale=id(); await manager.begin('alice','piece',stale,0,{name:'Audio'},a); await manager.save('alice','piece',id(),0,change);
  await expect(manager.upload('alice',stale,request())).rejects.toMatchObject({code:'conflict'});
  await expect(manager.begin('alice','piece',id(),1,{name:'Too big'},{...a,bytes:MAX_AUDIO_BYTES+1})).rejects.toMatchObject({code:'invalid'});
});
it('rolls back final attachment if cancellation wins during the R2 write', async () => {
  const recording=id(); await manager.begin('alice','piece',recording,0,{name:'Audio'},await audio());
  const racedBucket=new Proxy(bucket,{get(target,key){ if(key==='put') return async (...args:Parameters<R2Bucket['put']>)=>{const r=await bucket.put(...args);await manager.cancel('alice',recording);return r;};const v=Reflect.get(target,key);return typeof v==='function'?v.bind(target):v; }});
  await expect(new RecordingManager(db,racedBucket).upload('alice',recording,request())).rejects.toMatchObject({code:'conflict'});
  expect((await library.getPiece('alice','piece'))?.recordings).toHaveLength(0);
  expect((await library.getPiece('alice','piece'))?.piece.revision).toBe(0);
});
it('authenticates HTTP uploads and rejects cross-site/non-JSON writes', async () => {
  await db.prepare('CREATE TABLE users (id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL)').run();
  await db.prepare('INSERT INTO users (id,email,active,created_at) VALUES (?,?,1,?)').bind('alice','owner@example.test','now').run();
  const identity=await testIdentity(); const jwt=await identity.sign(); const env={...identity.config,LIBRARY_DB:db,LIBRARY_BUCKET:bucket};
  const url='/api/library/pieces/piece/recordings/'+id();
  const response=await realApp.request(url,{method:'PUT',headers:{'Content-Type':'application/json','Cf-Access-Jwt-Assertion':jwt},body:JSON.stringify({...change,expected_revision:0})},env);
  expect(response.status,await response.clone().text()).toBe(200);
  expect((await realApp.request(url,{method:'PUT',headers:{'Content-Type':'application/json','Cf-Access-Jwt-Assertion':jwt,Origin:'https://foreign.test'},body:'{}'},env)).status).toBe(403);
  expect((await realApp.request(url,{method:'PUT',headers:{'Content-Type':'text/plain','Cf-Access-Jwt-Assertion':jwt},body:'{}'},env)).status).toBe(415);
  expect((await realApp.request('/api/library/uploads/'+id(),{method:'PUT',body:payload},env)).status).toBe(401);
  expect((await realApp.request('/api/library/uploads/'+id(),{method:'PUT',headers:{'Content-Type':'application/json','Cf-Access-Jwt-Assertion':jwt},body:'{}'},env)).status).toBe(415);
});
// roadmap/complete/studio-sync-rederive.md: the shape an imported sync is known good for.
it('stamps a score shape into whatever provenance a recording has, without touching its sync', async () => {
  const take = id();
  const before = await manager.save('alice','piece',take,0,change);
  const row = () => db.prepare('SELECT name,syncpoints,provenance FROM recordings WHERE id=?').bind(take).first<{ name: string; syncpoints: string; provenance: string }>();
  const imported = await row();
  const stamped = await manager.save('alice','piece',take,before.piece.revision,{ name: 'Take', scoreShape: '12x1/1' });
  expect(stamped.piece.revision).toBe(before.piece.revision + 1);
  const after = await row();
  expect(after!.syncpoints).toBe(imported!.syncpoints);
  expect(JSON.parse(after!.provenance)).toEqual({ ...JSON.parse(imported!.provenance), scoreShape: '12x1/1' });
  // The same stamp again is nothing to write; a new sync forgets the old shape; null forgets it on request.
  expect((await manager.save('alice','piece',take,stamped.piece.revision,{ name: 'Take', scoreShape: '12x1/1' })).piece.revision).toBe(stamped.piece.revision);
  const cleared = await manager.save('alice','piece',take,stamped.piece.revision,{ name: 'Take', scoreShape: null });
  expect(JSON.parse((await row())!.provenance)).not.toHaveProperty('scoreShape');
  await manager.save('alice','piece',take,cleared.piece.revision,{ name: 'Take', scoreShape: '8x3/4' });
  const resynced = await manager.save('alice','piece',take,cleared.piece.revision + 1,{ name: 'Take', rawSync: [[0,0],[1,3]] });
  expect(JSON.parse((await row())!.provenance)).not.toHaveProperty('scoreShape');
  await expect(manager.save('alice','piece',take,resynced.piece.revision,{ name: 'Take', scoreShape: 'x'.repeat(4097) })).rejects.toThrow('score shape');
  // An ingested recording may have no provenance at all: the stamp stands alone.
  await db.prepare('UPDATE recordings SET provenance=NULL WHERE id=?').bind(take).run();
  await manager.save('alice','piece',take,resynced.piece.revision,{ name: 'Take', scoreShape: '4x1/1' });
  expect(JSON.parse((await row())!.provenance)).toEqual({ scoreShape: '4x1/1' });
});
