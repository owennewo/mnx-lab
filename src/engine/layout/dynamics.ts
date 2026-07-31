import { glyphBBox } from '../smufl/smufl.ts';
import type { MnxDynamic } from '../../model/mnx.ts';

/**
 * Dynamics vocabulary shared by spacing (column widths) and notation (glyph
 * emission). MNX v24 constrains `dynamic-group.value` to a closed enum
 * (ppppp…fffff, n); marks outside it (pppppp, ffffff, fp, fz, z, …) carry an
 * explicit `glyphs` list instead. v24 widened that enum by four and gave
 * sfz/rfz a structural encoding (`type: 'accent'` plus accentPrefix/Suffix),
 * so fewer marks need `glyphs` than before — but the table still covers both,
 * because a document may legitimately use either route. This table maps both
 * the enum values and those
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

type DynamicMark = Pick<
  MnxDynamic,
  'type' | 'value' | 'glyphs' | 'prefix' | 'suffix' | 'accentPrefix' | 'accentSuffix' | 'residualValue'
>;

/**
 * The conventional mnemonic an `type: 'accent'` group spells out.
 *
 * v24 encodes the sforzando family structurally rather than as an opaque glyph
 * name: `accentPrefix` + `value` + `accentSuffix` + `residualValue` concatenate
 * to exactly the conventional abbreviation — s+f+z = "sfz", r+f+z = "rfz",
 * ""+f+z = "fz", s+f+"" = "sf", ""+f+""+p = "fp", s+f+z+p = "sfzp",
 * s+ff+z = "sffz". Those are keys in the table above, so composition and lookup
 * are the same operation.
 *
 * The defaults are the spec's: "If not provided, the default is 's'" /
 * "'z'". They are load-bearing — omitting both yields "sfz", so a plain "fz"
 * or "fp" requires setting the empty string explicitly.
 */
function accentMnemonic(dyn: DynamicMark): string | null {
  if (dyn.type !== 'accent') return null;
  const prefix = dyn.accentPrefix ?? 's';
  const suffix = dyn.accentSuffix ?? 'z';
  const mnemonic = `${prefix}${dyn.value ?? ''}${suffix}${dyn.residualValue ?? ''}`;
  return mnemonic || null;
}

/** The SMuFL glyph for a dynamic: an explicit `glyphs[0]` wins (MNX routes
 *  marks outside the `value` enum through `glyphs`), then an accent group's
 *  composed mnemonic, else the `value` maps via the table. null = unmapped
 *  (renderers fall back to italic text). */
export function dynamicGlyph(dyn: DynamicMark): string | null {
  if (dyn.glyphs?.[0]) return dyn.glyphs[0];
  const accent = accentMnemonic(dyn);
  if (accent && DYNAMIC_GLYPH_BY_VALUE[accent]) return DYNAMIC_GLYPH_BY_VALUE[accent];
  return (dyn.value ? DYNAMIC_GLYPH_BY_VALUE[dyn.value] : undefined) ?? null;
}

/** The italic-text fallback for a dynamic that has no mapped glyph. An accent
 *  group falls back to its own mnemonic, so an unmapped combination still
 *  engraves as the letters it denotes rather than as a bare `value`. */
export function dynamicLabel(dyn: DynamicMark): string {
  const accent = accentMnemonic(dyn);
  if (accent) return [dyn.prefix, accent, dyn.suffix].filter(Boolean).join('');
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
