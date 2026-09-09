/** Pure transport. The injected clock and sink share the same audio-time origin. */
import type {
  Performance,
  SoundingEvent,
  WrittenOccurrence,
  SourceSegment,
} from './performanceTypes.ts';
import type { Sink, SinkEvent } from './sink.ts';
import {
  ZERO,
  add,
  subtract,
  compare,
  min,
  max,
  rational,
  createTempoMap,
  type Rational,
} from './time.ts';

export interface Clock {
  now(): number;
  setTimeout(callback: () => void, milliseconds: number): unknown;
  clearTimeout(handle: unknown): void;
}
export interface LoopRegion {
  start: Rational;
  end: Rational;
}
export interface TransportSnapshot {
  state: 'stopped' | 'paused' | 'playing';
  position: Rational;
  rate: number;
  activeWritten: readonly WrittenOccurrence[];
  source: SourceSegment | undefined;
}
export type TransportEvent =
  | {
      kind: 'onset' | 'end';
      writtenId: string;
      ordinal: number;
      audioTime: number;
    }
  | { kind: 'state'; snapshot: TransportSnapshot };
export interface TransportOptions {
  lookaheadSeconds?: number;
  pollMilliseconds?: number;
  onEvent?: (event: TransportEvent) => void;
}
const endOf = (event: { position: Rational; duration: Rational }) =>
  add(event.position, event.duration);
const within = (p: Rational, a: Rational, b: Rational) => compare(p, a) >= 0 && compare(p, b) < 0;
/** Exact half-open onset query; this never uses the inverse clock's display grid. */
export function eventsBetween(performance: Performance, a: Rational, b: Rational): SoundingEvent[] {
  return performance.sounding.filter((e) => within(e.position, a, b));
}
const ratio = (a: Rational, b: Rational) => Number(a.num * b.den) / Number(a.den * b.num);
/** Absolute cents, including all overlapping bend and vibrato curves. */
export function centsAt(event: SoundingEvent, offset: Rational): number {
  let cents = 0;
  for (const curve of event.curve) {
    if (curve.kind === 'vibrato') {
      if (within(offset, curve.offset, add(curve.offset, curve.duration)))
        cents +=
          Math.sin(2 * Math.PI * ratio(subtract(offset, curve.offset), curve.period)) *
          curve.depthCents;
    } else {
      const points = curve.points;
      let i = points.length - 1;
      while (i >= 0 && compare(points[i]!.offset, offset) > 0) i--;
      if (i >= 0) {
        const a = points[i]!,
          b = points[i + 1];
        cents += b
          ? a.cents +
            (b.cents - a.cents) * ratio(subtract(offset, a.offset), subtract(b.offset, a.offset))
          : a.cents;
      }
    }
  }
  return cents;
}
type WithoutOffset<T> = T extends unknown ? Omit<T, 'offset'> : never;
interface Action {
  position: Rational;
  event: WithoutOffset<SinkEvent>;
  until?: Rational;
  order: number;
  sounding?: SoundingEvent;
}
interface Visit {
  from: Rational;
  until: Rational;
  audio: number;
  endAudio: number;
  initialized: boolean;
  cursor: number;
}
interface Notice {
  audioTime: number;
  kind: 'onset' | 'end';
  written: WrittenOccurrence;
}

export class Transport {
  private readonly tempo;
  readonly duration: Rational;
  private readonly lookahead: number;
  private readonly poll: number;
  private readonly actions: Action[] = [];
  private readonly curvePoints = new Map<string, Rational[]>();
  private state: TransportSnapshot['state'] = 'stopped';
  private stored = ZERO;
  private speed = 1;
  private loop: LoopRegion | undefined;
  private anchor = ZERO;
  private audioAnchor = 0;
  private generation = 0;
  private timer: unknown;
  private scheduledThrough = 0;
  private disposed = false;
  private visit: Visit | undefined;
  private notices: Notice[] = [];
  private active = new Map<string, WrittenOccurrence>();
  constructor(
    readonly performance: Performance,
    private readonly clock: Clock,
    private readonly sink: Sink,
    private readonly options: TransportOptions = {},
  ) {
    this.tempo = createTempoMap(performance.tempo);
    this.duration = [
      ...performance.measures,
      ...performance.written,
      ...performance.sounding,
    ].reduce((d, e) => max(d, endOf(e)), ZERO);
    this.lookahead = options.lookaheadSeconds ?? 0.1;
    this.poll = options.pollMilliseconds ?? 20;
    if (
      !(this.lookahead > 0 && this.lookahead <= 5) ||
      !(this.poll > 0 && this.poll / 1000 < this.lookahead)
    )
      throw new RangeError(
        'Lookahead must be in (0, 5] seconds; polling must be positive and shorter.',
      );
    const key = (voice: string, p: Rational) =>
      JSON.stringify([voice, String(p.num), String(p.den)]);
    const ends = new Set(performance.sounding.map((e) => key(e.voice, endOf(e))));
    const continuations = new Set(
      performance.sounding.filter((e) => e.noReattack).map((e) => key(e.voice, e.position)),
    );
    for (const e of performance.sounding) {
      const previous = ends.has(key(e.voice, e.position));
      const next = continuations.has(key(e.voice, endOf(e)));
      this.actions.push({
        position: e.position,
        order: 1,
        sounding: e,
        event:
          e.noReattack && previous
            ? {
                kind: 'pitch',
                voice: e.voice,
                hz: 440 * 2 ** ((e.midi - 69) / 12),
                velocity: e.velocity / 127,
                ...(e.damped ? { damped: true } : {}),
                ...(e.timbre ? { timbre: e.timbre } : {}),
              }
            : {
                kind: 'attack',
                voice: e.voice,
                hz: 440 * 2 ** ((e.midi - 69) / 12),
                velocity: e.velocity / 127,
                ...(e.damped ? { damped: true } : {}),
                ...(e.timbre ? { timbre: e.timbre } : {}),
              },
      } as Action);
      if (!next)
        this.actions.push({
          position: endOf(e),
          order: 0,
          event: { kind: 'release', voice: e.voice },
        });
      const points: Rational[] = [ZERO, e.duration];
      for (const c of e.curve) {
        if (c.kind === 'bend') points.push(...c.points.map((p) => p.offset));
        else {
          if (c.period.num <= 0n) throw new RangeError('Vibrato period must be positive.');
          const step = rational(c.period.num, c.period.den * 32n);
          for (
            let p = c.offset;
            compare(p, min(e.duration, add(c.offset, c.duration))) < 0;
            p = add(p, step)
          ) {
            if (points.length >= 100000)
              throw new RangeError('Transport curve exceeds 100,000 points.');
            points.push(p);
          }
          points.push(add(c.offset, c.duration));
        }
      }
      points.push(...performance.tempo.map((t) => subtract(t.position, e.position)));
      const sorted = points
        .filter((p) => compare(p, ZERO) >= 0 && compare(p, e.duration) <= 0)
        .sort(compare)
        .filter((p, i, all) => i === 0 || compare(p, all[i - 1]!) !== 0);
      this.curvePoints.set(e.id, sorted);
      this.actions.push({
        position: e.position,
        order: 2,
        event: { kind: 'bend', voice: e.voice, cents: centsAt(e, ZERO) },
      } as Action);
      for (let i = 1; i < sorted.length; i++) {
        const a = sorted[i - 1]!,
          b = sorted[i]!;
        this.actions.push({
          position: add(e.position, a),
          until: add(e.position, b),
          order: 3,
          event: { kind: 'bend', voice: e.voice, cents: centsAt(e, b) },
        } as Action);
      }
    }
    this.actions.sort((a, b) => compare(a.position, b.position) || a.order - b.order);
  }
  private assertLive() {
    if (this.disposed) throw new Error('Transport is disposed.');
  }
  private bounded(p: Rational): Rational {
    return this.loop && !within(p, this.loop.start, this.loop.end)
      ? this.loop.start
      : min(this.duration, max(ZERO, p));
  }
  get position(): Rational {
    if (this.state !== 'playing') return this.stored;
    if (this.clock.now() === this.audioAnchor) return this.anchor;
    const seconds =
      this.tempo.secondsAt(this.anchor) +
      Math.max(0, this.clock.now() - this.audioAnchor) * this.speed;
    const end = this.tempo.secondsAt(this.loop?.end ?? this.duration);
    if (this.loop && seconds >= end) {
      const start = this.tempo.secondsAt(this.loop.start);
      return max(
        this.loop.start,
        min(this.loop.end, this.tempo.positionAt(start + ((seconds - end) % (end - start)))),
      );
    }
    return seconds >= end ? this.duration : min(this.duration, this.tempo.positionAt(seconds));
  }
  get snapshot(): TransportSnapshot {
    const position = this.position;
    return {
      state: this.state,
      position,
      rate: this.speed,
      activeWritten: [...this.active.values()],
      source: this.performance.sourceMap.find((s) => within(position, s.position, endOf(s))),
    };
  }
  private emit() {
    this.options.onEvent?.({ kind: 'state', snapshot: this.snapshot });
  }
  private invalidate() {
    this.generation++;
    this.clock.clearTimeout(this.timer);
    this.timer = undefined;
    this.notices = [];
    this.visit = undefined;
    this.sink.cancel(this.clock.now());
  }
  /** Call from a gesture; stale unlock promises cannot restart a stopped/seeked generation. */
  async play(): Promise<void> {
    this.assertLive();
    if (this.state === 'playing') return;
    const gen = ++this.generation;
    await this.sink.unlock();
    if (gen !== this.generation || this.disposed) return;
    this.restart(this.stored);
  }
  pause(): void {
    this.assertLive();
    const position = this.position;
    this.invalidate();
    this.state = 'paused';
    this.stored = position;
    this.reconstructHighlights(position);
    this.emit();
  }
  stop(): void {
    this.assertLive();
    this.invalidate();
    this.state = 'stopped';
    this.stored = ZERO;
    this.active.clear();
    this.emit();
  }
  seek(position: Rational): void {
    this.assertLive();
    position = this.bounded(position);
    if (this.state === 'playing') this.restart(position);
    else {
      this.invalidate();
      this.stored = position;
      this.reconstructHighlights(position);
      this.emit();
    }
  }
  setRate(rate: number): void {
    this.assertLive();
    if (!Number.isFinite(rate) || rate < 1 / 16 || rate > 16)
      throw new RangeError('Rate must be in [1/16, 16].');
    this.validateLoop(this.loop, rate);
    const p = this.position;
    this.speed = rate;
    this.seek(p);
  }
  setLoop(loop?: LoopRegion): void {
    this.assertLive();
    this.validateLoop(loop, this.speed);
    const p = this.position;
    this.loop = loop;
    this.seek(p);
  }
  private validateLoop(loop: LoopRegion | undefined, rate: number) {
    if (
      loop &&
      (compare(loop.start, ZERO) < 0 ||
        compare(loop.end, this.duration) > 0 ||
        compare(loop.start, loop.end) >= 0 ||
        this.tempo.secondsAt(loop.end) - this.tempo.secondsAt(loop.start) < 0.001 ||
        (this.lookahead * rate) /
          (this.tempo.secondsAt(loop.end) - this.tempo.secondsAt(loop.start)) >
          9998)
    )
      throw new RangeError(
        'Loop must be inside the performance, at least 1 ms at rate 1, and fit the 10,000-wrap window budget.',
      );
  }
  private restart(p: Rational) {
    this.invalidate();
    p = this.bounded(p);
    this.stored = p;
    this.anchor = p;
    this.audioAnchor = this.clock.now();
    this.scheduledThrough = this.audioAnchor;
    this.state = 'playing';
    this.reconstructHighlights(p);
    this.visit = this.newVisit(p, this.audioAnchor);
    this.pump(this.generation);
  }
  private reconstructHighlights(p: Rational) {
    this.active = new Map(
      this.performance.written.filter((w) => within(p, w.position, endOf(w))).map((w) => [w.id, w]),
    );
  }
  private newVisit(from: Rational, audio: number): Visit {
    const until = this.loop?.end ?? this.duration;
    return {
      from,
      until,
      audio,
      endAudio: audio + (this.tempo.secondsAt(until) - this.tempo.secondsAt(from)) / this.speed,
      initialized: false,
      cursor: 0,
    };
  }
  private audioAt(p: Rational, v: Visit) {
    return v.audio + (this.tempo.secondsAt(p) - this.tempo.secondsAt(v.from)) / this.speed;
  }
  private schedule(action: Action, v: Visit) {
    const audio = this.audioAt(action.position, v);
    let event = { ...action.event, offset: 0 } as SinkEvent;
    if (event.kind === 'pitch' && compare(action.position, v.from) === 0 && action.sounding)
      event = {
        kind: 'attack',
        voice: event.voice,
        hz: event.hz,
        velocity: action.sounding.velocity / 127,
        ...(action.sounding.damped ? { damped: true } : {}),
        ...(action.sounding.timbre ? { timbre: action.sounding.timbre } : {}),
        offset: 0,
      };
    if (action.until && event.kind === 'bend')
      event = {
        ...event,
        rampSeconds:
          (this.tempo.secondsAt(action.until) - this.tempo.secondsAt(action.position)) / this.speed,
      };
    this.sink.schedule([event], audio);
  }
  private initialize(v: Visit) {
    v.initialized = true;
    for (const e of this.performance.sounding.filter(
      (e) => compare(e.position, v.from) < 0 && compare(endOf(e), v.from) > 0,
    )) {
      const offset = subtract(v.from, e.position);
      this.sink.schedule(
        [
          {
            kind: 'attack',
            voice: e.voice,
            hz: 440 * 2 ** ((e.midi - 69) / 12),
            velocity: e.velocity / 127,
            ...(e.damped ? { damped: true } : {}),
            ...(e.timbre ? { timbre: e.timbre } : {}),
            offset: 0,
          },
          {
            kind: 'bend',
            voice: e.voice,
            cents: centsAt(e, offset),
            offset: 0,
          },
        ],
        v.audio,
      );
      const next = this.curvePoints.get(e.id)!.find((p) => compare(p, offset) > 0);
      if (next)
        this.schedule(
          {
            position: v.from,
            until: add(e.position, next),
            order: 3,
            event: { kind: 'bend', voice: e.voice, cents: centsAt(e, next) },
          } as Action,
          v,
        );
    }
    for (const w of this.performance.written) {
      if (compare(endOf(w), v.from) <= 0 || compare(w.position, v.until) >= 0) continue;
      this.notices.push({
        audioTime: this.audioAt(max(w.position, v.from), v),
        kind: 'onset',
        written: w,
      });
      this.notices.push({
        audioTime: this.audioAt(min(endOf(w), v.until), v),
        kind: 'end',
        written: w,
      });
    }
    this.notices.sort(
      (a, b) => a.audioTime - b.audioTime || (a.kind === b.kind ? 0 : a.kind === 'end' ? -1 : 1),
    );
  }
  private pump(gen: number) {
    if (gen !== this.generation || this.state !== 'playing') return;
    const now = this.clock.now();
    // A suspended tab must not replay a backlog of late attacks/highlights.
    if (now > this.scheduledThrough) {
      this.restart(this.position);
      return;
    }
    const horizon = now + this.lookahead;
    this.scheduledThrough = horizon;
    let wraps = 0;
    while (this.visit) {
      const v = this.visit;
      if (!v.initialized) this.initialize(v);
      while (v.cursor < this.actions.length) {
        const a = this.actions[v.cursor]!;
        if (compare(a.position, v.from) < 0) {
          v.cursor++;
          continue;
        }
        if (compare(a.position, v.until) >= 0 || this.audioAt(a.position, v) >= horizon) break;
        this.schedule(a, v);
        v.cursor++;
      }
      if (v.endAudio >= horizon) break;
      this.sink.schedule(
        this.performance.voices.map((voice) => ({
          kind: 'release',
          voice: voice.id,
          offset: 0,
        })),
        v.endAudio,
      );
      if (!this.loop) {
        this.visit = undefined;
        break;
      }
      if (++wraps > 10000) throw new RangeError('Too many loop wraps in one scheduling window.');
      this.visit = this.newVisit(this.loop.start, v.endAudio);
    }
    while (this.notices[0] && this.notices[0].audioTime <= now) {
      const n = this.notices.shift()!;
      if (n.kind === 'onset') this.active.set(n.written.id, n.written);
      else this.active.delete(n.written.id);
      this.options.onEvent?.({
        kind: n.kind,
        writtenId: n.written.id,
        ordinal: n.written.ordinal,
        audioTime: n.audioTime,
      });
      if (gen !== this.generation) return;
    }
    if (
      !this.loop &&
      now >=
        this.audioAnchor +
          (this.tempo.secondsAt(this.duration) - this.tempo.secondsAt(this.anchor)) / this.speed
    ) {
      this.state = 'stopped';
      this.stored = this.duration;
      this.active.clear();
    }
    this.emit();
    if (gen === this.generation && this.state === 'playing')
      this.timer = this.clock.setTimeout(() => this.pump(gen), this.poll);
  }
  dispose(): void {
    if (this.disposed) return;
    this.invalidate();
    this.disposed = true;
    this.state = 'stopped';
    this.active.clear();
    // The host owns the injected sink; dispose it separately if it is not shared.
  }
}
