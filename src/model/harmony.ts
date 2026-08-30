/**
 * Chord-symbol text ⇄ structure — the engine's copy of what the converters
 * carry (`converters/<name>/src/common/harmony.ts`; the packages are standalone, so
 * the three are kept identical by hand). Promoted here for the renderer and
 * the editor (core-chord-symbols.md): the page spells a harmony from its
 * structure unless `text` overrides it, and the typed `chord Am7` goes back
 * through `parseChordSymbol`.
 */
import type { MnxHarmony, MnxHarmonyQuality, MnxHarmonyStep, MnxPitch } from './mnx.ts';

type Step = MnxPitch['step'];

/** Suffix (everything after the root, before any slash bass) → quality.
 *  Longest match wins, so `m7` is not read as `m` followed by junk. */
const SUFFIX_TO_QUALITY: Array<[string, MnxHarmonyQuality]> = [
  ['', 'major'],
  ['maj', 'major'],
  ['M', 'major'],
  ['m', 'minor'],
  ['min', 'minor'],
  ['-', 'minor'],
  ['aug', 'augmented'],
  ['+', 'augmented'],
  ['dim', 'diminished'],
  ['o', 'diminished'],
  ['°', 'diminished'],
  ['5', 'power'],
  ['6', 'majorSixth'],
  ['m6', 'minorSixth'],
  ['min6', 'minorSixth'],
  ['-6', 'minorSixth'],
  ['7', 'dominantSeventh'],
  ['maj7', 'majorSeventh'],
  ['M7', 'majorSeventh'],
  ['ma7', 'majorSeventh'],
  ['Δ', 'majorSeventh'],
  ['Δ7', 'majorSeventh'],
  ['m7', 'minorSeventh'],
  ['min7', 'minorSeventh'],
  ['-7', 'minorSeventh'],
  ['dim7', 'diminishedSeventh'],
  ['o7', 'diminishedSeventh'],
  ['°7', 'diminishedSeventh'],
  ['m7b5', 'halfDiminished'],
  ['m7♭5', 'halfDiminished'],
  ['min7b5', 'halfDiminished'],
  ['ø', 'halfDiminished'],
  ['ø7', 'halfDiminished'],
  ['aug7', 'augmentedSeventh'],
  ['+7', 'augmentedSeventh'],
  ['7#5', 'augmentedSeventh'],
  ['mMaj7', 'majorMinor'],
  ['mM7', 'majorMinor'],
  ['minMaj7', 'majorMinor'],
  ['9', 'dominantNinth'],
  ['maj9', 'majorNinth'],
  ['M9', 'majorNinth'],
  ['m9', 'minorNinth'],
  ['min9', 'minorNinth'],
  ['-9', 'minorNinth'],
  ['11', 'dominantEleventh'],
  ['maj11', 'majorEleventh'],
  ['M11', 'majorEleventh'],
  ['m11', 'minorEleventh'],
  ['min11', 'minorEleventh'],
  ['-11', 'minorEleventh'],
  ['13', 'dominantThirteenth'],
  ['maj13', 'majorThirteenth'],
  ['M13', 'majorThirteenth'],
  ['m13', 'minorThirteenth'],
  ['min13', 'minorThirteenth'],
  ['-13', 'minorThirteenth'],
  ['sus', 'suspendedFourth'],
  ['sus4', 'suspendedFourth'],
  ['sus2', 'suspendedSecond']
];

/** The spelling a consumer renders when a harmony carries no `text` override. */
const QUALITY_TO_SUFFIX: Record<MnxHarmonyQuality, string> = {
  major: '',
  minor: 'm',
  augmented: 'aug',
  diminished: 'dim',
  dominantSeventh: '7',
  majorSeventh: 'maj7',
  minorSeventh: 'm7',
  diminishedSeventh: 'dim7',
  augmentedSeventh: 'aug7',
  halfDiminished: 'm7b5',
  majorMinor: 'mMaj7',
  majorSixth: '6',
  minorSixth: 'm6',
  dominantNinth: '9',
  majorNinth: 'maj9',
  minorNinth: 'm9',
  dominantEleventh: '11',
  majorEleventh: 'maj11',
  minorEleventh: 'm11',
  dominantThirteenth: '13',
  majorThirteenth: 'maj13',
  minorThirteenth: 'm13',
  suspendedSecond: 'sus2',
  suspendedFourth: 'sus4',
  neapolitan: 'N',
  italian: 'It',
  french: 'Fr',
  german: 'Ger',
  pedal: 'ped',
  power: '5',
  tristan: 'Tr',
  other: '',
  none: ''
};

const SUFFIX_LOOKUP = new Map(SUFFIX_TO_QUALITY);

/** `C`, `Bb`, `F♯` → a root/bass step. Case-insensitive on the letter: Guitar
 *  Pro files in the wild carry lowercase roots (`c/G`), and lowercase does NOT
 *  reliably mean minor — the literal spelling is preserved in `text` instead. */
function parseStep(raw: string): MnxHarmonyStep | null {
  const match = /^([A-Ga-g])([#♯b♭x]{0,2})$/.exec(raw.trim());
  if (!match) return null;
  const step = match[1].toUpperCase() as Step;
  let alter = 0;
  for (const char of match[2]) {
    if (char === '#' || char === '♯') alter += 1;
    else if (char === 'b' || char === '♭') alter -= 1;
    else if (char === 'x') alter += 2;
  }
  return alter === 0 ? { step } : { step, alter };
}

function renderStep(step: MnxHarmonyStep): string {
  const alter = step.alter ?? 0;
  const accidental = alter > 0 ? '#'.repeat(alter) : alter < 0 ? 'b'.repeat(-alter) : '';
  return `${step.step}${accidental}`;
}

/** The canonical display spelling of a harmony, ignoring any `text` override.
 *  `other` has no canonical spelling by definition — its text IS the symbol. */
export function renderChordSymbol(harmony: Omit<MnxHarmony, 'location'>): string {
  if (harmony.quality === 'none') return 'N.C.';
  if (harmony.quality === 'other') return harmony.text ?? '';
  if (!harmony.root) return harmony.text ?? '';
  const bass = harmony.bass ? `/${renderStep(harmony.bass)}` : '';
  return `${renderStep(harmony.root)}${QUALITY_TO_SUFFIX[harmony.quality]}${bass}`;
}

/**
 * A chord symbol as written → structure, with `text` set only when the source
 * spelling is not what `renderChordSymbol` produces.
 *
 * Never returns null for non-empty input: an unrecognised symbol becomes
 * `quality: 'other'` carrying the literal, so nothing in a source file is lost
 * to a parser gap.
 */
export function parseChordSymbol(raw: string): Omit<MnxHarmony, 'location'> | null {
  const text = raw.trim();
  if (!text) return null;
  if (/^(n\.?c\.?|no chord)$/i.test(text)) {
    return text === 'N.C.' ? { quality: 'none' } : { quality: 'none', text };
  }

  const withText = (harmony: Omit<MnxHarmony, 'location'>) =>
    renderChordSymbol(harmony) === text ? harmony : { ...harmony, text };

  // The bass is after the LAST slash: `C/G`, and `Am7b5/G` too.
  const slash = text.lastIndexOf('/');
  const head = slash > 0 ? text.slice(0, slash) : text;
  const bass = slash > 0 ? parseStep(text.slice(slash + 1)) : null;

  const rootMatch = /^([A-Ga-g][#♯b♭x]{0,2})(.*)$/.exec(head);
  const root = rootMatch ? parseStep(rootMatch[1]) : null;
  const quality = rootMatch ? SUFFIX_LOOKUP.get(rootMatch[2]) : undefined;

  // Anything the table cannot name is still carried, root included when one was
  // found — `other` says "the text is the symbol", not "this was thrown away".
  if (!root || quality === undefined || (slash > 0 && !bass)) {
    return { ...(root ? { root } : {}), quality: 'other', text };
  }

  return withText({ root, quality, ...(bass ? { bass } : {}) });
}

/** The accidental-bearing name of a root/bass step: `F#`, `Bb`, `C`. */
export function stepToText(step: MnxHarmonyStep): string {
  return renderStep(step);
}


/** The spelling as ENGRAVED: the text override, else the canonical spelling,
 *  with real flat and sharp signs — `Bb` is how it is typed, `B♭` how it is
 *  read. Applied to the root and the bass only; a quality suffix keeps its
 *  letters (`m7b5` stays, as jazz charts print it). */
export function chordSymbolDisplay(harmony: Omit<MnxHarmony, 'location'>): string {
  const text = harmony.text ?? renderChordSymbol(harmony);
  return text.replace(/^([A-Ga-g])([#b]{1,2})/, (_, l, acc) => l + acc.replace(/#/g, '♯').replace(/b/g, '♭'))
             .replace(/\/([A-Ga-g])([#b]{1,2})$/, (_, l, acc) => '/' + l + acc.replace(/#/g, '♯').replace(/b/g, '♭'));
}
