import { compilePerformance } from '../../../../../src/audio/performance.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { linearizePasses } from '../../../../../src/model/passes.ts';

export interface Measure { written: number; occurrence: number; startQuarter: number; durationQuarters: number; partial: boolean }
export function inspectScore(score: MnxStructure) {
  const walk = linearizePasses(score);
  const result = compilePerformance(score);
  const quarter = (r: { num: bigint; den: bigint }) => 4 * Number(r.num) / Number(r.den);
  const issues = walk.diagnostics.map(d => d.code + ': ' + d.message);
  if (walk.truncated) issues.push('route truncated');
  if (!result.ok) return { measures: [] as Measure[], issues: [...issues, ...result.diagnostics.map(d => d.message)] };
  issues.push(...result.performance.diagnostics.map(d => d.code + ': ' + d.message));
  const measures = result.performance.measures.map(m => ({ written: m.measureIndex + 1, occurrence: m.occurrence,
    startQuarter: quarter(m.metricPosition), durationQuarters: quarter(m.metricDuration),
    partial: quarter(m.from) !== 0 || quarter(m.until) !== quarter(result.writtenBarDurations[m.measureIndex]!) }));
  return { measures, issues };
}
export function checkAnchors(raw: unknown, measures: Measure[], mediaDuration: number | null) {
  const issues: string[] = [];
  const anchors: { index: number; bar: number; seconds: number; offset: number; written: number | null; occurrence: number | null; scoreQuarter: number | null }[] = [];
  if (!Array.isArray(raw) || !raw.length) return { anchors, issues: ['no anchors'], gaps: 0, eligible: false as const };
  let previousSeconds = -Infinity, previousPosition = -Infinity, previousBar = -1, gaps = 0;
  for (const [index, tuple] of raw.entries()) {
    if (!Array.isArray(tuple) || tuple.length < 2 || tuple.length > 4) { issues.push(`anchor ${index}: malformed tuple`); continue; }
    const [bar, seconds, inner = 0] = tuple;
    if (!Number.isSafeInteger(bar) || bar < 0 || !Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(inner) || inner < 0 || inner > 480) {
      issues.push(`anchor ${index}: invalid bar, time or offset`); continue;
    }
    if (seconds <= previousSeconds) issues.push(`anchor ${index}: time does not increase`);
    const position = bar + inner / 480;
    if (position <= previousPosition) issues.push(`anchor ${index}: position does not increase; pause or bad mapping needs review`);
    if (bar - previousBar > 1 && previousBar >= 0) gaps++;
    if (mediaDuration !== null && seconds > mediaDuration) issues.push(`anchor ${index}: beyond media duration`);
    const end = bar === measures.length && inner === 0;
    const m = measures[bar];
    let scoreQuarter: number | null = null;
    if (!m && !end) issues.push(`anchor ${index}: outside performed route`);
    else if (m?.partial) issues.push(`anchor ${index}: partial performed measure needs independent offset mapping`);
    else scoreQuarter = end ? (measures.at(-1)?.startQuarter ?? 0) + (measures.at(-1)?.durationQuarters ?? 0) : m!.startQuarter + inner / 480 * m!.durationQuarters;
    anchors.push({ index, bar, seconds, offset: inner, written: m?.written ?? null, occurrence: m?.occurrence ?? null, scoreQuarter });
    previousSeconds = seconds; previousPosition = position; previousBar = bar;
  }
  if (mediaDuration === null) issues.push('local media duration not established');
  return { anchors, issues: [...new Set(issues)], gaps, eligible: false as const };
}
