/** Media-clock playback; browser mechanics are injected through MediaPort. */
import { AUDIO_CAPABILITIES, type BackendSnapshot, type PlaybackBackend, type ScoreLoop, type ScorePosition } from './playbackBackend.ts';
import type { RecordingSyncMap } from './recordingSync.ts';
import type { Performance, WrittenOccurrence } from './performanceTypes.ts';
import { add, compare } from './time.ts';
export type MediaEvent = 'time' | 'playing' | 'pause' | 'waiting' | 'seeking' | 'seeked' | 'ended' | 'rate' | 'error';
export interface MediaPort {
  readonly currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  readonly ended: boolean;
  readonly seeking: boolean;
  readonly rate: number;
  readonly volume: number;
  readonly error: string | undefined;
  subscribe(listener: (event: MediaEvent) => void): () => void;
  prepare(): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): Promise<void>;
  setRate(rate: number): number;
  setVolume(volume: number): number;
  dispose(): void;
}
export class RecordingBackend implements PlaybackBackend {
  readonly capabilities = AUDIO_CAPABILITIES;
  private listeners = new Set<() => void>();
  private unsubscribe: () => void;
  private closed = false;
  private stopped = true;
  private waiting = false;
  private intent = false;
  private prepared = false;
  private generation = 0;
  private loop?: { start: number; end: number };
  private wrapping = false;
  private issue?: string;
  private invalidSync?: string;
  private written = new Map<number, WrittenOccurrence[]>();
  constructor(readonly id: string, private readonly media: MediaPort, performance: Performance,
    private readonly sync: RecordingSyncMap | null, syncIssue?: string) {
    this.invalidSync = syncIssue;
    for (const w of performance.written) {
      const group = this.written.get(w.ordinal) ?? [];
      group.push(w); this.written.set(w.ordinal, group);
    }
    this.unsubscribe = media.subscribe(event => this.onMedia(event));
  }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private emit() { if (!this.closed) for (const listener of this.listeners) listener(); }
  private onMedia(event: MediaEvent) {
    if (this.closed) return;
    if (event === 'waiting' || event === 'seeking') this.waiting = true;
    if (event === 'playing' || event === 'seeked' || event === 'pause') this.waiting = false;
    if (event === 'error') { this.issue = this.media.error || 'The audio could not be loaded.'; this.intent = false; this.media.pause(); }
    if (this.loop && this.intent && this.media.currentTime >= this.loop.end && !this.wrapping) {
      void this.wrap();
    } else if (event === 'ended' && !this.wrapping) {
      this.stopped = true; this.intent = false;
    }
    this.emit();
  }
  get snapshot(): BackendSnapshot {
    const location = this.sync && !this.invalidSync ? this.sync.positionAt(this.media.currentTime) : null;
    const position = location?.ok ? location.value.position : null;
    const hidden = location?.ok ? location.value.hidePlayhead : false;
    const state = this.stopped ? 'stopped' : this.media.paused ? 'paused'
      : this.waiting || this.media.seeking ? 'buffering' : 'playing';
    const highlight = !position || hidden || state === 'stopped' ? [] : (this.written.get(position.ordinal) ?? [])
      .filter(w => compare(position.metricOffset, w.metricOffset) >= 0 && compare(position.metricOffset, add(w.metricOffset, w.metricDuration)) < 0)
      .map(w => ({ noteKey: w.noteKey, ordinal: w.ordinal }));
    return { sourceId: this.id, kind: 'audio', state, scorePosition: position, highlight, hidePlayhead: hidden,
      rate: this.media.rate, volume: this.media.volume, mediaTime: this.media.currentTime,
      syncIssue: this.invalidSync || (location && !location.ok ? location.diagnostic.message : !this.sync ? 'This recording has no usable sync data.' : undefined),
      error: this.issue || this.media.error };
  }
  async prepare() {
    if (this.closed) throw new Error('Audio source is disposed.');
    await this.media.prepare();
    if (this.closed) return;
    if (!Number.isFinite(this.media.duration) || this.media.duration <= 0) throw new Error('This audio has no finite playable duration.');
    this.prepared = true;
    if (this.sync && this.sync.bounds.endSeconds > this.media.duration + 0.001)
      this.invalidSync = 'Sync timings extend beyond this audio file. Score following is unavailable.';
  }
  private get startTime() {
    return this.sync && !this.invalidSync ? this.sync.bounds.startSeconds : 0;
  }
  async play() {
    if (this.intent && !this.media.paused && !this.media.ended) return;
    const generation = ++this.generation;
    this.issue = undefined;
    this.intent = true;
    await this.prepare();
    if (this.closed || generation !== this.generation || !this.intent) return;
    if (this.media.ended || this.stopped) {
      await this.media.seek(this.loop?.start ?? this.startTime);
      if (this.closed || generation !== this.generation || !this.intent) return;
    }
    this.stopped = false;
    this.waiting = true;
    try { await this.media.play(); }
    catch (error) {
      if (!this.closed && generation === this.generation) { this.intent = false; this.waiting = false; this.media.pause(); this.emit(); }
      throw error;
    }
    if (this.closed) return;
    if (generation === this.generation) this.emit();
  }
  pause() {
    if (this.closed) return;
    ++this.generation; this.intent = false; this.waiting = false; this.media.pause(); this.emit();
  }
  stop() {
    if (this.closed) return;
    this.pause(); this.stopped = true; this.issue = undefined;
    if (this.prepared) {
      const generation = this.generation;
      void this.media.seek(this.startTime).then(() => this.emit(), error => {
        if (!this.closed && generation === this.generation) { this.issue = String(error); this.emit(); }
      });
    }
    this.emit();
  }
  canSeek(position: ScorePosition) {
    if (!this.sync || this.invalidSync) return this.invalidSync || 'This recording has no usable sync data.';
    const time = this.sync.secondsAt(position);
    if (!time.ok) return time.diagnostic.message;
    if (this.prepared && time.value > this.media.duration) return 'The requested score position is outside this audio file.';
    return null;
  }
  async seek(position: ScorePosition) {
    const problem = this.canSeek(position); if (problem) throw new Error(problem);
    const time = this.sync!.secondsAt(position);
    if (!time.ok) throw new Error(time.diagnostic.message);
    ++this.generation; this.issue = undefined; this.stopped = false;
    const seconds = this.loop && (time.value < this.loop.start || time.value >= this.loop.end) ? this.loop.start : time.value;
    await this.media.seek(seconds); this.emit();
  }
  setRate(rate: number) { const value = this.media.setRate(rate); this.emit(); return value; }
  setVolume(volume: number) { const value = this.media.setVolume(volume); this.emit(); return value; }
  setLoop(loop?: ScoreLoop) {
    ++this.generation;
    if (!loop) { this.loop = undefined; return; }
    const problem = this.canSeek(loop.start) || this.canSeek(loop.end); if (problem) throw new Error(problem);
    const start = this.sync!.secondsAt(loop.start), end = this.sync!.secondsAt(loop.end);
    if (!start.ok || !end.ok || end.value - start.value < 0.001) throw new Error('An audio loop must cover at least one millisecond of mapped time.');
    this.loop = { start: start.value, end: end.value };
    if (this.media.currentTime < start.value || this.media.currentTime >= end.value) {
      const generation = this.generation;
      void this.seek(loop.start).catch(error => { if (!this.closed && this.generation === generation + 1) { this.issue = String(error); this.emit(); } });
    }
  }
  private async wrap() {
    if (!this.loop) return;
    this.wrapping = true; this.waiting = true;
    const generation = this.generation, start = this.loop.start;
    try {
      await this.media.seek(start);
      if (this.closed || generation !== this.generation || !this.intent) return;
      if (this.media.paused) await this.media.play();
    } catch (error) {
      if (!this.closed && generation === this.generation) { this.issue = String(error); this.pause(); }
    } finally {
      this.wrapping = false;
      if (!this.closed) this.emit();
    }
  }
  dispose() {
    if (this.closed) return;
    this.closed = true; ++this.generation; this.intent = false;
    this.unsubscribe(); this.listeners.clear(); this.media.dispose();
  }
}
