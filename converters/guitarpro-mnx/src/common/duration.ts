import { MnxNoteValueBase } from './types.js';

/**
 * alphaTab's `Duration` enum is the note-value denominator: Whole = 1,
 * Half = 2, Quarter = 4 … TwoHundredFiftySixth = 256 (plus negative values for
 * the double/quadruple whole). MNX names the same values as strings.
 */
const MNX_TO_ALPHATAB: Partial<Record<MnxNoteValueBase, number>> = {
  breve: -2,
  whole: 1,
  half: 2,
  quarter: 4,
  eighth: 8,
  '16th': 16,
  '32nd': 32,
  '64th': 64,
  '128th': 128,
  '256th': 256
};

const ALPHATAB_TO_MNX = new Map<number, MnxNoteValueBase>(
  Object.entries(MNX_TO_ALPHATAB).map(([base, value]) => [
    value as number,
    base as MnxNoteValueBase
  ])
);

/**
 * MNX duration base → alphaTab Duration value. Returns null for values Guitar
 * Pro cannot represent (maxima, longa, and anything below a 256th), so callers
 * can report the loss rather than silently writing a wrong note.
 */
export function mnxBaseToAlphaTab(base: MnxNoteValueBase): number | null {
  return MNX_TO_ALPHATAB[base] ?? null;
}

export function alphaTabDurationToMnx(duration: number): MnxNoteValueBase | null {
  return ALPHATAB_TO_MNX.get(duration) ?? null;
}

/** Duration in whole-note fractions, so measures can be checked for fullness. */
export function mnxDurationToWholes(base: MnxNoteValueBase, dots = 0): number {
  const denominator = MNX_TO_ALPHATAB[base];
  if (denominator === undefined) return 0;
  const plain = denominator < 0 ? -denominator : 1 / denominator;
  return plain * (2 - Math.pow(2, -dots));
}

/**
 * Whole notes → an MNX `rhythmic-position` fraction, reduced.
 *
 * MNX measures metric positions as a fraction OF A WHOLE NOTE (`[1, 4]` is one
 * quarter into the bar), so this is the unit `harmony.location`,
 * `tempo.location` and `segno.location` all share. Every note value is a dyadic
 * rational — dots multiply by 3/2 and leave the denominator a power of two — so
 * scaling by 4096 is exact for anything down to a triple-dotted 256th.
 */
export function wholesToFraction(wholes: number): [number, number] {
  const scale = 4096;
  let numerator = Math.round(wholes * scale);
  let denominator = scale;
  const divisor = gcd(Math.abs(numerator), denominator) || 1;
  numerator /= divisor;
  denominator /= divisor;
  return [numerator, denominator];
}

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}
