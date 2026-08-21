import { Primitive } from '../primitives.ts';

/**
 * END BARLINES — the whole `barline-type` enum, drawn once for every staff kind.
 *
 * A barline belongs to the GLOBAL measure, not to a staff: MNX attaches it as
 * `measure-global.barline`, and the spec's own prose on that relationship is
 * what this module implements verbatim —
 *
 *   > The barline drawn at the END of this measure. If not provided, the
 *   > barline should be interpreted as follows:
 *   >   * If the measure is the last in the document, use {"type": "final"}.
 *   >   * Otherwise, use {"type": "regular"}.
 *
 * Both halves of that default were previously hard-coded as the ONLY behaviour:
 * every layout drew thin-unless-last and read `barline` never. Two mirrored
 * spec scenarios already carried the counter-evidence, checked against the CG's
 * own reference engravings in `vendor/mnx`:
 *
 *   - `measure-repeats` declares `double` at measure 4 and is engraved `‖`;
 *      we drew a plain thin line.
 *   - `hello-world` declares `regular` on its only measure and is engraved with
 *      a plain barline; we drew thin+thick, overriding an explicit declaration
 *      because the measure happened to be last.
 *
 * The second is the sharper bug and the reason the default belongs HERE rather
 * than in an `isLast` branch: a default is what you use when the document is
 * silent, and the old code applied it when the document had spoken.
 *
 * ---
 *
 * Every barline is drawn with its RIGHT edge on the measure's end x, which is
 * how `final` already behaved and is what keeps the music's column positions
 * independent of the barline style chosen. Nothing here is budgeted for in
 * `spacing.ts` — also as `final` already was — so the widest styles
 * (`heavyHeavy`) eat into the trailing pad rather than pushing the bar wider.
 *
 * Metrics come from the caller because the two staff kinds genuinely differ: a
 * notation barline is 0.16sp of ink against a tab staff's 0.1, sized to their
 * different staff-line weights. Passing them in is what let this replace both
 * copies without moving a committed golden.
 */

export type BarlineType =
  | 'regular'
  | 'dotted'
  | 'dashed'
  | 'heavy'
  | 'double'
  | 'final'
  | 'heavyLight'
  | 'heavyHeavy'
  | 'tick'
  | 'short'
  | 'noBarline';

/** Dash on-lengths for the two broken styles (equal gaps — see `LinePrim`). */
const DASH_SP = 0.5;
const DOT_SP = 0.12;

/** `tick` rises this far above the top staff line and drops this far below it. */
const TICK_REACH_SP = 1;
/** `short` spans the middle half of the staff, whatever its line count. */
const SHORT_INSET_RATIO = 0.25;

export interface BarlineMetrics {
  /** Ink width of a light line. */
  thinSp: number;
  /** Ink width of a heavy line. */
  thickSp: number;
  /** Clear space between two elements of a compound barline. */
  gapSp: number;
}

export interface EmitEndBarlineArgs {
  type: BarlineType;
  /** The measure's end x — every style's right edge. */
  x: number;
  /** Vertical span to cover (a staff, or a whole bracketed group). */
  top: number;
  bottom: number;
  metrics: BarlineMetrics;
  primitives: Primitive[];
}

/**
 * The document's barline type for a measure, or the spec's default when it is
 * silent. `isLast` only ever supplies a default — an explicit type wins,
 * including an explicit `regular` on the final measure.
 */
export function resolveBarlineType(
  barline: { type?: string } | undefined,
  isLast: boolean
): BarlineType {
  const declared = barline?.type as BarlineType | undefined;
  if (declared) return declared;
  return isLast ? 'final' : 'regular';
}

export function emitEndBarline(args: EmitEndBarlineArgs): void {
  const { type, x, top, bottom, metrics, primitives } = args;
  const { thinSp, thickSp, gapSp } = metrics;

  // Every offset below is an INK offset — the width of a stroke, the gap
  // between two of them — so it travels in `dx`, never subtracted from `x`.
  // Subtracted from `x` it would scale as a musical position: at 640% staff
  // scale on a fitted line the strokes are 6.4px wide and the gaps that
  // should separate them 3px, so a double barline OVERLAPPED ITSELF and drew
  // as one fat line. See PrimitiveBase's note on the two currencies.

  /** A light line whose ink is centred `dx` of ink from `at`. */
  const light = (at: number, dx: number, className: string, dash?: number) =>
    primitives.push({
      kind: 'line',
      x1: at, dx1: dx, y1: top,
      x2: at, dx2: dx, y2: bottom,
      thickness: thinSp,
      ...(dash === undefined ? {} : { dash }),
      className
    });

  /** A heavy band whose ink ENDS `dx` of ink from `right` — a rect, since it
   *  is a band of ink rather than a stroke, and that is how `final` has always
   *  drawn it. Its WIDTH is already ink, so placing it by its right edge is
   *  exactly `dx: dx - thickSp`. */
  const heavy = (right: number, dx: number, className: string) =>
    primitives.push({
      kind: 'rect',
      x: right, dx: dx - thickSp, y: top,
      w: thickSp, h: bottom - top,
      fill: 'currentColor',
      className
    });

  switch (type) {
    case 'noBarline':
      return;

    case 'regular':
      light(x, 0, 'barline');
      return;

    case 'dashed':
      light(x, 0, 'barline barline-dashed', DASH_SP);
      return;

    case 'dotted':
      light(x, 0, 'barline barline-dotted', DOT_SP);
      return;

    case 'heavy':
      heavy(x, 0, 'barline barline-heavy');
      return;

    case 'double':
      // Two light lines. Emitted left-to-right so a golden diff reads in the
      // order the reader's eye travels.
      light(x, -gapSp, 'barline barline-double');
      light(x, 0, 'barline barline-double');
      return;

    case 'final':
      // Light then heavy. Order and class names are load-bearing: this is the
      // one style that predates the module, and its goldens are committed.
      light(x, -thickSp - gapSp, 'barline barline-final-thin');
      heavy(x, 0, 'barline barline-final-thick');
      return;

    case 'heavyLight':
      heavy(x, -gapSp - thinSp, 'barline barline-heavy-light');
      light(x, 0, 'barline barline-heavy-light');
      return;

    case 'heavyHeavy':
      heavy(x, -thickSp - gapSp, 'barline barline-heavy-heavy');
      heavy(x, 0, 'barline barline-heavy-heavy');
      return;

    case 'tick':
      // A short stroke straddling the TOP line — the copyist's mark for a
      // phrase end that must not read as a structural division.
      primitives.push({
        kind: 'line',
        x1: x, y1: top - TICK_REACH_SP, x2: x, y2: top + TICK_REACH_SP,
        thickness: thinSp,
        className: 'barline barline-tick'
      });
      return;

    case 'short': {
      // The middle half of the staff, derived from its height rather than from
      // a line count, so one rule serves a 5-line staff and a 6-string one.
      const inset = (bottom - top) * SHORT_INSET_RATIO;
      primitives.push({
        kind: 'line',
        x1: x, y1: top + inset, x2: x, y2: bottom - inset,
        thickness: thinSp,
        className: 'barline barline-short'
      });
      return;
    }

    default:
      // An unknown type is a document from a newer schema than this build.
      // Draw the thing every barline at least is, rather than nothing.
      light(x, 0, 'barline');
  }
}
