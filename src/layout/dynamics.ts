import { glyphBBox } from '../smufl/smufl.ts';

/**
 * Dynamics vocabulary shared by spacing (column widths) and notation (glyph
 * emission). MNX leaves `dynamic-type` as a free string; this table is the
 * de-facto supported set (see lab/dynamics/all-dynamic-marks). The unsuffixed
 * SMuFL dynamicSforzando/dynamicRinforzando are bare letters; the "...1"/"...2"
 * variants are the conventional sf/rf marks.
 */
export const DYNAMIC_GLYPH_BY_VALUE: Record<string, string> = {
  pppppp: 'dynamicPPPPPP',
  ppppp: 'dynamicPPPPP',
  pppp: 'dynamicPPPP',
  ppp: 'dynamicPPP',
  pp: 'dynamicPP',
  p: 'dynamicPiano',
  mp: 'dynamicMP',
  mf: 'dynamicMF',
  pf: 'dynamicPF',
  f: 'dynamicForte',
  ff: 'dynamicFF',
  fff: 'dynamicFFF',
  ffff: 'dynamicFFFF',
  fffff: 'dynamicFFFFF',
  ffffff: 'dynamicFFFFFF',
  fp: 'dynamicFortePiano',
  fz: 'dynamicForzando',
  sf: 'dynamicSforzando1',
  sfp: 'dynamicSforzandoPiano',
  sfpp: 'dynamicSforzandoPianissimo',
  sfz: 'dynamicSforzato',
  sfzp: 'dynamicSforzatoPiano',
  sffz: 'dynamicSforzatoFF',
  rf: 'dynamicRinforzando1',
  rfz: 'dynamicRinforzando2',
  n: 'dynamicNiente',
  z: 'dynamicZ'
};

/** The SMuFL glyph for a dynamic, honouring an explicit `glyph` override;
 *  null = unmapped (renderers fall back to italic text). */
export function dynamicGlyph(value: string, explicit?: string): string | null {
  return explicit ?? DYNAMIC_GLYPH_BY_VALUE[value] ?? null;
}

const TEXT_FALLBACK_CHAR_SP = 1.0; // italic-text width estimate per character

/** Drawn width of a dynamic in sp — for reserving column room in the plan. */
export function dynamicWidthSp(value: string, explicit?: string): number {
  const glyph = dynamicGlyph(value, explicit);
  if (glyph) {
    const bb = glyphBBox(glyph);
    if (bb) return bb.w;
  }
  return value.length * TEXT_FALLBACK_CHAR_SP;
}
