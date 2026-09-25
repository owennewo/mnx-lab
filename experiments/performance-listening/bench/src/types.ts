import type { MnxStructure } from '../../../../src/model/mnx.ts';
export type Rational = { num: number; den: number };
export type Position = { quarters: Rational; route: number };
export type Trajectory = { atStart: Rational; quartersPerSecond: Rational; route: number };
export type Precision = { kind: 'exact' | 'bounded' | 'unknown'; uncertaintySeconds?: number };
type IntervalBase = { start: number; end: number; precision: Precision; provenance: string };
export type Following = IntervalBase & (
  | { state: 'supported'; answerableFrom: number; route: number; truth: Trajectory; admissible: Trajectory[]; abstainable?: boolean }
  | { state: 'unsupported'; answerableFrom: number; route: number }
  | { state: 'unknown' }
);
export interface NoteLabel {
  pitch: { midi: number; hz: number }; onset: number; audibleEnd: number;
  scoreDuration: Rational; scoreNoteId: string | null; precision: Precision; provenance: string;
}
export interface Recipe {
  manifest: string;
  parameters: { bpm: number; mode: 'score' | 'descending' | 'silence'; sampleRate: 48000;
    peakDbfs: -12; attackSeconds: 0.01; releaseSeconds: 0.01; soundingBeatFraction: 0.5;
    finalSilenceSeconds: 0.5; silenceDuration?: number };
}
export interface Golden {
  set: string; example: string; version: 1;
  intended: { score: string; tempo: Tempo; route: number[] };
  audio: { path: string; sampleRate: 48000; channels: 1; duration: number; sha256: string | null; recipe: Recipe };
  labels: { notes: NoteLabel[]; following: Following[] };
  expected: { summary: string; correctThrough: number | null; maxWrongErrorQuarters: number | null; exposureSeconds: number | null };
  profile: Record<'melodic' | 'polyphonic' | 'harmonic' | 'dynamics' | 'rhythm' | 'tempo' | 'structuralAmbiguity' | 'navigation', { level: number; range: string; note?: string }>;
  conditions: 'none'; provenance: { kind: 'generated' | 'handwritten'; manifest: string; scoreOrigin: string; perturbation: string | null };
  partition: 'development' | 'reserved' | 'acceptance'; noteAssessment: null;
}
export type Statement =
  | { kind: 'position'; candidates: { position: Position; weight: number }[]; confidence: number }
  | { kind: 'unsupported'; reason?: string }
  | { kind: 'note'; verdict: 'match' | 'missing' | 'extra' | 'substitution' | 'timing'; noteId: string | null; observedOnset: number | null; observedPitch: number | null };
export type Emission = Statement & { id: string; refersTo: number; supersedes?: string };
export type Decision = Emission & { madeAt: number };
export type Tempo = { bpm: number; unit: 'quarter' };
export interface Listener {
  start(score: MnxStructure, tempo: Tempo, delivery: { sampleRate: number; chunkSamples: number }): void;
  feed(chunk: Float32Array, clock: number): Emission[];
  finish(): Emission[];
}
export const value = (r: Rational): number => r.num / r.den;
export const round = (n: number): number => Math.round(n * 1e9) / 1e9;
export function rational(num: number, den = 1): Rational {
  if (!Number.isSafeInteger(num) || !Number.isSafeInteger(den) || num < 0 || den < 1) throw new Error('Invalid rational');
  const gcd = (a: number, d: number): number => d === 0 ? a : gcd(d, a % d);
  const divisor = gcd(num, den);
  return { num: num / divisor, den: den / divisor };
}
