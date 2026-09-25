// Implementation loop: authenticated HTTP boundary and cache import contract.
import { beforeEach, afterEach, expect, it } from 'vitest';
import { writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Miniflare } from 'miniflare';
import { applyMigrations, useLibraryRuntime } from '../helpers/libraryRuntime.ts';
import realApp from '../../worker/index.ts';
import { testIdentity } from '../helpers/libraryIdentity.ts';
import { ingestSources } from '../helpers/ingestFixture.ts';
let assertion = '';
const app = { request: (url: string, init?: RequestInit, bindings?: Parameters<typeof realApp.request>[2]) => realApp.request(url, { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), 'Cf-Access-Jwt-Assertion': assertion } }, bindings) };
import { Library } from '../../worker/library/index.ts';
import type { Env } from '../../worker/env.ts';
import { INGEST_OWNER, MAX_INGEST_BYTES } from '../../worker/api/library.ts';
import { pieceIdFor } from '../../worker/library/index.ts';
// Operator scripts are deliberately JavaScript and excluded from the app build.
// @ts-expect-error No declaration file for the Node operator tool.
import { planIngest, uploadPlan, endpointURL, validateConversion, recordingAuditRows } from '../../tools/library-ingest.mjs';
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
const fetcher = (input: RequestInfo | URL, init?: RequestInit) => app.request(String(input), init, env);
const plan = async () => (await planIngest(directory))[0];
const upload = (p: Awaited<ReturnType<typeof plan>>, options: object = { converters }) => uploadPlan(p, 'http://localhost', token, fetcher, {}, options);
async function form(manifest: object, files: Map<string, Uint8Array<ArrayBuffer>>) {
  const f = new FormData(); f.set('manifest', JSON.stringify(manifest));
  for (const [key, value] of files) f.set(key, new Blob([value]), key);
  return f;
}
const freshRuntime = useLibraryRuntime();
beforeEach(async () => {
  directory = await ingestSources();
  mf = await freshRuntime();
  env = { LIBRARY_DB: await mf.getD1Database('DB'), LIBRARY_BUCKET: await mf.getR2Bucket('BUCKET'), LIBRARY_WRITE_TOKEN: token };
  const identity = await testIdentity(); Object.assign(env, identity.config); assertion = await identity.sign({}, true);
  await applyMigrations(env.LIBRARY_DB);
  await env.LIBRARY_DB.prepare("INSERT INTO users VALUES ('operator','owner@example.test',1,'now')").run();
}, 15000);
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

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
  const audio = first.snapshot.recordings.find((r: {kind: string}) => r.kind === 'audio');
  expect(audio.duration_s).toBeNull();
  expect(JSON.parse(audio.provenance)).toEqual({ crop_end: 11, crop_start: 1, cropped_duration: 10, source: 'soundslice-sync-wrapper' });
  expect(recordingAuditRows(p, new Map([['2', 12]]))).toContainEqual({ recording: '2', first_anchor_s: 0,
    last_anchor_s: 0, cropped_duration_s: 10, decoded_duration_s: 12,
    genuine_media_overrun: false, clears_mislabelled_duration: true });
  expect(recordingAuditRows({ recordingAudits: [{ source_id: 'over', syncpoints: [[0, 2], [1, 7]],
    cropped_duration: null, mediaPath: null }] }, new Map([['over', 6]]))[0].genuine_media_overrun).toBe(true);
  expect(first.snapshot.renditions.find((r: {id: string}) => r.id === first.snapshot.piece.canonical_rendition_id).format).toBe('gp');
  expect(first.validation.report.map((e: {valid: boolean}) => e.valid)).toEqual([true, true]);
  expect(first.snapshot.tags.map((t: {dimension: string; value: string; origin: string; source_ref: string}) => `${t.dimension}:${t.value}:${t.origin}:${t.source_ref}`)).toEqual([
    'artist:Sidecar artist:derived:sidecar', 'capo:3:derived:guitarpro-mnx@test-version', 'list:Folder / List:asserted:L1', 'title:Sidecar song:derived:sidecar']);
  let posts = 0;
  const second = await uploadPlan(p, 'http://localhost', token, (input: RequestInfo | URL, init?: RequestInit) => { if (init?.method === 'POST') posts++; return fetcher(input, init); }, {}, { converters });
  expect(second.status).toBe('skipped'); expect(posts).toBe(0); expect(second.snapshot).toEqual(first.snapshot);
  expect(second.validation).toBeNull();
});
it('re-validates and refreshes only the projection when the converter version changes, moving no bytes', async () => {
  const p = await plan(); await upload(p);
  const next = Object.fromEntries(Object.entries(converters).map(([k, v]) => [k, { ...v, version: 'v2', convert: () => { const d = v.convert(); Object.assign(d.parts[0], { _x: { mnxLab: { capo: 5 } } }); return d; } }]));
  const files: string[] = [];
  const result = await uploadPlan(p, 'http://localhost', token, async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'POST') for (const key of (init.body as FormData).keys()) files.push(key);
    return fetcher(input, init);
  }, {}, { converters: next });
  expect(result.status).toBe('stored'); expect(files).toEqual(['manifest']);
  expect(result.snapshot.tags.filter((t: {dimension: string}) => t.dimension === 'capo').map((t: {value: string; source_ref: string}) => `${t.value}:${t.source_ref}`)).toEqual(['5:guitarpro-mnx@v2']);
  expect(result.snapshot.renditions).toHaveLength(2);
});
it('repairs a historical cropped duration claim on normal re-ingest without replacing media', async () => {
  const p = await plan(); const first = await upload(p);
  const audio = first.snapshot.recordings.find((r: {kind: string}) => r.kind === 'audio');
  await env.LIBRARY_DB.prepare('UPDATE recordings SET duration_s=10,provenance=NULL WHERE id=?').bind(audio.id).run();
  const repaired = await upload(await plan());
  expect(repaired.status).toBe('stored');
  const row = repaired.snapshot.recordings.find((r: {id: string}) => r.id === audio.id);
  expect(row.duration_s).toBeNull();
  expect(JSON.parse(row.provenance)).toMatchObject({ cropped_duration: 10, crop_start: 1, crop_end: 11 });
  expect(row.sha256).toBe(audio.sha256); expect(row.r2_key).toBe(audio.r2_key);
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
it('follows a refetched Soundslice .gp forward, never back to an older one', async () => {
  const first = await upload(await plan());
  const sidecar = async (gp: string, fetched_at: string) => {
    await writeFile(join(directory, 'Song_ABC.gp'), gp);
    const path = join(directory, 'Song_ABC.sync.json');
    await writeFile(path, JSON.stringify({ ...JSON.parse(await readFile(path, 'utf8')), fetched_at }));
    return plan();
  };
  const newer = await sidecar('refetched GP with sections', '2026-09-13');
  const moved = await upload(newer);
  expect(moved.status).toBe('stored');
  expect(moved.snapshot.piece.canonical_rendition_id).toBe(newer.canonicalId);
  expect(moved.snapshot.renditions.map((r: {id: string}) => r.id)).toContain(first.snapshot.piece.canonical_rendition_id);
  // Already stored but not yet canonical (a run before the pointer followed): the tool does not skip it.
  const lib = new Library(env.LIBRARY_DB, env.LIBRARY_BUCKET);
  await lib.writePiece(INGEST_OWNER, { id: moved.snapshot.piece.id, expected_revision: moved.snapshot.piece.revision, canonical: { mode: 'replace', rendition_id: first.snapshot.piece.canonical_rendition_id } });
  const caught = await upload(newer);
  expect(caught.status).toBe('stored'); expect(caught.snapshot.piece.canonical_rendition_id).toBe(newer.canonicalId);
  // A replayed older cache stores its bytes but leaves the pointer where it is.
  const older = await sidecar('an older GP export', '2026-09-12');
  const kept = await upload(older);
  expect(kept.snapshot.renditions.map((r: {id: string}) => r.id)).toContain(older.canonicalId);
  expect(kept.snapshot.piece.canonical_rendition_id).toBe(newer.canonicalId);
  expect((await upload(older)).status).toBe('skipped');
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

it('derives distinct canonical part labels, filters each value, and preserves cleanup aliases on refresh', async () => {
  const named = (names: string[]) => {
    const doc = structuredClone(score);
    doc.parts = names.map(name => ({ ...structuredClone(doc.parts[0]), name }));
    return doc;
  };
  const withParts = {
    ...converters,
    'guitarpro-mnx': { ...converters['guitarpro-mnx'], convert: () => named(['Guitar', 'Guitar', 'Ukulele', 'Track 1', 'unknown']) },
    'musicxml-mnx': { ...converters['musicxml-mnx'], convert: () => named(['Wrong source']) }
  };
  const p = await plan();
  const first = await upload(p, { converters: withParts });
  const partTags = first.snapshot.tags.filter((t: {dimension: string}) => t.dimension === 'part');
  expect(partTags.map((t: {value: string}) => t.value)).toEqual(['Guitar', 'Track 1', 'Ukulele', 'unknown']);
  expect(partTags.every((t: {origin: string; source_ref: string}) => t.origin === 'derived' && t.source_ref === 'guitarpro-mnx@test-version')).toBe(true);
  const lib = new Library(env.LIBRARY_DB, env.LIBRARY_BUCKET);
  for (const value of ['Guitar', 'Ukulele']) {
    expect((await lib.facets(INGEST_OWNER, [`part:${value}`])).total).toBe(1);
  }
  expect((await lib.facets(INGEST_OWNER, [])).facets.filter(f => f.dimension === 'part').every(f => f.pieces === 1)).toBe(true);
  await lib.setAlias(INGEST_OWNER, 'part', 'Track 1', 'Guitar');
  expect((await lib.facets(INGEST_OWNER, [])).facets.find(f => f.dimension === 'part' && f.value === 'Guitar')?.pieces).toBe(1);
  expect((await lib.facets(INGEST_OWNER, ['part:Track 1'])).total).toBe(0);
  await upload(p, { converters: withParts, force: true });
  expect((await lib.listAliases(INGEST_OWNER)).some(a => a.dimension === 'part' && a.raw_value === 'Track 1' && a.canonical_value === 'Guitar')).toBe(true);
});

it.each([87.5, 36.5])('warns for %s BPM without rounding or blocking derived tags', async bpm => {
  const doc = structuredClone(score);
  Object.assign(doc.global.measures[0], { tempos: [{ bpm, value: { base: 'quarter' } }] });
  Object.assign(doc.parts[0], { name: 'Guitar', _x: { mnxLab: { capo: 3 } } });
  const before = structuredClone(doc);
  const fractional = { ...converters, 'guitarpro-mnx': { ...converters['guitarpro-mnx'], convert: () => doc } };
  const result = await upload(await plan(), { converters: fractional });
  const report = result.validation.report.find((r: {producer: string}) => r.producer === 'guitarpro-mnx');
  expect(report.valid).toBe(true);
  expect(report.errors).toEqual([]);
  expect(report.warnings).toEqual([`/global/measures/0/tempos/0/bpm fractional tempo ${bpm} BPM retained; published MNX requires integer BPM`]);
  expect(result.snapshot.tags).toEqual(expect.arrayContaining([
    expect.objectContaining({ dimension: 'part', value: 'Guitar', origin: 'derived' }),
    expect.objectContaining({ dimension: 'capo', value: '3', origin: 'derived' })
  ]));
  expect(doc).toEqual(before);
});
it('keeps unrelated validation errors blocking alongside a fractional-tempo warning', async () => {
  const doc = structuredClone(score);
  Object.assign(doc.global.measures[0], { tempos: [{ bpm: 87.5, value: { base: 'quarter' } }] });
  Object.assign(doc.parts[0], { name: 'Guitar', measures: 'invalid' });
  const broken = { ...converters, 'guitarpro-mnx': { ...converters['guitarpro-mnx'], convert: () => doc } };
  const result = await upload(await plan(), { converters: broken });
  const report = result.validation.report.find((r: {producer: string}) => r.producer === 'guitarpro-mnx');
  expect(report.valid).toBe(false);
  expect(report.errors.join(' ')).toContain('/parts/0/measures');
  expect(report.warnings).toHaveLength(1);
  expect(result.snapshot.tags.some((t: {dimension: string}) => t.dimension === 'part')).toBe(false);
});
