/** Shared written-position bridge. It never supplies a recording clock. */
import type { Performance } from './performanceTypes.ts';
import { ZERO, ONE, add, subtract, multiply, divide, compare, type Rational } from './time.ts';
import type { RecordingSyncResult } from '../model/recordingSync.ts';
export interface ScorePosition { readonly ordinal: number; readonly metricOffset: Rational }
const failure = (code: 'out-of-range' | 'invalid-traversal' | 'ambiguous-insertion', message: string): RecordingSyncResult<never> => ({ ok: false, diagnostic: { code, message } });
export function canonicalScorePosition(performance: Performance, position: ScorePosition): RecordingSyncResult<ScorePosition> {
  const { ordinal, metricOffset } = position, count = performance.measures.length;
  if (!Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal > count || compare(metricOffset, ZERO) < 0)
    return failure('out-of-range', 'Position is outside the performed score.');
  if (ordinal === count) return compare(metricOffset, ZERO) === 0
    ? { ok: true, value: { ordinal, metricOffset: ZERO } } : failure('out-of-range', 'The final boundary has offset zero.');
  const m = performance.measures[ordinal];
  if (compare(metricOffset, m.from) < 0 || compare(metricOffset, m.until) > 0)
    return failure('out-of-range', 'Offset lies outside this performed visit.');
  return { ok: true, value: compare(metricOffset, m.until) === 0
    ? { ordinal: ordinal + 1, metricOffset: performance.measures[ordinal + 1]?.from ?? ZERO } : position };
}
export function performancePositionAt(performance: Performance, position: ScorePosition, edge?: 'before' | 'after'): RecordingSyncResult<Rational> {
  const canonical = canonicalScorePosition(performance, position);
  if (!canonical.ok) return canonical;
  const at = canonical.value;
  const insertions = performance.sourceMap.filter(s => s.kind !== 'metric' && s.sources.some(source => {
    const p = canonicalScorePosition(performance, source);
    return p.ok && p.value.ordinal === at.ordinal && compare(p.value.metricOffset, at.metricOffset) === 0;
  }));
  if (insertions.length) {
    if (!edge) return failure('ambiguous-insertion', 'A synthetic hold/grace occupies this position; choose before or after explicitly.');
    const last = insertions[insertions.length - 1];
    return { ok: true, value: edge === 'before' ? insertions[0].position : add(last.position, last.duration) };
  }
  if (at.ordinal === performance.measures.length) {
    const last = performance.measures.at(-1);
    return { ok: true, value: last ? add(last.position, last.duration) : ZERO };
  }
  const s = performance.sourceMap.find(s => s.kind === 'metric' && s.ordinal === at.ordinal &&
    compare(at.metricOffset, s.metricOffset) >= 0 && compare(at.metricOffset, add(s.metricOffset, divide(s.duration, s.scale ?? ONE))) < 0);
  if (!s || s.kind !== 'metric') return failure('invalid-traversal', 'No score segment covers this position.');
  return { ok: true, value: add(s.position, multiply(subtract(at.metricOffset, s.metricOffset), s.scale ?? ONE)) };
}
export function scorePositionAt(performance: Performance, position: Rational): RecordingSyncResult<ScorePosition> {
  const last = performance.measures.at(-1), end = last ? add(last.position, last.duration) : ZERO;
  if (compare(position, ZERO) < 0 || compare(position, end) > 0) return failure('out-of-range', 'Position is outside the synthetic performance.');
  if (performance.sourceMap.some(s => s.kind !== 'metric' && compare(position, s.position) >= 0 && compare(position, add(s.position, s.duration)) < 0))
    return failure('ambiguous-insertion', 'A synthetic hold/grace has no unique measured recording position.');
  if (compare(position, end) === 0) return { ok: true, value: { ordinal: performance.measures.length, metricOffset: ZERO } };
  const s = performance.sourceMap.find(s => s.kind === 'metric' && compare(position, s.position) >= 0 && compare(position, add(s.position, s.duration)) < 0);
  if (!s || s.kind !== 'metric') return failure('invalid-traversal', 'No score segment covers this position.');
  return { ok: true, value: { ordinal: s.ordinal, metricOffset: add(s.metricOffset, divide(subtract(position, s.position), s.scale ?? ONE)) } };
}
