import { createHash } from 'node:crypto';
import { round, value, type Decision } from '../types.ts';
import { validateDecisions } from '../validate.ts';
import { validateGoldenV2 } from './validate.ts';
import type { Band, Bounds, EvaluationV2, FollowingRecord, GoldenV2, Label, Point, Verdict } from './types.ts';
export const VERSION = 'following-evaluator@2' as const;
const EPS = 1e-9, TOL = .25, GRID = .05, DEADLINE = .2;
const zero = (): Bounds => ({ lower: 0, upper: 0 });
const exact = (n: number): Bounds => ({ lower: n, upper: n });
const ratio = (b: Bounds, n: number): Bounds | null => n ? { lower: round(b.lower / n), upper: round(b.upper / n) } : null;
const add = (a: Bounds, b: Bounds, scale = 1) => { a.lower += b.lower * scale; a.upper += b.upper * scale; };
function at(b: Band, l: Label, t: number): Bounds {
  const f = (t - l.start) / (l.end - l.start);
  return { lower: b.start.lower + f * (b.end.lower - b.start.lower), upper: b.start.upper + f * (b.end.upper - b.start.upper) };
}
function latest(record: FollowingRecord, t: number, availableAt = t): Decision | undefined {
  let result: Decision | undefined;
  for (const d of record) if (d.madeAt <= availableAt + EPS && d.refersTo <= t + EPS && (!result || d.refersTo > result.refersTo || d.refersTo === result.refersTo && d.madeAt >= result.madeAt)) result = d;
  return result;
}
function judge(l: Label, t: number, d: Decision | undefined): { verdict: Verdict; correct: Bounds } {
  if (l.state === 'unknown') return { verdict: 'unknown', correct: zero() };
  if (t < l.answerableFrom - EPS) return { verdict: 'pending', correct: zero() };
  if (!d) return { verdict: 'uncovered', correct: zero() };
  if (d.kind === 'note') throw new Error('Note assessment is outside following v2');
  if (l.state === 'unsupported') return { verdict: d.kind === 'unsupported' ? 'correctRejection' : 'falseFollowing', correct: exact(d.kind === 'unsupported' ? 1 : 0) };
  if (d.kind === 'unsupported') return { verdict: 'lost', correct: zero() };
  const truth = at(l.truth, l, t);
  const regions = d.candidates.filter(c => c.position.route === l.truth.route).map(c => ({ lower: value(c.position.quarters) - TOL, upper: value(c.position.quarters) + TOL })).sort((a, b) => a.lower - b.lower);
  let reach = truth.lower;
  for (const r of regions) if (r.lower <= reach + EPS && r.upper >= reach - EPS) reach = Math.max(reach, r.upper);
  const coversTruth = regions.some(r => r.lower <= truth.lower + EPS && r.upper >= truth.lower - EPS) && reach >= truth.upper - EPS;
  const mightCoverTruth = regions.some(r => r.upper >= truth.lower - EPS && r.lower <= truth.upper + EPS);
  const admissible = [l.truth, ...l.alternatives];
  const candidateFits = (certain: boolean) => d.candidates.every(c => admissible.some(b => {
    if (b.route !== c.position.route) return false;
    const range = at(b, l, t), q = value(c.position.quarters);
    return certain ? Math.max(Math.abs(q - range.lower), Math.abs(q - range.upper)) <= TOL + EPS : q + TOL >= range.lower - EPS && q - TOL <= range.upper + EPS;
  }));
  const lower = coversTruth && candidateFits(true) ? 1 : 0;
  const upper = mightCoverTruth && candidateFits(false) ? 1 : 0;
  return { verdict: lower ? 'correct' : upper ? 'indeterminate' : 'wrong', correct: { lower, upper } };
}
function deadline(l: Label, t: number, record: FollowingRecord): Bounds {
  // A timely correction can satisfy a deadline, but never erases earlier exposure.
  const instants = [t, ...record.filter(d => d.madeAt > t && d.madeAt <= t + DEADLINE + EPS && d.refersTo <= t + EPS).map(d => d.madeAt)];
  const correctness = instants.map(now => judge(l, t, latest(record, t, now)).correct);
  return { lower: 1 - Math.max(...correctness.map(c => c.upper)), upper: 1 - Math.max(...correctness.map(c => c.lower)) };
}
/** Exact integration for affine reference bands and piecewise-constant live claims. */
function exposure(g: GoldenV2, record: FollowingRecord) {
  const seconds = zero(), longestSeconds = zero(), current = zero();
  for (const l of g.labels) {
    if (l.state === 'unknown') { current.lower = current.upper = 0; continue; }
    if (l.answerableFrom > l.start) current.lower = current.upper = 0;
    const from = l.answerableFrom;
    const events = [...new Set([from, l.end, ...record.map(d => d.madeAt).filter(t => t > from && t < l.end)])].sort((a,b) => a-b);
    for (let i = 1; i < events.length; i++) {
      const start = events[i-1]!, end = events[i]!;
      const d = latest(record, (start + end) / 2);
      const cuts = [start, end];
      if (l.state === 'supported' && d?.kind === 'position') for (const band of [l.truth, ...l.alternatives]) {
        for (const side of ['lower', 'upper'] as const) {
          const slope = (band.end[side] - band.start[side]) / (l.end - l.start);
          if (!slope) continue;
          for (const c of d.candidates) if (c.position.route === band.route) for (const sign of [-1,1]) {
            const crossing = l.start + (value(c.position.quarters) + sign * TOL - band.start[side]) / slope;
            if (crossing > start && crossing < end) cuts.push(crossing);
          }
        }
      }
      cuts.sort((a,b) => a-b);
      for (let j = 1; j < cuts.length; j++) {
        const t = (cuts[j-1]! + cuts[j]!) / 2, width = cuts[j]! - cuts[j-1]!;
        const judged = judge(l, t, d);
        const claim = d?.kind === 'position';
        const wrong = claim ? { lower: 1 - judged.correct.upper, upper: 1 - judged.correct.lower } : zero();
        add(seconds, wrong, width);
        for (const side of ['lower', 'upper'] as const) {
          current[side] = wrong[side] ? current[side] + width : 0;
          longestSeconds[side] = Math.max(longestSeconds[side], current[side]);
        }
      }
    }
  }
  return { seconds: { lower: round(seconds.lower), upper: round(seconds.upper) }, longestSeconds: { lower: round(longestSeconds.lower), upper: round(longestSeconds.upper) } };
}
export function evaluateV2(g: GoldenV2, record: FollowingRecord): EvaluationV2 {
  validateGoldenV2(g); validateDecisions(record);
  const duration = g.audio.samples / g.audio.sampleRate;
  if (record.some(d => d.kind === 'note' || d.madeAt > duration + EPS)) throw new Error('Decision outside the following/audio contract');
  const points: Point[] = [];
  const denominators = { totalPoints: 0, supported: 0, unsupported: 0, unknown: 0, pending: 0, answerable: 0, indeterminate: 0, durationSeconds: duration, answerableSeconds: 0 };
  const supported = zero(), rejection = zero(), missed = zero(); let covered = 0;
  for (const l of g.labels) {
    if (l.state !== 'unknown') denominators.answerableSeconds += l.end - l.answerableFrom;
    const ticks = [l.end];
    for (let k = Math.floor(l.start / GRID) + 1; k * GRID < l.end - EPS; k++) ticks.push(round(k * GRID));
    if (l.state !== 'unknown' && l.answerableFrom > l.start && l.answerableFrom < l.end) ticks.push(l.answerableFrom);
    for (const t of [...new Set(ticks)].sort((a,b) => a-b)) {
      const d = latest(record, t), result = judge(l,t,d);
      const answerable = result.verdict !== 'unknown' && result.verdict !== 'pending';
      const miss = answerable ? deadline(l,t,record) : null;
      points.push({ time: t, state: l.state, ...result, decision: d?.id ?? null, deadlineMiss: miss });
      denominators.totalPoints++;
      if (!answerable) { if (result.verdict === 'unknown') denominators.unknown++; else denominators.pending++; continue; }
      denominators.answerable++; if (d) covered++;
      if (result.verdict === 'indeterminate') denominators.indeterminate++;
      if (l.state === 'supported') { denominators.supported++; add(supported,result.correct); }
      else { denominators.unsupported++; add(rejection,result.correct); }
      add(missed,miss!);
    }
  }
  denominators.answerableSeconds = round(denominators.answerableSeconds);
  const live = exposure(g,record);
  const recovery = g.recoveries.map(r => {
    const first = (side: 'lower'|'upper') => points.find(p => p.time >= r.at && p.state === 'supported' && p.correct[side] === 1)?.time;
    const optimistic = first('upper'), conservative = first('lower');
    return { at: r.at, seconds: optimistic === undefined || conservative === undefined ? null : { lower: round(optimistic-r.at), upper: round(conservative-r.at) } };
  });
  return { evaluator: VERSION, evidenceId: createHash('sha256').update(JSON.stringify(g)).digest('hex'), example: g.example, set: g.set, partition: g.partition, role:g.role, group:g.group,
    denominators, referenceCoverage: round(denominators.answerableSeconds / duration), supportedCorrect: ratio(supported,denominators.supported), rejection: ratio(rejection,denominators.unsupported), coverage: ratio(exact(covered),denominators.answerable), deadlineMiss: ratio(missed,denominators.answerable),
    exposure: { ...live, fraction: ratio(live.seconds,denominators.answerableSeconds) }, recovery, points };
}
