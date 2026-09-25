/** The listener contract Studio will drive: vocabulary version 2 (contracts/vocabulary-v2.md).
 * It lives beside the bench so that promotion to src/listen/ is a move, not a rewrite, and
 * it imports only the model and audio layers. */
import type { ScorePosition } from '../../../src/audio/scorePosition.ts';
import type { Rational } from '../../../src/audio/time.ts';
import type { MnxStructure } from '../../../src/model/mnx.ts';

export type { ScorePosition };
export const VOCABULARY_VERSION = 'listening-vocabulary@2';

/** Where and how a listening session starts. Studio supplies all of it. */
export interface Handoff {
  /** The performed position the player starts from: a seek, a restart or a loop start. */
  from: ScorePosition;
  /** The parts the performer plays. Others are accompaniment, never expected to be heard. */
  parts: string[];
  /** The score's tempo at `from`, times `rate`. Exact, never rounded. */
  tempo: { quartersPerMinute: Rational };
  /** Studio's playback rate, already folded into `tempo`, kept for the record. */
  rate: number;
}
/** What the device delivers. A declaration, not a requirement. */
export interface Delivery { sampleRate: number; chunkSamples: number }
/** A listener that cannot honour a handoff says so at start. Silence is not a refusal. */
export type StartResult = { ok: true } | { ok: false; refused: string };

export interface PositionStatement {
  kind: 'position';
  /** Weighted alternatives; weights sum to one. The heaviest is what Studio draws. */
  candidates: { at: ScorePosition; weight: number }[];
  confidence: number;
}
export interface UnsupportedStatement { kind: 'unsupported'; reason?: string }
export type NoteVerdict = 'match' | 'missing' | 'extra' | 'substitution' | 'timing' | 'duration';
/** The issue shape for the note-assessment milestone: fixed now, scored later. */
export interface NoteStatement {
  kind: 'note';
  verdict: NoteVerdict;
  /** Required, including for an extra note. */
  at: ScorePosition;
  /** Studio's note key; null for an extra note. */
  noteKey: string | null;
  observed: { onset: number | null; end: number | null; midi: number | null; string: number | null } | null;
  /** Signed seconds: negative is early. */
  timingErrorSeconds: number | null;
  /** Signed seconds: negative is short. */
  durationErrorSeconds: number | null;
  confidence: number;
}
export type Statement = PositionStatement | UnsupportedStatement | NoteStatement;
/** What a listener emits. refersTo is the audio time the statement is about. */
export type Emission = Statement & { id: string; refersTo: number; supersedes?: string };
/** An emission stamped by whoever delivered the audio, with the clock it was made at. */
export type Decision = Emission & { madeAt: number };

export interface Listener {
  start(score: MnxStructure, handoff: Handoff, delivery: Delivery): StartResult;
  feed(chunk: Float32Array, clock: number): Emission[];
  finish(): Emission[];
}
