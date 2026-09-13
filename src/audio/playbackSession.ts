/** Owns exactly one audible backend, independent of DOM and any media API. */
import { boundedRate, type BackendSnapshot, type PlaybackBackend, type PlaybackCapabilities, type ScoreLoop, type ScorePosition } from './playbackBackend.ts';
export interface PlaybackSnapshot extends BackendSnapshot {
  readonly capabilities: PlaybackCapabilities;
  readonly loading: boolean;
  readonly wantsPlayback: boolean;
  readonly needsStart: boolean;
  readonly issue: string;
}
export class PlaybackSession {
  private active: PlaybackBackend;
  private unsubscribe: () => void;
  private generation = 0;
  private operation = 0;
  private selecting = false;
  private pendingPlay = false;
  private intent = false;
  private closed = false;
  private needsStart = false;
  private issue = '';
  private target: { position: ScorePosition | null; problem?: string; reset?: boolean; edge?: 'before' | 'after' } = { position: null };
  private targetVersion = 0;
  constructor(initial: PlaybackBackend, private readonly factory: (id: string) => PlaybackBackend, private readonly changed: () => void) {
    this.active = initial;
    this.unsubscribe = initial.subscribe(() => this.notify());
  }
  get backend() { return this.active; }
  get snapshot(): PlaybackSnapshot {
    const state = this.active.snapshot;
    return { ...state, capabilities: this.active.capabilities, loading: this.selecting || this.pendingPlay,
      wantsPlayback: this.intent || state.state === 'playing' || state.state === 'buffering', needsStart: this.needsStart, issue: this.issue || state.error || '' };
  }
  private notify() {
    if (this.closed) return;
    const state = this.active.snapshot;
    if (state.error || (!this.pendingPlay && !this.selecting && state.state === 'stopped')) this.intent = false;
    this.changed();
  }
  async select(id: string, replace = false): Promise<boolean> {
    if (this.closed) return false;
    if (!replace && id === this.active.id) return true;
    const before = this.snapshot;
    let next: PlaybackBackend;
    try { next = this.factory(id); }
    catch (error) { this.pause(); this.issue = error instanceof Error ? error.message : String(error); this.notify(); return false; }
    if (!this.selecting) this.target = { position: before.scorePosition, problem: before.syncIssue };
    ++this.targetVersion;
    this.intent = before.wantsPlayback;
    const generation = ++this.generation;
    ++this.operation;
    this.unsubscribe();
    this.active.pause(); this.active.dispose();
    this.active = next;
    this.pendingPlay = false; this.selecting = true; this.issue = ''; this.needsStart = false;
    this.unsubscribe = next.subscribe(() => { if (generation === this.generation) this.notify(); });
    try {
      next.setRate(boundedRate(before.rate, next.capabilities)); next.setVolume(before.volume);
      this.notify();
      await next.prepare();
      if (this.closed || generation !== this.generation) return false;
      next.pause();
      while (!this.closed && generation === this.generation) {
        const version = this.targetVersion, target = this.target;
        try {
          if (target.reset) next.stop();
          else {
            const problem = target.position ? next.canSeek(target.position, target.edge) : target.problem || 'The current source has no mapped score position.';
            if (problem) throw new Error(problem);
            await next.seek(target.position!, target.edge);
          }
        } catch (error) { if (version === this.targetVersion) throw error; }
        if (version === this.targetVersion) break;
      }
      if (this.closed || generation !== this.generation) return false;
      this.selecting = false;
      if (this.intent) await this.play();
      this.notify(); return !this.issue;
    } catch (error) {
      if (!this.closed && generation === this.generation) {
        this.intent = false; this.pendingPlay = false; this.selecting = false;
        next.pause(); this.needsStart = true;
        this.issue = `${error instanceof Error ? error.message : String(error)} Start this source explicitly to continue.`;
        this.notify();
      }
      return false;
    }
  }
  async play(): Promise<void> {
    if (this.closed || this.needsStart) return;
    this.intent = true;
    if (this.selecting) { this.notify(); return; }
    const backend = this.active, generation = this.generation, operation = ++this.operation;
    this.issue = '';
    this.pendingPlay = true;
    this.notify();
    try { await backend.play(); }
    catch (error) {
      if (!this.closed && generation === this.generation && operation === this.operation) {
        this.intent = false;
        backend.pause();
        this.issue = error instanceof Error ? error.message : String(error);
      }
    } finally {
      if (!this.closed && generation === this.generation && operation === this.operation) {
        this.pendingPlay = false;
        this.notify();
      }
    }
  }
  pause() {
    if (this.closed) return;
    this.intent = false;
    this.pendingPlay = false;
    ++this.operation;
    this.active.pause();
    this.notify();
  }
  stop() {
    if (this.closed) return;
    this.pause();
    this.needsStart = false;
    this.issue = '';
    this.target = { position: null, reset: true }; ++this.targetVersion;
    this.active.stop();
    this.notify();
  }
  async start() { this.stop(); await this.play(); }
  async seek(position: ScorePosition, edge?: 'before' | 'after'): Promise<boolean> {
    if (this.closed) return false;
    const problem = this.active.canSeek(position, edge);
    if (problem) { this.issue = problem; this.notify(); return false; }
    if (this.selecting) { this.target = { position, edge }; ++this.targetVersion; this.needsStart = false; return true; }
    // Seeking cancels a pending Play; normal live seeking preserves playback.
    if (this.pendingPlay) this.pause();
    const generation = this.generation, operation = ++this.operation;
    try {
      await this.active.seek(position, edge);
      if (this.closed || generation !== this.generation || operation !== this.operation) return false;
      this.issue = '';
      this.needsStart = false;
      this.notify();
      return true;
    } catch (error) {
      if (!this.closed && generation === this.generation && operation === this.operation) {
        this.issue = error instanceof Error ? error.message : String(error); this.notify();
      }
      return false;
    }
  }
  setRate(value: number) { const rate = this.active.setRate(boundedRate(value, this.active.capabilities)); this.notify(); return rate; }
  setVolume(value: number) { const volume = this.active.setVolume(Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0.7))); this.notify(); return volume; }
  setLoop(loop?: ScoreLoop) { this.active.setLoop(loop); this.notify(); }
  dispose() {
    if (this.closed) return;
    this.closed = true;
    ++this.generation; ++this.operation;
    this.unsubscribe(); this.active.dispose();
  }
}
