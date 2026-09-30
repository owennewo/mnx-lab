/** stage-gates@1 (contracts/event-instruments-2.md): the gates the user approved for the
 * sine stages 1–3, applied to an example's measures, pooled over a stage, and to a
 * listener's causality and cost. The control-assessment gates (`claims`, `tempo`) and the
 * exclusion of controls from the pooled rates are PROPOSED, awaiting the user. */
import type { AssessmentEvaluation2, Direction, KindCounts } from './assessment2.ts';
import type { FollowingEvaluation } from './following.ts';
import { isControl, type PerformanceLabel } from './label.ts';

export const STAGE_GATES = 'stage-gates@1';
export const CURSOR = { onEvent: 0.95, ahead: 0.01, exposure: 0.05, episodeSeconds: 0.5, byEventAll: 20, byEvent: 0.95, rejection: 0.95 } as const;
export const ASSESSMENT = { overall: 0.05 } as const;
export const POOLED = { recovery: 0.90, extrasHeld: 0.90, found: 0.90, falseAlarms: 0.05 } as const;
export const COST = { sustainedRatio: 0.25, p99Ms: 10 } as const;
/** Gates not yet approved by the user. */
export const PROPOSED = ['claims', 'tempo', 'pooledExcludesControls'] as const;

export type CursorGate = 'onEvent' | 'ahead' | 'exposure' | 'episode' | 'byEvent' | 'rejection';
export type AssessmentGate = 'overall' | 'intervals' | 'notes' | 'clean' | 'claims' | 'tempo';
export interface ExampleVerdict<G extends string> { kind: 'performance' | 'control'; applied: G[]; failed: G[]; passed: boolean }

const verdict = <G extends string>(kind: 'performance' | 'control', checks: [G, boolean][]): ExampleVerdict<G> => {
  const failed = checks.filter(([, ok]) => !ok).map(([g]) => g);
  return { kind, applied: checks.map(([g]) => g), failed, passed: failed.length === 0 };
};
const atLeast = (part: number, whole: number, bound: number) => whole > 0 && part / whole >= bound;
const atMost = (part: number, whole: number, bound: number) => whole > 0 && part / whole <= bound;

/** The live cursor's gates on one example: a performance's, or a control's. */
export function cursorGates(label: PerformanceLabel, e: FollowingEvaluation): ExampleVerdict<CursorGate> {
  const s = e.asDecided.seconds;
  if (isControl(label)) return verdict<CursorGate>('control', [
    ['rejection', atLeast(s.correctRejection, s.answerable, CURSOR.rejection)],
    ['exposure', atMost(e.exposure.seconds, s.answerable, CURSOR.exposure)],
    ['episode', e.exposure.longest <= CURSOR.episodeSeconds],
  ]);
  const { reached, of } = e.byEvent;
  return verdict<CursorGate>('performance', [
    ['onEvent', atLeast(s.onEvent, s.supportedAnswerable, CURSOR.onEvent)],
    ['ahead', atMost(s.ahead, s.supportedAnswerable, CURSOR.ahead)],
    ['exposure', atMost(e.exposure.seconds, s.answerable, CURSOR.exposure)],
    ['episode', e.exposure.longest <= CURSOR.episodeSeconds],
    ['byEvent', of < CURSOR.byEventAll ? reached === of : reached / of >= CURSOR.byEvent],
  ]);
}

/** The assessment's gates on one example; `null` when the listener made no assessment,
 * which fails every gate that applies. */
export function assessmentGates(label: PerformanceLabel, e: AssessmentEvaluation2 | null): ExampleVerdict<AssessmentGate> {
  const control = isControl(label);
  const gates: AssessmentGate[] = control ? ['claims', 'tempo'] : ['overall', 'intervals', 'notes', 'clean'];
  if (!e) return verdict<AssessmentGate>(control ? 'control' : 'performance', gates.map(g => [g, false]));
  if (control) return verdict<AssessmentGate>('control', [['claims', e.claimedPlayed === 0], ['tempo', e.tempoClaims === 0]]);
  const overall = e.overall.expected === null ? e.overall.reported === null : e.overall.error !== null && Math.abs(e.overall.error) <= ASSESSMENT.overall;
  return verdict<AssessmentGate>('performance', [
    ['overall', overall],
    ['intervals', e.intervals.unreported === 0 && e.intervals.within === e.intervals.matched],
    ['notes', e.notes.unassessed === 0],
    ['clean', !e.clean || e.falseFindings === 0],
  ]);
}

export type FindingKind = Direction | 'missing' | 'wrong' | 'dead';
export const FINDING_KINDS: readonly FindingKind[] = ['slow', 'fast', 'missing', 'wrong', 'dead'];
export interface PooledGate { gate: string; part: number; whole: number; applicable: boolean; passed: boolean }
/** Pooled over a stage: recovery and extras from the cursor; each kind of finding from the
 * assessments. A gate with nothing to judge is not applicable and passes. */

/** Controls are excluded (proposed, awaiting the user). */
export function pooledGates(examples: readonly { label: PerformanceLabel; following: FollowingEvaluation | null; assessment: AssessmentEvaluation2 | null }[]): PooledGate[] {
  const performances = examples.filter(x => !isControl(x.label));
  const sum = (f: (x: typeof performances[number]) => number) => performances.reduce((s, x) => s + f(x), 0);
  const ratio = (gate: string, part: number, whole: number, pass: (r: number) => boolean): PooledGate =>
    ({ gate, part, whole, applicable: whole > 0, passed: whole === 0 || pass(part / whole) });
  const counts = (x: typeof performances[number], kind: FindingKind): KindCounts | null => {
    const a = x.assessment;
    if (!a) return null;
    return kind === 'slow' || kind === 'fast' ? a.flags[kind] : a.notes[kind];
  };
  const out: PooledGate[] = [
    ratio('recovery', sum(x => x.following?.recovery.recovered ?? 0), sum(x => x.following?.recovery.of ?? 0), r => r >= POOLED.recovery),
    ratio('extrasHeld', sum(x => x.following?.extras.held ?? 0), sum(x => (x.following?.extras.held ?? 0) + (x.following?.extras.moved ?? 0)), r => r >= POOLED.extrasHeld),
  ];
  const unassessed = performances.some(x => !x.assessment);
  for (const kind of FINDING_KINDS) {
    if (unassessed) {
      // A performance with no assessment fails the finding gates outright.
      out.push({ gate: `found:${kind}`, part: 0, whole: 0, applicable: true, passed: false }, { gate: `falseAlarms:${kind}`, part: 0, whole: 0, applicable: true, passed: false });
      continue;
    }
    out.push(ratio(`found:${kind}`, sum(x => counts(x, kind)?.detected ?? 0), sum(x => counts(x, kind)?.positives ?? 0), r => r >= POOLED.found));
    out.push(ratio(`falseAlarms:${kind}`, sum(x => counts(x, kind)?.falseAlarms ?? 0), sum(x => counts(x, kind)?.negatives ?? 0), r => r <= POOLED.falseAlarms));
  }
  return out;
}

/** Causality and cost, per listener. */
export function costGates(prefixChecksPassed: boolean, cost: { sustainedRatio: number; p99Ms: number }[]): ExampleVerdict<'causality' | 'sustained' | 'p99'> {
  return verdict('performance', [
    ['causality', prefixChecksPassed],
    ['sustained', cost.every(c => c.sustainedRatio <= COST.sustainedRatio)],
    ['p99', cost.every(c => c.p99Ms <= COST.p99Ms)],
  ]);
}
