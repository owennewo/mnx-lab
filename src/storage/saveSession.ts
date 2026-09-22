/**
 * Saving a piece while it is being edited: the state machine behind studio's
 * save chip (roadmap: studio-save-pipeline; the contract is the studio authoring
 * campaign's clauses 2–8).
 *
 * Nobody is asked to save. The session is told whenever the document changes,
 * and from that alone it keeps three promises:
 *
 *  - **The recovery record is the live document.** While the piece is dirty the
 *    document itself is written to a local store — debounced, and at once when
 *    the page is hidden. Recovery loads that record and nothing else: no
 *    re-import, no replay. A checkpoint does NOT leave the live document equal
 *    to its own re-import (every importer numbers its own ids; a lossy save
 *    differs in structure too), and an undo emits no op, so a snapshot is the
 *    only base that is exact.
 *  - **Dirty means "the live document is not the one last checkpointed"** — by
 *    reference. `EditHistory.undo()` hands back the very object it took, so
 *    undoing to the saved state is clean again and the record is deleted.
 *  - **A checkpoint captures one document and the record keeps following the
 *    live one.** Edits made while a save is in flight are neither lost nor
 *    counted as saved.
 *
 * Everything outside that logic is a port — exporting and checking the file,
 * the write itself, the local store, the clock and the timers — so this module
 * imports nothing but types and the harness can hold it to account without a
 * browser (harness/conformance/save-session.test.ts). `D` is the document;
 * the session never looks inside it.
 */
import type { ProjectedTag, RoundTripCheck, StudioScoreFile } from './libraryClient.ts';
import type { RecoveryRecord, RecoveryStore } from './recoveryStore.ts';

/** A checkpoint ready to send: the file, what its round trip cost, and the tags read off the document. */
export interface PreparedCheckpoint { file: StudioScoreFile; check: RoundTripCheck; derivedTags: ProjectedTag[];
  /** A defect report to send with it: the document the file was exported from, as JSON text. The session only carries it. */
  evidence?: string | null }
/** What the service says the piece is now. */
export interface PieceBase { renditionId: string | null }

/** Thrown by `SavePorts.save` when the service refused the write as stale (HTTP 409). */
export class StaleWriteError extends Error { constructor() { super('The piece changed; read it again.'); this.name = 'StaleWriteError'; } }

export interface SavePorts<D> {
  /** Export the document as the stored file and measure the round trip. Off the main thread, in studio. */
  prepare(document: D): Promise<PreparedCheckpoint>;
  /** Write the checkpoint, edited from `derivedFrom`, at whatever revision the piece is at now. */
  save(checkpoint: PreparedCheckpoint & { derivedFrom: string; name: string | null }): Promise<{ renditionId: string; unchanged: boolean }>;
  /** Re-read the piece after a stale write: is our base still the canonical rendition? */
  current(): Promise<PieceBase>;
  recovery: RecoveryStore<D>;
  now(): number;
  /** Run `fn` after `ms`; returns a cancel. */
  schedule(fn: () => void, ms: number): () => void;
  /** Stamped on the recovery record, so a record another build wrote is recognisable. */
  build: string;
}

export const RECOVERY_WRITE_MS = 1_000;
export const IDLE_CHECKPOINT_MS = 30_000;
export const CEILING_CHECKPOINT_MS = 5 * 60_000;
const RETRY_MS = [5_000, 15_000, 60_000];

export type SaveStatus =
  | 'clean'      // the live document is the checkpointed one
  | 'dirty'      // edits exist only on this device
  | 'saving'
  | 'failed'     // a checkpoint failed and will be retried; the record is kept
  | 'conflict';  // the piece was saved somewhere else; the owner chooses

export interface SaveState {
  status: SaveStatus;
  /** History events since the last checkpoint — the risk. */
  edits: number;
  /** When the last checkpoint landed (this session), or null. */
  savedAt: number | null;
  /** What the last checkpoint's round trip cost. */
  check: RoundTripCheck | null;
  error: string | null;
  /** Edits brought back from this device's recovery record, until the next checkpoint. */
  recovered: number | null;
}

export class SaveSession<D> {
  private live: D;
  private saved: D;
  private base: string | null;
  private state: SaveState = { status: 'clean', edits: 0, savedAt: null, check: null, error: null, recovered: null };
  private cancelRecoveryWrite: (() => void) | null = null;
  private cancelIdle: (() => void) | null = null;
  private cancelCeiling: (() => void) | null = null;
  private cancelRetry: (() => void) | null = null;
  private inFlight: Promise<void> | null = null;
  private queued: { name: string | null } | null = null;
  private failures = 0;
  private disposed = false;

  constructor(
    private readonly pieceId: string,
    document: D,
    base: PieceBase,
    private readonly ports: SavePorts<D>,
    private readonly onChange: (state: SaveState) => void = () => {}
  ) {
    this.live = this.saved = document;
    this.base = base.renditionId;
  }

  get snapshot(): SaveState { return this.state; }
  get document(): D { return this.live; }
  /** The rendition the live document was last saved as. */
  get baseRenditionId(): string | null { return this.base; }
  get dirty(): boolean { return this.live !== this.saved; }

  /**
   * This device's record for the piece, if it can be trusted to continue from:
   * written against the rendition that is still canonical. A record against any
   * other base is a fork — `stale` hands it back so the owner can keep it as a
   * copy; it is never applied over what another device saved.
   */
  async recoverable(): Promise<{ record: RecoveryRecord<D>; stale: boolean } | null> {
    const record = await this.ports.recovery.read(this.pieceId);
    return record ? { record, stale: record.baseRenditionId !== this.base } : null;
  }

  /**
   * Continue from a record: its document becomes the live one. Written on the
   * base that is still canonical, it is simply dirty and saves as usual. Written
   * on any other (`stale`), it is a fork: shown, kept on this device, and never
   * saved over what another device wrote — the owner keeps it as a copy or lets it go.
   */
  recover(record: RecoveryRecord<D>, stale = false): void {
    this.live = record.document;
    if (stale) { this.set({ status: 'conflict', edits: record.edits, recovered: record.edits, error: 'This piece was saved on another device.' }); return; }
    this.set({ status: 'dirty', edits: record.edits, recovered: record.edits, error: null });
    this.arm();
  }

  /**
   * The host holds the saved document under another identity — an editor copies
   * what it is given — so THIS object is the checkpointed one from here on. Only
   * while clean: adopting over unsaved edits would call them saved.
   */
  adopt(document: D): void {
    if (this.dirty) throw new Error('Cannot adopt a document over unsaved edits.');
    this.live = this.saved = document;
  }

  async discardRecovery(): Promise<void> { await this.ports.recovery.clear(this.pieceId); }

  /** The document changed — an edit, an undo, a redo. One history event. */
  documentChanged(document: D): void {
    if (this.disposed) return;
    this.live = document;
    if (!this.dirty) {
      // Back on the checkpointed document: nothing is at risk, so nothing is kept.
      this.disarm();
      void this.ports.recovery.clear(this.pieceId);
      if (this.state.status !== 'saving' && this.state.status !== 'conflict') this.set({ status: 'clean', edits: 0, error: null });
      else this.set({ edits: 0 });
      return;
    }
    const edits = this.state.edits + 1;
    this.set(this.state.status === 'saving' || this.state.status === 'conflict' ? { edits } : { status: this.state.status === 'failed' ? 'failed' : 'dirty', edits });
    this.arm();
  }

  /** Save now. Named, it is a version the owner asked for; unnamed, an automatic checkpoint. */
  checkpoint(name: string | null = null): Promise<void> {
    if (this.disposed || this.state.status === 'conflict') return Promise.resolve();
    if (this.inFlight) { this.queued = { name: name ?? this.queued?.name ?? null }; return this.inFlight; }
    if (!this.dirty && name === null) return Promise.resolve();
    this.inFlight = this.run(name).finally(() => {
      this.inFlight = null;
      const next = this.queued; this.queued = null;
      if (next && !this.disposed && (this.dirty || next.name !== null)) void this.checkpoint(next.name);
    });
    return this.inFlight;
  }

  /** The page is going away or hidden: the record first (it is local and fast), then the checkpoint. */
  async flush(): Promise<void> {
    this.cancelRecoveryWrite?.(); this.cancelRecoveryWrite = null;
    await this.writeRecovery();
    if (this.dirty) await this.checkpoint();
    else await this.inFlight;
    // A checkpoint that was already running can queue a newer document. A host
    // disposing after flush must wait for that final write before releasing its lock.
    while (!this.disposed && this.dirty && this.state.status !== 'failed' && this.state.status !== 'conflict')
      await this.checkpoint();
  }

  dispose(): void { this.disposed = true; this.disarm(); this.cancelRetry?.(); }

  // ── internals ────────────────────────────────────────────────────────────

  private async run(name: string | null): Promise<void> {
    const captured = this.live, editsAtCapture = this.state.edits;
    this.cancelIdle?.(); this.cancelIdle = null; this.cancelRetry?.(); this.cancelRetry = null;
    this.set({ status: 'saving', error: null });
    try {
      if (this.base === null) throw new Error('This piece has no stored score to save an edit of.');
      const prepared = await this.ports.prepare(captured);
      const send = () => this.ports.save({ ...prepared, derivedFrom: this.base!, name });
      let result: Awaited<ReturnType<typeof send>>;
      try { result = await send(); }
      catch (error) {
        if (!(error instanceof StaleWriteError)) throw error;
        // A tag or a sync moved the revision, or another device saved the score.
        // Only the first is ours to retry.
        if ((await this.ports.current()).renditionId !== this.base) { this.set({ status: 'conflict', error: 'This piece was saved on another device.' }); return; }
        try { result = await send(); }
        catch (again) { if (again instanceof StaleWriteError) { this.set({ status: 'conflict', error: 'This piece was saved on another device.' }); return; } throw again; }
      }
      this.base = result.renditionId;
      this.saved = captured;
      this.failures = 0;
      const remaining = this.state.edits - editsAtCapture;
      this.cancelCeiling?.(); this.cancelCeiling = null;
      if (this.dirty) {
        // Edited while the save was in flight: those edits are still only here.
        this.set({ status: 'dirty', edits: Math.max(1, remaining), savedAt: this.ports.now(), check: prepared.check, recovered: null });
        await this.writeRecovery();
        this.arm();
      } else {
        this.cancelRecoveryWrite?.(); this.cancelRecoveryWrite = null;
        await this.ports.recovery.clear(this.pieceId);
        this.set({ status: 'clean', edits: 0, savedAt: this.ports.now(), check: prepared.check, recovered: null });
      }
    } catch (error) {
      const delay = RETRY_MS[Math.min(this.failures++, RETRY_MS.length - 1)];
      this.set({ status: 'failed', error: error instanceof Error && error.message ? error.message : 'The piece could not be saved.' });
      if (!this.disposed) this.cancelRetry = this.ports.schedule(() => { this.cancelRetry = null; void this.checkpoint(name); }, delay);
    }
  }

  private arm(): void {
    this.cancelRecoveryWrite ??= this.ports.schedule(() => { this.cancelRecoveryWrite = null; void this.writeRecovery(); }, RECOVERY_WRITE_MS);
    this.cancelIdle?.();
    this.cancelIdle = this.ports.schedule(() => { this.cancelIdle = null; void this.checkpoint(); }, IDLE_CHECKPOINT_MS);
    this.cancelCeiling ??= this.ports.schedule(() => { this.cancelCeiling = null; void this.checkpoint(); }, CEILING_CHECKPOINT_MS);
  }

  private disarm(): void {
    for (const cancel of [this.cancelRecoveryWrite, this.cancelIdle, this.cancelCeiling]) cancel?.();
    this.cancelRecoveryWrite = this.cancelIdle = this.cancelCeiling = null;
  }

  private async writeRecovery(): Promise<void> {
    if (!this.dirty || this.base === null) return;
    const record: RecoveryRecord<D> = { pieceId: this.pieceId, document: this.live, baseRenditionId: this.base, build: this.ports.build, edits: this.state.edits, writtenAt: this.ports.now() };
    try { await this.ports.recovery.write(record); } catch { /* a full or blocked store must not stop the editor; the checkpoint still runs */ }
  }

  private set(change: Partial<SaveState>): void {
    this.state = { ...this.state, ...change };
    this.onChange(this.state);
  }
}
