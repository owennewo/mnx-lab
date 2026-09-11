// Implementation loop: authenticated HTTP boundary and cache import contract.
import { beforeEach, afterEach, expect, it } from 'vitest';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Miniflare } from 'miniflare';
import app from '../../worker/index.ts';
import { Library } from '../../worker/library/index.ts';
import type { Env } from '../../worker/env.ts';
import { INGEST_OWNER, MAX_INGEST_BYTES } from '../../worker/api/library.ts';
// Operator scripts are deliberately JavaScript and excluded from the app build.
// @ts-expect-error No declaration file for the Node operator tool.
import { planIngest, uploadPlan, endpointURL } from '../../tools/library-ingest.mjs';
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
const plan = async () => (await planIngest(directory, converters))[0];
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
  await writeFile(join(directory,'Song_ABC.sync.json'), JSON.stringify({ id: 'ABC', score_file: 'Song_ABC.gp', fetched_at: '2026-09-11', recordings: [
    { id: 1, source: 1, source_data: 'youtube123', name: 'Video', syncpoints: [[0,0]] },
    { id: 2, source: 2, media_file: 'Song_ABC.mp3', name: 'Audio', syncpoints: [[0,0]], cropped_duration: 10 }
  ] }));
  await writeFile(join(directory,'Song_ABC.lists.json'), JSON.stringify({ id: 'ABC', score_file: 'Song_ABC.gp', lists: [{ id: 'L1', path: 'Folder / List' }] }));
  mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("test")}}', compatibilityDate: '2026-06-01', d1Databases: ['DB'], r2Buckets: ['BUCKET'] });
  env = { LIBRARY_DB: await mf.getD1Database('DB'), LIBRARY_BUCKET: await mf.getR2Bucket('BUCKET'), LIBRARY_WRITE_TOKEN: token };
  const sql = await readFile(new URL('../../migrations/0001_library.sql', import.meta.url),'utf8');
  await env.LIBRARY_DB.batch(sql.replace(/--[^\n]*/g,'').trim().split(/;\s*(?=CREATE\b)/).map(s => env.LIBRARY_DB.prepare(s)));
}, 15000);
afterEach(async () => { await mf?.dispose(); await rm(directory, { recursive: true, force: true }); });

it('rejects unauthenticated reads, writes and unknown library routes before storage', async () => {
  for (const path of ['/api/library','/api/library/','/api/library/ingest/ABC','/api/library/pieces','/api/library/renditions/private']) {
    for (const method of ['GET','POST']) {
      const response = await app.request(path, { method }, { LIBRARY_WRITE_TOKEN: token });
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
it('imports through HTTP, derives canonical metadata and repeats without writes', async () => {
  const p = await plan(); const first = await uploadPlan(p, 'http://localhost', token, fetcher);
  expect(first.snapshot.piece.owner).toBe(INGEST_OWNER);
  expect(first.snapshot.renditions).toHaveLength(4); expect(first.snapshot.recordings).toHaveLength(2);
  expect(first.canonical.work).toEqual({ title: 'Test song', artist: 'Test artist' }); expect(first.canonical.capos).toEqual([3]);
  const second = await uploadPlan(p, 'http://localhost', token, fetcher);
  expect(second.unchanged).toBe(true); expect(second.snapshot).toEqual(first.snapshot);
});
it('preserves canonical choices, renamed lists and missing recordings', async () => {
  const p = await plan(); const first = await uploadPlan(p, 'http://localhost', token, fetcher);
  const lib = new Library(env.LIBRARY_DB, env.LIBRARY_BUCKET, { 'guitarpro-mnx': 'test-version', 'musicxml-mnx': 'test-version' });
  const xml = first.snapshot.renditions.find((r: {format: string}) => r.format === 'musicxml');
  await lib.writePiece(INGEST_OWNER, { id: p.manifest.id, expected_revision: 0, canonical: { mode: 'replace', rendition_id: xml.id },
    rename_tags: [{ dimension: 'unknown', value: 'Folder / List', to_dimension: 'collection', to_value: 'Renamed' }] });
  await rm(join(directory,'Song_ABC.mp3'));
  const second = await uploadPlan(await plan(), 'http://localhost', token, fetcher);
  expect(second.unchanged).toBe(true); expect(second.snapshot.piece.canonical_rendition_id).toBe(xml.id);
  expect(second.snapshot.tags.some((t: {value: string}) => t.value === 'Renamed')).toBe(true);
  expect(second.snapshot.recordings).toHaveLength(2);
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
  const p = await plan(); await uploadPlan(p, 'http://localhost', token, fetcher);
  const response = await app.request('/api/library/ingest', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: await form(p.manifest, p.files) }, env);
  expect(response.status).toBe(409);
  p.manifest.expected_revision = 0; p.manifest.renditions[0].sha256 = '0'.repeat(64);
  const bad = await app.request('/api/library/ingest', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: await form(p.manifest, p.files) }, env);
  expect(bad.status).toBe(400);
  expect((await new Library(env.LIBRARY_DB, env.LIBRARY_BUCKET).getPiece(INGEST_OWNER, p.manifest.id))?.piece.revision).toBe(0);
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
  const first = await uploadPlan(p, 'http://localhost', token, fetcher);
  const second = await uploadPlan(await plan(), 'http://localhost', token, fetcher);
  expect(second.unchanged).toBe(true); expect(second.snapshot).toEqual(first.snapshot);
});
it('enforces the actual stream limit without trusting Content-Length', async () => {
  const response = await app.request('/api/library/ingest', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data; boundary=x' }, body: new Uint8Array(MAX_INGEST_BYTES+1) }, env);
  expect(response.status).toBe(413);
});
