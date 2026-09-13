import {
  decodeRecordingSync, type DecodedRecordingSync, type RecordingSyncpoint,
  type RecordingSyncDiagnostic, type RecordingSyncResult,
} from '../model/recordingSync.ts';
import type { PassModel } from '../model/passes.ts';
import type { CompiledPerformance, SourceSegment } from './performanceTypes.ts';
import {
  ZERO, ONE, rational, fromDecimal, add, subtract, multiply, divide, compare,
  TimingError, type Rational,
} from './time.ts';

export { decodeRecordingSync } from '../model/recordingSync.ts';
export type { SoundsliceSyncpoint, RecordingSyncpoint, RecordingSyncDiagnostic, RecordingSyncResult } from '../model/recordingSync.ts';

export interface RecordingScorePosition {
  readonly ordinal: number;
  /** Written whole-note offset; ordinal N with offset 0 is the final boundary. */
  readonly metricOffset: Rational;
}
export interface RecordingSyncLocation {
  readonly position: RecordingScorePosition;
  readonly hidePlayhead: boolean;
  /** Only source anchors are measured; positions between them are interpolated. */
  readonly atAnchor: boolean;
}
export interface RecordingSyncMap {
  readonly source: DecodedRecordingSync;
  /** Coverage of this traversal, NOT proof of the recording's bar structure. */
  readonly coverage: 'full' | 'partial';
  readonly bounds: { readonly startSeconds: number; readonly endSeconds: number; readonly end: RecordingScorePosition };
  positionAt(seconds: number): RecordingSyncResult<RecordingSyncLocation>;
  secondsAt(position: RecordingScorePosition): RecordingSyncResult<number>;
  /** Synth handoff only: do not run this clock to follow recorded media. */
  toPerformance(position: RecordingScorePosition, edge?: 'before' | 'after'): RecordingSyncResult<Rational>;
  /** An interior synthetic hold/grace has no uniquely measured recording time. */
  fromPerformance(position: Rational): RecordingSyncResult<RecordingScorePosition>;
}
type MetricSegment = Extract<SourceSegment, { kind: 'metric' }>;
interface Anchor { point: RecordingSyncpoint; coordinate: Rational; seconds: Rational }
class SyncFailure extends Error {
  constructor(readonly diagnostic: RecordingSyncDiagnostic) { super(diagnostic.message); }
}
function fail(code: RecordingSyncDiagnostic['code'], message: string, point?: number): never {
  throw new SyncFailure({ code, message, ...(point === undefined ? {} : { point }) });
}
function attempt<T>(fn: () => T): RecordingSyncResult<T> {
  try { return { ok: true, value: fn() }; }
  catch (error) {
    if (error instanceof SyncFailure) return { ok: false, diagnostic: error.diagnostic };
    if (error instanceof TimingError) return { ok: false, diagnostic: {
      code: error.diagnostic.code === 'resource-limit' ? 'resource-limit' : 'out-of-range', message: error.message,
    } };
    throw error;
  }
}
/** Index of the last value <= target. Anchor lookups stay logarithmic. */
function floorIndex<T>(values: readonly T[], target: Rational, key: (value: T) => Rational): number {
  let lo = 0, hi = values.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (compare(key(values[mid]), target) <= 0) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}
const numberOf = (value: Rational) => Number(value.num) / Number(value.den);

/** Bind to the exact compilation and traversal. Partial visits are unsupported
 *  until Soundslice correspondence is known; full-bar jumps remain supported.
 *  No supplied arrays are sorted, repaired or retained as mutable live state. */
export function createRecordingSync(
  input: unknown, compiled: CompiledPerformance, passes: PassModel,
): RecordingSyncResult<RecordingSyncMap> {
  const decoded = decodeRecordingSync(input);
  if (!decoded.ok) return decoded;
  return attempt(() => {
    const source = decoded.value;
    const { performance, writtenBarDurations } = compiled;
    if (source.points.length < 2) fail('no-sync', 'At least two anchors are needed for a recording interval.');
    const measures = performance.measures.map(m => ({ ...m }));
    const count = measures.length;
    if (!count || passes.entries.length !== count || passes.truncated || passes.diagnostics.some(d => d.code === 'cap'))
      fail('invalid-traversal', 'A complete, matching performed traversal is required.');
    measures.forEach((m, i) => {
      const entry = passes.entries[i];
      if (m.ordinal !== i || entry.ordinal !== i || entry.measureIndex !== m.measureIndex
          || entry.iteration !== m.iteration || entry.occurrence !== m.occurrence
          || compare(m.until, m.from) <= 0)
        fail('invalid-traversal', 'Performance measures must match the supplied traversal.');
      const full = writtenBarDurations[m.measureIndex];
      if (!full || compare(full, ZERO) <= 0 || compare(m.until, full) > 0)
        fail('invalid-traversal', 'The compiler must supply the full written duration for every performed bar.');
      if (compare(m.from, ZERO) !== 0 || compare(m.until, full) !== 0)
        fail('partial-bar', `Performed bar ${i} has partial navigation bounds; Soundslice correspondence is not established.`);
      const bound = (value: [number, number]) => rational(BigInt(value[0]), BigInt(value[1]));
      if ((entry.from && compare(bound(entry.from), m.from) !== 0)
          || (entry.until && compare(bound(entry.until), m.until) !== 0))
        fail('invalid-traversal', 'Performance and traversal bounds disagree.');
    });
    const endCoordinate = rational(BigInt(count));
    const anchors: Anchor[] = source.points.map((point, i) => {
      const coordinate = add(rational(BigInt(point.bar)), divide(fromDecimal(point.offset), rational(480n)));
      if (compare(coordinate, endCoordinate) > 0)
        fail('out-of-range', 'Syncpoint lies beyond the performed score boundary.', i);
      return { point, coordinate, seconds: fromDecimal(point.seconds) };
    });
    if (compare(anchors[0].coordinate, ZERO) !== 0)
      fail('invalid-sync', 'The first syncpoint must identify the start of performed bar zero.', 0);
    for (let i = 1; i < anchors.length; i++) {
      const before = anchors[i - 1], current = anchors[i];
      const timeOrder = compare(current.seconds, before.seconds);
      const scoreOrder = compare(current.coordinate, before.coordinate);
      if (timeOrder < 0 || scoreOrder < 0)
        fail('nonsequential-sync', 'Backwards times or score positions are unsupported; raw syncpoints are preserved.', i);
      if (timeOrder === 0 || scoreOrder === 0)
        fail('ambiguous-sync', 'Duplicate times or musical positions do not define a unique bidirectional map.', i);
    }
    const first = anchors[0], last = anchors[anchors.length - 1];
    const scoreAt = (coordinate: Rational): RecordingScorePosition => {
      const ordinal = Number(coordinate.num / coordinate.den);
      if (ordinal === count) return { ordinal, metricOffset: ZERO };
      const m = measures[ordinal];
      return { ordinal, metricOffset: multiply(subtract(coordinate, rational(BigInt(ordinal))), m.until) };
    };
    const coordinateAt = (position: RecordingScorePosition): Rational => {
      const { ordinal, metricOffset } = position;
      if (!Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal > count || compare(metricOffset, ZERO) < 0)
        fail('out-of-range', 'A score position must use an existing performed ordinal and nonnegative offset.');
      if (ordinal === count) {
        if (compare(metricOffset, ZERO) !== 0) fail('out-of-range', 'The final boundary has offset zero.');
        return endCoordinate;
      }
      const m = measures[ordinal];
      if (compare(metricOffset, m.until) > 0) fail('out-of-range', 'Offset lies outside the performed bar.');
      return add(rational(BigInt(ordinal)), divide(metricOffset, m.until));
    };
    const within = (coordinate: Rational) => {
      if (compare(coordinate, first.coordinate) < 0 || compare(coordinate, last.coordinate) > 0)
        fail('outside-coverage', 'Position is outside the anchored interval; no intro, final-bar or outro timing is inferred.');
    };
    // Snapshot the compiler's bridge separately. No synth duration participates in
    // interpolation above; swing is applied ONLY when explicitly crossing to synth.
    const metricByOrdinal: MetricSegment[][] = Array.from({ length: count }, () => []);
    const metric: MetricSegment[] = [];
    const insertions: Exclude<SourceSegment, MetricSegment>[] = [];
    for (const segment of performance.sourceMap) {
      if (segment.kind === 'metric') {
        if (!metricByOrdinal[segment.ordinal]) fail('invalid-traversal', 'Source map references an absent performed ordinal.');
        const copy = { ...segment };
        metricByOrdinal[segment.ordinal].push(copy);
        metric.push(copy);
      } else insertions.push({ ...segment, sources: segment.sources.map(s => ({ ...s })) });
    }
    const finalMeasure = measures[count - 1];
    const performanceEnd = add(finalMeasure.position, finalMeasure.duration);
    const metricEnd = (s: MetricSegment) => add(s.metricOffset, divide(s.duration, s.scale ?? ONE));
    const map: RecordingSyncMap = {
      source,
      coverage: compare(last.coordinate, endCoordinate) === 0 ? 'full' : 'partial',
      bounds: Object.freeze({ startSeconds: first.point.seconds, endSeconds: last.point.seconds, end: Object.freeze(scoreAt(last.coordinate)) }),
      positionAt(seconds) {
        return attempt(() => {
          if (!Number.isFinite(seconds) || seconds < 0) fail('out-of-range', 'Media time must be finite, nonnegative seconds.');
          const time = fromDecimal(seconds);
          if (compare(time, first.seconds) < 0 || compare(time, last.seconds) > 0)
            fail('outside-coverage', 'Media time is outside the anchored interval; no extrapolation is available.');
          const i = floorIndex(anchors, time, a => a.seconds), a = anchors[i];
          const atAnchor = compare(time, a.seconds) === 0;
          const b = anchors[i + 1];
          const coordinate = atAnchor ? a.coordinate : add(a.coordinate,
            multiply(divide(subtract(time, a.seconds), subtract(b.seconds, a.seconds)), subtract(b.coordinate, a.coordinate)));
          return { position: scoreAt(coordinate), hidePlayhead: a.point.hidePlayhead, atAnchor };
        });
      },
      secondsAt(position) {
        return attempt(() => {
          const coordinate = coordinateAt(position);
          within(coordinate);
          const i = floorIndex(anchors, coordinate, a => a.coordinate), a = anchors[i];
          if (compare(coordinate, a.coordinate) === 0) return a.point.seconds;
          const b = anchors[i + 1];
          return numberOf(add(a.seconds, multiply(divide(subtract(coordinate, a.coordinate),
            subtract(b.coordinate, a.coordinate)), subtract(b.seconds, a.seconds))));
        });
      },
      toPerformance(position, edge) {
        return attempt(() => {
          const coordinate = coordinateAt(position);
          within(coordinate);
          const canonical = scoreAt(coordinate);
          // A barline hold belongs to the preceding ordinal, so compare its
          // canonical bar coordinate, not only its source ordinal.
          const at = insertions.filter(s => s.sources.some(source =>
            compare(coordinateAt({ ordinal: source.ordinal, metricOffset: source.metricOffset }), coordinate) === 0));
          if (at.length) {
            if (!edge) fail('ambiguous-insertion', 'A synthetic hold/grace occupies this metric anchor; choose before or after explicitly.');
            return edge === 'before' ? at[0].position : add(at[at.length - 1].position, at[at.length - 1].duration);
          }
          if (canonical.ordinal === count) return performanceEnd;
          const segment = metricByOrdinal[canonical.ordinal].find(s =>
            compare(canonical.metricOffset, s.metricOffset) >= 0 && compare(canonical.metricOffset, metricEnd(s)) < 0);
          if (!segment) fail('invalid-traversal', 'No metric source segment covers this position.');
          return add(segment.position, multiply(subtract(canonical.metricOffset, segment.metricOffset), segment.scale ?? ONE));
        });
      },
      fromPerformance(position) {
        return attempt(() => {
          if (compare(position, ZERO) < 0 || compare(position, performanceEnd) > 0)
            fail('out-of-range', 'Position is outside the synthetic performance.');
          if (insertions.some(s => compare(position, s.position) >= 0 && compare(position, add(s.position, s.duration)) < 0))
            fail('ambiguous-insertion', 'An interior synthetic hold/grace has no unique measured recording time.');
          let result: RecordingScorePosition;
          if (compare(position, performanceEnd) === 0) result = { ordinal: count, metricOffset: ZERO };
          else {
            const segment = metric.find(s => compare(position, s.position) >= 0 && compare(position, add(s.position, s.duration)) < 0);
            if (!segment) fail('invalid-traversal', 'No metric source segment covers this synthetic position.');
            result = { ordinal: segment.ordinal, metricOffset: add(segment.metricOffset,
              divide(subtract(position, segment.position), segment.scale ?? ONE)) };
          }
          within(coordinateAt(result));
          return result;
        });
      },
    };
    return Object.freeze(map);
  });
}
