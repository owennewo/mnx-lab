/** Studio's third playback source: a listener's decisions drive the cursor. DOM-free and fed
 * decisions, never audio, so a Node replay and a live session run the same code. */
import type { BackendSnapshot, PlaybackBackend, PlaybackCapabilities } from '../../../src/audio/playbackBackend.ts';
import type { Performance, WrittenOccurrence } from '../../../src/audio/performanceTypes.ts';
import { add, compare } from '../../../src/audio/time.ts';
import type { Decision, PositionStatement, ScorePosition } from './contract.ts';
import { liveView } from './liveView.ts';

/** Listening has no rate, volume or loop of its own; the player sets the pace. */
export const LISTENING_CAPABILITIES: PlaybackCapabilities = Object.freeze({ rate: { min: 1, max: 1, step: 1 }, volume: false, loop: 'none', parts: false });

export type ListeningPhase = 'warming' | 'following' | 'lost';
/** Until Studio's snapshot type gains a 'live' kind and a lost phase (a promotion delta),
 * the listening state travels in this extension. */
export interface ListeningSnapshot extends BackendSnapshot {
  readonly listening: { readonly phase: ListeningPhase; readonly confidence: number | null; readonly alternatives: readonly { at: ScorePosition; weight: number }[] };
}
/** What the backend asks of whoever runs the listener: whether a session can start at a
 * position, and to start one there. A refusal is the listener's own reason. */
export interface ListeningHost { canStartAt(position: ScorePosition): string | null; startAt(position: ScorePosition): void }

export const heaviest = (d: PositionStatement): ScorePosition =>
  d.candidates.reduce((best, c) => c.weight > best.weight ? c : best).at;

export class ListeningBackend implements PlaybackBackend {
  readonly capabilities = LISTENING_CAPABILITIES;
  private listeners = new Set<() => void>();
  private written = new Map<number, WrittenOccurrence[]>();
  private record: Decision[] = [];
  private clock = 0;
  private state: 'stopped' | 'paused' | 'playing' = 'stopped';
  private volume = 1;
  private closed = false;
  constructor(readonly id: string, performance: Performance, private readonly host: ListeningHost, private start: ScorePosition) {
    for (const w of performance.written) { const group = this.written.get(w.ordinal) ?? []; group.push(w); this.written.set(w.ordinal, group); }
  }
  /** A decision from the listener, stamped by its delivery. Ignored unless playing: a paused
   * session neither listens nor guesses. */
  receive(decision: Decision) { if (this.state === 'playing' && !this.closed) this.record.push(decision); }
  /** The listening clock: seconds of audio released to the listener in this session. */
  advance(clock: number) { if (this.state !== 'playing' || this.closed) return; this.clock = clock; this.emit(); }

  get snapshot(): ListeningSnapshot {
    const shown = this.state === 'stopped' ? undefined : liveView(this.record, this.clock);
    const position = shown?.kind === 'position' ? heaviest(shown) : null;
    const highlight = !position ? [] : (this.written.get(position.ordinal) ?? [])
      .filter(w => compare(position.metricOffset, w.metricOffset) >= 0 && compare(position.metricOffset, add(w.metricOffset, w.metricDuration)) < 0)
      .map(w => ({ noteKey: w.noteKey, ordinal: w.ordinal }));
    return { sourceId: this.id, kind: 'audio', state: this.state, scorePosition: position, highlight, hidePlayhead: false, rate: 1, volume: this.volume,
      listening: { phase: !shown ? 'warming' : position ? 'following' : 'lost', confidence: shown?.kind === 'position' ? shown.confidence : null,
        alternatives: shown?.kind === 'position' ? shown.candidates.map(c => ({ ...c })) : [] } };
  }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private emit() { if (!this.closed) for (const l of this.listeners) l(); }
  async prepare() { if (this.closed) throw new Error('Listening source is disposed.'); }
  async play() {
    if (this.closed) throw new Error('Listening source is disposed.');
    if (this.state === 'stopped') { this.host.startAt(this.start); this.record = []; this.clock = 0; }
    this.state = 'playing'; this.emit();
  }
  pause() { if (this.state === 'playing') { this.state = 'paused'; this.emit(); } }
  stop() { this.state = 'stopped'; this.record = []; this.clock = 0; this.emit(); }
  canSeek(position: ScorePosition) { return this.host.canStartAt(position); }
  seek(position: ScorePosition) {
    const problem = this.host.canStartAt(position);
    if (problem) throw new Error(problem);
    // A seek starts a fresh listening session there; nothing from before carries over.
    this.start = position; this.record = []; this.clock = 0;
    if (this.state !== 'stopped') this.host.startAt(position);
    this.emit();
  }
  setRate() { return 1; }
  setVolume(volume: number) { this.volume = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 1)); return this.volume; }
  setLoop() { /* Loops are a practice concern for later; capabilities declare none. */ }
  dispose() { this.closed = true; this.listeners.clear(); }
}
