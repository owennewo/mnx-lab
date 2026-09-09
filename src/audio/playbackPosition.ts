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
