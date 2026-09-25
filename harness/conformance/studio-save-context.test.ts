import { expect, it } from 'vitest';
import { PieceSaveContext, acquirePieceLock } from '../../src/storage/pieceSaveContext.ts';
import { buildNewDocument } from '../../src/edit/newDocument.ts';
import { parseTuning } from '../../src/edit/setupGrammar.ts';
import type { LibrarySnapshot } from '../../src/storage/libraryClient.ts';
import type { StorageCheckResult } from '../../src/importers/storageCheck.ts';

const document = () => {
  const doc = buildNewDocument({ title: 'Temporary', tuning: parseTuning('standard')!, time: { count: 4, unit: 4 }, fifths: 0, bars: 1 });
  delete doc._x!.mnxLab!.work;
  return doc;
};
const tags = (title: string) => [{ dimension: 'title', value: title, origin: 'derived', source_ref: 'sidecar' }] as LibrarySnapshot['tags'];
const result = (): StorageCheckResult => ({ bytes: new Uint8Array(), options: {},
  check: { verdict: 'differs', differences: [{ path: 'parts/notes', kind: 'lost', count: 1 }], warnings: [] },
  losses: [{ path: 'parts/notes', kind: 'lost', was: 'a note' }] });

it('a delayed checkpoint keeps the departing piece’s sidecar title and filename', async () => {
  let visibleTags = tags('Piece A');
  let finish!: (value: StorageCheckResult) => void;
  const context = new PieceSaveContext(visibleTags, 'test', () => new Promise<StorageCheckResult>(resolve => { finish = resolve; }));
  const pending = context.prepare(document());
  visibleTags = tags('Piece B');
  finish(result());
  const checkpoint = await pending;
  expect(checkpoint.derivedTags).toContainEqual({ dimension: 'title', value: 'Piece A', kept: true });
  expect(checkpoint.file.filename).toBe('Piece A.gp');
});

it('evidence belongs to the session and is acknowledged only by its successful checkpoint', async () => {
  const a = new PieceSaveContext(tags('A'), 'test', async () => result());
  const b = new PieceSaveContext(tags('B'), 'test', async () => result());
  const doc = document();
  const first = await a.prepare(doc);
  expect(first.evidence).toBe(JSON.stringify(doc));
  expect((await a.prepare(doc)).evidence).toBe(first.evidence); // a failed attempt did not acknowledge it
  expect(a.saved(first)).toEqual(result().losses);
  expect((await a.prepare(doc)).evidence).toBeNull();
  expect((await b.prepare(doc)).evidence).toBe(first.evidence);
});

it('each checkpoint retains its own losses even if another has been prepared', async () => {
  let checked = result();
  const context = new PieceSaveContext([], 'test', async () => checked);
  const first = await context.prepare(document());
  checked = { ...result(), losses: [] };
  await context.prepare(document());
  expect(context.saved(first)).toEqual(result().losses);
});

it('lock releases belong to each acquisition and a contended lock is read-only', async () => {
  const held = new Set<string>();
  const locks = { request: async (name: string, _options: unknown, callback: (lock: object | null) => unknown) => {
    if (held.has(name)) return callback(null);
    held.add(name);
    try { await callback({}); } finally { held.delete(name); }
    return undefined;
  } } as Pick<LockManager, 'request'>;
  const a = await acquirePieceLock('A', locks);
  const b = await acquirePieceLock('B', locks);
  expect((await acquirePieceLock('A', locks)).writable).toBe(false);
  a.release();
  await Promise.resolve();
  expect(held.has('mnx-studio.piece.A')).toBe(false);
  expect(held.has('mnx-studio.piece.B')).toBe(true);
  b.release();
});

it('a saved document title replaces the sidecar fallback before a later clear', async () => {
  const context = new PieceSaveContext(tags('Imported title'), 'test', async () => result());
  const titled = document();
  titled._x!.mnxLab!.work = { title: 'Edited title' };
  const checkpoint = await context.prepare(titled);
  expect(checkpoint.derivedTags.find(t => t.dimension === 'title')).toEqual({ dimension: 'title', value: 'Edited title' });
  context.saved(checkpoint);
  context.updateTags([{ ...tags('Edited title')[0], source_ref: 'document' }]);
  expect((await context.prepare(document())).derivedTags.some(t => t.dimension === 'title')).toBe(false);
});
