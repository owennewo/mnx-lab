/**
 * The shape of a score as a recording sees it: how long each PERFORMED bar is,
 * in order. An imported sync (Soundslice tuples) addresses performed bars by
 * index and has nothing to re-derive from, so the only way to know the bars
 * have moved under it is to remember the shape it was last known good for and
 * compare (roadmap: studio-sync-rederive). Two scores with the same shape take a
 * bar-indexed sync identically; a bar inserted, a repeat added or a meter
 * changed makes a different shape.
 *
 * Run-length encoded whole-note fractions, so it is short, unit-free and legible:
 * a 12-bar blues in 4/4 with a 2/4 turnaround bar is `11x1/1,1x1/2`.
 */
import type { Performance } from './performanceTypes.ts';
import type { Rational } from './time.ts';

export function performedShape(performance: Pick<Performance, 'measures'>, writtenBarDurations: readonly Rational[]): string {
  const runs: { length: string; count: number }[] = [];
  for (const measure of performance.measures) {
    const duration = writtenBarDurations[measure.measureIndex];
    const length = duration ? `${duration.num}/${duration.den}` : '?';
    const last = runs[runs.length - 1];
    if (last?.length === length) last.count++;
    else runs.push({ length, count: 1 });
  }
  return runs.map(run => `${run.count}x${run.length}`).join(',');
}
