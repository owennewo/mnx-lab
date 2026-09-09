// Swing as a warp of the metric axis, not a rewrite of notes.
//
// A swung bar rearranges time inside itself and keeps its length: the pair
// [0, 2u) becomes [0, 2u·a/(a+b)) and [2u·a/(a+b), 2u). That single property —
// **bar-local and duration-preserving** — is what lets swing sit under the rest
// of the compiler untouched. Bar starts are fixed points, so measure positions,
// the tempo map and the fermata/grace insertion map all still see the axis they
// were written against; only offsets INSIDE a bar move.
//
// Warping the axis rather than the notes is also the musically honest reading.
// MusicXML's `<swing>` only reaches notes whose duration equals their written
// type, which leaves a 16th inside a swung eighth pair undefined; a continuous
// warp places it where a player would put it, and leaves a quarter note sitting
// across the pair exactly on the beat, because 2u is a fixed point too.
import {
  ZERO,
  add,
  subtract,
  multiply,
  compare,
  rational,
  type Rational,
} from './time.ts';
import type { ResolvedSwing } from '../model/swing.ts';

/** One straight run of the warped axis: written `[from, until)` plays at
 *  `scale` times its written length. */
export interface SwingRun {
  from: Rational;
  until: Rational;
  scale: Rational;
}

const TWO = rational(2n);
const SWING_PAIR_LIMIT = 4096;

/**
 * The warp for one bar, as the runs it is piecewise linear over. A bar with no
 * feel is one run at scale 1; the trailing partial pair, if any, is likewise.
 */
export function swingRuns(swing: ResolvedSwing | null, length: Rational): SwingRun[] {
  if (!swing || compare(length, ZERO) <= 0) return [{ from: ZERO, until: length, scale: rational(1n) }];
  const unit = rational(swing.unit[0], swing.unit[1]);
  const pair = multiply(unit, TWO);
  const total = swing.first + swing.second;
  // A played half as a multiple of the written half: (2a/(a+b)) : 1.
  const firstScale = rational(swing.first * 2n, total);
  const secondScale = rational(swing.second * 2n, total);
  const runs: SwingRun[] = [];
  let from = ZERO;
  // A resource bound, not a musical one: a bar cannot hold more pairs than
  // this without already having failed the compiler's event budget.
  while (compare(add(from, pair), length) <= 0 && runs.length < SWING_PAIR_LIMIT * 2) {
    const middle = add(from, unit);
    runs.push({ from, until: middle, scale: firstScale });
    runs.push({ from: middle, until: add(from, pair), scale: secondScale });
    from = add(from, pair);
  }
  // Whatever is left cannot make a pair, so it is played as written. A 7/8 bar
  // swung in eighths swings three pairs and plays its last eighth straight.
  if (compare(from, length) < 0) runs.push({ from, until: length, scale: rational(1n) });
  return runs;
}

export interface SwingMap {
  /** Written offset within the bar → played offset within the bar. */
  at(offset: Rational): Rational;
  /** The runs, with played spans resolved, for the source map. */
  runs: readonly (SwingRun & { position: Rational })[];
  /** True when nothing is warped, so callers can skip the work entirely. */
  straight: boolean;
}

/** The warp for one bar. Offsets are written offsets FROM THE BARLINE. */
export function createSwingMap(swing: ResolvedSwing | null, length: Rational): SwingMap {
  const runs = swingRuns(swing, length);
  let position = ZERO;
  const placed = runs.map(run => {
    const entry = { ...run, position };
    position = add(position, multiply(subtract(run.until, run.from), run.scale));
    return entry;
  });
  const straight = placed.every(run => run.scale.num === run.scale.den);
  return {
    straight,
    runs: placed,
    at(offset) {
      if (straight) return offset;
      // Past the end (a bar longer than its declared meter) the axis continues
      // straight: an overfull bar is a document error the layouts already
      // badge, and inventing a grid for it would move notes the reader can see.
      const last = placed[placed.length - 1];
      if (compare(offset, last.until) >= 0)
        return add(
          add(last.position, multiply(subtract(last.until, last.from), last.scale)),
          subtract(offset, last.until),
        );
      const run = placed.find(r => compare(offset, r.from) >= 0 && compare(offset, r.until) < 0)!;
      return add(run.position, multiply(subtract(offset, run.from), run.scale));
    },
  };
}
