import type { MnxPitch } from '../model/mnx.ts';

const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 } as const;
/** MNX pitch is already sounded. Clefs, ottavas, transposition, capo and
 * harmonic touchingPitch are deliberately not inputs to this function.
 * Fractional alterations and pitches outside MIDI's export range are retained;
 * the bounded MIDI writer owns export diagnostics, never a silent clamp here. */
export function midiOf(pitch: MnxPitch): number {
  const step = SEMITONES[pitch.step];
  if (typeof step !== 'number' || !Number.isSafeInteger(pitch.octave) || !Number.isFinite(pitch.alter ?? 0))
    throw new RangeError('Invalid sounded pitch.');
  const base = (pitch.octave + 1) * 12 + step;
  if (!Number.isSafeInteger(base)) throw new RangeError('Sounded pitch exceeds safe integer precision.');
  const midi = base + (pitch.alter ?? 0);
  if (!Number.isFinite(midi) || Math.abs(midi) > Number.MAX_SAFE_INTEGER) throw new RangeError('Sounded pitch exceeds the numeric range.');
  return midi;
}
