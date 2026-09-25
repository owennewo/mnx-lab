// Implementation loop: a piece's life in Studio, over the real routes on local D1/R2
// (roadmap/complete/studio-piece-lifecycle.md, studio authoring campaign item 5):
// deleting that removes nothing, going back to a version by moving the pointer,
// and the defect report a lossy save leaves for the operator. The tests make dozens
// of requests each through Miniflare, so they are given room for a loaded full run.
import { beforeEach, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import type { Miniflare } from 'miniflare';
import type { D1Result } from '@cloudflare/workers-types';
import { useLibraryRuntime } from '../helpers/libraryRuntime.ts';
import app from '../../worker/index.ts';
import type { Env } from '../../worker/env.ts';
import { Library, pieceIdFor } from '../../worker/library/index.ts';
import { testIdentity } from '../helpers/libraryIdentity.ts';
import { LibraryClient, LibraryRequestError, type Checkpoint, type ProjectedTag } from '../../src/storage/libraryClient.ts';
import { buildNewDocument } from '../../src/edit/newDocument.ts';
import { applyOp } from '../../src/edit/ops.ts';
import { parseTuning } from '../../src/edit/setupGrammar.ts';
import { derivedLibraryTags } from '../../src/model/libraryTags.ts';
import { projectPieceTags } from '../../src/storage/pieceSaveContext.ts';
import { checkStorage } from '../../src/importers/storageCheckCore.ts';
import { documentTitle, type MnxStructure } from '../../src/model/mnx.ts';
import { importGuitarProCleanRoom } from '../../converters/guitarpro-mnx/src/cleanRoom.ts';
// @ts-expect-error No declaration file for the Node operator tool.
import { defectRows } from '../../tools/library-defects.mjs';

let mf: Miniflare; let env: Env; let jwt: string; let identity: Awaited<ReturnType<typeof testIdentity>>;
const blank = (title = 'Anji') => buildNewDocument({ title, artist: 'Davy Graham', tuning: parseTuning('standard')!, time: { count: 4, unit: 4 }, fifths: 0, bars: 4 });
const retitled = (document: MnxStructure, title: string) => applyOp(document, { type: 'setWork', work: { title } });
const file = (document: MnxStructure) => { const { bytes, options } = checkStorage(document); return { filename: `${documentTitle(document)}.gp`, bytes, producerVersion: '0.3.0+test', producerOptions: options }; };
const send = (path: string, init: RequestInit = {}, token = jwt) => app.request(`http://localhost/api/library${path}`, { ...init, headers: { 'Cf-Access-Jwt-Assertion': token, ...(init.headers ?? {}) } }, env);
const client = (token = () => jwt) => new LibraryClient((input, init) => {
  const { signal: _signal, ...rest } = init ?? {};
  return app.request(`http://localhost${String(input)}`, { ...rest, headers: { 'Cf-Access-Jwt-Assertion': token(), ...(rest.headers as Record<string, string>) } }, env) as Promise<Response>;
});
const make = async (document = blank()) => (await client().createPiece(file(document), derivedLibraryTags(document))).snapshot;
const checkpoint = (document: MnxStructure, from: { revision: number; canonical_rendition_id?: string | null }, over: Partial<Checkpoint> = {}): Checkpoint => {
  const { check } = checkStorage(document);
  return { expectedRevision: from.revision, derivedFrom: from.canonical_rendition_id!, file: file(document), derivedTags: derivedLibraryTags(document), check, ...over };
};
const status = (promise: Promise<unknown>) => promise.then(() => 200, error => (error instanceof LibraryRequestError ? error.status : -1));
const count = async (table: string) => (await env.LIBRARY_DB.prepare(`SELECT count(*) AS n FROM ${table}`).first<{ n: number }>())!.n;
const titleOf = (bytes: ArrayBuffer) => documentTitle(importGuitarProCleanRoom(new Uint8Array(bytes)) as unknown as MnxStructure);

const freshRuntime = useLibraryRuntime();
beforeEach(async () => {
  identity = await testIdentity(); jwt = await identity.sign();
  mf = await freshRuntime();
  env = { LIBRARY_DB: await mf.getD1Database('DB'), LIBRARY_BUCKET: await mf.getR2Bucket('BUCKET'), LIBRARY_WRITE_TOKEN: 'private-test', ...identity.config };
  for (const name of ['0001_library', '0002_users', '0003_piece_views', '0004_recording_management', '0005_piece_lifecycle', '0006_piece_prefs']) {
    const sql = (await readFile(new URL(`../../migrations/${name}.sql`, import.meta.url), 'utf8')).replace(/--[^\n]*/g, '').trim();
    await env.LIBRARY_DB.batch(sql.split(/;\s*(?=(?:CREATE|ALTER)\b)/).map(s => env.LIBRARY_DB.prepare(s)));
  }
  await env.LIBRARY_DB.prepare("INSERT INTO users VALUES ('operator','owner@example.test',1,'now')").run();
}, 15000);

it('deleting hides a piece from every read and removes nothing; restoring brings all of it back', async () => {
  const kept = await make(blank('Kept'));
  const gone = await make(blank('Gone'));
  await client().changeTags(gone.piece.id, gone.piece.revision, { add: [{ dimension: 'genre', value: 'folk' }] });
  await client().setAlias('artist', 'Davy Graham', 'Davey Graham');
  const before = { pieces: await count('pieces'), renditions: await count('renditions'), tags: await count('tags'), blobs: (await env.LIBRARY_BUCKET.list()).objects.length };

  expect(await status(client().deletePiece(gone.piece.id, gone.piece.revision))).toBe(409);      // the tag moved the revision
  await client().deletePiece(gone.piece.id, gone.piece.revision + 1);
  expect({ pieces: await count('pieces'), renditions: await count('renditions'), tags: await count('tags'), blobs: (await env.LIBRARY_BUCKET.list()).objects.length }).toEqual(before);

  expect((await client().pieces([], '', 'title')).pieces.map(p => p.title)).toEqual(['Kept']);
  expect((await client().facets([])).total).toBe(1);
  expect((await client().facets([])).facets.some(f => f.dimension === 'genre')).toBe(false);
  expect((await client().tags('genre')).tags).toEqual([]);
  expect((await client().aliases()).aliases.map(a => a.pieces)).toEqual([1]);
  for (const path of [`/pieces/${gone.piece.id}`, `/pieces/${gone.piece.id}/canonical`, `/renditions/${gone.piece.canonical_rendition_id}`])
    expect((await send(path)).status, path).toBe(404);
  // No write reaches it either: not a tag, not a recording, not a save, not a second delete.
  expect(await status(client().changeTags(gone.piece.id, gone.piece.revision + 2, { add: [{ dimension: 'genre', value: 'blues' }] }))).toBe(404);
  expect(await status(client().saveRecording(gone.piece.id, `studio-${crypto.randomUUID()}`, gone.piece.revision + 2, { name: 'Live', video: 'https://youtu.be/M7lc1UVf-VE', rawSync: null }))).toBe(404);
  expect(await status(client().saveCheckpoint(gone.piece.id, checkpoint(retitled(blank('Gone'), 'Back?'), { ...gone.piece, revision: gone.piece.revision + 2 })))).toBe(404);
  expect(await status(client().deletePiece(gone.piece.id, gone.piece.revision + 2))).toBe(404);

  const listed = (await client().deleted()).pieces;
  expect(listed).toMatchObject([{ id: gone.piece.id, title: 'Gone', artist: 'Davey Graham' }]);
  expect(Date.parse(listed[0].deleted_at)).not.toBeNaN();

  const restored = await client().restorePiece(gone.piece.id);
  expect(restored.snapshot.tags.map(t => `${t.dimension}:${t.value}`)).toEqual(expect.arrayContaining(['title:Gone', 'genre:folk']));
  expect((await client().pieces([], '', 'title')).pieces.map(p => p.title)).toEqual(['Gone', 'Kept']);
  expect((await client().deleted()).pieces).toEqual([]);
  expect(titleOf((await client().canonical(gone.piece.id)).bytes)).toBe('Gone');
  expect(await status(client().restorePiece(gone.piece.id))).toBe(409);
  expect(await status(client().restorePiece(kept.piece.id))).toBe(409);
}, 30_000);

it('a deleted piece is its owner\'s to restore, and an ingest of its slice neither collides with it nor revives it', async () => {
  await env.LIBRARY_DB.prepare("INSERT INTO users VALUES ('second','second@example.test',1,'now')").run();
  const mine = await make();
  await client().deletePiece(mine.piece.id, mine.piece.revision);
  const other = await identity.sign({ email: 'second@example.test' });
  expect((await client(() => other).deleted()).pieces).toEqual([]);
  expect(await status(client(() => other).restorePiece(mine.piece.id))).toBe(404);

  const lib = new Library(env.LIBRARY_DB, env.LIBRARY_BUCKET);
  const id = await pieceIdFor('soundslice', 'Deleted1');
  const gp = file(blank('From Soundslice')).bytes;
  const slice = await lib.writePiece('operator', { id, expected_revision: null, source: { kind: 'soundslice', id: 'Deleted1' },
    renditions: [{ id: 'Deleted1-gp', format: 'gp', role: 'export', producer: 'soundslice-exporter', producer_version: null, producer_options: null, content: gp.buffer as ArrayBuffer }],
    canonical: { mode: 'initialize', rendition_id: 'Deleted1-gp' }, derived_tags: [{ dimension: 'title', value: 'From Soundslice', source_ref: 'sidecar' }] });
  await client().deletePiece(id, slice.piece.revision);
  const machine = { Authorization: 'Bearer private-test' }; const token = await identity.sign({}, true);
  expect((await (await send('/ingest/Deleted1', { headers: machine }, token)).json()).snapshot).toBeNull();
  await expect(lib.writePiece('operator', { id, expected_revision: null, source: { kind: 'soundslice', id: 'Deleted1' } })).rejects.toThrow('deleted in Studio');
  expect((await client().deleted()).pieces.map(p => p.title).sort()).toEqual(['Anji', 'From Soundslice']);
}, 30_000);

it('going back to a version moves the pointer and the projection, writes nothing, and can itself be undone', async () => {
  const first = blank();
  const made = await make(first);
  const second = await client().saveCheckpoint(made.piece.id, checkpoint(retitled(first, 'Angie'), made.piece, { name: 'Bert\'s spelling' }));
  const versions = (await client().piece(made.piece.id)).snapshot.renditions!;
  expect(versions.map(v => [v.role, v.derived_from === null])).toEqual(expect.arrayContaining([['original', true], ['edit', false]]));
  const blobs = (await env.LIBRARY_BUCKET.list()).objects.length;

  // Open the older version the way the page does, and send the projection read off it.
  const older = importGuitarProCleanRoom(new Uint8Array(await client().rendition(made.piece.canonical_rendition_id!))) as unknown as MnxStructure;
  expect(documentTitle(older)).toBe('Anji');
  const back = await client().revertTo(made.piece.id, second.snapshot.piece.revision, second.snapshot.piece.canonical_rendition_id!, made.piece.canonical_rendition_id!, derivedLibraryTags(older));
  expect(back.snapshot.piece).toMatchObject({ canonical_rendition_id: made.piece.canonical_rendition_id, revision: second.snapshot.piece.revision + 1 });
  expect(back.snapshot.tags.filter(t => t.dimension === 'title').map(t => t.value)).toEqual(['Anji']);
  expect(await count('renditions')).toBe(2);
  expect((await env.LIBRARY_BUCKET.list()).objects.length).toBe(blobs);
  expect(titleOf((await client().canonical(made.piece.id)).bytes)).toBe('Anji');

  // Undo the revert: the version left behind is still there. And the next edit is edited FROM where the pointer is.
  const newer = importGuitarProCleanRoom(new Uint8Array(await client().rendition(second.snapshot.piece.canonical_rendition_id!))) as unknown as MnxStructure;
  const forward = await client().revertTo(made.piece.id, back.snapshot.piece.revision, made.piece.canonical_rendition_id!, second.snapshot.piece.canonical_rendition_id!, derivedLibraryTags(newer));
  expect(forward.snapshot.tags.filter(t => t.dimension === 'title').map(t => t.value)).toEqual(['Angie']);
  const third = await client().saveCheckpoint(made.piece.id, checkpoint(retitled(newer, 'Angi'), forward.snapshot.piece));
  const parent = (await env.LIBRARY_DB.prepare('SELECT derived_from FROM renditions WHERE id=?').bind(third.snapshot.piece.canonical_rendition_id).first<{ derived_from: string }>())!.derived_from;
  expect(parent).toBe(second.snapshot.piece.canonical_rendition_id);

  // Refused: a stale belief about what is canonical, a stale revision, a version of another piece, and no title.
  const elsewhere = await make(blank('Elsewhere'));
  const now = third.snapshot.piece; const tags = derivedLibraryTags(older);
  expect(await status(client().revertTo(made.piece.id, now.revision, made.piece.canonical_rendition_id!, made.piece.canonical_rendition_id!, tags))).toBe(409);
  expect(await status(client().revertTo(made.piece.id, now.revision - 1, now.canonical_rendition_id!, made.piece.canonical_rendition_id!, tags))).toBe(409);
  expect(await status(client().revertTo(made.piece.id, now.revision, now.canonical_rendition_id!, elsewhere.piece.canonical_rendition_id!, tags))).toBe(400);
  expect(await status(client().revertTo(made.piece.id, now.revision, now.canonical_rendition_id!, made.piece.canonical_rendition_id!, []))).toBe(400);
}, 30_000);

it('a save that lost something leaves a defect report the operator can pull, and evidence never costs the owner the save', async () => {
  const made = await make();
  // `source` and an arranger credit have no field in a Guitar Pro header: a real, warned loss.
  const lossy = applyOp(retitled(blank(), 'Angie'), { type: 'setWork', work: { source: 'a bootleg', creators: [{ role: 'arranger', name: 'Bert Jansch' }] } });
  expect(checkStorage(lossy).check.verdict).toBe('differs');
  const saved = await client().saveCheckpoint(made.piece.id, checkpoint(lossy, made.piece, { evidence: JSON.stringify(lossy) }));
  const rows: D1Result<Record<string, string>> = await env.LIBRARY_DB.prepare('SELECT id, role, format, derived_from, provenance FROM renditions WHERE piece_id=? ORDER BY created_at, role').bind(made.piece.id).all<Record<string, string>>();
  const evidence = rows.results.find(r => r.role === 'evidence')!;
  expect(evidence).toMatchObject({ format: 'mnx', derived_from: saved.snapshot.piece.canonical_rendition_id });
  expect(JSON.parse(rows.results.find(r => r.id === saved.snapshot.piece.canonical_rendition_id)!.provenance).evidence).toBe('kept');
  // Evidence is never a version: not canonical, not something to go back to.
  expect(await status(client().revertTo(made.piece.id, saved.snapshot.piece.revision, saved.snapshot.piece.canonical_rendition_id!, evidence.id, derivedLibraryTags(lossy)))).toBe(400);

  // Evidence that is not valid MNX, or too big, is noted and dropped; the save stands.
  const again = await client().saveCheckpoint(made.piece.id, checkpoint(retitled(lossy, 'Angi'), saved.snapshot.piece, { evidence: '{"not":"mnx"}' }));
  expect(again.unchanged).toBe(false);
  const big = await client().saveCheckpoint(made.piece.id, checkpoint(retitled(lossy, 'Anjy'), again.snapshot.piece, { evidence: JSON.stringify({ pad: 'x'.repeat(1024 * 1024) }) }));
  const notes = (await env.LIBRARY_DB.prepare("SELECT json_extract(provenance,'$.evidence') AS note FROM renditions WHERE piece_id=? AND role='edit' ORDER BY created_at").bind(made.piece.id).all<{ note: string }>() as D1Result<{ note: string }>).results.map(r => r.note);
  expect(notes).toEqual(['kept', 'invalid', 'too-large']);
  expect(titleOf((await client().canonical(made.piece.id)).bytes)).toBe('Anjy');
  expect(big.snapshot.renditions!.filter(r => r.role === 'evidence')).toHaveLength(1);

  // The operator's listing: machine credentials only, newest first, the losses named, the bytes reachable.
  expect((await send('/ingest/studio/defects')).status).toBe(401);
  const machine = { Authorization: 'Bearer private-test' }; const token = await identity.sign({}, true);
  const { defects } = await (await send('/ingest/studio/defects', { headers: machine }, token)).json();
  expect(defects).toHaveLength(3);
  const listed = defectRows(defects);
  expect(listed.map((r: { evidence: string }) => r.evidence)).toEqual(['too-large', 'invalid', 'kept']);
  expect(listed[2].lost.sort()).toEqual(['lost 1x _x/mnxLab/work/creators', 'lost 1x _x/mnxLab/work/source']);
  expect(listed[2].warned.join(' ')).toContain('arranger');
  const pulled = await send(`/ingest/studio/renditions/${defects[2].evidence_id}`, { headers: machine }, token);
  expect(pulled.headers.get('x-library-format')).toBe('mnx');
  expect(JSON.parse(await pulled.text())._x.mnxLab.work.source).toBe('a bootleg');
  // A clean save is not a defect.
  const clean = await make(blank('Clean'));
  await client().saveCheckpoint(clean.piece.id, checkpoint(retitled(blank('Clean'), 'Cleaner'), clean.piece));
  expect((await (await send('/ingest/studio/defects', { headers: machine }, token)).json()).defects).toHaveLength(3);
}, 30_000);

it('keeps a sidecar\'s title as the sidecar\'s, and lets the document clear what Studio itself projected', async () => {
  // A Soundslice piece: title and artist in the sidecar, neither in the .gp.
  const lib = new Library(env.LIBRARY_DB, env.LIBRARY_BUCKET);
  const untitled = applyOp(blank(), { type: 'setWork', work: { title: null, artist: null } });
  const id = await pieceIdFor('soundslice', 'Sidecar1');
  const slice = await lib.writePiece('operator', { id, expected_revision: null, source: { kind: 'soundslice', id: 'Sidecar1' },
    renditions: [{ id: 'Sidecar1-gp', format: 'gp', role: 'export', producer: 'soundslice-exporter', producer_version: null, producer_options: null, content: file(untitled).bytes.buffer as ArrayBuffer }],
    canonical: { mode: 'initialize', rendition_id: 'Sidecar1-gp' },
    derived_tags: [{ dimension: 'title', value: 'Sidecar title', source_ref: 'sidecar' }, { dimension: 'artist', value: 'Sidecar artist', source_ref: 'sidecar' }] });
  const kept = [{ dimension: 'title', value: 'Sidecar title', kept: true as const }, { dimension: 'artist', value: 'Sidecar artist', kept: true as const }];
  const sources = async () => Object.fromEntries((await env.LIBRARY_DB.prepare("SELECT dimension, value, source_ref FROM tags WHERE piece_id=? AND origin='derived' AND dimension IN ('title','artist','subtitle')").bind(id).all<Record<string, string>>() as D1Result<Record<string, string>>).results.map(t => [t.dimension, `${t.value} ← ${t.source_ref}`]));

  // Two saves that never touch the title: it stays the sidecar's both times (the second save is the one a restated tag would have broken).
  const subtitled = applyOp(untitled, { type: 'setWork', work: { subtitle: 'first' } });
  const one = await client().saveCheckpoint(id, checkpoint(subtitled, slice.piece, { derivedTags: [...derivedLibraryTags(subtitled), ...kept] }));
  const again = applyOp(subtitled, { type: 'setWork', work: { subtitle: 'second' } });
  const two = await client().saveCheckpoint(id, checkpoint(again, one.snapshot.piece, { derivedTags: [...derivedLibraryTags(again), ...kept] }));
  expect(await sources()).toEqual({ title: 'Sidecar title ← sidecar', artist: 'Sidecar artist ← sidecar', subtitle: 'second ← studio@0.3.0+test' });

  // The document takes a title of its own: now it is the document's, and clearing the artist it then gave clears the tag.
  const titled = applyOp(again, { type: 'setWork', work: { title: 'My title', artist: 'My artist' } });
  const three = await client().saveCheckpoint(id, checkpoint(titled, two.snapshot.piece));
  const cleared = applyOp(titled, { type: 'setWork', work: { artist: null } });
  await client().saveCheckpoint(id, checkpoint(cleared, three.snapshot.piece));
  expect(await sources()).toEqual({ title: 'My title ← studio@0.3.0+test', subtitle: 'second ← studio@0.3.0+test' });

  // `kept` vouches for nothing new: it must already be the library's, and a new piece has nothing to keep.
  const now = (await client().piece(id)).snapshot.piece;
  expect(await status(client().saveCheckpoint(id, checkpoint(applyOp(cleared, { type: 'setWork', work: { subtitle: 'third' } }), now, { derivedTags: [{ dimension: 'title', value: 'Invented', kept: true }] })))).toBe(400);
  const forged: ProjectedTag[] = [{ dimension: 'title', value: 'Anji', kept: true }];
  expect(await status(client().createPiece(file(blank()), forged))).toBe(400);
}, 30_000);


it('names an untitled version in the library without changing its bytes, and keeps that name on save', async () => {
  const untitled = blank(); delete untitled._x!.mnxLab!.work!.title;
  const made = (await client().createPiece(file(untitled), [{ dimension: 'title', value: 'Old library title' }])).snapshot;
  const id = made.piece.canonical_rendition_id!;
  const original = await client().rendition(id);
  const request = (title: unknown, revision = made.piece.revision, tags: unknown[] = []) => send(`/pieces/${made.piece.id}/canonical`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expected_revision: revision, from: id, rendition_id: id, derived_tags: tags, library_title: title })
  });
  expect((await request('   ')).status).toBe(400);
  expect((await request('New title', made.piece.revision, [{ dimension: 'title', value: 'Source title' }])).status).toBe(400);
  const response = await request('  New title  ');
  expect(response.status).toBe(200);
  expect((await request('Stale title', made.piece.revision)).status).toBe(409);
  const { snapshot } = await response.json() as { snapshot: Awaited<ReturnType<typeof make>> };
  expect(snapshot.tags.find(t => t.dimension === 'title')).toMatchObject({ value: 'New title', source_ref: 'library-title' });
  expect(new Uint8Array(await client().rendition(id))).toEqual(new Uint8Array(original));
  const tags = projectPieceTags(untitled, snapshot.tags);
  expect(tags).toContainEqual({ dimension: 'title', value: 'New title', kept: true });
  const saved = await client().saveCheckpoint(made.piece.id, checkpoint(untitled, snapshot.piece, { derivedTags: tags }));
  expect(saved.snapshot.tags.find(t => t.dimension === 'title')).toMatchObject({ value: 'New title', source_ref: 'library-title' });
  expect(titleOf(await client().rendition(saved.snapshot.piece.canonical_rendition_id!))).toBeNull();
  expect(projectPieceTags(retitled(untitled, 'Score title'), saved.snapshot.tags).filter(t => t.dimension === 'title'))
    .toEqual([{ dimension: 'title', value: 'Score title' }]);
}, 30_000);
