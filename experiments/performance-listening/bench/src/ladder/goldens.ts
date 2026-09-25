import { type Evaluation } from '../evaluate/index.ts';
import type { Cost } from '../report/index.ts';
import { type Following, type Golden, type NoteLabel, rational } from '../types.ts';
import { RENDERER_VERSION, SAMPLE_RATE, type RungZeroRecipe } from './render.ts';
import type { TempoFamily } from './tempo.ts';

/** Rung 1 adds a tempo curve to rung 0's sine recipe; the handed tempo stays bpm. */
export type RungOneRecipe = Omit<RungZeroRecipe, 'rung'> & { rung: 1; tempo: { family: TempoFamily; seed: number; segmentQuarters: 0.5; bpms: number[] } };
/** Rung 2 keeps rung 0's timing and replaces the sine with recorded guitar samples. */
export type RungTwoRecipe = Omit<RungZeroRecipe, 'rung' | 'renderer'> & { rung: 2; renderer: 'sample-render@1';
  samples: { id: string; name: string; source: string; licence: string; attribution: string; origin: string; files: number; shiftSemitones: { max: number; mean: number } };
  preRollSamples: number; attackFraction: number; releaseSamples: number; paddedSamples: number };
export type LadderRecipe = RungZeroRecipe | RungOneRecipe | RungTwoRecipe;

/** A following golden for a rendered example. The labels have exactly the shape the
 * frozen following-evaluator@1 judges; only the recipe differs from sine-v1, so the
 * set is not validated against the v1 golden schema's recipe field. */
export type LadderGolden = Omit<Golden, 'audio'> & {
  audio: Omit<Golden['audio'], 'recipe'> & { recipe: LadderRecipe };
};
export type LadderExample = 'positive' | 'wrong-score' | 'silence';

/** The frozen evaluator reads only the fields a LadderGolden shares with Golden. */
export const asGolden = (g: LadderGolden): Golden => g as unknown as Golden;

export const ALLOWANCE = 0.15;

export function ladderGolden(args: {
  set: string; example: LadderExample; recipe: LadderRecipe; duration: number; audioSha256: string;
  score: string; notes: NoteLabel[]; profile: Golden['profile']; scoreOrigin: string;
}): LadderGolden {
  const { recipe, duration, notes } = args;
  const provenance = `${RENDERER_VERSION} rung ${recipe.rung}; exact by construction; ${ALLOWANCE * 1000} ms detection allowance from the first onset.`;
  const firstOnset = notes.length ? Math.min(...notes.map(n => n.onset)) : 0;
  const following: Following[] = args.example === 'positive'
    ? [{
        start: 0, end: duration, state: 'supported', answerableFrom: firstOnset + ALLOWANCE, route: 1,
        truth: { atStart: rational(recipe.fromQuarter), quartersPerSecond: rational(recipe.bpm, 60), route: 1 },
        admissible: [{ atStart: rational(recipe.fromQuarter), quartersPerSecond: rational(recipe.bpm, 60), route: 1 }],
        precision: { kind: 'exact' }, provenance,
      }]
    : [{ start: 0, end: duration, state: 'unsupported', answerableFrom: ALLOWANCE, route: 1, precision: { kind: 'exact' }, provenance }];
  const summary = {
    positive: 'Rendered score at its own constant tempo: follow it throughout.',
    'wrong-score': 'The same rendered audio handed with a different piece\'s score: report unsupported.',
    silence: 'Digital silence of the same duration: report unsupported.',
  }[args.example];
  return {
    set: args.set, example: args.example, version: 1,
    intended: { score: args.score, tempo: { bpm: recipe.bpm, unit: 'quarter' }, route: [1] },
    audio: { path: `${args.example}.wav`, sampleRate: SAMPLE_RATE, channels: 1, duration, sha256: args.audioSha256, recipe },
    labels: { notes: args.example === 'silence' ? [] : notes, following },
    expected: { summary, correctThrough: null, maxWrongErrorQuarters: null, exposureSeconds: null },
    profile: args.profile, conditions: 'none',
    provenance: { kind: 'generated', manifest: RENDERER_VERSION, scoreOrigin: args.scoreOrigin, perturbation: args.example === 'positive' ? null : args.example },
    partition: 'development', noteAssessment: null,
  };
}

/** Development contract 1's pass bar, computed from the frozen evaluator's as-decided view. */
export interface GateResult {
  supportedCorrect: number | null;
  coverage: number;
  unsupportedRejection: number | null;
  exposureFraction: number;
  longestExposureSeconds: number;
  deadlineMisses: number;
  causality: boolean;
  sustainedRatio: number;
  chunkP99Ms: number;
  pass: Record<string, boolean>;
  failed: string[];
}

export function gates(evaluation: Evaluation, cost: Cost, causality: readonly { pass: boolean }[]): GateResult {
  const view = evaluation.asDecided;
  const answerableSeconds = view.points.filter(p => p.category !== 'pending').reduce((sum, p) => sum + p.duration, 0);
  const ratio = (n: number, d: number) => d ? n / d : null;
  const result = {
    supportedCorrect: ratio(view.counts.correct, view.denominators.supported),
    coverage: 1 - (ratio(view.coverage.uncovered, view.coverage.denominator) ?? 0),
    unsupportedRejection: ratio(view.counts.correctRejection, view.denominators.unsupported),
    exposureFraction: answerableSeconds ? evaluation.exposure.totalSeconds / answerableSeconds : 0,
    longestExposureSeconds: evaluation.exposure.longestSeconds,
    deadlineMisses: ratio(evaluation.timeliness.missed, evaluation.timeliness.denominator) ?? 0,
    causality: causality.length > 0 && causality.every(c => c.pass),
    sustainedRatio: cost.sustainedRatio,
    chunkP99Ms: cost.p99Ms,
  };
  const pass: Record<string, boolean> = {
    supportedCorrect: result.supportedCorrect === null || result.supportedCorrect >= 0.95,
    coverage: result.coverage >= 0.98,
    unsupportedRejection: result.unsupportedRejection === null || result.unsupportedRejection >= 0.95,
    exposure: result.exposureFraction <= 0.05,
    longestExposure: result.longestExposureSeconds <= 0.5,
    deadline: result.deadlineMisses <= 0.10,
    causality: result.causality,
    sustained: result.sustainedRatio <= 0.25,
    chunkP99: result.chunkP99Ms <= 10,
  };
  return { ...result, pass, failed: Object.keys(pass).filter(k => !pass[k]) };
}
