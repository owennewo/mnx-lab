// Fermatas (core-measure-attributes-gaps.md, item 8): one glyph table for
// the event form (over its note or rest, in emitEvent's articulation stack)
// and the bar form (over the closing barline, emitMeasureFermata). MNX's
// `symbol` names the sign; Bravura has a pair per sign except the curlew,
// which is one glyph. `doubleDot` has no Bravura glyph and draws as normal.
import type { MnxFermata, MnxGlobalMeasure } from '../../model/mnx.ts';
import type { Primitive } from '../primitives.ts';

const FERMATA_GLYPH_BY_SYMBOL: Record<NonNullable<MnxFermata['symbol']>, string> = {
  normal: 'fermata',
  angled: 'fermataShort',
  square: 'fermataLong',
  doubleAngled: 'fermataVeryShort',
  doubleSquare: 'fermataVeryLong',
  doubleDot: 'fermata',
  halfCurve: 'fermataShortHenze',
  curlew: 'curlewSign'
};

/** Whether the sign sits under the staff: `orient: below`, or — with no side
 *  given — a glyph that points down, which is the same sign seen from below. */
export function fermataBelow(fermata: MnxFermata): boolean {
  if (fermata.orient === 'below') return true;
  if (fermata.orient === 'above') return false;
  return fermata.pointing === 'down';
}

export function fermataGlyph(fermata: MnxFermata, below: boolean): string {
  const base = FERMATA_GLYPH_BY_SYMBOL[fermata.symbol ?? 'normal'] ?? 'fermata';
  return base === 'curlewSign' ? base : `${base}${below ? 'Below' : 'Above'}`;
}

const MEASURE_FERMATA_RISE_SP = 2.5; // baseline above the top line, level with the navigation marks
const MEASURE_FERMATA_DROP_SP = 2.5; // below the bottom line

export interface EmitMeasureFermataArgs {
  gm: MnxGlobalMeasure;
  m: { x: number; width: number };
  staffTop: number;
  staffHeight: number;
  primitives: Primitive[];
}

/** The bar's fermata, centred over (or under) its closing barline. */
export function emitMeasureFermata({ gm, m, staffTop, staffHeight, primitives }: EmitMeasureFermataArgs): void {
  if (!gm.fermata) return;
  const below = fermataBelow(gm.fermata);
  primitives.push({
    kind: 'glyph',
    glyph: fermataGlyph(gm.fermata, below),
    x: m.x + m.width,
    y: below ? staffTop + staffHeight + MEASURE_FERMATA_DROP_SP : staffTop - MEASURE_FERMATA_RISE_SP,
    anchor: 'middle',
    ...(gm.fermata.color ? { fill: gm.fermata.color } : {}),
    className: 'fermata fermata-measure'
  });
}
