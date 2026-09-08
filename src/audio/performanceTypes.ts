// Version 1 contract for item 5's opt-in expected.performance.json. This file
// defines its shape only: no corpus golden or approval is introduced by item 3.
import type { Rational, RationalJSON, TempoChange, TimingDiagnostic } from './time.ts';
import type { Insertion } from './timingConventions.ts';

export interface WrittenOccurrence<T = Rational> {
  id: string;
  noteKey: string;
  ordinal: number;
  metricOffset: T;
  metricDuration: T;
  position: T;
  duration: T;
  soundingIds: string[];
}
export type PitchCurve<T = Rational> =
  | { kind: 'bend'; points: { offset: T; cents: number }[] }
  | { kind: 'vibrato'; offset: T; duration: T; period: T; depthCents: number };
export interface SoundingEvent<T = Rational> {
  id: string;
  voice: string;
  position: T;
  duration: T;
  midi: number;
  velocity: number;
  curve: PitchCurve<T>[];
  writtenIds: string[];
  noReattack?: boolean;
  timbre?: string[];
}
export interface PerformanceMeasure<T = Rational> {
  ordinal: number;
  measureIndex: number;
  occurrence: number;
  iteration: number;
  /** Fully resolved written slice; no implicit measure length in the golden. */
  from: T;
  until: T;
  metricPosition: T;
  metricDuration: T;
  position: T;
  duration: T;
}
export type SourceSegment<T = Rational> =
  | { kind: 'metric'; ordinal: number; metricOffset: T; metricPosition: T; position: T; duration: T }
  | Insertion<T>;
export interface PerformanceVoice {
  id: string;
  partIndex: number;
  partId?: string;
  string?: number;
  kit?: boolean;
}
export interface Performance<T = Rational> {
  voices: PerformanceVoice[];
  formatVersion: 1;
  written: WrittenOccurrence<T>[];
  sounding: SoundingEvent<T>[];
  tempo: TempoChange<T>[];
  measures: PerformanceMeasure<T>[];
  sourceMap: SourceSegment<T>[];
  diagnostics: { code: string; message: string; ordinal?: number; noteKey?: string }[];
}
export type PerformanceJSON = Performance<RationalJSON>;
/** Resource errors stop the whole affected compilation; no partial success. */
export type PerformanceResult =
  | { ok: true; performance: Performance }
  | { ok: false; diagnostics: TimingDiagnostic[] };
