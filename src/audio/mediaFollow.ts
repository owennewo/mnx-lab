/**
 * The synth playing along with a recording (roadmap/inprogress/studio-mix-layers.md). Pure:
 * the host sits behind `FollowTarget`, the media behind a reading, and the caller ticks it.
 *
 * A recording leads: its clock is the score's, read through its sync. The synth's notes are
 * timed by the performance's tempo map, so each is moved onto the recording's timeline by
 * `mediaWarp` — the score sampled every eighth of a whole note, each sample's synth second
 * paired with the recording second the sync gives it, straight lines between. Within a sample
 * the synth's own timing (swing, a grace's place) is kept, stretched; outside the sync's
 * anchored interval nothing is inferred, as the sync infers nothing there.
 *
 * `MediaFollower` then plays those notes (and the click's beats) against the media's clock as
 * `../clickSchedule.ts` reads it — a line fitted through readings that arrive coarse or
 * jittery — supplying the host about a second ahead. A seek, a loop's wrap, a change of rate or
 * a pause is a restart: what was sent is taken back and the supply starts again from the
 * media's place, a note already sounding there struck again for what is left of it.
 */
import type { Control, Note, Technique } from '@mnx-lab/synth/contract';
import { MediaClockEstimate } from './clickSchedule.ts';
import type { Performance } from './performanceTypes.ts';
import type { RecordingSyncMap } from './recordingSync.ts';
import { performancePositionAt } from './scorePosition.ts';
import { add, compare, rational, type Rational } from './time.ts';

/** Synth seconds (the performance's tempo map) to recording seconds, where the sync says. */
export interface MediaWarp {
  /** Null outside the anchored interval. */
  toMedia(seconds: number): number | null;
  /** The other way: recording seconds to synth seconds, null outside. */
  toSynth(mediaSeconds: number): number | null;
  /** Recording seconds per synth second around `seconds` (1 where nothing is known). */
  slope(seconds: number): number;
}
const SAMPLE = rational(1n, 8n);

export function mediaWarp(performance: Performance, secondsAt: (position: Rational) => number, sync: RecordingSyncMap): MediaWarp {
  const synth: number[] = [], media: number[] = [];
  const sample = (ordinal: number, metricOffset: Rational) => {
    const at = performancePositionAt(performance, { ordinal, metricOffset }, 'before');
    const heard = sync.secondsAt({ ordinal, metricOffset });
    if (!at.ok || !heard.ok) return;
    const s = secondsAt(at.value), m = heard.value;
    // Strictly rising on both clocks, or the line between two samples means nothing.
    if (synth.length && (s <= synth[synth.length - 1]! || m <= media[media.length - 1]!)) return;
    synth.push(s); media.push(m);
  };
  performance.measures.forEach((m, ordinal) => {
    for (let o = m.from; compare(o, m.until) < 0; o = add(o, SAMPLE)) sample(ordinal, o);
  });
  const last = performance.measures.length;
  if (last) sample(last, rational(0n));
  /** The sample segment holding `value` on clock `xs`. */
  const segment = (xs: number[], value: number) => {
    let lo = 0, hi = xs.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (xs[mid]! <= value) lo = mid + 1; else hi = mid; }
    return Math.min(Math.max(0, lo - 1), xs.length - 2);
  };
  const map = (xs: number[], ys: number[], value: number) => {
    if (xs.length < 2 || value < xs[0]! || value > xs[xs.length - 1]!) return null;
    const i = segment(xs, value);
    return ys[i]! + (value - xs[i]!) * (ys[i + 1]! - ys[i]!) / (xs[i + 1]! - xs[i]!);
  };
  return {
    toMedia: seconds => map(synth, media, seconds),
    toSynth: seconds => map(media, synth, seconds),
    slope(seconds) {
      if (synth.length < 2) return 1;
      const i = segment(synth, seconds);
      return (media[i + 1]! - media[i]!) / (synth[i + 1]! - synth[i]!);
    },
  };
}

/** The synth's notes on the recording's timeline: `at` and `duration` in recording seconds.
 *  A note that starts outside the sync is left out; one that ends outside it keeps its length
 *  at the tempo where it starts. */
export function warpNotes(notes: readonly Note[], warp: MediaWarp): Note[] {
  const out: Note[] = [];
  for (const n of notes) {
    const at = warp.toMedia(n.at);
    if (at === null) continue;
    const end = warp.toMedia(n.at + n.duration) ?? at + n.duration * warp.slope(n.at);
    out.push({ ...n, at, duration: Math.max(1e-4, end - at) });
  }
  return out.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
}

/** What the follower needs of the synth's host (src/audio/hostBackend.ts's HostPort). */
export interface FollowTarget {
  /** Host clock, seconds. */
  now(): number;
  schedule(batch: { notes?: Note[]; controls?: Control[]; through?: number }): void;
  cancel(cancel: { from?: number; silence?: boolean }): void;
  click?(at: number, accent: boolean): void;
  idle?(): void;
  /** Wake the host's audio, if it slept while nothing played. */
  unlock?(): Promise<void>;
  /** Seconds from the host rendering a note to it being heard: the browser's buffer, the
   *  system's, a Bluetooth link. A recording's clock already says what is heard (the media
   *  pipeline delays itself to match), so each note is sent this much earlier. 0 where unknown. */
  latency?(): number;
}
export interface MediaReading { readonly mediaTime: number; readonly rate: number; readonly playing: boolean }
export interface FollowEvents {
  /** In recording seconds, sorted. */
  readonly notes: readonly Note[];
  /** In recording seconds, sorted. */
  readonly clicks: readonly { at: number; accent: boolean }[];
  /** The synth's tempo, as the recording plays it, at a recording second (tempo-synced effects). */
  readonly bpmAt?: (mediaSeconds: number) => number;
}
export interface FollowOptions {
  /** How far ahead of the media the host is supplied, in seconds of the media. */
  readonly ahead?: number;
  /** The nearest a note is sent ahead of the host's clock: past the plucked instrument's
   *  commit horizon (0.1 s, synth/docs/contract.md D15). One due sooner, just after a restart,
   *  sounds that much late rather than not at all. */
  readonly lead?: number;
}
/** A reading this far from where the media should be is a seek or a wrap, not jitter. */
const JUMP = 0.25;

export class MediaFollower {
  private readonly clock = new MediaClockEstimate();
  private readonly ahead: number;
  private readonly lead: number;
  private last = NaN;
  private running = false;
  private gen = 0;
  private noteCursor = 0;
  private clickCursor = 0;
  /** Media time supplied through. */
  private through = 0;
  /** Where the media should be now, from the last tick, and the rate the supply was made at. */
  private expected = { now: 0, media: 0, rate: 1 };
  private emitted = new Set<string>();
  constructor(private readonly target: FollowTarget, private events: FollowEvents, options: FollowOptions = {}) {
    this.ahead = options.ahead ?? 1;
    this.lead = options.lead ?? 0.12;
  }
  /** New notes or beats (an edit, a sync changed): what was sent is taken back and the supply
   *  starts again from where the media is. */
  replace(events: FollowEvents) {
    this.events = events;
    if (this.running) this.halt(false);
  }
  /** `now` is any monotonic clock in seconds (the page's), sampled with the reading. */
  tick(now: number, reading: MediaReading | null) {
    if (!reading) { this.clock.reset(); this.last = NaN; if (this.running) this.halt(true); return; }
    if (reading.mediaTime !== this.last || reading.playing !== this.clock.playing || reading.rate !== this.clock.playbackRate) {
      this.clock.sample(now, reading.mediaTime, reading.rate, reading.playing);
      this.last = reading.mediaTime;
    }
    if (!this.clock.playing) { if (this.running) this.halt(true); return; }
    const media = this.clock.at(now), rate = this.clock.playbackRate;
    if (this.running) {
      const drift = media - (this.expected.media + (now - this.expected.now) * this.expected.rate);
      if (rate !== this.expected.rate || Math.abs(drift) > JUMP) this.halt(false);
    }
    if (!this.running) this.start(media, rate);
    this.expected = { now, media, rate };
    this.supply(media, rate);
  }
  private latency() { const l = this.target.latency?.() ?? 0; return Number.isFinite(l) && l > 0 ? l : 0; }
  /** Stop supplying, and silence what was sent. */
  stop() { if (this.running) this.halt(true); this.clock.reset(); this.last = NaN; }

  private halt(idle: boolean) {
    this.running = false;
    this.target.cancel({ from: this.target.now(), silence: true });
    if (idle) this.target.idle?.();
  }
  private start(media: number, rate: number) {
    this.running = true;
    void this.target.unlock?.().catch(() => {});
    this.gen++;
    this.emitted = new Set();
    const { notes, clicks } = this.events;
    this.noteCursor = firstAt(notes, media);
    this.clickCursor = firstAt(clicks, media);
    this.through = media;
    // The soonest a note can be sent, and when that is heard.
    const host = this.target.now() + this.lead, wait = this.lead + this.latency(), sustained: Note[] = [];
    // A note sounding where the media is: struck again for what is left of it.
    for (let i = 0; i < this.noteCursor; i++) {
      const n = notes[i]!;
      if (n.at + n.duration > media + wait * rate) {
        this.emitted.add(n.id);
        const { techniques, ...rest } = n;
        const kept = (techniques ?? []).filter(t => t.type === 'mute' || t.type === 'harmonic');
        sustained.push({ ...rest, id: `${n.id}:f${this.gen}`, at: host, duration: Math.max(1e-4, (n.at + n.duration - media) / rate - wait),
          ...(kept.length ? { techniques: kept } : {}) });
      }
    }
    const bpm = this.events.bpmAt?.(media);
    const controls: Control[] = bpm ? [{ id: `tempo:f${this.gen}`, at: host, type: 'tempo', bpm: bpm * rate } as Control] : [];
    if (sustained.length || controls.length) this.target.schedule({ notes: sustained, controls });
  }
  private supply(media: number, rate: number) {
    const to = media + this.ahead * rate;
    if (to <= this.through) return;
    // Host time is when a note is rendered; the media's clock is what is heard.
    const now = this.target.now(), soonest = now + this.lead, heardNow = now - this.latency();
    const hostAt = (seconds: number) => Math.max(soonest, heardNow + (seconds - media) / rate);
    const { notes, clicks } = this.events, out: Note[] = [];
    for (; this.noteCursor < notes.length && notes[this.noteCursor]!.at < to; this.noteCursor++) {
      const n = notes[this.noteCursor]!;
      out.push(this.placed(n, hostAt(n.at), rate));
    }
    for (; this.clickCursor < clicks.length && clicks[this.clickCursor]!.at < to; this.clickCursor++) {
      const c = clicks[this.clickCursor]!;
      this.target.click?.(hostAt(c.at), c.accent);
    }
    this.through = to;
    this.target.schedule({ notes: out, through: heardNow + (to - media) / rate });
  }
  /** A note at host time `at`, its length and techniques retimed for the rate. */
  private placed(n: Note, at: number, rate: number): Note {
    const techniques = (n.techniques ?? []).flatMap((t): Technique[] => {
      if (t.type === 'legato') return this.emitted.has(t.from as string) ? [{ ...t, from: `${t.from}:f${this.gen}` } as Technique] : [];
      if (t.type === 'vibrato') return [{ ...t, rateHz: (t.rateHz as number) * rate } as Technique];
      return [t];
    });
    this.emitted.add(n.id);
    const { techniques: _, ...rest } = n;
    return { ...rest, id: `${n.id}:f${this.gen}`, at, duration: Math.max(1e-4, n.duration / rate), ...(techniques.length ? { techniques } : {}) };
  }
}

/** First index in time-sorted items at or after `seconds`. */
function firstAt(items: readonly { at: number }[], seconds: number) {
  let lo = 0, hi = items.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (items[mid]!.at < seconds) lo = mid + 1; else hi = mid; }
  return lo;
}
