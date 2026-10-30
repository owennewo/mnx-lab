// Does a sync play what the recording plays? The search's own numbers score the bar lines it
// proposed; this scores what the PLAYER would do with the sync as stored — its segments read
// against the bars as they are now, through its own map — note by note against what was heard.
// Run 9 is why: copied bars of 12 eighths over segments of 8 played 1.5× fast from bar 80 while
// every number the search reported looked fine, and it took the owner's ears to find it.
import { linearizePasses } from '../../src/model/passes.ts';
import { decodeSyncSegments, playingSyncpoints, staleSegmentBars, type SyncSegments } from '../../src/model/syncSegments.ts';
import { compilePerformance } from '../../src/audio/performance.ts';
import { createRecordingSync, performedBarBeats } from '../../src/audio/recordingSync.ts';
import { ZERO, subtract, compare, add } from '../../src/audio/time.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

export interface VerifiedBar { ordinal: number; bar: number; seconds: number | null; notes: number; found: number }
export interface SyncProblem { code: 'no-sync' | 'stale-segments' | 'bar-lines' | 'weak-run'; message: string; bars: number[] }
export interface SyncVerdict {
  ok: boolean;
  bars: VerifiedBar[];
  /** Written notes (dead notes aside: a slap has no pitch to find) answered by a heard note of their pitch class. */
  found: number; notes: number; foundFraction: number;
  /** The same, with the sync slid off by a few tenths of a second: what lookalike music scores anyway. */
  chance: number;
  problems: SyncProblem[];
}
const TOLERANCE = 0.07;                // seconds: a heard note answers a written one (the search's)
const BAR_LINE_TOLERANCE = 0.08;       // seconds: the owner does not notice under this (RUNS.md)
const WEAK = 0.5, WEAK_RUN = 4;        // a stretch this long, this far under, has left the recording
const SHIFTS = [-0.9, -0.65, -0.4, 0.35, 0.6, 0.85];

export function verifySync(input: { document: MnxStructure; sync: { syncpoints: unknown; syncSegments?: unknown }; heard: readonly { start: number; pitch: number }[] }): SyncVerdict {
  const { document, sync } = input;
  const heard = [...input.heard].sort((a, b) => a.start - b.start), starts = heard.map(h => h.start);
  const answered = (t: number, pc: number) => {
    let lo = 0, hi = starts.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (starts[mid] < t - TOLERANCE) lo = mid + 1; else hi = mid; }
    for (; lo < starts.length && starts[lo] <= t + TOLERANCE; lo++) if (heard[lo].pitch % 12 === pc) return true;
    return false;
  };
  const verdict = (bars: VerifiedBar[], chance: number, problems: SyncProblem[]): SyncVerdict => {
    const notes = bars.reduce((sum, b) => sum + b.notes, 0), found = bars.reduce((sum, b) => sum + b.found, 0);
    return { ok: !problems.length, bars, found, notes, foundFraction: notes ? found / notes : 0, chance, problems };
  };
  const passes = linearizePasses(document), compiled = compilePerformance(document, passes);
  if (!compiled.ok) return verdict([], 0, [{ code: 'no-sync', message: `the score does not compile: ${JSON.stringify(compiled.diagnostics)}`, bars: [] }]);
  const { performance } = compiled;
  const beatsOf = (segments: SyncSegments) => performedBarBeats(performance, compiled.writtenBarDurations, segments);
  const playing = playingSyncpoints(sync, beatsOf);
  const map = createRecordingSync(playing.syncpoints, compiled, passes);
  if (!map.ok) return verdict([], 0, [{ code: 'no-sync', message: map.diagnostic.message, bars: [] }]);

  // Every written attack, as the player places it: the map's time for its place in its bar.
  const bars: VerifiedBar[] = [], attacks: { bar: number; time: number; pc: number }[] = [];
  for (const m of performance.measures) {
    const at = map.value.secondsAt({ ordinal: m.ordinal, metricOffset: ZERO });
    const row: VerifiedBar = { ordinal: m.ordinal, bar: m.measureIndex + 1, seconds: at.ok ? at.value : null, notes: 0, found: 0 };
    bars.push(row);
    if (!at.ok) continue;
    const end = add(m.position, m.duration);
    for (const s of performance.sounding) {
      if (compare(s.position, m.position) < 0 || compare(s.position, end) >= 0 || s.damped || s.noReattack) continue;
      const time = map.value.secondsAt({ ordinal: m.ordinal, metricOffset: subtract(s.position, m.position) });
      if (!time.ok) continue;
      row.notes++;
      if (answered(time.value, s.midi % 12)) row.found++;
      attacks.push({ bar: row.ordinal, time: time.value, pc: s.midi % 12 });
    }
  }
  const chance = attacks.length ? SHIFTS.reduce((sum, d) => sum + attacks.filter(a => answered(a.time + d, a.pc)).length / attacks.length, 0) / SHIFTS.length : 0;

  const problems: SyncProblem[] = [];
  const decoded = sync.syncSegments == null ? null : decodeSyncSegments(sync.syncSegments);
  if (decoded?.ok) {
    const stale = staleSegmentBars(decoded.value, beatsOf(decoded.value));
    if (stale.length) problems.push({ code: 'stale-segments', bars: stale.map(i => i + 1), message: `${stale.length} performed bars are not as long as the sync's segments count: the player runs them at the wrong speed` });
    // A sync of one segment a bar says exactly where each bar starts: the player must agree.
    if (decoded.value.segments.every(s => /^Bar \d+/.test(s.name))) {
      const off = bars.filter(b => b.seconds !== null && b.ordinal < decoded.value.cuts.length && Math.abs(b.seconds - decoded.value.cuts[b.ordinal]) > BAR_LINE_TOLERANCE);
      if (off.length) problems.push({ code: 'bar-lines', bars: off.map(b => b.ordinal + 1), message: `${off.length} bar lines play more than ${BAR_LINE_TOLERANCE * 1000} ms from where the sync cuts them` });
    }
  }
  // A long stretch the recording does not answer: bars without written notes neither count nor break it.
  let run: VerifiedBar[] = [];
  const close = () => {
    if (run.length >= WEAK_RUN) problems.push({ code: 'weak-run', bars: run.map(b => b.ordinal + 1), message: `performed bars ${run[0].ordinal + 1}–${run.at(-1)!.ordinal + 1}: under ${WEAK * 100}% of the written notes heard, ${run.length} bars running` });
    run = [];
  };
  for (const b of bars) {
    if (b.notes < 3) continue;
    if (b.found / b.notes < WEAK) run.push(b); else close();
  }
  close();
  return verdict(bars, chance, problems);
}

/** The verdict in lines, and whether it passed: what `sync` and `verify` print. */
export function verdictLines(v: SyncVerdict): string[] {
  const placed = v.bars.filter(b => b.seconds !== null).length;
  return [
    `verify: ${v.ok ? 'OK' : 'FAILED'} — as the player would play it, ${(v.foundFraction * 100).toFixed(0)}% of ${v.notes} written notes heard against ${(v.chance * 100).toFixed(0)}% by chance; ${placed} of ${v.bars.length} performed bars placed`,
    ...v.problems.map(p => `  ✗ ${p.message}${p.bars.length ? ` (bars ${p.bars.length > 12 ? `${p.bars.slice(0, 12).join(' ')} …` : p.bars.join(' ')})` : ''}`),
  ];
}
