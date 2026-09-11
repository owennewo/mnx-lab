import { MnxPartTransposition } from './types.js';

/**
 * Guitar Pro states a track's display transposition in semitones from WRITTEN
 * to SOUNDING — a guitar is -12, written an octave above where it sounds. GP7
 * spells it `<Transpose><Chromatic>0</Chromatic><Octave>-1</Octave>`, GP6
 * `<PartSounding><TranspositionPitch>-12</TranspositionPitch>`, and GP3–5 not
 * at all (`gp345TranspositionPitch`).
 *
 * MNX's `part.transposition.interval` runs the other way, sounding → written,
 * so a guitar is {halfSteps: 12, staffDistance: 7}. MNX pitch stays SOUNDING
 * either way: the block is display metadata and never enters the fret
 * arithmetic (scenarios/lab/22-tab-derivation/07-transposition-display-only).
 */
export function gpTranspositionToMnx(semitones: number): MnxPartTransposition | undefined {
  if (!semitones) return undefined;
  const halfSteps = -semitones;
  const octaves = Math.trunc(halfSteps / 12);
  const remainder = halfSteps - octaves * 12;
  const staffDistance = octaves * 7 + Math.sign(remainder) * DIATONIC_STEPS[Math.abs(remainder)];
  return {
    interval: { halfSteps, staffDistance },
    // The spec's convention for instruments read at the octave (piccolo,
    // glockenspiel, double bass — and guitar): shown written even in a
    // concert-pitch score. Any other interval is left to the score.
    ...(remainder === 0 ? { prefersWrittenPitches: true } : {})
  };
}

/** Diatonic steps per chromatic distance, in the usual spelling. */
const DIATONIC_STEPS = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];

/**
 * The inverse, for the writer: GP's written → sounding semitones. A part that
 * states no transposition gets the guitar's -12, since the writer always emits
 * a guitar track.
 */
export function mnxTranspositionToGp(transposition: MnxPartTransposition | undefined): number {
  return transposition ? -transposition.interval.halfSteps : -12;
}

/**
 * GP3–5 has no transposition field; the octave follows the MIDI program.
 * Guitars, basses, banjo and contrabass are written an octave up — the programs
 * alphaTab's GP3–5 reader treats that way, so the differential oracle agrees.
 */
export function gp345TranspositionPitch(program: number, percussion: boolean): number {
  if (percussion) return 0;
  return (program >= 24 && program <= 39) || program === 105 || program === 43 ? -12 : 0;
}
