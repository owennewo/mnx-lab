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
/** How many times the performance visits this written measure — its last
 *  occurrence, so a readout can say `pass 2 of 3`. Occurrences never reset,
 *  where the strain `iteration` does when a jump fires. */
export function occurrencesOf(performance: Performance, measureIndex: number): number {
  let last = 1;
  for (const m of performance.measures)
    if (m.measureIndex === measureIndex && m.occurrence > last) last = m.occurrence;
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
  /** Which visit to the bar this is, from 1 — the `.2` of `9.2`, as the lyric text names it. */
  occurrence: number;
  occurrences: number;
  /** The beat, with its written fraction when it has one: `3`, `1½`, `2⅓`. */
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
  const beat = beatLabel(add(rational(1n), multiply(position.metricOffset, rational(BigInt(unit)))));
  return {
    ordinal: measure.ordinal,
    measureIndex: measure.measureIndex,
    bar: String(document?.global.measures[measure.measureIndex]?.number ?? measure.measureIndex + 1),
    occurrence: measure.occurrence,
    occurrences: occurrencesOf(performance, measure.measureIndex),
    beat,
    insertion: null,
  };
}
/** The finest fraction of a beat the readout names. A note or rest sits on a
 *  written fraction; a running playhead is read off the clock's 2⁻²⁰ grid, so
 *  it never reduces this far and reads as its whole beat instead of ticking. */
const FINEST_BEAT_FRACTION = 32n;
const VULGAR: Record<string, string> = {
  '1/2': '½', '1/3': '⅓', '2/3': '⅔', '1/4': '¼', '3/4': '¾', '1/5': '⅕', '2/5': '⅖', '3/5': '⅗', '4/5': '⅘',
  '1/6': '⅙', '5/6': '⅚', '1/8': '⅛', '3/8': '⅜', '5/8': '⅝', '7/8': '⅞',
};
const SUPER = '⁰¹²³⁴⁵⁶⁷⁸⁹', SUB = '₀₁₂₃₄₅₆₇₈₉';
const script = (n: bigint, digits: string) => [...String(n)].map(d => digits[Number(d)]).join('');
/** `1`, `1½`, `2⅓`, `3⁵⁄₁₆`: the beat with its written fraction, or the whole beat when the fraction is finer than any written one. */
export function beatLabel(beat: Rational): string {
  const whole = beat.num / beat.den;
  const num = beat.num - whole * beat.den, den = beat.den;
  if (num === 0n || den > FINEST_BEAT_FRACTION) return String(whole);
  return `${whole}${VULGAR[`${num}/${den}`] ?? `${script(num, SUPER)}⁄${script(den, SUB)}`}`;
}
/** The place in the written score: the bar and its visit as the lyric text
 *  names them — `# 9.2` is the second visit to bar 9 — then the beat, so
 *  `# 9.2 · beat 1½`. The dot only ever separates bar from visit. */
export function placeLabel(parts: Pick<PlaybackPositionParts, 'bar' | 'occurrence' | 'beat'>): string {
  return `# ${parts.bar}.${parts.occurrence} · beat ${parts.beat}`;
}
/** Which pass through the bar this is — `pass 2 of 3` — or nothing at all on
 *  a bar the performance plays once: `pass 1 of 1` tells the reader nothing. */
export function passLabel(parts: Pick<PlaybackPositionParts, 'occurrence' | 'occurrences'>): string {
  return parts.occurrences > 1 ? `pass ${parts.occurrence} of ${parts.occurrences}` : '';
}
/** The readout's segments in order, empties dropped: place · pass · hold/grace. */
export function readoutSegments(parts: PlaybackPositionParts): string[] {
  return [placeLabel(parts), passLabel(parts), parts.insertion ?? ''].filter((s) => s !== '');
}
export function formatPlaybackPosition(
  performance: Performance,
  position: Rational,
  document?: MnxStructure,
): string {
  const parts = playbackPositionParts(performance, position, document);
  if (!parts) return compare(position, ZERO) === 0 ? 'Ready' : 'End';
  return readoutSegments(parts).join(' · ');
}
export function formatScorePlaybackPosition(performance: Performance, position: ScorePosition, document?: MnxStructure): string {
  const parts = scorePlaybackPositionParts(performance, position, document);
  return parts ? readoutSegments({ ...parts, insertion: null }).join(' · ') : 'End';
}
/**
 * The widest label `formatPlaybackPosition` can print for this performance,
 * so a readout can reserve its width once instead of nudging its neighbours
 * every time the beat ticks from `4` to `4½`. Every field is taken at its
 * longest: the longest written bar number, the most visits to any bar, the
 * fullest beat of any measure with a one-glyph fraction on it (a rarer
 * `⁵⁄₁₆` may widen it), and the longer insertion word when the performance
 * holds or graces anywhere.
 */
export function widestPlaybackPosition(performance: Performance, document?: MnxStructure): string {
  if (performance.measures.length === 0) return 'Ready';
  return widestReadoutSegments(performance, document).join(' · ');
}
/** The widest place alone — `# 128.3 · beat 4½` — so a readout can reserve
 *  that segment's width by itself and keep what follows it from drifting as
 *  the fraction comes and goes. */
export function widestPlaceLabel(performance: Performance, document?: MnxStructure): string {
  return widestReadoutSegments(performance, document)[0] ?? '';
}
function widestReadoutSegments(performance: Performance, document?: MnxStructure): string[] {
  if (performance.measures.length === 0) return [];
  let bar = '';
  let occurrence = 1;
  let beat = 1n;
  let unit = 4;
  let nextUnitIndex = 0;
  for (const measure of performance.measures) {
    const number = String(document?.global.measures[measure.measureIndex]?.number ?? measure.measureIndex + 1);
    if (number.length > bar.length) bar = number;
    occurrence = Math.max(occurrence, measure.occurrence);
    for (let i = nextUnitIndex; i <= measure.measureIndex; i++)
      unit = document?.global.measures[i]?.time?.unit ?? unit;
    nextUnitIndex = Math.max(nextUnitIndex, measure.measureIndex + 1);
    // The last beat label a measure prints has integer part ⌈until × unit⌉:
    // offsets stop just short of `until`, so a whole-beat end prints that
    // beat with a fraction and a partial end rounds up into its final beat.
    const scaled = multiply(measure.until, rational(BigInt(unit)));
    const last = (scaled.num + scaled.den - 1n) / scaled.den;
    if (last > beat) beat = last;
  }
  const kinds = new Set(performance.sourceMap.map((s) => s.kind));
  const suffix = kinds.has('makeTime') ? 'grace' : kinds.has('fermata') ? 'hold' : '';
  const pass = passLabel({ occurrence, occurrences: occurrence });
  return [placeLabel({ bar, occurrence, beat: `${beat}½` }), pass, suffix].filter((s) => s !== '');
}
