import { MnxNoteValue, MnxNoteValueBase } from './types.js';

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

/**
 * Whole-note fractions as exact integers. Every note value is dyadic (dots
 * multiply by 3/2 and leave the denominator a power of two), so a whole note of
 * 4096 ticks is exact down to a triple-dotted 256th — the same scale
 * `wholesToFraction` reduces against.
 */
const TICKS_PER_WHOLE = 4096;

/** The undotted values a tuplet's `inner`/`outer` unit may be stated in,
 *  longest first: the LONGEST unit that divides both sides evenly is the one
 *  an engraver would write. */
const UNIT_BASES: MnxNoteValueBase[] = [
  'breve', 'whole', 'half', 'quarter', 'eighth',
  '16th', '32nd', '64th', '128th', '256th'
];

export interface MnxTupletRatio {
  inner: { duration: MnxNoteValue; multiple: number };
  outer: { duration: MnxNoteValue; multiple: number };
}

/**
 * Guitar Pro flags EVERY beat of a tuplet with the same `num:den`; MNX states
 * the group ONCE, as `inner` events performed in the time of `outer`. This is
 * the same collapse/expand asymmetry as voltas (declared once in MNX, flagged
 * per bar in Guitar Pro), so it is solved the same way — the flags decide where
 * a group starts and ends, and the group is what gets written.
 *
 * `writtenWholes` is what the inner events are WRITTEN as, in whole notes; the
 * performed time is that scaled by `den/num`. Both sides are then restated
 * against one shared unit, because MNX's `multiple` is a count of units and a
 * triplet whose halves disagree ("3 eighths in the time of 2 eighths") has to
 * name the eighth twice.
 *
 * Returns null when no note value states both sides in whole units — a partial
 * group (two beats flagged 3:2) performs in a non-dyadic time that MNX's
 * duration × multiple cannot spell. Callers warn rather than write a wrong
 * ratio, which is the same standard the rest of this converter holds to.
 */
export function tupletRatio(
  writtenWholes: number[],
  numerator: number,
  denominator: number
): MnxTupletRatio | null {
  if (writtenWholes.length === 0 || numerator <= 0 || denominator <= 0) return null;

  const innerTicks = writtenWholes.reduce(
    (sum, wholes) => sum + Math.round(wholes * TICKS_PER_WHOLE),
    0
  );
  if (innerTicks <= 0 || (innerTicks * denominator) % numerator !== 0) return null;
  const outerTicks = (innerTicks * denominator) / numerator;

  for (const base of UNIT_BASES) {
    const unit = Math.round(mnxDurationToWholes(base) * TICKS_PER_WHOLE);
    if (unit <= 0) continue;
    if (innerTicks % unit !== 0 || outerTicks % unit !== 0) continue;
    return {
      inner: { duration: { base }, multiple: innerTicks / unit },
      outer: { duration: { base }, multiple: outerTicks / unit }
    };
  }
  return null;
}

/**
 * The inverse of `tupletRatio`: one MNX container → the num:den Guitar Pro
 * stamps on every beat of the group. `num` beats are performed in the time of
 * `den`, so alphaTab scales a flagged beat's ticks by `den/num` — which is
 * exactly `outer / inner` once both sides are measured in whole notes.
 *
 * Returns null when either side measures zero, which is the only way the ratio
 * has no meaning.
 */
export function tupletFlags(tuplet: {
  inner: { duration: MnxNoteValue; multiple: number };
  outer: { duration: MnxNoteValue; multiple: number };
}): { numerator: number; denominator: number } | null {
  const side = (part: { duration: MnxNoteValue; multiple: number }) =>
    Math.round(
      mnxDurationToWholes(part.duration.base, part.duration.dots ?? 0) *
        part.multiple *
        TICKS_PER_WHOLE
    );
  const inner = side(tuplet.inner);
  const outer = side(tuplet.outer);
  if (inner <= 0 || outer <= 0) return null;
  const divisor = gcd(inner, outer) || 1;
  return { numerator: inner / divisor, denominator: outer / divisor };
}
