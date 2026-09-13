import type { Performance, PerformanceMeasure } from './performanceTypes.ts';
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
export function formatPlaybackPosition(
  performance: Performance,
  position: Rational,
  document?: MnxStructure,
): string {
  const measure = measureAt(performance, position);
  if (!measure) return compare(position, ZERO) === 0 ? 'Ready' : 'End';
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
  let unit = 4;
  for (let i = 0; i <= measure.measureIndex; i++)
    unit = document?.global.measures[i]?.time?.unit ?? unit;
  const beat = add(rational(1n), multiply(offset, rational(BigInt(unit))));
  const tenths = (beat.num * 10n) / beat.den;
  const label = `${tenths / 10n}${tenths % 10n ? '.' + (tenths % 10n) : ''}`;
  return `bar ${document?.global.measures[measure.measureIndex]?.number ?? measure.measureIndex + 1} · iteration ${measure.iteration} · beat ${label}${segment && segment.kind !== 'metric' ? ` · ${segment.kind === 'fermata' ? 'hold' : 'grace'}` : ''}`;
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
  return `bar ${bar} · iteration ${iteration} · beat ${beat}.5${suffix}`;
}
