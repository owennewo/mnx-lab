import type { Performance, PerformanceMeasure } from './performanceTypes.ts';
import type { ScorePosition } from './scorePosition.ts';
import type { MnxStructure } from '../model/mnx.ts';
import { ZERO, add, subtract, multiply, divide, rational, compare, type Rational } from './time.ts';
export function measureAt(
  performance: Performance,
  position: Rational,
): PerformanceMeasure | undefined {
  return performance.measures.find(
    (m) => compare(position, m.position) >= 0 && compare(position, add(m.position, m.duration)) < 0,
  );
}
/** How many times the performance visits this written measure — the last
 *  iteration it reaches, so a readout can say `iteration 2 of 3`. */
export function iterationsOf(performance: Performance, measureIndex: number): number {
  let last = 1;
  for (const m of performance.measures)
    if (m.measureIndex === measureIndex && m.iteration > last) last = m.iteration;
  return last;
}
/** Every visit to a written measure, in performed order — the passes a
 *  readout can offer as a menu (the verses of a bar). */
export function passesOf(performance: Performance, measureIndex: number): PerformanceMeasure[] {
  return performance.measures
    .filter((m) => m.measureIndex === measureIndex)
    .sort((a, b) => a.ordinal - b.ordinal);
}
/** The readout's fields, for a host that renders one of them as a control. */
export interface PlaybackPositionParts {
  ordinal: number;
  measureIndex: number;
  /** The written bar number as printed. */
  bar: string;
  iteration: number;
  iterations: number;
  /** The beat with its tenth when it has one: `3`, `4.5` — printed after the bar as `# 21.4.5`. */
  beat: string;
  insertion: 'hold' | 'grace' | null;
}
export function playbackPositionParts(
  performance: Performance,
  position: Rational,
  document?: MnxStructure,
): PlaybackPositionParts | null {
  const measure = measureAt(performance, position);
  if (!measure) return null;
  const segment = performance.sourceMap.find(
    (s) => compare(position, s.position) >= 0 && compare(position, add(s.position, s.duration)) < 0,
  );
  // A swung segment plays at `scale` times its written length, so the distance
  // travelled inside it divides back out to reach the written beat.
  const offset =
    segment?.kind === 'metric'
      ? add(
          segment.metricOffset,
          segment.scale
            ? divide(subtract(position, segment.position), segment.scale)
            : subtract(position, segment.position),
        )
      : (segment?.sources.find((s) => s.ordinal === measure.ordinal)?.metricOffset ?? measure.from);
  const parts = scorePlaybackPositionParts(performance, { ordinal: measure.ordinal, metricOffset: offset }, document)!;
  return { ...parts, insertion: segment && segment.kind !== 'metric' ? (segment.kind === 'fermata' ? 'hold' : 'grace') : null };
}
export function scorePlaybackPositionParts(performance: Performance, position: ScorePosition, document?: MnxStructure): PlaybackPositionParts | null {
  const measure = performance.measures[position.ordinal];
  if (!measure) return null;
  let unit = 4;
  for (let i = 0; i <= measure.measureIndex; i++)
    unit = document?.global.measures[i]?.time?.unit ?? unit;
  const beat = add(rational(1n), multiply(position.metricOffset, rational(BigInt(unit))));
  const tenths = (beat.num * 10n) / beat.den;
  const label = `${tenths / 10n}${tenths % 10n ? '.' + (tenths % 10n) : ''}`;
  return {
    ordinal: measure.ordinal,
    measureIndex: measure.measureIndex,
    bar: String(document?.global.measures[measure.measureIndex]?.number ?? measure.measureIndex + 1),
    iteration: measure.iteration,
    iterations: iterationsOf(performance, measure.measureIndex),
    beat: label,
    insertion: null,
  };
}
/** The place in the written score as one dotted number — `# 21.4` is bar 21
 *  beat 4, `# 21.4.5` half a beat in — so bar, beat and sub-beat read together. */
export function placeLabel(parts: Pick<PlaybackPositionParts, 'bar' | 'beat'>): string {
  return `# ${parts.bar}.${parts.beat}`;
}
export function formatPlaybackPosition(
  performance: Performance,
  position: Rational,
  document?: MnxStructure,
): string {
  const parts = playbackPositionParts(performance, position, document);
  if (!parts) return compare(position, ZERO) === 0 ? 'Ready' : 'End';
  return `${placeLabel(parts)} · iteration ${parts.iteration} of ${parts.iterations}${parts.insertion ? ` · ${parts.insertion}` : ''}`;
}
export function formatScorePlaybackPosition(performance: Performance, position: ScorePosition, document?: MnxStructure): string {
  const parts = scorePlaybackPositionParts(performance, position, document);
  return parts ? `${placeLabel(parts)} · iteration ${parts.iteration} of ${parts.iterations}` : 'End';
}
/**
 * The widest label `formatPlaybackPosition` can print for this performance,
 * so a readout can reserve its width once instead of nudging its neighbours
 * every time the beat ticks from `4` to `4.5`. Every field is taken at its
 * longest: the longest written bar number, the last iteration, the fullest
 * beat of any measure with a tenth on it, and the longer insertion word when
 * the performance holds or graces anywhere.
 */
export function widestPlaybackPosition(performance: Performance, document?: MnxStructure): string {
  if (performance.measures.length === 0) return 'Ready';
  let bar = '';
  let iteration = 1;
  let beat = 1n;
  let unit = 4;
  let nextUnitIndex = 0;
  for (const measure of performance.measures) {
    const number = String(document?.global.measures[measure.measureIndex]?.number ?? measure.measureIndex + 1);
    if (number.length > bar.length) bar = number;
    iteration = Math.max(iteration, measure.iteration);
    for (let i = nextUnitIndex; i <= measure.measureIndex; i++)
      unit = document?.global.measures[i]?.time?.unit ?? unit;
    nextUnitIndex = Math.max(nextUnitIndex, measure.measureIndex + 1);
    // The last beat label a measure prints has integer part ⌈until × unit⌉:
    // offsets stop just short of `until`, so a whole-beat end prints that
    // beat's tenths and a partial end rounds up into its final beat.
    const scaled = multiply(measure.until, rational(BigInt(unit)));
    const last = (scaled.num + scaled.den - 1n) / scaled.den;
    if (last > beat) beat = last;
  }
  const kinds = new Set(performance.sourceMap.map((s) => s.kind));
  const suffix = kinds.has('makeTime') ? ' · grace' : kinds.has('fermata') ? ' · hold' : '';
  return `${placeLabel({ bar, beat: `${beat}.5` })} · iteration ${iteration} of ${iteration}${suffix}`;
}
