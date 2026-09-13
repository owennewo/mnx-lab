import { Transport, type TransportEvent } from '../transport.ts';
import { NativeSink, nativeClock, type NativeSinkOptions } from './sink.ts';
import { SYNTH_CAPABILITIES, type BackendSnapshot, type PlaybackBackend, type ScoreLoop, type ScorePosition } from '../playbackBackend.ts';
import { performancePositionAt, scorePositionAt } from '../scorePosition.ts';
import { measureAt } from '../playbackPosition.ts';
import type { Performance } from '../performanceTypes.ts';
import { ZERO, compare } from '../time.ts';
export class SynthBackend implements PlaybackBackend {
  readonly id = 'synth';
  readonly capabilities = SYNTH_CAPABILITIES;
  readonly transport: Transport;
  readonly sink: NativeSink;
  private volume: number;
  private closed = false;
  private listeners = new Set<() => void>();
  constructor(private readonly performance: Performance, options: NativeSinkOptions,
    onEvent: (event: TransportEvent) => void) {
    this.volume = options.volume ?? 0.7;
    this.sink = new NativeSink(options);
    this.transport = new Transport(performance, nativeClock(this.sink), this.sink, { onEvent: event => {
      if (this.closed) return;
      onEvent(event);
      if (event.kind === 'state') for (const listener of this.listeners) listener();
    } });
  }
  get snapshot(): BackendSnapshot {
    const transport = this.transport.snapshot;
    const p = scorePositionAt(this.performance, transport.position);
    return { sourceId: this.id, kind: 'synth', state: transport.state, scorePosition: p.ok ? p.value : null,
      syncIssue: p.ok ? undefined : p.diagnostic.message, rate: transport.rate, volume: this.volume, hidePlayhead: false,
      highlight: transport.activeWritten.map(w => ({ noteKey: w.noteKey, ordinal: w.ordinal })), transport };
  }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  prepare() { return Promise.resolve(); }
  async play() {
    if (this.transport.snapshot.state === 'stopped' && compare(this.transport.position, this.transport.duration) >= 0) this.transport.seek(ZERO);
    await this.transport.play();
  }
  pause() { if (!this.closed) this.transport.pause(); }
  stop() { if (!this.closed) this.transport.stop(); }
  canSeek(position: ScorePosition, edge?: 'before' | 'after') {
    const result = performancePositionAt(this.performance, position, edge);
    return result.ok ? null : result.diagnostic.message;
  }
  seek(position: ScorePosition, edge?: 'before' | 'after') {
    const result = performancePositionAt(this.performance, position, edge);
    if (!result.ok) throw new Error(result.diagnostic.message);
    this.transport.seek(result.value);
  }
  get ordinal() { return measureAt(this.performance, this.transport.position)?.ordinal ?? null; }
  setRate(rate: number) { this.transport.setRate(rate); return this.transport.snapshot.rate; }
  setVolume(volume: number) { this.volume = volume; this.sink.setVolume(volume); return volume; }
  setLoop(loop?: ScoreLoop) {
    if (!loop) { this.transport.setLoop(); return; }
    const start = performancePositionAt(this.performance, loop.start), end = performancePositionAt(this.performance, loop.end);
    if (!start.ok || !end.ok) throw new Error(!start.ok ? start.diagnostic.message : !end.ok ? end.diagnostic.message : 'Invalid loop.');
    this.transport.setLoop({ start: start.value, end: end.value });
  }
  dispose() { if (this.closed) return; this.closed = true; this.listeners.clear(); this.transport.dispose(); this.sink.dispose(); }
}
