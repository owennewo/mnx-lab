// Implementation loop: the owner's own setup for a piece, over the real routes
// on local D1/R2 (studio authoring campaign; docs/studio-storage.md).
//
// Which source they last played and how they left the Instruments sheet is per
// OWNER and piece, stored beside `opened_at` for the same reason that is
// server-side: it should hold across devices. It is not an edit of the piece —
// it never moves the revision — and the service keeps it opaque, so the shell
// that wrote a shape is the one that checks it on the way back in. That check
// (`normalizePiecePrefs`) and the cueing it feeds belong to studio, which this
// layer may not import: their proof is harness/verify/recording-studio-smoke.mjs.
import { beforeEach, expect, it } from 'vitest';
import type { Miniflare } from 'miniflare';
import { applyMigrations, useLibraryRuntime } from '../helpers/libraryRuntime.ts';
import app from '../../worker/index.ts';
import type { Env } from '../../worker/env.ts';
import { testIdentity } from '../helpers/libraryIdentity.ts';
import { LibraryClient, LibraryRequestError } from '../../src/storage/libraryClient.ts';
import { buildNewDocument } from '../../src/edit/newDocument.ts';
import { parseTuning } from '../../src/edit/setupGrammar.ts';
import { derivedLibraryTags } from '../../src/model/libraryTags.ts';
import { checkStorage } from '../../src/importers/storageCheckCore.ts';
import { documentTitle, type MnxStructure } from '../../src/model/mnx.ts';

let mf: Miniflare; let env: Env; let jwt: string;
const blank = (title = 'Anji') => buildNewDocument({ title, artist: 'Davy Graham', tuning: parseTuning('standard')!, time: { count: 4, unit: 4 }, fifths: 0, bars: 4 });
const file = (document: MnxStructure) => { const { bytes, options } = checkStorage(document); return { filename: `${documentTitle(document)}.gp`, bytes, producerVersion: '0.3.0+test', producerOptions: options }; };
const client = (token = () => jwt) => new LibraryClient((input, init) => {
  const { signal: _signal, ...rest } = init ?? {};
  return app.request(`http://localhost${String(input)}`, { ...rest, headers: { 'Cf-Access-Jwt-Assertion': token(), ...(rest.headers as Record<string, string>) } }, env) as Promise<Response>;
});
const make = async (document = blank()) => (await client().createPiece(file(document), derivedLibraryTags(document))).snapshot;
const status = (promise: Promise<unknown>) => promise.then(() => 200, error => (error instanceof LibraryRequestError ? error.status : -1));

const freshRuntime = useLibraryRuntime();
beforeEach(async () => {
  const identity = await testIdentity(); jwt = await identity.sign();
  mf = await freshRuntime();
  env = { LIBRARY_DB: await mf.getD1Database('DB'), LIBRARY_BUCKET: await mf.getR2Bucket('BUCKET'), LIBRARY_WRITE_TOKEN: 'private-test', ...identity.config };
  await applyMigrations(env.LIBRARY_DB);
  await env.LIBRARY_DB.prepare("INSERT INTO users VALUES ('operator','owner@example.test',1,'now')").run();
}, 15000);

it('carries the setup in the snapshot, replaces it wholesale, and never moves the revision', async () => {
  const piece = await make();
  expect(piece.prefs ?? null).toBe(null);

  const setup = { source: 'rec-1', rendition: piece.piece.canonical_rendition_id, parts: { hidden: [1], mix: { 0: { sound: 'nylon-guitar', volume: 0.5 } }, count: 2 } };
  await client().savePrefs(piece.piece.id, setup);
  const read = (await client().piece(piece.piece.id)).snapshot;
  expect(read.prefs).toEqual(setup);
  // A preference is not an edit: the piece is untouched, so no read of it conflicts.
  expect(read.piece.revision).toBe(piece.piece.revision);

  await client().savePrefs(piece.piece.id, { source: 'synth' });
  expect((await client().piece(piece.piece.id)).snapshot.prefs).toEqual({ source: 'synth' });

  // The row is the one the recent sort keeps; opening again leaves the setup alone.
  await client().opened(piece.piece.id);
  expect((await client().piece(piece.piece.id)).snapshot.prefs).toEqual({ source: 'synth' });
  const view = await env.LIBRARY_DB.prepare('SELECT opened_at, prefs FROM piece_views WHERE piece_id=?').bind(piece.piece.id).first<{ opened_at: string; prefs: string }>();
  expect(view?.opened_at).toBeTruthy();
});

it('refuses a setup for a piece that is not the owner’s, and one too large to be a setup', async () => {
  const piece = await make();
  expect(await status(client().savePrefs('not-a-piece', { source: 'synth' }))).toBe(404);
  // Another member's piece is not there at all, to them.
  await env.LIBRARY_DB.prepare("INSERT INTO users VALUES ('second','second@example.test',1,'now')").run();
  const other = await (await testIdentity()).sign({ email: 'second@example.test' });
  expect(await status(client(() => other).savePrefs(piece.piece.id, { source: 'synth' }))).toBe(404);
  expect((await client().piece(piece.piece.id)).snapshot.prefs ?? null).toBe(null);
  await client().deletePiece(piece.piece.id, piece.piece.revision);
  expect(await status(client().savePrefs(piece.piece.id, { source: 'synth' }))).toBe(404);

  const big = await make(blank('Big'));
  expect(await status(client().savePrefs(big.piece.id, { note: 'x'.repeat(9000) }))).toBe(400);
  expect(await status(client().savePrefs(big.piece.id, ['not', 'an', 'object'] as unknown as Record<string, unknown>))).toBe(400);
  expect((await client().piece(big.piece.id)).snapshot.prefs ?? null).toBe(null);
});

it('opens a piece whose stored setup is unreadable, carrying none', async () => {
  const piece = await make();
  await client().savePrefs(piece.piece.id, { source: 'rec-1' });
  await env.LIBRARY_DB.prepare('UPDATE piece_views SET prefs=? WHERE piece_id=?').bind('{not json', piece.piece.id).run();
  expect((await client().piece(piece.piece.id)).snapshot.prefs ?? null).toBe(null);
});
