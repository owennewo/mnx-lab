/** Audio renderer boundary. Musical time, traversal, tempo and rate belong to
 * the compiler/transport; all times here are seconds on the sink's audio clock.
 * No browser globals or backend imports: safe to import under Node.
 */
export type SinkVoice = string;

/** Offsets are relative to schedule's audioTime, not to the time of the call.
 * The transport supplies events in nondecreasing offset order; equal offsets
 * execute in array order. All numeric values must be finite, offsets/rampSeconds
 * nonnegative, hz positive, and velocity within [0, 1].
 */
export type SinkEvent = {
  readonly offset: number;
  readonly voice: SinkVoice;
} & (
  | {
      readonly kind: 'attack';
      readonly hz: number;
      readonly velocity: number;
      readonly damped?: boolean;
      readonly timbre?: readonly string[];
    }
  | { readonly kind: 'release' }
  /** Preserve oscillator/sample phase and envelope; retain the current bend. */
  | {
      readonly kind: 'pitch';
      readonly hz: number;
      readonly rampSeconds?: number;
      readonly velocity?: number;
      readonly damped?: boolean;
      readonly timbre?: readonly string[];
    }
  /** Absolute cents from the base pitch, not an accumulated delta. */
  | {
      readonly kind: 'bend';
      readonly cents: number;
      readonly rampSeconds?: number;
    }
);

export interface Sink {
  /** Raw currentTime, never lookahead-adjusted time or wall time. */
  now(): number;
  /** Called from a user gesture. Resume/create the context lazily; reject on
   * failure. Repeated calls are safe. Offline sinks resolve without resuming. */
  unlock(): Promise<void>;
  /** Queue absolute-clock actions. Attacks replace the addressed voice with a
   * fresh envelope and zero bend; pitch actions implement noReattack. Other
   * voices are independent. Pitch/bend/release on a silent voice are no-ops.
   * Future actions must target the voice generation active at their timestamp,
   * not merely whichever source exists when schedule is called.
   */
  schedule(events: readonly SinkEvent[], audioTime: number): void;
  /** Discard queued actions at/after the cutoff, truncate automation crossing
   * it, and silence voices sounding at it with a <=5 ms de-click tail. Earlier
   * sound is preserved; future attacks cannot leak. Idempotent. New schedule
   * calls may rebuild from the cutoff; old callbacks must not affect new voices.
   * This is teardown for seek/stop/rate change, not an undo of just future notes.
   */
  cancel(fromAudioTime: number): void;
  /** Convenience equivalents of a scheduled release/bend at this absolute time.
   * Release has a <=5 ms de-click tail. A bend with a ramp holds the value at the
   * start, then interpolates linearly in cents; omitted/zero ramp is immediate.
   */
  release(voice: SinkVoice, audioTime: number): void;
  bend(voice: SinkVoice, cents: number, audioTime: number, rampSeconds?: number): void;
  /** Idempotently stop and disconnect owned sources. Do not close a host-owned
   * AudioContext. Scheduling after disposal is an error. */
  dispose(): void;
}
