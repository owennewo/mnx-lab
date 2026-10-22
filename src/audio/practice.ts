/**
 * A loop as a practice schedule (roadmap/inprogress/studio-player-practice.md). Pure.
 *
 * A loop is whole performed bars — a first and a last ordinal, so "bars 5–8 the second
 * time through" is one loop and a passage across a repeat sign plays in performed order.
 * The options say how it is practised: a count-in before it, how many repeats, a gap of
 * silence between them, a speed trainer that raises the rate every few repeats, and what
 * happens when the repeats are done:
 *
 * - **stop** — playback stops, parked at the loop's start;
 * - **continue** — the music carries on from the loop's end to the end of the piece;
 * - **advance** — the loop moves on a bar (start and end), the trainer drops back to its
 *   start, it counts in again and the repeats begin again. A loop that cannot move on — its
 *   last bar is the piece's last — stops.
 *
 * `practiceTakes` lays this out as takes; `practiceRegion` hands them to the transport as
 * the visits of its loop (`LoopRegion.visits`), in performance positions.
 */
import type { Performance } from './performanceTypes.ts';
import type { LoopRegion, LoopVisit } from './transport.ts';
import { add, compare, multiply, rational, subtract, type Rational } from './time.ts';

export type PracticeThen = 'stop' | 'continue' | 'advance';
/** Rates are fractions of the written tempo: start 0.7, step 0.05, every 2 repeats, up to 1. */
export interface SpeedTrainer { start: number; step: number; every: number; ceiling: number }
export interface PracticeOptions {
  /** Bars of count-in before the passage: when playback starts and whenever the loop advances. */
  countIn: number;
  /** How many times the passage plays; null: until it is stopped. */
  repeats: number | null;
  /** What happens once the repeats are done (ignored while `repeats` is null). */
  then: PracticeThen;
  /** Bars of silence between one repeat and the next. */
  gap: number;
  trainer: SpeedTrainer | null;
  /** Click every beat through the passage. */
  click: boolean;
}
/** A loop and nothing more: the passage, again and again, seamlessly. */
export const PLAIN_LOOP: PracticeOptions = Object.freeze({ countIn: 0, repeats: null, then: 'stop', gap: 0, trainer: null, click: false });
export const DEFAULT_TRAINER: SpeedTrainer = Object.freeze({ start: 0.7, step: 0.05, every: 2, ceiling: 1 });

/** A loop's bars: performed ordinals, first and last inclusive. */
export interface LoopBars { first: number; last: number }

/** One playing of the passage, or the run-out after it. */
export interface Take {
  /** Its index in the whole practice, from 0. */
  k: number;
  bars: LoopBars;
  /** 1-based, counted afresh each time the loop advances. */
  repeat: number;
  rate: number;
  /** Opens a passage (the first take, or one the loop advanced to): it is counted in. */
  opens: boolean;
  /** The music carrying on past the loop to the end of the piece; nothing comes after it. */
  runOut: boolean;
}

/** The trainer's rate on a repeat: up a step every `every` repeats, never past the ceiling. */
export function trainerRate(trainer: SpeedTrainer, repeat: number): number {
  const steps = Math.floor((repeat - 1) / Math.max(1, trainer.every));
  return Math.round(Math.min(trainer.ceiling, trainer.start + steps * trainer.step) * 1e6) / 1e6;
}

/**
 * The take after `take` (the first when null), or null when the practice is over.
 * `lastOrdinal` is the performance's last bar; `rate` the player's rate when the trainer is off.
 */
export function takeAfter(take: Take | null, loop: LoopBars, options: PracticeOptions, lastOrdinal: number, rate: number): Take | null {
  const rateFor = (repeat: number) => options.trainer ? trainerRate(options.trainer, repeat) : rate;
  if (!take) return { k: 0, bars: loop, repeat: 1, rate: rateFor(1), opens: true, runOut: false };
  if (take.runOut) return null;
  const k = take.k + 1;
  if (options.repeats === null || take.repeat < options.repeats)
    return { k, bars: take.bars, repeat: take.repeat + 1, rate: rateFor(take.repeat + 1), opens: false, runOut: false };
  if (options.then === 'stop') return null;
  if (take.bars.last >= lastOrdinal) return null;
  if (options.then === 'continue')
    return { k, bars: { first: take.bars.last + 1, last: lastOrdinal }, repeat: take.repeat, rate: take.rate, opens: false, runOut: true };
  return { k, bars: { first: take.bars.first + 1, last: take.bars.last + 1 }, repeat: 1, rate: rateFor(1), opens: true, runOut: false };
}

/** The first `count` takes (fewer when the practice ends sooner). */
export function practiceTakes(loop: LoopBars, options: PracticeOptions, lastOrdinal: number, rate: number, count: number): Take[] {
  const takes: Take[] = [];
  for (let take = takeAfter(null, loop, options, lastOrdinal, rate); take && takes.length < count; take = takeAfter(take, loop, options, lastOrdinal, rate))
    takes.push(take);
  return takes;
}

/** What a bar is counted in: its beats to the bar and one beat's length, in whole notes. */
export type MeterOf = (ordinal: number) => { count: number; beat: Rational };
/** Quarter-note beats over the bar's written length: a meter for a performance with no document. */
export const quarterBeats = (performance: Performance): MeterOf => ordinal => {
  const m = performance.measures[ordinal];
  const quarters = m ? multiply(m.metricDuration, rational(4n)) : rational(4n);
  return { count: Math.max(1, Number(quarters.num / quarters.den)), beat: rational(1n, 4n) };
};

/**
 * The transport's loop for a practice: the visits of `practiceTakes`, each spanning its bars
 * as performance positions. Takes are made as the transport asks for them, and kept.
 */
export function practiceRegion(performance: Performance, loop: LoopBars, options: PracticeOptions, rate: number, meterOf: MeterOf = quarterBeats(performance)): LoopRegion {
  const measures = performance.measures, lastOrdinal = measures.length - 1;
  const first = measures[loop.first], last = measures[loop.last];
  if (!first || !last || loop.first > loop.last) throw new RangeError('A loop is a run of the performance\'s bars, first to last.');
  const takes: Take[] = [];
  const visit = (k: number): LoopVisit | null => {
    while (takes.length <= k) {
      const next = takeAfter(takes.at(-1) ?? null, loop, options, lastOrdinal, rate);
      if (!next) return null;
      takes.push(next);
    }
    const take = takes[k]!, from = measures[take.bars.first]!, to = measures[take.bars.last]!;
    const meter = meterOf(take.bars.first);
    const bar = multiply(meter.beat, rational(BigInt(meter.count)));
    const clicks: { at: Rational; accent: boolean }[] = [];
    if (options.click)
      for (let o = take.bars.first; o <= take.bars.last; o++) {
        const m = measures[o]!, { count, beat } = meterOf(o);
        // A visit that starts mid-bar (a jump into it) counts from the bar's start all the same.
        const barStart = subtract(m.position, m.from);
        for (let i = 0; i < count; i++) {
          const at = add(barStart, multiply(beat, rational(BigInt(i))));
          if (compare(at, m.position) >= 0 && compare(at, add(m.position, m.duration)) < 0) clicks.push({ at, accent: i === 0 });
        }
      }
    return {
      start: from.position,
      end: add(to.position, to.duration),
      // Without the trainer a take plays at whatever rate the player is set to.
      ...(options.trainer ? { rate: take.rate } : {}),
      lead: take.opens ? multiply(bar, rational(BigInt(options.countIn))) : multiply(bar, rational(BigInt(options.gap))),
      counted: take.opens,
      countIn: multiply(bar, rational(BigInt(options.countIn))),
      beat: meter.beat,
      perBar: meter.count,
      clicks,
      runOut: take.runOut,
      take,
    };
  };
  if (!visit(0)) throw new RangeError('A practice has at least one take.');
  return { start: first.position, end: add(last.position, last.duration), visits: visit };
}
