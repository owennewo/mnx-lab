/** Pure transport. The injected clock and sink share the same audio-time origin. */
import type {
  Performance,
  SoundingEvent,
  WrittenOccurrence,
  SourceSegment,
} from './performanceTypes.ts';
import type { Sink, SinkEvent } from './sink.ts';
import type { Take } from './practice.ts';
import {
  ZERO,
  add,
  subtract,
  compare,
  min,
  max,
  rational,
  createTempoMap,
  divide,
  type Rational,
} from './time.ts';

export interface Clock {
  now(): number;
  setTimeout(callback: () => void, milliseconds: number): unknown;
  clearTimeout(handle: unknown): void;
}
/** One playing of a loop's passage, as a practice lays it out (src/audio/practice.ts). */
export interface LoopVisit {
  start: Rational;
  end: Rational;
  /** Its rate; omitted: the transport's (`setRate`). */
  rate?: number;
  /** Silence before it when it follows the visit before: a count-in or a gap, in whole notes at
   *  the tempo where it starts. */
  lead: Rational;
  /** The lead is a count-in, clicked on its beats; otherwise it is a gap, silent. */
  counted: boolean;
  /** The count-in when playback starts inside this visit (play, after a pause). */
  countIn: Rational;
  /** A count-in's beat, in whole notes, and its beats to the bar (the first of each is accented). */
  beat: Rational;
  perBar: number;
  /** A click on these positions through the passage; empty when the click is off. */
  clicks: readonly { at: Rational; accent: boolean }[];
  /** It plays on to its end, and nothing follows it. */
  runOut: boolean;
  /** The practice's own account of it, carried for the player's labels. */
  take?: Take;
}
export interface LoopRegion {
  start: Rational;
  end: Rational;
  /** The visits a practice plays, by index from 0, and null past the last. Omitted: start to
   *  end, again and again, seamlessly. */
  visits?: (k: number) => LoopVisit | null;
}
/** Where a loop's practice stands (`TransportSnapshot.loop`). */
export interface LoopState {
  k: number;
  visit: LoopVisit;
  /** In a count-in: the beat sounding, from 1, of how many. */
  counting: { beat: number; of: number } | null;
  /** In the silence between two repeats. */
  resting: boolean;
  /** The practice came to its end here (Stop, or an advance with nowhere to go): playback stopped. */
  ended: boolean;
}
/** A visit as the transport has laid it out from its last restart, in its clock's time. */
export interface PlannedVisit {
  readonly k: number;
  readonly from: Rational;
  readonly until: Rational;
  readonly rate: number;
  /** When its lead (count-in or gap) begins; `audio`, when `from` sounds. */
  readonly leadAudio: number;
  readonly audio: number;
  readonly endAudio: number;
  /** Part of a loop: notes are cut at `until`. */
  readonly looped: boolean;
  /** The count-in's clicks before it, in the clock's time. */
  readonly countClicks: readonly { audio: number; accent: boolean }[];
  /** The passage's clicks, as positions. */
  readonly clicks: readonly { at: Rational; accent: boolean }[];
}
export interface TransportSnapshot {
  state: 'stopped' | 'paused' | 'playing';
  position: Rational;
  rate: number;
  activeWritten: readonly WrittenOccurrence[];
  source: SourceSegment | undefined;
  /** Present while a loop is set. */
  loop?: LoopState;
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
/** The index of the first of `sorted` strictly after `p` (binary search). */
function firstAfter(sorted: readonly Rational[], p: Rational): number {
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (compare(sorted[mid]!, p) <= 0) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
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
  /** The loop visit's index; -1 without a loop. */
  k: number;
  spec: LoopVisit | undefined;
  from: Rational;
  until: Rational;
  rate: number;
  leadAudio: number;
  audio: number;
  endAudio: number;
  lead: Rational;
  counted: boolean;
  initialized: boolean;
  cursor: number;
}
/** A loop with no practice: the region, seamlessly, forever. */
const seamless = (loop: LoopRegion): LoopVisit => ({ start: loop.start, end: loop.end, lead: ZERO, counted: false, countIn: ZERO,
  beat: rational(1n, 4n), perBar: 4, clicks: [], runOut: false });
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
  /** The loop visit playing, or to play from. */
  private k = 0;
  /** The visit a practice ended on, until playback starts again. */
  private ended: LoopVisit | undefined;
  private audioAnchor = 0;
  private generation = 0;
  private timer: unknown;
  private scheduledThrough = 0;
  private disposed = false;
  /** The visits laid out since the last restart; `base` is the first's index among them all. */
  private timeline: Visit[] = [];
  private base = 0;
  /** The index (among them all) of the visit being scheduled; past the last when done. */
  private scheduling = 0;
  /** Nothing follows the timeline's last visit. */
  private closed = false;
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
    // Tempo changes, in order: a note's curve is cut only where one falls INSIDE it.
    const tempoPositions = performance.tempo.map((t) => t.position).sort(compare);
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
      // Those at its start or end would only repeat 0 and the duration, already here.
      const end = endOf(e);
      for (let i = firstAfter(tempoPositions, e.position); i < tempoPositions.length && compare(tempoPositions[i]!, end) < 0; i++)
        points.push(subtract(tempoPositions[i]!, e.position));
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
  /** The loop's visit `k`, or its first when a practice has none that far. */
  private specAt(k: number): LoopVisit | undefined {
    const loop = this.loop;
    if (!loop) return undefined;
    if (!loop.visits) return seamless(loop);
    return loop.visits(k) ?? loop.visits(0) ?? undefined;
  }
  private bounded(p: Rational): Rational {
    const spec = this.specAt(this.k);
    if (spec) return within(p, spec.start, spec.runOut ? this.duration : spec.end) ? p : spec.start;
    return min(this.duration, max(ZERO, p));
  }
  /** The visit sounding at clock time `now` — the last whose lead has begun. */
  private visitAt(now: number): Visit | undefined {
    for (let i = this.timeline.length - 1; i >= 0; i--) if (this.timeline[i]!.leadAudio <= now) return this.timeline[i];
    return this.timeline[0];
  }
  get position(): Rational {
    if (this.state !== 'playing') return this.stored;
    const now = this.clock.now(), v = this.visitAt(now);
    if (!v) return this.stored;
    if (now <= v.audio) return v.from;
    const seconds = this.tempo.secondsAt(v.from) + (now - v.audio) * v.rate;
    return seconds >= this.tempo.secondsAt(v.until) ? v.until : min(v.until, this.tempo.positionAt(seconds));
  }
  /** The loop region set, if any (a backend that schedules its own audio follows it). */
  get loopRegion(): LoopRegion | undefined {
    return this.loop;
  }
  private get loopState(): LoopState | undefined {
    if (!this.loop) return undefined;
    if (this.ended) return { k: this.k, visit: this.ended, counting: null, resting: false, ended: true };
    const now = this.clock.now();
    const v = this.state === 'playing' ? this.visitAt(now) : undefined;
    const spec = v?.spec ?? this.specAt(this.k);
    if (!spec) return undefined;
    const leading = v !== undefined && now < v.audio && v.audio > v.leadAudio;
    const beats = v && leading && v.counted ? Math.max(1, Number(divide(v.lead, spec.beat).num / divide(v.lead, spec.beat).den)) : 0;
    return {
      k: v?.k ?? this.k,
      visit: spec,
      counting: v && beats ? { beat: Math.min(beats, Math.floor((now - v.leadAudio) / (v.audio - v.leadAudio) * beats) + 1), of: beats } : null,
      resting: leading && !v.counted,
      ended: false,
    };
  }
  get snapshot(): TransportSnapshot {
    const position = this.position;
    const playing = this.state === 'playing' ? this.visitAt(this.clock.now()) : undefined;
    const loop = this.loopState;
    return {
      state: this.state,
      position,
      rate: playing?.rate ?? this.specAt(this.k)?.rate ?? this.speed,
      activeWritten: [...this.active.values()],
      source: this.performance.sourceMap.find((s) => within(position, s.position, endOf(s))),
      ...(loop ? { loop } : {}),
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
    this.timeline = [];
    this.base = this.scheduling = 0;
    this.closed = true;
    this.sink.cancel(this.clock.now());
  }
  /** Call from a gesture; stale unlock promises cannot restart a stopped/seeked generation. */
  async play(): Promise<void> {
    this.assertLive();
    if (this.state === 'playing') return;
    const gen = ++this.generation;
    await this.sink.unlock();
    if (gen !== this.generation || this.disposed) return;
    this.restart(this.stored, true);
  }
  pause(): void {
    this.assertLive();
    const position = this.position;
    const v = this.state === 'playing' ? this.visitAt(this.clock.now()) : undefined;
    if (v && v.k >= 0) this.k = v.k;
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
    this.k = 0;
    this.ended = undefined;
    this.active.clear();
    this.emit();
  }
  seek(position: Rational): void {
    this.assertLive();
    if (this.state === 'playing') {
      const v = this.visitAt(this.clock.now());
      if (v && v.k >= 0) this.k = v.k;
    }
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
  /** Set or clear the loop. A practice (`LoopRegion.visits`) starts again from its first visit. */
  setLoop(loop?: LoopRegion): void {
    this.assertLive();
    this.validateLoop(loop, this.speed);
    const p = this.position;
    this.loop = loop;
    this.k = 0;
    this.ended = undefined;
    // Playing, playback carries on where it is inside the loop and moves to its start from outside
    // it. Paused or stopped the place stays put — a cursor parked elsewhere is not moved — and
    // play starts at the loop (`restart` bounds it).
    if (this.state === 'playing') this.restart(this.bounded(p));
    else this.emit();
  }
  private validateLoop(loop: LoopRegion | undefined, rate: number) {
    const first = loop?.visits ? loop.visits(0) : loop;
    if (
      loop &&
      (!first ||
        compare(loop.start, ZERO) < 0 ||
        compare(loop.end, this.duration) > 0 ||
        compare(loop.start, loop.end) >= 0 ||
        this.tempo.secondsAt(loop.end) - this.tempo.secondsAt(loop.start) < 0.001 ||
        (this.lookahead * Math.max(rate, ...(first && 'rate' in first && first.rate ? [first.rate] : []))) /
          (this.tempo.secondsAt(loop.end) - this.tempo.secondsAt(loop.start)) >
          9998)
    )
      throw new RangeError(
        'Loop must be inside the performance, at least 1 ms at rate 1, and fit the 10,000-wrap window budget.',
      );
  }
  /** Start playing at `p`: counted in first when `counting` (play) and the loop's visit has a count-in. */
  private restart(p: Rational, counting = false) {
    this.invalidate();
    this.ended = undefined;
    p = this.bounded(p);
    this.stored = p;
    this.audioAnchor = this.clock.now();
    this.scheduledThrough = this.audioAnchor;
    this.state = 'playing';
    this.reconstructHighlights(p);
    const spec = this.specAt(this.k);
    const lead = counting && spec ? spec.countIn : ZERO;
    this.timeline = [this.newVisit(spec ? this.k : -1, spec, p, this.audioAnchor, lead, compare(lead, ZERO) > 0)];
    this.closed = false;
    this.pump(this.generation);
  }
  private reconstructHighlights(p: Rational) {
    this.active = new Map(
      this.performance.written.filter((w) => within(p, w.position, endOf(w))).map((w) => [w.id, w]),
    );
  }
  private newVisit(k: number, spec: LoopVisit | undefined, from: Rational, leadAudio: number, lead: Rational, counted: boolean): Visit {
    const rate = spec?.rate ?? this.speed;
    const until = spec?.end ?? this.duration;
    const start = spec?.start ?? from;
    const leadSeconds = compare(lead, ZERO) > 0 ? this.tempo.secondsAt(add(start, lead)) - this.tempo.secondsAt(start) : 0;
    const audio = leadAudio + leadSeconds / rate;
    return {
      k, spec, from, until, rate, leadAudio, audio, lead, counted,
      endAudio: audio + (this.tempo.secondsAt(until) - this.tempo.secondsAt(from)) / rate,
      initialized: false,
      cursor: 0,
    };
  }
  /** The visit at `index` among all laid out since the last restart, laying out more as needed; undefined past the last. */
  private visitIndex(index: number): Visit | undefined {
    while (!this.closed && this.base + this.timeline.length <= index) {
      const last = this.timeline.at(-1)!;
      // A seamless loop's next visit is the same span again; a practice says what its next is.
      const next = last.spec && !last.spec.runOut ? (this.loop?.visits ? this.loop.visits(last.k + 1) ?? undefined : last.spec) : undefined;
      if (!next) { this.closed = true; break; }
      this.timeline.push(this.newVisit(last.k + 1, next, next.start, last.endAudio, next.lead, next.counted));
    }
    return this.timeline[index - this.base];
  }
  /** The visits a backend that schedules its own audio plays (src/audio/hostBackend.ts), by the same
   *  index from the last restart; undefined past the last. */
  planned(index: number): PlannedVisit | undefined {
    const v = this.visitIndex(index);
    if (!v) return undefined;
    const countClicks: { audio: number; accent: boolean }[] = [];
    if (v.counted && v.spec && v.audio > v.leadAudio) {
      const beats = Math.max(1, Number(divide(v.lead, v.spec.beat).num / divide(v.lead, v.spec.beat).den));
      for (let i = 0; i < beats; i++)
        countClicks.push({ audio: v.leadAudio + (v.audio - v.leadAudio) * i / beats, accent: i % Math.max(1, v.spec.perBar) === 0 });
    }
    return { k: v.k, from: v.from, until: v.until, rate: v.rate, leadAudio: v.leadAudio, audio: v.audio, endAudio: v.endAudio,
      looped: v.spec !== undefined && !v.spec.runOut, countClicks, clicks: v.spec?.clicks.filter(c => compare(c.at, v.from) >= 0) ?? [] };
  }
  private audioAt(p: Rational, v: Visit) {
    return v.audio + (this.tempo.secondsAt(p) - this.tempo.secondsAt(v.from)) / v.rate;
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
          (this.tempo.secondsAt(action.until) - this.tempo.secondsAt(action.position)) / v.rate,
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
      const v = this.visitAt(now);
      if (v && v.k >= 0) this.k = v.k;
      this.restart(this.position);
      return;
    }
    const horizon = now + this.lookahead;
    this.scheduledThrough = horizon;
    let wraps = 0;
    for (let v = this.visitIndex(this.scheduling); v; v = this.visitIndex(this.scheduling)) {
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
      this.scheduling++;
      if (++wraps > 10000) throw new RangeError('Too many loop wraps in one scheduling window.');
    }
    // Visits long over are dropped; a second back is kept for anyone still reading them.
    while (this.timeline.length > 1 && this.base + 1 < this.scheduling && this.timeline[1]!.leadAudio < now - 1) {
      this.timeline.shift();
      this.base++;
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
    const last = this.timeline.at(-1);
    if (this.closed && last && this.base + this.timeline.length <= this.scheduling && now >= last.endAudio) {
      this.state = 'stopped';
      this.active.clear();
      if (last.spec && !last.spec.runOut) {
        // A practice's end (Stop, or an advance with nowhere to go): parked at its last passage's start.
        this.ended = last.spec;
        this.k = 0;
        this.stored = last.spec.start;
      } else {
        this.k = 0;
        this.stored = this.duration;
      }
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
