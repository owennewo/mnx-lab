// Executable campaign conventions, used by the future compiler. These helpers
// transform already-resolved metric spans; they do not walk notes or merge ties.
import type { MnxFermata, MnxGrace } from '../model/mnx.ts';
import { add, subtract, multiply, divide, compare, min, max, rational, positive,
  nonnegative, ZERO, ONE, QUARTER, type Rational, type TimingDiagnostic } from './time.ts';

export const GRACE_BUDGET = rational(1n, 32n);
export const LV_DURATION = ONE;
export const VIBRATO_PERIOD = rational(1n, 10n);
export function fermataMultiplier(hint: MnxFermata['duration'] = 'auto'): Rational {
  switch (hint) {
    case 'none': return ONE;
    case 'short': case 'veryShort': return rational(5n, 4n);
    case 'long': return rational(2n);
    case 'veryLong': return rational(3n);
    case 'auto': case 'normal': return rational(3n, 2n);
  }
}
export function fermataExtra(span: Rational, hint?: MnxFermata['duration']): Rational {
  return multiply(nonnegative(span, 'Fermata span'), subtract(fermataMultiplier(hint), ONE));
}
export function barlineFermataExtra(hint?: MnxFermata['duration']): Rational {
  return fermataExtra(QUARTER, hint);
}
export interface GraceAllocation {
  duration: Rational;
  durations: Rational[];
  diagnostics: TimingDiagnostic[];
}
/** neighbour=null means no adjacent timed neighbour in the same performed voice:
 * the compiler must not supply a rest-only gap or cross an unrelated jump. */
export function allocateGrace(kind: NonNullable<MnxGrace['graceType']>, weights: readonly Rational[],
  neighbour: Rational | null): GraceAllocation {
  if (!weights.length) return { duration: ZERO, durations: [], diagnostics: [] };
  weights.forEach(weight => positive(weight, 'Grace weight'));
  if (kind !== 'makeTime' && neighbour === null) return {
    duration: ZERO, durations: weights.map(() => ZERO),
    diagnostics: [{ code: 'missing-grace-neighbour', message: 'Stealing grace has no adjacent timed neighbour in its performed voice; silent.' }]
  };
  const duration = kind === 'makeTime' ? GRACE_BUDGET
    : min(GRACE_BUDGET, divide(positive(neighbour!, 'Grace neighbour'), rational(2n)));
  const total = weights.reduce(add, ZERO);
  return { duration, durations: weights.map(weight => multiply(duration, divide(weight, total))), diagnostics: [] };
}
export type InsertionKind = 'fermata' | 'makeTime';
export interface InsertionSource<T = Rational> {
  ordinal: number;
  metricOffset: T;
  noteKey?: string;
  graceId?: string;
}
export interface InsertionRequest {
  /** Unrolled metric position, BEFORE any inserted time. */
  position: Rational;
  duration: Rational;
  kind: InsertionKind;
  source: InsertionSource;
}
export interface Insertion<T = Rational> {
  kind: InsertionKind;
  metricPosition: T;
  /** Expanded performance interval [position, position + duration). */
  position: T;
  duration: T;
  sources: InsertionSource<T>[];
}
export interface InsertionMap {
  insertions: readonly Insertion[];
  toPerformance(position: Rational, edge?: 'before' | 'afterFermata' | 'after'): Rational;
  mapSpan(position: Rational, duration: Rational): { position: Rational; duration: Rational };
  locate(position: Rational): { metricPosition: Rational; insertion?: Insertion };
}
/** Score-wide requests at a shared point combine by MAX per kind, then fermata
 * precedes makeTime. This prevents duplicate cross-part marks multiplying time. */
export function createInsertionMap(requests: readonly InsertionRequest[]): InsertionMap {
  const grouped = new Map<string, { position: Rational; duration: Rational; kind: InsertionKind; sources: InsertionSource[] }>();
  for (const request of requests) {
    nonnegative(request.position, 'Insertion position'); nonnegative(request.duration, 'Insertion duration');
    if (request.duration.num === 0n) continue;
    const position = rational(request.position.num, request.position.den);
    const key = `${position.num}/${position.den}:${request.kind}`;
    const group = grouped.get(key);
    if (group) { group.duration = max(group.duration, request.duration); group.sources.push({ ...request.source }); }
    else grouped.set(key, { position, duration: request.duration, kind: request.kind, sources: [{ ...request.source }] });
  }
  let delta = ZERO;
  const insertions: Insertion[] = [...grouped.values()]
    .sort((a, b) => compare(a.position, b.position) || (a.kind === b.kind ? 0 : a.kind === 'fermata' ? -1 : 1))
    .map(group => {
      const insertion = { kind: group.kind, metricPosition: group.position,
        position: add(group.position, delta), duration: group.duration, sources: group.sources };
      delta = add(delta, group.duration);
      return insertion;
    });
  const toPerformance: InsertionMap['toPerformance'] = (position, edge = 'after') => {
    nonnegative(position, 'Metric position');
    let expanded = position;
    for (const insertion of insertions) {
      const relation = compare(insertion.metricPosition, position);
      if (relation > 0) break;
      if (relation < 0 || edge === 'after' || (edge === 'afterFermata' && insertion.kind === 'fermata'))
        expanded = add(expanded, insertion.duration);
    }
    return expanded;
  };
  return {
    insertions: Object.freeze(insertions), toPerformance,
    mapSpan(position, duration) {
      positive(duration, 'Mapped note span');
      const start = toPerformance(position);
      // An existing note sustains through a hold at its release, but releases
      // BEFORE make-time at that release. Principal attacks follow both.
      const end = toPerformance(add(position, duration), 'afterFermata');
      return { position: start, duration: subtract(end, start) };
    },
    locate(position) {
      nonnegative(position, 'Performance position');
      let offset = ZERO;
      for (const insertion of insertions) {
        if (compare(position, insertion.position) < 0) break;
        if (compare(position, add(insertion.position, insertion.duration)) < 0)
          return { metricPosition: insertion.metricPosition, insertion };
        offset = add(offset, insertion.duration);
      }
      return { metricPosition: subtract(position, offset) };
    }
  };
}


export function placeStealingGrace(kind: 'stealPrevious' | 'stealFollowing', weights: readonly Rational[],
  neighbour: { position: Rational; duration: Rational } | null) {
  const allocation = allocateGrace(kind, weights, neighbour?.duration ?? null);
  if (!neighbour || !weights.length) return { notes: [], neighbour, diagnostics: allocation.diagnostics };
  nonnegative(neighbour.position, 'Grace neighbour position');
  let position = kind === 'stealPrevious'
    ? subtract(add(neighbour.position, neighbour.duration), allocation.duration) : neighbour.position;
  const notes = allocation.durations.map(duration => {
    const note = { position, duration };
    position = add(position, duration);
    return note;
  });
  return { notes, neighbour: {
    position: kind === 'stealFollowing' ? add(neighbour.position, allocation.duration) : neighbour.position,
    duration: subtract(neighbour.duration, allocation.duration)
  }, diagnostics: allocation.diagnostics };
}
