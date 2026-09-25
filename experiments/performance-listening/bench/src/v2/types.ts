import type { Decision, Tempo } from '../types.ts';
export type Bounds = { lower: number; upper: number };
/** Bounds are epistemic position uncertainty; alternatives are acoustic equivalence. */
export interface Band { route: number; start: Bounds; end: Bounds }
interface Region { start: number; end: number; evidence: string }
export type Label = Region & (
  | { state: 'unknown'; reason: string }
  | { state: 'unsupported'; answerableFrom: number }
  | { state: 'supported'; answerableFrom: number; truth: Band; alternatives: Band[]; method: 'observed' | 'bounded-interpolation' }
);
export interface GoldenV2 {
  version: 2; set: string; example: string;
  partition: 'development' | 'reserved' | 'acceptance';
  role: 'positive' | 'wrong-score' | 'silence' | 'room-noise' | 'interruption';
  group: { piece: string; performer: string; session: string };
  intended: { scoreSha256: string; tempo: Tempo; route: number[] };
  audio: { sha256: string; sampleRate: 48000; channels: 1; samples: number;
    sourceSha256: string; cropStartSample: number; timeOrigin: string };
  provenance: { kind: 'recording' | 'generated' | 'handwritten'; reviewer: string;
    reviewedOn: string; evidenceSha256: string; independentOfCandidate: true;
    sourceChecks: { soloGuitar: boolean; scoreRoute: boolean; cropTimeOrigin: boolean; tempoEnvelope: boolean } };
  profile: Record<string, string>;
  labels: Label[];
  /** Independently reviewed moments at which support resumes after an interruption. */
  recoveries: { at: number; evidence: string }[];
  noteAssessment: null;
}
export type Verdict = 'correct' | 'wrong' | 'indeterminate' | 'lost' | 'uncovered' | 'correctRejection' | 'falseFollowing' | 'unknown' | 'pending';
export interface Point { time: number; state: Label['state']; verdict: Verdict; decision: string | null; correct: Bounds; deadlineMiss: Bounds | null }
export interface EvaluationV2 {
  evaluator: 'following-evaluator@2'; evidenceId: string; example: string; set: string;
  partition: GoldenV2['partition']; role: GoldenV2['role']; group: GoldenV2['group'];
  denominators: { totalPoints: number; supported: number; unsupported: number; unknown: number; pending: number;
    answerable: number; indeterminate: number; durationSeconds: number; answerableSeconds: number };
  referenceCoverage: number; supportedCorrect: Bounds | null; rejection: Bounds | null; coverage: Bounds | null;
  deadlineMiss: Bounds | null; exposure: { seconds: Bounds; fraction: Bounds | null; longestSeconds: Bounds };
  recovery: { at: number; seconds: Bounds | null }[];
  points: Point[];
}
export interface Measurement {
  evaluation: EvaluationV2;
  causality: { checks: number; pass: boolean };
  cost: { machine: string; sustainedRatio: number; p99Ms: number; maxBacklogMs: number };
}
export interface RecordedRun {
  id: string; candidate: string; setHash: string; instrumentHash: string;
  measurements: Measurement[];
}
export type FollowingRecord = readonly Decision[];
