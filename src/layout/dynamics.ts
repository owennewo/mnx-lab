import { glyphBBox } from '../smufl/smufl.ts';
import type { MnxDynamic } from '../types/mnx.ts';

/**
 * Dynamics vocabulary shared by spacing (column widths) and notation (glyph
 * emission). MNX v19 constrains `dynamic-group.value` to a closed enum
 * (ppp…fff, n); marks outside it (pppppp, sfz, fp, z, …) carry an explicit
 * `glyphs` list instead. This table maps both the enum values and those
 * conventional mnemonics to SMuFL glyphs (the mnemonic keys are what a
 * `glyphs` entry resolves to). The unsuffixed SMuFL dynamicSforzando/
 * dynamicRinforzando are bare letters; the "...1"/"...2" variants are the
 * conventional sf/rf marks.
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

type DynamicMark = Pick<MnxDynamic, 'value' | 'glyphs' | 'prefix' | 'suffix'>;

/** The SMuFL glyph for a dynamic: an explicit `glyphs[0]` wins (MNX v19 routes
 *  marks outside the `value` enum through `glyphs`), else the `value` maps via
 *  the table. null = unmapped (renderers fall back to italic text). */
export function dynamicGlyph(dyn: DynamicMark): string | null {
  return dyn.glyphs?.[0] ?? (dyn.value ? DYNAMIC_GLYPH_BY_VALUE[dyn.value] : undefined) ?? null;
}

/** The italic-text fallback for a dynamic that has no mapped glyph. */
export function dynamicLabel(dyn: DynamicMark): string {
  return [dyn.prefix, dyn.value, dyn.suffix].filter(Boolean).join('');
}

const TEXT_FALLBACK_CHAR_SP = 1.0; // italic-text width estimate per character

/** Drawn width of a dynamic in sp — for reserving column room in the plan. */
export function dynamicWidthSp(dyn: DynamicMark): number {
  const glyph = dynamicGlyph(dyn);
  if (glyph) {
    const bb = glyphBBox(glyph);
    if (bb) return bb.w;
  }
  return dynamicLabel(dyn).length * TEXT_FALLBACK_CHAR_SP;
}
