import type { MnxDynamic, MnxDynamicValue } from './types.js';

/**
 * The dynamics vocabulary, both directions.
 *
 * MusicXML names a dynamic by element (`<sfz/>`). MNX says it one of three
 * ways: a `value` from the closed `dynamic-value` enum; the sforzando family
 * spelled structurally — `type: 'accent'` whose accentPrefix + value +
 * accentSuffix + residualValue concatenate to exactly the MusicXML element
 * name; or an explicit SMuFL `glyphs` list for anything else. The glyph names
 * are the ones src/engine/layout/dynamics.ts draws, so a mark read here
 * engraves as the mark that was written.
 */

export type DynamicMark = Omit<MnxDynamic, 'position'>;

/** The MNX enum. Every member is also a MusicXML `<dynamics>` child. */
const VALUES = new Set<string>([
  'pppppp', 'ppppp', 'pppp', 'ppp', 'pp', 'p', 'mp',
  'mf', 'f', 'ff', 'fff', 'ffff', 'fffff', 'ffffff', 'n'
]);

/** The sforzando family, every part stated: the spec defaults an absent
 *  prefix to `s` and suffix to `z`, so a bare "fz" or "sf" must say `''`. */
const ACCENTS: Record<string, Pick<MnxDynamic, 'accentPrefix' | 'value' | 'accentSuffix' | 'residualValue'>> = {
  sf: { accentPrefix: 's', value: 'f', accentSuffix: '' },
  sfz: { accentPrefix: 's', value: 'f', accentSuffix: 'z' },
  sffz: { accentPrefix: 's', value: 'ff', accentSuffix: 'z' },
  sfp: { accentPrefix: 's', value: 'f', accentSuffix: '', residualValue: 'p' },
  sfpp: { accentPrefix: 's', value: 'f', accentSuffix: '', residualValue: 'pp' },
  sfzp: { accentPrefix: 's', value: 'f', accentSuffix: 'z', residualValue: 'p' },
  fz: { accentPrefix: '', value: 'f', accentSuffix: 'z' },
  fp: { accentPrefix: '', value: 'f', accentSuffix: '', residualValue: 'p' },
  rf: { accentPrefix: 'r', value: 'f', accentSuffix: '' },
  rfz: { accentPrefix: 'r', value: 'f', accentSuffix: 'z' }
};

/** MusicXML element → SMuFL glyph, for every `<dynamics>` child MusicXML
 *  names. `pf` has no MNX structure, so it travels as its glyph. */
const GLYPH_BY_ELEMENT: Record<string, string> = {
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
  n: 'dynamicNiente'
};

const ELEMENT_BY_GLYPH: Record<string, string> = Object.fromEntries(
  Object.entries(GLYPH_BY_ELEMENT).map(([element, glyph]) => [glyph, element])
);

/** One child of `<dynamics>`: its element name, and for `<other-dynamics>`
 *  the `smufl` attribute and text. */
export interface XmlDynamicChild {
  element: string;
  smufl?: string | null;
  text?: string;
}

function fromElement(name: string): DynamicMark | null {
  if (VALUES.has(name)) return { type: 'immediate', value: name as MnxDynamicValue };
  const accent = ACCENTS[name];
  if (accent) return { type: 'accent', ...accent };
  const glyph = GLYPH_BY_ELEMENT[name];
  return glyph ? { type: 'immediate', glyphs: [glyph] } : null;
}

function fromChild(child: XmlDynamicChild): DynamicMark | null {
  if (child.element !== 'other-dynamics') return fromElement(child.element);
  // A named SMuFL glyph is exact; a glyph MusicXML also has an element for is
  // read as that element, so `<other-dynamics smufl="dynamicSforzato"/>` and
  // `<sfz/>` come out the same.
  if (child.smufl) {
    const element = ELEMENT_BY_GLYPH[child.smufl];
    return element ? fromElement(element) : { type: 'immediate', glyphs: [child.smufl] };
  }
  return fromElement((child.text ?? '').trim());
}

/**
 * A `<dynamics>` element → one MNX mark, or null when it names something MNX
 * cannot hold (free text in `<other-dynamics>`). Several children print as one
 * group, so they become one glyph sequence rather than several marks stacked
 * at the same position.
 */
export function dynamicFromXml(children: XmlDynamicChild[]): DynamicMark | null {
  if (children.length === 1) return fromChild(children[0]);
  const glyphs = children.map(child =>
    child.element === 'other-dynamics'
      ? (child.smufl ?? GLYPH_BY_ELEMENT[(child.text ?? '').trim()])
      : GLYPH_BY_ELEMENT[child.element]
  );
  return children.length > 1 && glyphs.every(Boolean)
    ? { type: 'immediate', glyphs: glyphs as string[] }
    : null;
}

/** One child to write inside `<dynamics>`. */
export type XmlDynamicOut = { element: string } | { other: { smufl?: string; text?: string } };

/**
 * An MNX point dynamic → the `<dynamics>` children that spell it, plus a
 * `problem` naming whatever could not be said. Hairpins and relative groups
 * are not point marks and are the caller's business.
 */
export function dynamicToXml(dyn: DynamicMark): { children: XmlDynamicOut[]; problem?: string } {
  // Glyphs win, as they do when the engine draws the mark.
  if (dyn.glyphs?.length) {
    return {
      children: dyn.glyphs.map(glyph =>
        ELEMENT_BY_GLYPH[glyph] ? { element: ELEMENT_BY_GLYPH[glyph] } : { other: { smufl: glyph } }
      )
    };
  }
  if (dyn.type === 'accent') {
    const mnemonic =
      `${dyn.accentPrefix ?? 's'}${dyn.value ?? ''}${dyn.accentSuffix ?? 'z'}${dyn.residualValue ?? ''}`;
    if (ACCENTS[mnemonic] || VALUES.has(mnemonic)) return { children: [{ element: mnemonic }] };
    return {
      children: [{ other: { text: mnemonic } }],
      problem: `accent dynamic "${mnemonic}" has no MusicXML element; written as <other-dynamics>`
    };
  }
  if (dyn.value && VALUES.has(dyn.value)) return { children: [{ element: dyn.value }] };
  return { children: [], problem: 'a dynamic with neither a value nor a glyph was not written' };
}
