// Written-position lookup, not a visited-marks accumulator. The compiler builds
// one lane for tempo, one for time, and one per resolved dynamic scope; accents
// without residual state never enter a persistent lane.
import type { MnxGlobalMeasure } from '../model/mnx.ts';
import { add, subtract, compare, fromSafeFraction, quarterBpm, DEFAULT_QUARTER_BPM,
  nonnegative, ZERO, type Rational, type TempoChange } from './time.ts';

export interface WrittenPosition { measureIndex: number; metricOffset: Rational }
export interface WrittenChange<T> extends WrittenPosition { value: T }
export interface TimedEntry extends WrittenPosition {
  ordinal: number;
  /** Written slice end, and its unrolled metric start. */
  until: Rational;
  position: Rational;
}
/** How far into a slice a written offset falls, on the axis the compiler is
 *  building. Straight by default; swing supplies a warped one so a mid-bar
 *  mark lands where its offset is PLAYED. */
export type Advance = (entry: TimedEntry, metricOffset: Rational) => Rational;
const straightAdvance: Advance = (entry, metricOffset) => subtract(metricOffset, entry.metricOffset);
const compareWritten = (a: WrittenPosition, b: WrittenPosition) =>
  a.measureIndex - b.measureIndex || compare(a.metricOffset, b.metricOffset);
export function createWrittenStateLane<T>(input: readonly WrittenChange<T>[], fallback: T) {
  const changes = [...input].sort(compareWritten);
  const at = (position: WrittenPosition): T => {
    let value = fallback;
    for (const change of changes) {
      if (compareWritten(change, position) > 0) break;
      value = change.value;
    }
    return value;
  };
  return {
    at,
    /** Restore at every traversal entry, including skipped-ending state and
     * changes preceding a mid-bar segno. Marks at `until` belong to the next
     * written-state lookup; they are outside this half-open performed slice. */
    project(entries: readonly TimedEntry[], advance: Advance = straightAdvance): { position: Rational; value: T }[] {
      return entries.flatMap(entry => {
        const span = nonnegative(subtract(entry.until, entry.metricOffset), 'Traversal slice');
        if (span.num === 0n) return [];
        nonnegative(entry.position, 'Traversal position');
        return [{ position: entry.position, value: at(entry) }, ...changes
          .filter(change => change.measureIndex === entry.measureIndex
            && compare(change.metricOffset, entry.metricOffset) > 0 && compare(change.metricOffset, entry.until) < 0)
          .map(change => ({ position: add(entry.position, advance(entry, change.metricOffset)), value: change.value }))];
      });
    }
  };
}
/** Metric lengths come from the compiler (so pickups are not guessed from the
 * time signature). Offsets are MNX whole-note fractions, not fractions of a bar. */
export function performedTempoChanges(globals: readonly MnxGlobalMeasure[], entries: readonly TimedEntry[],
  advance?: Advance): TempoChange[] {
  const changes: WrittenChange<Rational>[] = globals.flatMap((measure, measureIndex) =>
    (measure.tempos ?? []).map(mark => ({ measureIndex,
      metricOffset: mark.location ? fromSafeFraction({ num: mark.location.fraction[0], den: mark.location.fraction[1] }) : ZERO,
      value: quarterBpm(mark.bpm, mark.value) })));
  return createWrittenStateLane(changes, DEFAULT_QUARTER_BPM).project(entries, advance)
    .map(change => ({ position: change.position, quarterBpm: change.value }));
}
