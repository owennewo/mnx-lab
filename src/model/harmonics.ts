/**
 * Harmonic nodes, and where a non-natural harmonic is held and touched.
 *
 * MNX pitch is what SOUNDS. A natural harmonic is touched over the open string,
 * so its node counts from the nut. Every other type (artificial, pinch, tap,
 * semi, feedback) is a stopped note sounded at a node counted up FROM the
 * stopped fret: a harp harmonic held at 7 and touched at 19 sounds the octave
 * above the 7th fret. `touchingPitch` names the node; absent, it is the octave.
 * (roadmap/inprogress/core-artificial-harmonics.md)
 */
import type { MnxTabTechnique } from './mnx.ts';

export type MnxHarmonic = NonNullable<MnxTabTechnique['harmonic']>;

/** Node distance in frets → semitones it sounds above the string or stopped note. */
const NODES = new Map<number, number>([
  [12, 12],
  [7, 19],
  [19, 19],
  [5, 24],
  [24, 24],
  [4, 28],
  [9, 28],
  [16, 28],
  [3, 31],
  [2, 36]
]);

/** Semitones a node `frets` up sounds above where it is counted from; undefined off the table. */
export function harmonicInterval(frets: number): number | undefined {
  return NODES.get(frets);
}

/** A harmonic sounded at a node above a stopped fret, rather than over the open string. */
export function isStoppedHarmonic(harmonic: MnxHarmonic | undefined): boolean {
  return harmonic !== undefined && harmonic.type !== 'natural';
}

export interface StoppedHarmonicPosition {
  /** The fret held, counted from the (capo-shifted) open string. */
  stopped: number;
  /** The fret touched: the node, counted the same way. */
  touch: number;
}

/** Which explanation wins when several held frets and nodes sound the same
 *  pitch at the same touch point: the octave first — the harp harmonic, and
 *  every importer's default — then the stronger nodes. */
const NODE_PREFERENCE = [12, 7, 5, 19, 24, 4, 9, 16, 3, 2];

/**
 * Where a stopped harmonic is held and touched on a string whose open note is
 * `open` (MIDI, capo applied), given what it sounds and, when stated, the
 * touching pitch. A touch point can be explained more than one way (D5 touched
 * at 19 on the G string: held at 7 an octave up, or held open at the 19th-fret
 * node), so the stored fret wins when it is one of them, else the octave.
 * Null when no node on the table explains the sounding pitch.
 */
export function stoppedHarmonicPosition(
  sounding: number,
  open: number,
  touching: number | undefined,
  storedFret?: number
): StoppedHarmonicPosition | null {
  if (touching === undefined) {
    const stopped = sounding - open - 12;
    return stopped < 0 ? null : { stopped, touch: stopped + 12 };
  }
  const touch = touching - open;
  const candidates: number[] = [];
  for (let stopped = 0; stopped <= touch; stopped++) {
    const interval = harmonicInterval(touch - stopped);
    if (interval !== undefined && open + stopped + interval === sounding) candidates.push(stopped);
  }
  if (!candidates.length) return null;
  const stopped = storedFret !== undefined && candidates.includes(storedFret)
    ? storedFret
    : [...candidates].sort((a, b) => NODE_PREFERENCE.indexOf(touch - a) - NODE_PREFERENCE.indexOf(touch - b))[0];
  return { stopped, touch };
}

/**
 * The fret a NATURAL harmonic is touched at, `aboveOpen` semitones over its
 * (capo-shifted) open string: the stored fret when it is a node that sounds
 * that — the twelfth is reached at 7 and at 19 — else the arithmetic, which is
 * right at the octave and is what an unstated fret has always derived to.
 */
export function naturalHarmonicFret(aboveOpen: number, storedFret: number | undefined): number {
  return storedFret !== undefined && harmonicInterval(storedFret) === aboveOpen ? storedFret : aboveOpen;
}
