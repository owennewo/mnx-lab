// Implementation loop: saving an edit, over the real route on local D1/R2
// (roadmap/complete/studio-save-pipeline.md, studio authoring campaign item 3).
//
// A checkpoint is another immutable `.gp` rendition that takes the canonical
// pointer — so the service keeps every version — and it is refused unless it
// was edited from what is canonical NOW.
import { beforeEach, expect, it } from 'vitest';
import type { Miniflare } from 'miniflare';
import type { D1Result } from '@cloudflare/workers-types';
import { libraryBindings, useLibraryRuntime } from '../helpers/libraryRuntime.ts';
import app from '../../worker/index.ts';
import type { Env } from '../../worker/env.ts';
import { Library, pieceIdFor } from '../../worker/library/index.ts';
import { testIdentity } from '../helpers/libraryIdentity.ts';
import { LibraryClient, LibraryRequestError, type Checkpoint } from '../../src/storage/libraryClient.ts';
import { buildNewDocument } from '../../src/edit/newDocument.ts';
import { applyOp } from '../../src/edit/ops.ts';
import { parseTuning } from '../../src/edit/setupGrammar.ts';
import { derivedLibraryTags } from '../../src/model/libraryTags.ts';
import { documentTitle, type MnxStructure } from '../../src/model/mnx.ts';
import { exportGuitarProGpif, STORAGE_EXPORT_OPTIONS } from '../../converters/guitarpro-mnx/src/gpif/fromMnx.ts';
import { importGuitarProCleanRoom } from '../../converters/guitarpro-mnx/src/cleanRoom.ts';

let mf: Miniflare; let env: Env; let jwt: string; let identity: Awaited<ReturnType<typeof testIdentity>>;
const blank = () => buildNewDocument({ title: 'Anji', artist: 'Davy Graham', tuning: parseTuning('standard')!, time: { count: 4, unit: 4 }, fifths: 0, bars: 4 });
const retitled = (document: MnxStructure, title: string) => applyOp(document, { type: 'setWork', work: { title } });
type Exportable = Parameters<typeof exportGuitarProGpif>[0];
const file = (document: MnxStructure) => ({ filename: `${documentTitle(document)}.gp`, bytes: exportGuitarProGpif(document as unknown as Exportable, { ...STORAGE_EXPORT_OPTIONS }), producerVersion: '0.3.0+test', producerOptions: { ...STORAGE_EXPORT_OPTIONS } });
const send = (path: string, init: RequestInit = {}, token = jwt) => app.request(`http://localhost/api/library${path}`, { ...init, headers: { 'Cf-Access-Jwt-Assertion': token, ...(init.headers ?? {}) } }, env);
const client = (token = () => jwt) => new LibraryClient((input, init) => {
  const { signal: _signal, ...rest } = init ?? {};
  return app.request(`http://localhost${String(input)}`, { ...rest, headers: { 'Cf-Access-Jwt-Assertion': token(), ...(rest.headers as Record<string, string>) } }, env) as Promise<Response>;
});
const checkpoint = (document: MnxStructure, from: { revision: number; canonical_rendition_id?: string | null }, over: Partial<Checkpoint> = {}): Checkpoint => ({
  expectedRevision: from.revision, derivedFrom: from.canonical_rendition_id!, file: file(document), derivedTags: derivedLibraryTags(document),
  check: { verdict: 'gains', differences: [{ path: 'parts/[]/transposition', kind: 'gained', count: 1 }], warnings: [] }, ...over });
const rows = (sql: string, ...bind: unknown[]): Promise<Record<string, unknown>[]> => env.LIBRARY_DB.prepare(sql).bind(...bind).all<Record<string, unknown>>().then((r: D1Result<Record<string, unknown>>) => r.results);
const status = (promise: Promise<unknown>) => promise.then(() => 200, error => (error instanceof LibraryRequestError ? error.status : -1));

const freshRuntime = useLibraryRuntime({ migrated: true });
beforeEach(async () => {
  identity = await testIdentity(); jwt = await identity.sign();
  mf = await freshRuntime();
  env = { ...(await libraryBindings(mf)), LIBRARY_WRITE_TOKEN: 'private-test', ...identity.config };
  await env.LIBRARY_DB.prepare("INSERT INTO users VALUES ('operator','owner@example.test',1,'now')").run();
}, 15000);

it('keeps every version: a checkpoint is a new edit rendition that takes the pointer, and the tags follow the document', async () => {
  const first = blank();
  const made = (await client().createPiece(file(first), derivedLibraryTags(first))).snapshot;
  const second = retitled(first, 'Angie');
  const saved = await client().saveCheckpoint(made.piece.id, checkpoint(second, made.piece, { name: 'Bert\'s spelling' }));
  expect(saved.unchanged).toBe(false);
  expect(saved.snapshot.piece.revision).toBe(made.piece.revision + 1);
  expect(saved.snapshot.piece.canonical_rendition_id).not.toBe(made.piece.canonical_rendition_id);

  const renditions = await rows('SELECT * FROM renditions WHERE piece_id = ? ORDER BY created_at, role DESC', made.piece.id);
  expect(renditions.map(r => [r.role, r.derived_from, r.producer, r.producer_version])).toEqual([
    ['original', null, 'studio', '0.3.0+test'], ['edit', made.piece.canonical_rendition_id, 'studio', '0.3.0+test']]);
  expect(JSON.parse(String(renditions[1].provenance))).toEqual({ kind: 'checkpoint', name: 'Bert\'s spelling',
    check: { verdict: 'gains', differences: [{ path: 'parts/[]/transposition', kind: 'gained', count: 1 }], warnings: [] }, evidence: null });

  // The pointer names the current one; the one it was edited from is still there, byte for byte.
  const canonical = await client().canonical(made.piece.id);
  expect(canonical.renditionId).toBe(saved.snapshot.piece.canonical_rendition_id);
  expect(documentTitle(importGuitarProCleanRoom(new Uint8Array(canonical.bytes)) as unknown as MnxStructure)).toBe('Angie');
  const original = await send(`/renditions/${made.piece.canonical_rendition_id}`);
  expect(documentTitle(importGuitarProCleanRoom(new Uint8Array(await original.arrayBuffer())) as unknown as MnxStructure)).toBe('Anji');

  // Tags are a projection of the document: the title moved, the artist stayed, nothing doubled.
  const tags = saved.snapshot.tags.map(t => `${t.dimension}:${t.value}`);
  expect(tags).toContain('title:Angie'); expect(tags).not.toContain('title:Anji'); expect(tags).toContain('artist:Davy Graham');
  expect((await client().pieces([], '', 'title')).pieces.map(p => p.title)).toEqual(['Angie']);
});

it('stores nothing when the bytes are already canonical, and a new version when an undo returns to older bytes', async () => {
  const first = blank();
  const made = (await client().createPiece(file(first), derivedLibraryTags(first))).snapshot;
  const same = await client().saveCheckpoint(made.piece.id, checkpoint(first, made.piece));
  expect(same).toMatchObject({ unchanged: true, snapshot: { piece: { revision: made.piece.revision, canonical_rendition_id: made.piece.canonical_rendition_id } } });
  const edited = await client().saveCheckpoint(made.piece.id, checkpoint(retitled(first, 'Angie'), made.piece));
  // Undone, then saved: the same bytes as the original, a different version with a different parent.
  const undone = await client().saveCheckpoint(made.piece.id, checkpoint(first, edited.snapshot.piece));
  expect(undone.unchanged).toBe(false);
  const renditions = await rows('SELECT id, sha256, derived_from FROM renditions WHERE piece_id = ?', made.piece.id);
  expect(renditions).toHaveLength(3);
  expect(new Set(renditions.map(r => r.sha256)).size).toBe(2);
  expect((await env.LIBRARY_BUCKET.list({ prefix: 'renditions/' })).objects).toHaveLength(2);
  expect(renditions.find(r => r.id === undone.snapshot.piece.canonical_rendition_id)?.derived_from).toBe(edited.snapshot.piece.canonical_rendition_id);
});

it('refuses a checkpoint edited from anything but the current canonical, and one at a stale revision', async () => {
  const first = blank();
  const made = (await client().createPiece(file(first), derivedLibraryTags(first))).snapshot;
  const theirs = await client().saveCheckpoint(made.piece.id, checkpoint(retitled(first, 'Saved on the tablet'), made.piece));
  // This device still thinks the original is canonical.
  expect(await status(client().saveCheckpoint(made.piece.id, checkpoint(retitled(first, 'Saved on the desktop'), made.piece)))).toBe(409);
  expect(await status(client().saveCheckpoint(made.piece.id, checkpoint(retitled(first, 'Right base, old revision'), { ...theirs.snapshot.piece, revision: made.piece.revision })))).toBe(409);
  // A tag moved the revision; the base is still right, so the retry on the fresh revision lands.
  const tagged = await client().changeTags(made.piece.id, theirs.snapshot.piece.revision, { add: [{ dimension: 'genre', value: 'folk' }] });
  expect(await status(client().saveCheckpoint(made.piece.id, checkpoint(retitled(first, 'After the tag'), theirs.snapshot.piece)))).toBe(409);
  const retried = await client().saveCheckpoint(made.piece.id, checkpoint(retitled(first, 'After the tag'), { ...theirs.snapshot.piece, revision: tagged.snapshot.piece.revision }));
  expect(retried.snapshot.tags.map(t => `${t.dimension}:${t.value}`)).toEqual(expect.arrayContaining(['title:After the tag', 'genre:folk']));
  expect(await rows('SELECT id FROM renditions WHERE piece_id = ?', made.piece.id)).toHaveLength(3);
});

it('is the owner\'s, is same-origin JSON, and says nothing it was not asked to vouch for', async () => {
  await env.LIBRARY_DB.prepare("INSERT INTO users VALUES ('second','second@example.test',1,'now')").run();
  const first = blank();
  const made = (await client().createPiece(file(first), derivedLibraryTags(first))).snapshot;
  const other = await identity.sign({ email: 'second@example.test' });
  expect(await status(client(() => other).saveCheckpoint(made.piece.id, checkpoint(retitled(first, 'Theirs now'), made.piece)))).toBe(404);
  const good = checkpoint(retitled(first, 'Angie'), made.piece);
  const body = async (change: (b: Record<string, any>) => void) => {
    let captured = ''; const spy = new LibraryClient(async (_input, init) => { captured = String(init?.body); return new Response('{}', { headers: { 'content-type': 'application/json' } }); });
    await spy.saveCheckpoint(made.piece.id, good);
    const parsed = JSON.parse(captured); change(parsed); return JSON.stringify(parsed);
  };
  const post = async (payload: string, headers: Record<string, string> = { 'Content-Type': 'application/json' }) => (await send(`/pieces/${made.piece.id}/renditions`, { method: 'POST', headers, body: payload })).status;
  for (const [what, change] of [
    ['a role', (b: Record<string, any>) => { b.rendition.role = 'original'; }],
    ['a rendition id', (b: Record<string, any>) => { b.id = 'mine'; }],
    ['no revision', (b: Record<string, any>) => { delete b.expected_revision; }],
    ['no base', (b: Record<string, any>) => { delete b.derived_from; }],
    ['a verdict of its own', (b: Record<string, any>) => { b.check.verdict = 'perfect'; }],
    ['a difference without a count', (b: Record<string, any>) => { b.check.differences = [{ path: 'x', kind: 'lost' }]; }],
    ['an endless name', (b: Record<string, any>) => { b.name = 'x'.repeat(121); }],
    ['no title', (b: Record<string, any>) => { b.derived_tags = []; }],
    ['not a Guitar Pro file', (b: Record<string, any>) => { b.rendition.content = Buffer.from('{}').toString('base64'); }]
  ] as const) expect(await post(await body(change)), what).toBe(400);
  expect(await rows('SELECT id FROM renditions WHERE piece_id = ?', made.piece.id)).toHaveLength(1);
  expect(await post(await body(() => {}))).toBe(201);
});

it('an ingest after a Studio edit adds what Soundslice exported and moves neither the pointer nor the projection', async () => {
  const lib = new Library(env.LIBRARY_DB, env.LIBRARY_BUCKET);
  const first = blank(); const gp = file(first).bytes;
  const id = await pieceIdFor('soundslice', 'Edited1');
  await lib.writePiece('operator', { id, expected_revision: null, source: { kind: 'soundslice', id: 'Edited1' },
    renditions: [{ id: 'Edited1-gp', format: 'gp', role: 'export', producer: 'soundslice-exporter', producer_version: null, producer_options: null, content: gp.buffer as ArrayBuffer, fetched_at: '2026-09-01T00:00:00Z' }],
    canonical: { mode: 'initialize', rendition_id: 'Edited1-gp' }, derived_tags: [{ dimension: 'title', value: 'Sidecar title', source_ref: 'sidecar' }] });
  const before = (await client().piece(id)).snapshot;
  const edited = await client().saveCheckpoint(id, checkpoint(retitled(first, 'My title'), before.piece));

  // The exporter allocates its own ArrayBuffer; nothing here is shared memory.
  const refetched = file(retitled(first, 'Soundslice changed it')).bytes as Uint8Array<ArrayBuffer>;
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', refetched)), b => b.toString(16).padStart(2, '0')).join('');
  const form = new FormData();
  form.set('manifest', JSON.stringify({ expected_revision: edited.snapshot.piece.revision, source: { kind: 'soundslice', id: 'Edited1' },
    renditions: [{ id: 'Edited1-gp-2', format: 'gp', role: 'export', producer: 'soundslice-exporter', producer_version: null, producer_options: null, file: 'score', sha256, fetched_at: '2026-09-17T00:00:00Z' }],
    recordings: [], tags: [], derived_tags: [{ dimension: 'title', value: 'Sidecar title', source_ref: 'sidecar' }], canonical: { mode: 'initialize', rendition_id: 'Edited1-gp-2' } }));
  form.set('score', new Blob([refetched]), 'Edited1.gp');
  const ingest = await send('/ingest', { method: 'POST', body: form, headers: { Authorization: 'Bearer private-test' } }, await identity.sign({}, true));
  expect(ingest.status).toBe(200);
  const after = (await client().piece(id)).snapshot;
  expect(after.piece.canonical_rendition_id).toBe(edited.snapshot.piece.canonical_rendition_id);
  expect(after.tags.filter(t => t.dimension === 'title').map(t => t.value)).toEqual(['My title']);
  expect(await rows('SELECT id FROM renditions WHERE piece_id = ?', id)).toHaveLength(3);
});

