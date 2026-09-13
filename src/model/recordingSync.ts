/** Soundslice's external tuple format. Shared by storage validation and audio;
 *  source seconds are evidence, not the synth's musical timeline. */
export type SoundsliceSyncpoint = readonly [bar: number, seconds: number, offset?: number, hidePlayhead?: 0 | 1];
export interface RecordingSyncpoint {
  readonly bar: number;
  readonly seconds: number;
  /** Fraction of the entire bar on Soundslice's 0–480 scale, not MIDI ticks. */
  readonly offset: number;
  readonly hidePlayhead: boolean;
}
export interface RecordingSyncDiagnostic {
  readonly code: 'invalid-sync' | 'resource-limit' | 'no-sync' | 'nonsequential-sync'
    | 'ambiguous-sync' | 'invalid-traversal' | 'partial-bar' | 'out-of-range'
    | 'outside-coverage' | 'ambiguous-insertion';
  readonly message: string;
  /** Zero-based source tuple index, when applicable. */
  readonly point?: number;
}
export type RecordingSyncResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly diagnostic: RecordingSyncDiagnostic };
export interface DecodedRecordingSync {
  /** Copy preserving tuple arity and values; normalization never rewrites storage. */
  readonly raw: readonly SoundsliceSyncpoint[];
  readonly points: readonly RecordingSyncpoint[];
}
export const MAX_RECORDING_SYNCPOINTS = 100_000;

/** Shape validation only. Nonsequential/ambiguous maps remain storable; audio
 *  decides whether they can be followed against a particular performance. */
export function decodeRecordingSync(input: unknown): RecordingSyncResult<DecodedRecordingSync> {
  const invalid = (message: string, point?: number): RecordingSyncResult<never> => ({
    ok: false, diagnostic: { code: 'invalid-sync', message, ...(point === undefined ? {} : { point }) },
  });
  if (!Array.isArray(input)) return invalid('Syncpoints must be an array of Soundslice tuples.');
  if (input.length > MAX_RECORDING_SYNCPOINTS) return {
    ok: false, diagnostic: { code: 'resource-limit', message: `At most ${MAX_RECORDING_SYNCPOINTS} syncpoints are supported.` },
  };
  const raw: SoundsliceSyncpoint[] = [];
  const points: RecordingSyncpoint[] = [];
  for (let i = 0; i < input.length; i++) {
    const p: unknown = input[i];
    if (!Array.isArray(p) || p.length < 2 || p.length > 4)
      return invalid('A syncpoint must contain two to four values.', i);
    const [bar, seconds, offset = 0, hide = 0] = p;
    if (!Number.isSafeInteger(bar) || bar < 0)
      return invalid('The performed bar must be a nonnegative safe integer.', i);
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0)
      return invalid('The recording time must be finite, nonnegative seconds.', i);
    // A present undefined/hole is not a valid JSON field; only omission defaults.
    if ((p.length >= 3 && typeof p[2] !== 'number') || !Number.isFinite(offset) || offset < 0 || offset > 480)
      return invalid('The inner-bar offset must be a finite number from 0 to 480.', i);
    if ((p.length === 4 && p[3] !== 0 && p[3] !== 1) || (hide !== 0 && hide !== 1))
      return invalid('The hide-playhead flag must be 0 or 1.', i);
    raw.push(Object.freeze([...p]) as SoundsliceSyncpoint);
    points.push(Object.freeze({ bar, seconds, offset, hidePlayhead: hide === 1 }));
  }
  return { ok: true, value: Object.freeze({ raw: Object.freeze(raw), points: Object.freeze(points) }) };
}
