// Implementation loop: the save session's promises, with no browser
// (roadmap/complete/studio-save-pipeline.md, studio authoring campaign item 3).
//
// The first six are the campaign's recovery acceptance tests — named there
// because each is a way the FIRST design of recovery (replay ops against the
// re-imported .gp) was wrong. The documents are real: built by `buildNewDocument`
// and edited through `EditHistory`, because two of the six are about what undo
// hands back.
import { describe, expect, it } from 'vitest';
import { SaveSession, StaleWriteError, IDLE_CHECKPOINT_MS, CEILING_CHECKPOINT_MS, RECOVERY_WRITE_MS, type PreparedCheckpoint, type SavePorts, type SaveState } from '../../src/storage/saveSession.ts';
import { memoryRecoveryStore, type RecoveryStore } from '../../src/storage/recoveryStore.ts';
import { saveChip } from '../../src/storage/saveChip.ts';
import { EditHistory } from '../../src/edit/ops.ts';
import { buildNewDocument } from '../../src/edit/newDocument.ts';
import { parseTuning } from '../../src/edit/setupGrammar.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

const blank = () => buildNewDocument({ title: 'Anji', tuning: parseTuning('standard')!, time: { count: 4, unit: 4 }, fifths: 0, bars: 4 });
const retitle = (history: EditHistory, title: string) => history.apply({ type: 'setWork', work: { title } });
const titleOf = (document: MnxStructure) => document._x?.mnxLab?.work?.title;

/** A hand-cranked world: timers fire when told to, saves land when told to. */
function world(store: RecoveryStore<MnxStructure> = memoryRecoveryStore()) {
  let clock = 1_000; let renditions = 0;
  const timers: { at: number; fn: () => void }[] = [];
  const saves: { title: string | undefined; derivedFrom: string; name: string | null }[] = [];
  const states: SaveState[] = [];
  let gate: Promise<void> | null = null; let open: (() => void) | null = null;
  let failWith: Error | null = null; let remote: string | null = null;
  const prepared = (document: MnxStructure): PreparedCheckpoint => ({
    file: { filename: 'Anji.gp', bytes: new TextEncoder().encode(JSON.stringify(document)), producerVersion: 'test', producerOptions: null },
    check: { verdict: 'gains', differences: [], warnings: [] }, derivedTags: [{ dimension: 'title', value: String(titleOf(document)) }]
  });
  const ports: SavePorts<MnxStructure> = {
    prepare: async document => prepared(document),
    save: async checkpoint => {
      if (gate) await gate;
      if (failWith) { const error = failWith; failWith = null; throw error; }
      saves.push({ title: JSON.parse(new TextDecoder().decode(checkpoint.file.bytes))._x.mnxLab.work.title, derivedFrom: checkpoint.derivedFrom, name: checkpoint.name });
      return { renditionId: `r${++renditions}`, unchanged: false };
    },
    current: async () => ({ renditionId: remote ?? `r${renditions}` }),
    recovery: store, now: () => clock, build: 'build-a',
    schedule: (fn, ms) => { const timer = { at: clock + ms, fn }; timers.push(timer); return () => { const i = timers.indexOf(timer); if (i >= 0) timers.splice(i, 1); }; }
  };
  return {
    ports, saves, states, store,
    session: (document: MnxStructure, base = 'r0') => new SaveSession('piece', document, { renditionId: base }, ports, state => states.push(state)),
    /** Advance the clock, firing what falls due, and let the promises settle. */
    async advance(ms: number) {
      clock += ms;
      for (;;) { const due = timers.filter(t => t.at <= clock).sort((a, b) => a.at - b.at)[0]; if (!due) break; timers.splice(timers.indexOf(due), 1); due.fn(); await settle(); }
      await settle();
    },
    hold() { gate = new Promise(resolve => (open = resolve)); },
    async release() { open?.(); gate = null; await settle(); },
    failNext(error: Error) { failWith = error; },
    savedElsewhere(renditionId: string) { remote = renditionId; },
    pending: () => timers.length
  };
}
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

describe('recovery: the record is the live document', () => {
  it('edit → checkpoint → undo → crash recovers the UNDONE state', async () => {
    const w = world(); const history = new EditHistory(blank()); const session = w.session(history.current);
    session.documentChanged(retitle(history, 'Angie'));
    await session.checkpoint();
    expect(w.saves.map(s => s.title)).toEqual(['Angie']);
    session.documentChanged(history.undo());
    await w.advance(RECOVERY_WRITE_MS);
    // The crash: a new session, the same device, the base the first one reached.
    const next = w.session(blank(), 'r1');
    const found = await next.recoverable();
    expect(found?.stale).toBe(false);
    expect(titleOf(found!.record.document)).toBe('Anji');
    next.recover(found!.record);
    expect(next.snapshot).toMatchObject({ status: 'dirty', recovered: 1 });
    expect(next.document).toEqual(history.current);
  });

  it('checkpoint → more edits → crash recovers a document byte-identical to the live one', async () => {
    const w = world(); const history = new EditHistory(blank()); const session = w.session(history.current);
    session.documentChanged(retitle(history, 'Angie'));
    await session.checkpoint();
    session.documentChanged(retitle(history, 'Angi'));
    session.documentChanged(history.apply({ type: 'setWork', work: { artist: 'Davy Graham', notes: 'DADGAD? No — standard.' } }));
    await w.advance(RECOVERY_WRITE_MS);
    const found = await w.session(blank(), 'r1').recoverable();
    expect(JSON.stringify(found!.record.document)).toBe(JSON.stringify(history.current));
    expect(found!.record).toMatchObject({ baseRenditionId: 'r1', edits: 2, build: 'build-a' });
  });

  it('edits made while a checkpoint is in flight survive and stay counted unsaved', async () => {
    const w = world(); const history = new EditHistory(blank()); const session = w.session(history.current);
    session.documentChanged(retitle(history, 'Angie'));
    w.hold();
    const saving = session.checkpoint();
    await settle();
    expect(session.snapshot.status).toBe('saving');
    session.documentChanged(retitle(history, 'Angi'));
    session.documentChanged(retitle(history, 'Anji (live)'));
    await w.release(); await saving;
    expect(w.saves.map(s => s.title)).toEqual(['Angie']);
    expect(session.snapshot).toMatchObject({ status: 'dirty', edits: 2 });
    // The record now follows the live document, on the NEW base.
    const record = await w.store.read('piece');
    expect(titleOf(record!.document)).toBe('Anji (live)');
    expect(record!.baseRenditionId).toBe('r1');
    await w.advance(IDLE_CHECKPOINT_MS);
    expect(w.saves.map(s => [s.title, s.derivedFrom])).toEqual([['Angie', 'r0'], ['Anji (live)', 'r1']]);
    expect(session.snapshot).toMatchObject({ status: 'clean', edits: 0 });
  });

  it('undo back to the checkpointed state reads clean, and nothing is kept', async () => {
    const w = world(); const history = new EditHistory(blank()); const session = w.session(history.current);
    session.documentChanged(retitle(history, 'Angie'));
    await w.advance(RECOVERY_WRITE_MS);
    expect(await w.store.read('piece')).not.toBeNull();
    session.documentChanged(history.undo());
    await settle();
    expect(session.snapshot).toMatchObject({ status: 'clean', edits: 0 });
    expect(await w.store.read('piece')).toBeNull();
    expect(w.pending()).toBe(0);
    await w.advance(CEILING_CHECKPOINT_MS);
    expect(w.saves).toEqual([]);
    // And redo is dirty again — by reference, not by count.
    session.documentChanged(history.redo());
    expect(session.snapshot).toMatchObject({ status: 'dirty', edits: 1 });
  });

  it('a record another build wrote is handed over whole, never half-applied', async () => {
    const store = memoryRecoveryStore<MnxStructure>();
    const written = retitle(new EditHistory(blank()), 'Written by an older build');
    await store.write({ pieceId: 'piece', document: written, baseRenditionId: 'r0', build: 'build-older', edits: 3, writtenAt: 1 });
    const session = world(store).session(blank());
    const found = await session.recoverable();
    expect(found).toMatchObject({ stale: false, record: { build: 'build-older', edits: 3 } });
    expect(found!.record.document).toEqual(written);
    // Looking is not applying.
    expect(titleOf(session.document)).toBe('Anji');
    await session.discardRecovery();
    expect(await session.recoverable()).toBeNull();
  });

  it('a record whose base is no longer canonical is a fork, not something to continue from', async () => {
    const store = memoryRecoveryStore<MnxStructure>();
    await store.write({ pieceId: 'piece', document: blank(), baseRenditionId: 'r0', build: 'build-a', edits: 4, writtenAt: 1 });
    expect((await world(store).session(blank(), 'r7').recoverable())?.stale).toBe(true);
  });
});

describe('checkpoints', () => {
  it('fire after an idle pause, and at a ceiling under continuous editing', async () => {
    const w = world(); const history = new EditHistory(blank()); const session = w.session(history.current);
    for (let i = 0; i < 12; i++) { session.documentChanged(retitle(history, `Take ${i}`)); await w.advance(IDLE_CHECKPOINT_MS - 1_000); }
    // 12 edits, never 30 s apart: the idle timer never fired, the ceiling did.
    expect(w.saves).toHaveLength(1);
    session.documentChanged(retitle(history, 'Rest'));
    await w.advance(IDLE_CHECKPOINT_MS);
    expect(w.saves.at(-1)?.title).toBe('Rest');
    expect(session.snapshot).toMatchObject({ status: 'clean', check: { verdict: 'gains' } });
  });

  it('a stale revision is retried; a score saved elsewhere is a conflict that stops autosave and keeps the record', async () => {
    const w = world(); const history = new EditHistory(blank()); const session = w.session(history.current);
    session.documentChanged(retitle(history, 'Angie'));
    w.failNext(new StaleWriteError());
    await session.checkpoint();
    expect(w.saves.map(s => s.title)).toEqual(['Angie']);           // a tag moved the revision: retried on the same base
    session.documentChanged(retitle(history, 'Angi'));
    await w.advance(RECOVERY_WRITE_MS);
    w.failNext(new StaleWriteError()); w.savedElsewhere('r-other-device');
    await session.checkpoint();
    expect(session.snapshot).toMatchObject({ status: 'conflict', edits: 1 });
    expect(w.saves).toHaveLength(1);
    await w.advance(CEILING_CHECKPOINT_MS); await session.checkpoint('Mine');
    expect(w.saves).toHaveLength(1);
    expect(titleOf((await w.store.read('piece'))!.document)).toBe('Angi');
  });

  it('a failed save keeps the record, says so, and retries', async () => {
    const w = world(); const history = new EditHistory(blank()); const session = w.session(history.current);
    session.documentChanged(retitle(history, 'Angie'));
    await w.advance(RECOVERY_WRITE_MS);
    w.failNext(new Error('The request did not finish.'));
    await session.checkpoint();
    expect(session.snapshot).toMatchObject({ status: 'failed', edits: 1, error: 'The request did not finish.' });
    expect(await w.store.read('piece')).not.toBeNull();
    await w.advance(5_000);
    expect(session.snapshot.status).toBe('clean');
    expect(await w.store.read('piece')).toBeNull();
  });

  it('a named version asked for mid-save follows it; flushing writes the record before the save', async () => {
    const w = world(); const history = new EditHistory(blank()); const session = w.session(history.current);
    session.documentChanged(retitle(history, 'Angie'));
    w.hold();
    void session.checkpoint();
    await settle();
    session.documentChanged(retitle(history, 'Angi'));
    void session.checkpoint('Before the bridge');
    await w.release(); await settle();
    expect(w.saves.map(s => [s.title, s.name])).toEqual([['Angie', null], ['Angi', 'Before the bridge']]);
    session.documentChanged(retitle(history, 'Anji'));
    w.hold();
    const flushing = session.flush();
    await settle();
    expect(titleOf((await w.store.read('piece'))!.document)).toBe('Anji');
    await w.release(); await flushing;
    expect(session.snapshot.status).toBe('clean');
  });

  it('a disposed session does nothing more', async () => {
    const w = world(); const history = new EditHistory(blank()); const session = w.session(history.current);
    session.documentChanged(retitle(history, 'Angie'));
    session.dispose();
    await w.advance(CEILING_CHECKPOINT_MS);
    expect(w.saves).toEqual([]);
  });
});

describe('the chip leads with the risk, then the freshness', () => {
  const base: SaveState = { status: 'clean', edits: 0, savedAt: null, check: null, error: null, recovered: null };
  const at = 10 * 60_000;
  it.each([
    [{}, 'Saved', 'quiet'],
    [{ savedAt: at - 20_000 }, 'Saved · just now', 'quiet'],
    [{ savedAt: at - 4 * 60_000 }, 'Saved · 4 min ago', 'quiet'],
    [{ status: 'dirty', edits: 1 }, '1 edit unsaved', 'risk'],
    [{ status: 'dirty', edits: 12, savedAt: at - 4 * 60_000 }, '12 edits unsaved · last saved 4 min ago', 'risk'],
    [{ status: 'dirty', edits: 9, recovered: 9 }, 'Recovered 9 edits from this device', 'risk'],
    [{ status: 'saving', edits: 3 }, 'Saving…', 'quiet'],
    [{ status: 'failed', edits: 31 }, 'Not saved · 31 edits on this device only · retrying', 'warn'],
    [{ status: 'conflict', edits: 2 }, 'Saved on another device · 2 edits here', 'warn'],
    [{ savedAt: at, check: { verdict: 'differs', warnings: [], differences: [{ path: 'a', kind: 'lost', count: 1 }, { path: 'b', kind: 'changed', count: 1 }, { path: 'c', kind: 'gained', count: 40 }] } }, 'Saved · 2 items won’t persist', 'warn'],
    [{ savedAt: at, check: { verdict: 'gains', warnings: [], differences: [{ path: 'c', kind: 'gained', count: 40 }] } }, 'Saved · just now', 'quiet']
  ] as [Partial<SaveState>, string, string][])('%j', (state, text, tone) => {
    expect(saveChip({ ...base, ...state }, at)).toEqual({ text, tone });
  });
});


// roadmap/inprogress/studio-piece-lifecycle.md: the version list is a reading of rows that already exist.
describe('a piece\'s versions', async () => {
  const { pieceVersions } = await import('../../src/storage/versions.ts');
  const row = (id: string, role: string, created_at: string, provenance: unknown = null, producer = 'studio') =>
    ({ id, role, created_at, provenance: provenance === null ? null : JSON.stringify(provenance), producer, format: role === 'evidence' ? 'mnx' : 'gp', bytes: 1, derived_from: null, producer_version: null, filename: null }) as never;
  const differs = { verdict: 'differs', warnings: [], differences: [{ path: 'a', kind: 'lost', count: 2 }, { path: 'b', kind: 'changed', count: 1 }, { path: 'c', kind: 'gained', count: 9 }] };

  it('reads newest first: the start, every checkpoint, named or not — never evidence or derived files', () => {
    const versions = pieceVersions([
      row('r0', 'original', '2026-09-17T10:00:00Z'),
      row('r1', 'edit', '2026-09-17T10:05:00Z', { kind: 'checkpoint', name: null, check: { verdict: 'clean', differences: [] } }),
      row('r2', 'edit', '2026-09-17T10:09:00Z', { kind: 'checkpoint', name: ' Before the bridge ', check: differs }),
      row('r2-saved', 'evidence', '2026-09-17T10:09:00Z', { kind: 'saved-document' }),
      row('d1', 'derived', '2026-09-17T10:01:00Z')
    ], 'r1');
    expect(versions.map(v => [v.id, v.kind, v.label, v.current, v.unkept])).toEqual([
      ['r2', 'named', 'Before the bridge', false, 3],
      ['r1', 'automatic', 'Saved automatically', true, 0],
      ['r0', 'start', 'As first made', false, 0]
    ]);
  });

  it('calls an ingested start what it is, and survives provenance it cannot read', () => {
    const versions = pieceVersions([row('s0', 'export', '2026-09-01T00:00:00Z', null, 'soundslice-exporter'), { ...(row('e1', 'edit', '2026-09-02T00:00:00Z') as object), provenance: 'not json' } as never], null);
    expect(versions.map(v => [v.label, v.current, v.unkept])).toEqual([['Saved automatically', false, 0], ['As imported', false, 0]]);
  });
});
