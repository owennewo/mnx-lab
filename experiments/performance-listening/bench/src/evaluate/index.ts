import { createHash } from 'node:crypto';
import { type Decision, type Following, type Golden, type Trajectory, round, value } from '../types.ts';
import { validateDecisions, validateGolden } from '../validate.ts';
export const EVALUATOR_VERSION = 'following-evaluator@1';
export const GRID = 0.05;
export const TOLERANCE = 0.25;
export const DEADLINE = 0.2;
export const CATEGORIES = ['correct', 'wrong', 'overAmbiguous', 'lost', 'abstained', 'uncovered', 'falseFollowing', 'correctRejection', 'pending'] as const;
export type Category = typeof CATEGORIES[number];
export interface Point {
  time: number; duration: number; interval: number; state: Following['state'];
  category: Category; decision: string | null; confidence: number | null; confidentPending: boolean;
  error: number | null;
}
export interface View {
  counts: Record<Category, number> & { confidentPending: number };
  denominators: { supported: number; unsupported: number; pending: number; answerable: number };
  errors: { values: number[]; routeMismatches: number; mean: number | null; p95: number | null; max: number | null };
  losses: { start: number; recoveredAt: number | null; recoverySeconds: number | null }[];
  falseFollowingSeconds: number;
  coverage: { uncovered: number; denominator: number };
  abstention: { count: number; denominator: number };
  confidence: { lower: number; upper: number; claims: number; pending: number; correct: number; answerable: number }[];
  points: Point[];
}
export interface Evaluation {
  evaluator: string; evidenceId: string; example: string; set: string; profile: Golden['profile']; partition: Golden['partition'];
  asDecided: View; hindsight: View;
  timeliness: { missed: number; denominator: number; delays: { time: number; seconds: number | null }[]; mean: number | null; p95: number | null; max: number | null };
  exposure: { totalSeconds: number; longestSeconds: number };
}
export function distribution(values: readonly number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) => sorted.length ? round(sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)]!) : null;
  return { mean: sorted.length ? round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : null, p95: at(.95), max: at(1) };
}
function judge(d: Decision | undefined, label: Following, t: number): { category: Category; error: number | null } {
  if (label.state === 'unknown') throw new Error('Unknown evidence is not judged');
  if (t < label.answerableFrom) return { category: 'pending', error: null };
  if (!d) return { category: 'uncovered', error: null };
  if (label.state === 'unsupported') return { category: d.kind === 'position' ? 'falseFollowing' : 'correctRejection', error: null };
  if (d.kind === 'unsupported') return { category: label.abstainable ? 'abstained' : 'lost', error: null };
  if (d.kind !== 'position') throw new Error('Reserved note decision reached following evaluator');
  const distance = (p: typeof d.candidates[number]['position'], a: Trajectory): number => p.route !== a.route ? Infinity : Math.abs(value(p.quarters) - (value(a.atStart) + (t - label.start) * value(a.quartersPerSecond)));
  const error = Math.min(...d.candidates.map(c => distance(c.position, label.truth)));
  if (error > TOLERANCE + 1e-9) return { category: 'wrong', error: Number.isFinite(error) ? round(error) : null };
  const excessive = d.candidates.some(c => !label.admissible.some(a => distance(c.position, a) <= TOLERANCE + 1e-9));
  return { category: excessive ? 'overAmbiguous' : 'correct', error: null };
}
function latest(record: readonly Decision[], t: number, live: boolean): Decision | undefined {
  let result: Decision | undefined;
  for (const d of record) {
    if (d.kind === 'note' || d.refersTo > t || (live && d.madeAt > t)) continue;
    if (!result || d.refersTo > result.refersTo || (d.refersTo === result.refersTo && d.madeAt >= result.madeAt)) result = d;
  }
  return result;
}
function view(points: Point[]): View {
  const counts = Object.fromEntries(CATEGORIES.map(k => [k, 0])) as View['counts'];
  counts.confidentPending = 0;
  const denominators = { supported: 0, unsupported: 0, pending: 0, answerable: 0 };
  const confidence = Array.from({ length: 5 }, (_, i) => ({ lower: i / 5, upper: (i + 1) / 5, claims: 0, pending: 0, correct: 0, answerable: 0 }));
  const errors: number[] = []; let routeMismatches = 0; let falseFollowingSeconds = 0;
  const losses: View['losses'] = []; let active: View['losses'][number] | undefined; let interval = -1;
  for (const p of points) {
    counts[p.category]++; if (p.confidentPending) counts.confidentPending++;
    if (p.category === 'pending') denominators.pending++;
    else { denominators.answerable++; if (p.state === 'supported') denominators.supported++; else denominators.unsupported++; }
    if (p.category === 'wrong') { if (p.error === null) routeMismatches++; else errors.push(p.error); }
    if (p.category === 'falseFollowing') falseFollowingSeconds += p.duration;
    if (p.confidence !== null) {
      const bin = confidence[Math.min(4, Math.floor(p.confidence * 5))]!;
      bin.claims++; if (p.category === 'pending') bin.pending++; else bin.answerable++;
      if (p.category === 'correct') bin.correct++;
    }
    if (interval !== p.interval) { active = undefined; interval = p.interval; }
    if (p.state === 'supported' && (p.category === 'wrong' || p.category === 'lost') && !active) {
      active = { start: p.time, recoveredAt: null, recoverySeconds: null }; losses.push(active);
    }
    if (active && p.category === 'correct') { active.recoveredAt = p.time; active.recoverySeconds = round(p.time - active.start); active = undefined; }
  }
  return { counts, denominators, errors: { values: errors, routeMismatches, ...distribution(errors) }, losses,
    falseFollowingSeconds: round(falseFollowingSeconds), coverage: { uncovered: counts.uncovered, denominator: denominators.answerable },
    abstention: { count: counts.lost + counts.abstained, denominator: denominators.supported }, confidence, points };
}
export function evaluate(golden: Golden, record: readonly Decision[]): Evaluation {
  validateGolden(golden); validateDecisions(record);
  const live: Point[] = [], hindsight: Point[] = [];
  const delays: Evaluation['timeliness']['delays'] = [];
  let missed = 0, exposure = 0, longest = 0, current = 0;
  const cells = Math.ceil(round(golden.audio.duration / GRID));
  for (let k = 1; k <= cells; k++) {
    const t = round(Math.min(k * GRID, golden.audio.duration));
    const interval = golden.labels.following.findIndex(l => t > l.start && t <= l.end);
    const label = golden.labels.following[interval]!;
    if (label.state === 'unknown') { current = 0; continue; }
    const duration = round(Math.max(0, t - Math.max((k - 1) * GRID, label.start, label.answerableFrom)));
    for (const [isLive, points] of [[true, live], [false, hindsight]] as const) {
      const d = latest(record, t, isLive); const result = judge(d, label, t);
      points.push({ time: t, duration, interval, state: label.state, ...result, decision: d?.id ?? null,
        confidence: d?.kind === 'position' ? d.confidence : null,
        confidentPending: result.category === 'pending' && d?.kind === 'position' && d.confidence >= .8 });
    }
    const shown = live.at(-1)!;
    if (shown.category === 'wrong' || shown.category === 'falseFollowing') { exposure += duration; current += duration; longest = Math.max(longest, current); } else current = 0;
    if (t < label.answerableFrom) continue;
    const final = latest(record, t, false);
    const firstCorrect = final && record.find(d => d.kind !== 'note' && d.refersTo === final.refersTo && ['correct', 'correctRejection'].includes(judge(d, label, t).category));
    const delay = firstCorrect ? round(Math.max(0, firstCorrect.madeAt - t)) : null;
    delays.push({ time: t, seconds: delay }); if (delay === null || delay > DEADLINE) missed++;
  }
  const evidenceId = createHash('sha256').update(JSON.stringify({ intended: golden.intended, audio: golden.audio, labels: golden.labels, profile: golden.profile })).digest('hex');
  return { evaluator: EVALUATOR_VERSION, evidenceId, example: golden.example, set: golden.set, profile: golden.profile, partition: golden.partition,
    asDecided: view(live), hindsight: view(hindsight), timeliness: { missed, denominator: delays.length, delays, ...distribution(delays.flatMap(d => d.seconds === null ? [] : [d.seconds])) },
    exposure: { totalSeconds: round(exposure), longestSeconds: round(longest) } };
}
