// The setup popovers' typed grammar — roadmap/complete/core-editor-input-layer.md.
//
// Setup (tuning, time signature) is low-frequency, so it gets no single keys;
// its keyboard story is the popover tier (survey §6.2, Dorico's Shift+letter):
// a small prompt whose text parses into an existing setup INTENT. Parsing
// lives in edit/ — it is input-layer logic, DOM-free and unit-testable; the
// popover chrome in ui/ only hosts the input box.
import type {
  MnxLayoutContent,
  MnxFermata,
  MnxNoteValueBase,
  MnxPitch,
  MnxScore,
  MnxTuningEntry
} from '../model/mnx.ts';
import type {
  MeasureAttribute,
  MeasureAttributeKind,
  PartDeclaration,
  PartDeclarationKind,
  PositionedAttribute
} from './ops.ts';

/** "4/4", "6/8", "12/8" → an MNX time signature. Unit must be a power of two
 *  the notation can express. */
export function parseTimeSignature(
  text: string
): { count: number; unit: number; display?: 'common' | 'cut' } | 'inherit' | null {
  let token = text.trim().toLowerCase();
  // The inherited-attribute removal token (campaign item 5), now on its third
  // family: clef, key, and the meter itself.
  if (token === INHERIT_TOKEN || token === '-') return 'inherit';
  // The GLYPH, not the meter (campaign item 4): common time is 4/4 drawn as
  // 𝄴, so the bare word implies the meter every player means by it, and the
  // qualified form spells the meter out.
  if (token === 'common') return { count: 4, unit: 4, display: 'common' };
  if (token === 'cut') return { count: 2, unit: 2, display: 'cut' };
  let display: 'common' | 'cut' | undefined;
  const glyph = /^(.*?)\s+(common|cut)$/.exec(token);
  if (glyph) {
    display = glyph[2] as 'common' | 'cut';
    token = glyph[1];
  }
  const match = /^\s*(\d{1,2})\s*\/\s*(\d{1,3})\s*$/.exec(token);
  if (!match) return null;
  const count = Number(match[1]);
  const unit = Number(match[2]);
  if (count < 1 || count > 32) return null;
  if (![1, 2, 4, 8, 16, 32, 64].includes(unit)) return null;
  return { count, unit, ...(display ? { display } : {}) };
}

/** Named tunings, recited the way players do (low string first). */
const TUNING_PRESETS: Record<string, string> = {
  standard: 'E2 A2 D3 G3 B3 E4',
  'drop-d': 'D2 A2 D3 G3 B3 E4',
  dadgad: 'D2 A2 D3 G3 A3 D4',
  'open-g': 'D2 G2 D3 G3 B3 D4',
  'open-d': 'D2 A2 D3 F#3 A3 D4',
  // Other standard-geometry fretted instruments — the string set IS the
  // instrument as far as derivation is concerned.
  bass: 'E1 A1 D2 G2',
  ukulele: 'G4 C4 E4 A4',
  mandolin: 'G3 D4 A4 E5'
};

export const TUNING_PRESET_NAMES = Object.keys(TUNING_PRESETS);

const PITCH_TOKEN = /^([A-Ga-g])([#b]?)(\d)$/;

function parsePitchToken(token: string): MnxPitch | null {
  const match = PITCH_TOKEN.exec(token);
  if (!match) return null;
  const pitch: MnxPitch = {
    step: match[1].toUpperCase() as MnxPitch['step'],
    octave: Number(match[3])
  };
  if (match[2] === '#') pitch.alter = 1;
  if (match[2] === 'b') pitch.alter = -1;
  return pitch;
}

/** Part genesis grammar (the Shift+P popover): a display name, with the id
 *  derived as its slug ("Lead Guitar" → lead-guitar). Empty input is an
 *  ANONYMOUS part — legal MNX, and what the minimal scenarios carry. */
/** The part popover's second job (campaign item 13): change the part you are
 *  in, not just create one. `capo 3` / `staves 2` set; `no name` / `no strings`
 *  / `no capo` / `no tab` / `no staves` strip — item 7's token, third family. */
export type PartDeclarationResult =
  | { set: PartDeclaration }
  | { remove: PartDeclarationKind }
  | { support: { key: 'useAccidentalDisplay' | 'useBeams'; value: boolean } }
  | null;

const PART_REMOVAL_WORDS: Record<string, PartDeclarationKind> = {
  name: 'name',
  strings: 'strings',
  tuning: 'strings',
  capo: 'capo',
  tab: 'staffKind',
  staves: 'staves'
};

export function parsePartDeclaration(text: string): PartDeclarationResult {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  const words = trimmed.split(' ');
  const head = (words[0] ?? '').toLowerCase();
  // Document-level support declarations ride the part popover, as the layout
  // and score removals do: the user's question is "what about this document?"
  // and which object holds the answer is our problem. `explicit accidentals`
  // is what `mnx.support.useAccidentalDisplay` means — print what each note
  // asks for, infer nothing.
  const support = /^(no\s+)?explicit\s+(accidentals|beams)$/.exec(trimmed.toLowerCase());
  if (support)
    return {
      support: {
        key: support[2] === 'beams' ? 'useBeams' : 'useAccidentalDisplay',
        value: !support[1]
      }
    };
  if (head === 'no') {
    const target = (words[1] ?? '').toLowerCase();
    // `no layout 2` / `no score 1` / `no mmrest 1` moved to the layout
    // popover (Shift+S) with core-layout-authoring.md, which owns the whole
    // presentation layer — construct and destruct in one grammar.
    const kind = PART_REMOVAL_WORDS[target];
    return kind ? { remove: kind } : null;
  }
  if (head === 'capo' || head === 'staves') {
    const value = Number(words[1]);
    if (!Number.isInteger(value)) return null;
    if (head === 'capo' && (value < 0 || value > 12)) return null;
    if (head === 'staves' && (value < 1 || value > 4)) return null;
    return { set: { kind: head, value } };
  }
  return null;
}

export function parsePart(text: string): { partId?: string; name?: string } {
  const name = text.trim();
  if (name === '') return {};
  const partId = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return partId ? { partId, name } : { name };
}

/**
 * A preset name ("standard", "drop-d", "dadgad", "open-g") or a pitch list
 * recited LOW string first ("D2 A2 D3 G3 A3 D4" — the order players say
 * tunings in), any string count 3–12. Returns entries numbered per
 * `_x.mnxLab`: string 1 = highest-pitched (the last token).
 */
export function parseTuning(text: string): MnxTuningEntry[] | null {
  const trimmed = text.trim().toLowerCase();
  if (trimmed === '' ) return null;
  const preset = TUNING_PRESETS[trimmed];
  const source = preset ?? text;
  const tokens = source.trim().split(/[\s,]+/).filter(Boolean);
  if (tokens.length < 3 || tokens.length > 12) return null;
  const pitches = tokens.map(parsePitchToken);
  if (pitches.some(p => p === null)) return null;
  // Low string first in the text → highest string number first; string 1 is
  // the last (highest-pitched) token.
  return pitches.map((pitch, index) => ({
    string: tokens.length - index,
    pitch: pitch!
  }));
}

// ---------------------------------------------------------------------------
// The inherited-attribute pair (campaign item 5,
// roadmap/complete/core-element-ops-clef-key.md). Both grammars accept
// `inherit` (shorthand `-`), which names what removal DOES — revert to the
// predecessor's governance — rather than what it deletes. One token, one
// meaning, reusable by every later inherited-attribute item.

/** The removal token shared by every inherited-attribute popover. */
export const INHERIT_TOKEN = 'inherit';

export interface ClefChoice {
  sign: string;
  staffPosition: number;
  octave?: number;
}

/** The clefs an engraver actually writes, by the names they say out loud.
 *  Staff positions are half-spaces from the middle line, positive up. */
const CLEF_NAMES: Record<string, ClefChoice> = {
  treble: { sign: 'G', staffPosition: -2 },
  bass: { sign: 'F', staffPosition: 2 },
  alto: { sign: 'C', staffPosition: 0 },
  tenor: { sign: 'C', staffPosition: 2 },
  // The guitar clef — what a tab-bearing part already renders by default.
  treble8vb: { sign: 'G', staffPosition: -2, octave: -1 },
  treble8va: { sign: 'G', staffPosition: -2, octave: 1 },
  bass8vb: { sign: 'F', staffPosition: 2, octave: -1 }
};

export const CLEF_NAME_LIST = Object.keys(CLEF_NAMES);

/** "treble" | "bass8vb" | "inherit" → a clef choice, or the removal token. */
export function parseClef(text: string): ClefChoice | 'inherit' | null {
  const token = text.trim().toLowerCase().replace(/[\s_]+/g, '');
  if (token === '') return null;
  if (token === INHERIT_TOKEN || token === '-') return 'inherit';
  return CLEF_NAMES[token] ?? null;
}

/** Major keys by name, in fifths — the circle as players recite it. */
const KEY_NAMES: Record<string, number> = {
  c: 0, g: 1, d: 2, a: 3, e: 4, b: 5, 'f#': 6, 'c#': 7,
  f: -1, bb: -2, eb: -3, ab: -4, db: -5, gb: -6, cb: -7
};

/** "C" | "Bb" | "-3" | "+2" | "inherit" → fifths, or the removal token. */
export function parseKeySignature(text: string): { fifths: number } | 'inherit' | null {
  const token = text.trim().toLowerCase().replace(/\s+/g, '');
  if (token === '') return null;
  if (token === INHERIT_TOKEN) return 'inherit';
  // `-` alone is the removal shorthand; `-3` is three flats. Order matters.
  if (token === '-') return 'inherit';
  if (/^[+-]?\d$/.test(token)) {
    const fifths = Number(token);
    return fifths >= -7 && fifths <= 7 ? { fifths } : null;
  }
  const named = KEY_NAMES[token];
  return named === undefined ? null : { fifths: named };
}

// ---------------------------------------------------------------------------
// The bar-attribute family (campaign item 7,
// roadmap/complete/core-element-ops-bar-attributes.md). One popover, ten
// kinds: the first word names the attribute, the rest is its value. Removal is
// `no <attribute>` — where item 5's inherited attributes say `inherit`
// ("revert to the predecessor"), an annotation says it is simply not there.
// The token names the removal CLASS, so the grammar teaches the taxonomy.

export const BARLINE_TYPES = [
  'regular', 'dotted', 'dashed', 'heavy', 'double', 'final',
  'heavyLight', 'heavyHeavy', 'tick', 'short', 'noBarline'
] as const;

/** `start`, `end`, or `N/D` — a mark's place in its bar. */
function parseMarkAt(token: string): 'start' | 'end' | [number, number] {
  if (token === 'start' || token === 'end') return token;
  const [n, d] = token.split('/').map(Number);
  return [n!, d!];
}

/** The segno's SMuFL variants, by the word a player would type. */
const SEGNO_GLYPHS: Record<string, string> = {
  segno: 'segno',
  serpent: 'segnoSerpent1',
  serpent1: 'segnoSerpent1',
  serpent2: 'segnoSerpent2',
  japanese: 'segnoJapanese'
};
function segnoGlyph(word: string): string | null {
  const key = word.toLowerCase().replace(/\s+/g, '');
  if (SEGNO_GLYPHS[key]) return SEGNO_GLYPHS[key]!;
  // A SMuFL name spelt out (`segnoSerpent2`) is taken as it stands.
  return /^segno[A-Za-z0-9]*$/.test(word) ? word : null;
}

const TEMPO_UNITS: Record<string, MnxNoteValueBase> = {
  whole: 'whole', half: 'half', quarter: 'quarter', eighth: 'eighth', '16th': '16th'
};

export const BAR_ATTRIBUTE_HELP =
  'barline double · repeat start · repeat end 3 · ending 1,2 · ending 3 for 1 open · ' +
  'segno · fine · fermata · fermata square long below · ' +
  'jump dsalfine · jump segno at start · fine at end · tempo 120 · rehearsal A · section Verse 1 · full-measure rest · ' +
  'measure repeat 2 · measure repeat counter 3 · no <attribute>';

export type BarAttributeResult =
  | { set: MeasureAttribute }
  | { remove: MeasureAttributeKind }
  // Part-measure rhythm declarations (campaign item 11) ride the same popover:
  // it is a SURFACE, not a data-owner, and the user's question is "what about
  // this bar?" — which object holds the answer is our problem, not theirs.
  | {
      rhythm: 'fullMeasureRest' | 'measureRepeat';
      remove?: boolean;
      number?: number;
      visualDuration?: { base: MnxNoteValueBase };
      counter?: { count: number; orient?: 'above' | 'below' };
    }
  | null;

/** The word a user types → the attribute kind it names. */
const ATTRIBUTE_WORDS: Record<string, MeasureAttributeKind> = {
  barline: 'barline',
  ending: 'ending',
  volta: 'ending',
  segno: 'segno',
  fine: 'fine',
  fermata: 'fermata',
  jump: 'jump',
  tempo: 'tempo',
  rehearsal: 'rehearsal',
  section: 'section'
};

export function parseBarAttribute(text: string): BarAttributeResult {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed === '') return null;
  const words = trimmed.split(' ');
  const head = words[0].toLowerCase();

  // Removal: `no repeat` / `no section` / `no barline`.
  if (head === 'no') {
    const target = (words[1] ?? '').toLowerCase();
    const rest = words.slice(1).join(' ').toLowerCase();
    if (rest === 'full-measure rest' || rest === 'full measure rest')
      return { rhythm: 'fullMeasureRest', remove: true };
    if (rest === 'measure repeat') return { rhythm: 'measureRepeat', remove: true };
    if (target === 'repeat') return { remove: 'repeatEnd' };
    const kind = ATTRIBUTE_WORDS[target];
    return kind ? { remove: kind } : null;
  }

  // `full-measure rest` — the bar declares its own silence.
  if (head === 'full-measure' || (head === 'full' && words[1]?.toLowerCase() === 'measure')) {
    const rest = trimmed.toLowerCase().replace(/^full[- ]measure\s*/, '');
    // `full-measure rest` / `full-measure rest whole` — the second form says
    // how it is DRAWN, which differs from the meter in 3/4 and 6/8.
    const drawn = /^rest\s+(\S+)$/.exec(rest);
    if (drawn) {
      const value = NOTE_VALUES[drawn[1]];
      return value ? { rhythm: 'fullMeasureRest', visualDuration: { base: value } } : null;
    }
    return rest === 'rest' ? { rhythm: 'fullMeasureRest' } : null;
  }

  // `measure repeat` / `measure repeat 2` — repeat the previous N bars, with
  // an optional printed COUNTER (`measure repeat counter 3`): how many times
  // this bar has come round, which MNX authors rather than derives.
  if (head === 'measure' && (words[1] ?? '').toLowerCase() === 'repeat') {
    const rest = words.slice(2);
    let counter: { count: number; orient?: 'above' | 'below' } | undefined;
    const at = rest.findIndex(word => word.toLowerCase() === 'counter');
    if (at >= 0) {
      const value = Number(rest[at + 1]);
      if (!Number.isInteger(value) || value < 1) return null;
      const orient = (rest[at + 2] ?? '').toLowerCase();
      if (orient !== '' && orient !== 'above' && orient !== 'below') return null;
      counter = { count: value, orient: orient === 'below' ? 'below' : 'above' };
      rest.splice(at);
    }
    const count = rest[0] !== undefined ? Number(rest[0]) : 1;
    if (!Number.isInteger(count) || count < 1 || count > 4) return null;
    return { rhythm: 'measureRepeat', number: count, ...(counter ? { counter } : {}) };
  }

  // `fermata` / `fermata square long below` — over the bar's closing barline.
  if (head === 'fermata') {
    const fermata = parseFermataWords(words.slice(1));
    return fermata ? { set: { kind: 'fermata', ...fermata } } : null;
  }

  // `repeat start` / `repeat end` / `repeat end 3` — one word, two kinds.
  if (head === 'repeat') {
    const which = (words[1] ?? '').toLowerCase();
    if (which === 'start') return { set: { kind: 'repeatStart' } };
    if (which !== 'end') return null;
    const times = words[2] !== undefined ? Number(words[2]) : undefined;
    if (times !== undefined && (!Number.isInteger(times) || times < 2)) return null;
    return { set: { kind: 'repeatEnd', ...(times !== undefined ? { times } : {}) } };
  }

  const kind = ATTRIBUTE_WORDS[head];
  if (!kind) return null;
  const rest = words.slice(1).join(' ');

  switch (kind) {
    case 'barline': {
      const type = BARLINE_TYPES.find(t => t.toLowerCase() === rest.toLowerCase());
      return type ? { set: { kind: 'barline', type } } : null;
    }
    case 'ending': {
      // "1", "1,2", "1 open", "1 for 2" — the numbers, an optional open flag,
      // and how many bars the volta lasts (item 7 recorded the missing
      // duration; the trace queue is what finally needed it).
      const open = /\bopen\b/i.test(rest);
      const span = /\bfor\s+(\d+)\b/i.exec(rest);
      const duration = span ? Number(span[1]) : undefined;
      if (duration !== undefined && (!Number.isInteger(duration) || duration < 1)) return null;
      const numbers = rest
        .replace(/\bopen\b/i, '')
        .replace(/\bfor\s+\d+\b/i, '')
        .split(/[,\s]+/)
        .filter(Boolean)
        .map(Number);
      if (numbers.some(n => !Number.isInteger(n) || n < 1)) return null;
      return {
        set: {
          kind: 'ending',
          ...(numbers.length > 0 ? { numbers } : {}),
          ...(duration !== undefined ? { duration } : {}),
          ...(open ? { open: true } : {})
        }
      };
    }
    // The navigation marks may say WHERE in the bar they sit — `fine at end`,
    // `jump dsalfine at end` — because for these three the position is part of
    // the meaning rather than a nicety (see `measureAttributeValue`).
    case 'segno':
    case 'fine': {
      // `segno`, `segno serpent`, `segno at end`, `segno at 1/2`,
      // `segno serpent at 3/4` — the variant glyph and any place in the bar,
      // both long rendered, writable since item 6.
      const at = /\s*\bat\s+(start|end|\d+\/\d+)$/.exec(rest.toLowerCase());
      const body = (at ? rest.slice(0, at.index) : rest).trim();
      const where = at ? { at: parseMarkAt(at[1]!) } : {};
      if (kind === 'fine') return body === '' ? { set: { kind, ...where } } : null;
      const glyph = body === '' ? null : segnoGlyph(body);
      if (body !== '' && !glyph) return null;
      return { set: { kind, ...where, ...(glyph ? { glyph } : {}) } };
    }
    case 'jump': {
      const at = /\s+at\s+(start|end|\d+\/\d+)$/.exec(rest.toLowerCase());
      const body = (at ? rest.slice(0, at.index) : rest).toLowerCase().replace(/[.\s]/g, '');
      const where = at ? { at: parseMarkAt(at[1]!) } : {};
      if (body === 'segno' || body === 'ds') return { set: { kind: 'jump', type: 'segno', ...where } };
      if (body === 'dsalfine') return { set: { kind: 'jump', type: 'dsalfine', ...where } };
      return null;
    }
    case 'tempo': {
      // "120" (quarter implied), "half=80", "quarter.=60" (dots on the unit).
      const match = /^(?:([a-z0-9]+)(\.*)\s*=\s*)?(\d{1,3})$/i.exec(rest);
      if (!match) return null;
      const base = match[1] ? TEMPO_UNITS[match[1].toLowerCase()] : 'quarter';
      const dots = match[2]?.length ?? 0;
      const bpm = Number(match[3]);
      if (!base || bpm < 20 || bpm > 400) return null;
      return { set: { kind: 'tempo', bpm, base, ...(dots ? { dots } : {}) } };
    }
    case 'rehearsal':
    case 'section':
      return rest === '' ? null : { set: { kind, label: rest } };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Event adornments (campaign item 8,
// roadmap/complete/core-element-ops-adornments.md). One popover, three kinds
// with two owners: a bare marking word, a bare dynamic word, or `text …`.
// Removal keeps item 7's `no <thing>` token — these are annotations too.

export const MARKING_WORDS = [
  'accent', 'breath', 'softAccent', 'spiccato', 'staccatissimo', 'staccato',
  'stress', 'strongAccent', 'tenuto'
] as const;

export const DYNAMIC_WORDS = [
  'pppppp', 'ppppp', 'pppp', 'ppp', 'pp', 'p', 'mp', 'mf',
  'f', 'ff', 'fff', 'ffff', 'fffff', 'ffffff', 'n'
] as const;

export const ADORNMENT_HELP =
  'accent · staccato · tenuto · strongAccent · … · a dynamic (pp, mf, fff) · ' +
  'text Play 8x · text below cantabile · 8va 2 · bend release · finger 3 · right p · cresc · dim · louder · softer · breath comma · bow up · ' +
  'fermata · fermata square long below · accidental · accidental parens · ' +
  'no accent · no fermata · no dynamic · no text · no string · no accidental';

export type AdornmentResult =
  | { marking: string; remove?: boolean; attributes?: Record<string, string> }
  /** The event's fermata (`fermata`, `fermata angled short below`); `no
   *  fermata` removes it. Not a marking: MNX gives it its own key. */
  | { fermata: MnxFermata }
  | { removeFermata: true }
  /** Tab technique with a SHAPE. The single letters (B H S V X O) toggle the
   *  plain form; a bend that is released, or bent by something other than a
   *  tone, needs words — so the popover carries them, as it does for the
   *  other adornments whose shape exceeds a keystroke. */
  | { technique: { kind: 'bend'; semitones?: number; release?: boolean; pre?: number } }
  | { fingering: { hand: 'left' | 'right'; finger: string } }
  | { removeFingering: true }
  // The accidental's DISPLAY is note-level ink like the markings, so it lives
  // in their popover rather than earning a sixth one (campaign item 6). The
  // SPELLING is a key (`J`) — a different question with a different answer.
  | { accidental: { show: boolean; parenthesized?: boolean } | 'remove' }
  | { removeStringAnnotation: true }
  | { positioned: PositionedAttribute }
  | { removePositioned: PositionedAttribute['kind'] }
  | null;

/** `marcato` is what players say; MNX calls it `strongAccent`. */
const MARKING_ALIASES: Record<string, string> = { marcato: 'strongAccent' };

export function parseAdornment(text: string): AdornmentResult {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed === '') return null;
  const words = trimmed.split(' ');
  const head = words[0].toLowerCase();

  if (head === 'accidental') {
    const qualifier = (words[1] ?? '').toLowerCase();
    if (qualifier === '' || qualifier === 'show') return { accidental: { show: true } };
    if (qualifier === 'parens' || qualifier === 'parenthesized' || qualifier === 'cautionary')
      return { accidental: { show: true, parenthesized: true } };
    if (qualifier === 'hidden' || qualifier === 'hide') return { accidental: { show: false } };
    return null;
  }

  if (head === 'no') {
    const target = (words[1] ?? '').toLowerCase();
    if (target === 'accidental') return { accidental: 'remove' };
    if (target === 'fermata') return { removeFermata: true };
    if (target === 'dynamic') return { removePositioned: 'dynamic' };
    if (target === 'text' || target === 'direction') return { removePositioned: 'direction' };
    // The string choice is a note-level annotation like the markings, so it
    // strips here: `no string` hands the note back to the derivation ladder.
    if (target === 'string' || target === 'fret') return { removeStringAnnotation: true };
    const marking = resolveMarking(words[1] ?? '');
    return marking ? { marking, remove: true } : null;
  }

  if (head === 'fermata') {
    const fermata = parseFermataWords(words.slice(1));
    return fermata ? { fermata } : null;
  }

  if (head === 'symbol') {
    // `symbol keyboardPedalPed` / `symbol below keyboardPedalUp` — a direction
    // that is a SMuFL glyph rather than words (rendered since score-text;
    // writable since item 6).
    const side = (words[1] ?? '').toLowerCase();
    const oriented = side === 'above' || side === 'below' || side === 'between';
    const glyph = words[oriented ? 2 : 1];
    if (!glyph || words.length > (oriented ? 3 : 2)) return null;
    return {
      positioned: {
        kind: 'direction',
        text: '',
        glyphs: [glyph],
        ...(oriented ? { orient: side as 'above' | 'below' | 'between' } : {})
      }
    };
  }

  if (head === 'text') {
    // `text above R.H.` / `text below cantabile` — the side is a leading word,
    // and a direction that really begins "above" is spelled `text above above`.
    const side = (words[1] ?? '').toLowerCase();
    const oriented = side === 'above' || side === 'below' || side === 'between';
    const body = words.slice(oriented ? 2 : 1).join(' ');
    return body === ''
      ? null
      : {
          positioned: {
            kind: 'direction',
            text: body,
            ...(oriented ? { orient: side as 'above' | 'below' | 'between' } : {})
          }
        };
  }

  // Fingering had an op and an intent and no way in either — the same hole the
  // ottava had, found the same way (campaign item 3's queue). `1`–`4`/`0` and
  // `p i m a` are what players write, so the words are the notation itself:
  // `finger 3`, `left 3`, `right p`.
  const finger = /^(?:(left|right)\s+|finger\s+)([0-4pimac])$/.exec(trimmed.toLowerCase());
  if (finger) {
    const digit = finger[2];
    const hand = finger[1] ?? (/^[pimac]$/.test(digit) ? 'right' : 'left');
    return { fingering: { hand: hand as 'left' | 'right', finger: digit } };
  }
  if (trimmed.toLowerCase() === 'no finger' || trimmed.toLowerCase() === 'no fingering')
    return { removeFingering: true };

  // `bend`, `bend 3`, `bend release` — the shapes the `B` key cannot say.
  // `bend pre 1 2 release`: the inspector's dotted form flattened — a
  // pre-bend of 1, up to 2, let back down (workbench-rung-inspector.md).
  const bendCurve = /^bend(?:\s+pre\s+(\d+(?:\.\d+)?))?(?:\s+(\d+(?:\.\d+)?))?(?:\s+(release))?$/.exec(
    trimmed.toLowerCase()
  );
  if (bendCurve && (bendCurve[1] !== undefined || (bendCurve[2] !== undefined && bendCurve[3] !== undefined))) {
    return {
      technique: {
        kind: 'bend',
        ...(bendCurve[2] !== undefined ? { semitones: Number(bendCurve[2]) } : {}),
        ...(bendCurve[3] ? { release: true } : {}),
        ...(bendCurve[1] !== undefined ? { pre: Number(bendCurve[1]) } : {})
      }
    };
  }
  const bend = /^bend(?:\s+(release|\d+))?$/.exec(trimmed.toLowerCase());
  if (bend) {
    const qualifier = bend[1];
    if (qualifier === 'release') return { technique: { kind: 'bend', release: true } };
    return {
      technique: { kind: 'bend', ...(qualifier ? { semitones: Number(qualifier) } : {}) }
    };
  }

  // The octave lines had an op and an intent and NO WAY IN — the keyboard join
  // could not see it, because `setPositioned` reaches the popover through its
  // dynamic and direction siblings. `8va`, `8vb`, `15ma`… and an optional bar
  // span (`8va 2` runs to the end of the next bar).
  const ottava = /^(8va|8vb|15ma|15mb|22ma|22mb)(?:\s+(\d+))?$/.exec(trimmed.toLowerCase());
  if (ottava) {
    const value = ({ '8va': 1, '15ma': 2, '22ma': 3, '8vb': -1, '15mb': -2, '22mb': -3 } as const)[
      ottava[1] as '8va'
    ];
    const bars = ottava[2] ? Number(ottava[2]) : undefined;
    if (bars !== undefined && (!Number.isInteger(bars) || bars < 1)) return null;
    return { positioned: { kind: 'ottava', value, ...(bars ? { bars } : {}) } };
  }

  const dynamic = DYNAMIC_WORDS.find(d => d === trimmed);
  if (dynamic) return { positioned: { kind: 'dynamic', value: dynamic } };

  // A dynamic is not always a letter at a point (campaign item 8's verb, the
  // rest of its vocabulary): a hairpin is a GRADUAL one and `louder`/`softer`
  // are RELATIVE ones. Same object, same verb.
  const lower = trimmed.toLowerCase();
  if (lower === 'cresc' || lower === 'crescendo')
    return { positioned: { kind: 'dynamic', dynamicType: 'gradual', wedgeType: 'increasing' } };
  if (lower === 'dim' || lower === 'decresc' || lower === 'diminuendo')
    return { positioned: { kind: 'dynamic', dynamicType: 'gradual', wedgeType: 'decreasing' } };
  if (lower === 'louder' || lower === 'softer')
    return {
      positioned: { kind: 'dynamic', dynamicType: 'relative', relativeValue: lower }
    };

  // The two markings that are not bare flags: a breath names its symbol and a
  // bow its direction, and an empty object would be a different mark.
  const breath = /^breath(?:\s+(comma|tick|upbow|salzedo))?$/.exec(lower);
  if (breath)
    return { marking: 'breath', ...(breath[1] ? { attributes: { symbol: breath[1] } } : {}) };
  const bow = /^bow\s+(up|down)$/.exec(lower);
  if (bow) return { marking: 'bowDirection', attributes: { direction: bow[1] } };

  const marking = resolveMarking(trimmed);
  return marking ? { marking } : null;
}

function resolveMarking(word: string): string | null {
  const lower = word.toLowerCase();
  const aliased = MARKING_ALIASES[lower] ?? word;
  return MARKING_WORDS.find(m => m.toLowerCase() === aliased.toLowerCase()) ?? null;
}

// ---------------------------------------------------------------------------
// Lyrics (campaign item 12, roadmap/complete/core-element-ops-lyrics.md).
// Text entry is a MODE in most editors; here it is the same typed popover the
// rest of the campaign uses, because a syllable is one short string attached to
// one note — and the popover already knows how to be a text field.

export const LYRIC_HELP =
  'sleep- · -ing · 2: Am · line 2 Nederlands nl · no lyric · no line 2';

export type LyricResult =
  | { syllable: string; line: string; syllableType?: 'start' | 'middle' | 'end' | 'whole' }
  | { removeSyllable: string }
  | { line: string; label?: string; lang?: string }
  | { removeLine: string }
  | null;

export function parseLyric(text: string): LyricResult {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed === '') return null;
  const words = trimmed.split(' ');
  const head = words[0].toLowerCase();

  if (head === 'no') {
    const target = (words[1] ?? '').toLowerCase();
    if (target === 'line') return words[2] ? { removeLine: words[2] } : null;
    if (target === 'lyric') return { removeSyllable: words[2] ?? '1' };
    return null;
  }

  // `line 2 Nederlands nl` — declare a verse's label and language.
  if (head === 'line') {
    const line = words[1];
    if (!line) return null;
    const rest = words.slice(2);
    // A trailing 2-3 letter token is a language code, else it is all label.
    const lang = rest.length > 1 && /^[a-z]{2,3}$/.test(rest[rest.length - 1])
      ? rest.pop()
      : undefined;
    return {
      line,
      ...(rest.length > 0 ? { label: rest.join(' ') } : {}),
      ...(lang ? { lang } : {})
    };
  }

  // `2: Am` — an explicit verse number, else verse 1.
  const numbered = /^(\d+):\s*(.+)$/.exec(trimmed);
  const line = numbered ? numbered[1] : '1';
  const raw = numbered ? numbered[2] : trimmed;

  // Hyphens carry the syllable's role, the way a singer writes it:
  // `sleep-` starts a word, `-ing` ends one, `-ly-` continues.
  const leading = raw.startsWith('-');
  const trailing = raw.endsWith('-');
  const body = raw.replace(/^-/, '').replace(/-$/, '');
  if (body === '') return null;
  const syllableType = trailing && leading ? 'middle' : trailing ? 'start' : leading ? 'end' : undefined;
  return { syllable: body, line, ...(syllableType ? { syllableType } : {}) };
}

// ── Rhythm declarations (campaign item 11b) ────────────────────────────────
//
// One popover for the four items that are content but not events: the three
// containers (tuplet, grace, tremolo) and authored silence (`space`). The
// typed text carries the whole address — see `wrapExtent`: a container knows
// its own extent, so there is no press-navigate-press anchor here.

export const RHYTHM_HELP =
  '3:2 · 3 eighth in 2 eighth · 3 eighth in 1 quarter, no number · ' +
  'grace · grace 2 · appoggiatura · acciaccatura · tremolo 2 · tremolo 3 in 2 half · ' +
  'space 1/4 · rest half.';

/** The note values a wrap may name, spelled as the schema spells them. */
const NOTE_VALUES: Record<string, MnxNoteValueBase> = {
  whole: 'whole',
  half: 'half',
  quarter: 'quarter',
  eighth: 'eighth',
  '16th': '16th',
  '32nd': '32nd',
  '64th': '64th',
  '128th': '128th'
};

export const NOTE_VALUE_NAMES = Object.keys(NOTE_VALUES);

/** A wrap whose note values may still be blank — the parser cannot see the
 *  document, and an unqualified `3:2` means "at whatever value the cursor is
 *  sitting on". `completeContainerSpec` (ops.ts) fills them from the event. */
export type PartialContainerSpec =
  | {
      type: 'tuplet';
      inner: { multiple: number; duration?: { base: MnxNoteValueBase } };
      outer: { multiple: number; duration?: { base: MnxNoteValueBase } };
      bracket?: 'yes' | 'no' | 'auto';
      showNumber?: 'noNumber' | 'inner' | 'both';
    }
  | { type: 'grace'; graceType?: 'makeTime' | 'stealFollowing' | 'stealPrevious'; slash?: boolean }
  | {
      type: 'tremolo';
      marks?: number;
      /** The PERFORMED value, when the written notes cannot imply it: the two
       *  events each carry the tremolo's whole span, so a wrap normally reads
       *  it off them — `tremolo 3 in 2 half` says it outright. */
      outer?: { multiple: number; duration: { base: MnxNoteValueBase } };
    };

export type RhythmResult =
  | { space: [number, number] }
  | { rest: { base: MnxNoteValueBase; dots?: number } }
  | { wrap: PartialContainerSpec; count?: number }
  | null;

/** "3:2", "3 eighth in 1 quarter, no number", "grace 2", "appoggiatura",
 *  "tremolo 2", "space 1/4". */
export function parseRhythm(text: string): RhythmResult {
  let token = text.trim().toLowerCase();
  if (token === '') return null;

  // Rest SPELLING (campaign item 11b): entry pads with beat rests because the
  // cursor's positions are the rest events; an author who wants the engraver's
  // one half rest says so here, after the fact.
  const rest = /^rest\s+(\S+?)(\.*)$/.exec(token);
  if (rest) {
    const value = NOTE_VALUES[rest[1]];
    // Trailing dots read as they are written: `rest half.` is a dotted half
    // rest. Dotted rests have no key of their own because a rest is absence —
    // the spelling verb is their only route (campaign items 11b and 4).
    return value ? { rest: { base: value, ...(rest[2] ? { dots: rest[2].length } : {}) } } : null;
  }

  const space = /^space\s+(\d+)\s*\/\s*(\d+)$/.exec(token);
  if (space) {
    const [num, den] = [Number(space[1]), Number(space[2])];
    return num > 0 && den > 0 ? { space: [num, den] } : null;
  }

  // Display modifiers are suffixes on the tuplet forms, comma-separated so the
  // ratio stays readable: "3 eighth in 1 quarter, no number".
  let showNumber: 'noNumber' | undefined;
  let bracket: 'yes' | 'no' | undefined;
  const parts = token.split(',').map(part => part.trim());
  token = parts[0];
  for (const modifier of parts.slice(1)) {
    if (modifier === 'no number' || modifier === 'nonumber') showNumber = 'noNumber';
    else if (modifier === 'bracket') bracket = 'yes';
    else if (modifier === 'no bracket') bracket = 'no';
    else return null;
  }
  const display = {
    ...(bracket ? { bracket } : {}),
    ...(showNumber ? { showNumber } : {})
  };

  // The two grace idioms players actually name. An acciaccatura is the crushed,
  // slashed one; an appoggiatura leans on the note it steals from — which is
  // exactly `stealFollowing` without a slash (`lab/rhythm/appoggiatura`).
  if (token === 'acciaccatura') return { wrap: { type: 'grace', slash: true } };
  if (token === 'appoggiatura')
    return { wrap: { type: 'grace', graceType: 'stealFollowing', slash: false } };

  const grace = /^grace(?:\s+(\d+))?(?:\s+(make-time|steal-following|steal-previous))?$/.exec(token);
  if (grace) {
    const graceType =
      grace[2] === 'make-time'
        ? ('makeTime' as const)
        : grace[2] === 'steal-following'
          ? ('stealFollowing' as const)
          : grace[2] === 'steal-previous'
            ? ('stealPrevious' as const)
            : undefined;
    return {
      wrap: { type: 'grace', ...(graceType ? { graceType } : {}) },
      ...(grace[1] ? { count: Number(grace[1]) } : {})
    };
  }

  // `tremolo 2` · `tremolo 3 in 2 half` — the second form spells the performed
  // value, in the same `<multiple> <value>` shape the tuplet form uses.
  const tremolo = /^tremolo(?:\s+(\d+))?(?:\s+in\s+(\d+)\s+(\S+))?$/.exec(token);
  if (tremolo) {
    const outerValue = tremolo[3] ? NOTE_VALUES[tremolo[3]] : undefined;
    if (tremolo[3] && !outerValue) return null;
    return {
      wrap: {
        type: 'tremolo',
        ...(tremolo[1] ? { marks: Number(tremolo[1]) } : {}),
        ...(outerValue
          ? { outer: { multiple: Number(tremolo[2]), duration: { base: outerValue } } }
          : {})
      }
    };
  }

  // "3 eighth in 2 eighth" — the full form, where the corpus needs an outer
  // value the short ratio cannot express (1 quarter, not 2 eighths).
  const full = /^(\d+)\s+(\S+)\s+in\s+(\d+)\s+(\S+)$/.exec(token);
  if (full) {
    const inner = NOTE_VALUES[full[2]];
    const outer = NOTE_VALUES[full[4]];
    if (!inner || !outer) return null;
    return {
      wrap: {
        type: 'tuplet',
        inner: { multiple: Number(full[1]), duration: { base: inner } },
        outer: { multiple: Number(full[3]), duration: { base: outer } },
        ...display
      }
    };
  }

  // "3:2" — both values default to the one under the cursor.
  const ratio = /^(\d+)\s*:\s*(\d+)$/.exec(token);
  if (ratio) {
    const [innerCount, outerCount] = [Number(ratio[1]), Number(ratio[2])];
    if (innerCount < 1 || outerCount < 1) return null;
    return {
      wrap: {
        type: 'tuplet',
        inner: { multiple: innerCount },
        outer: { multiple: outerCount },
        ...display
      }
    };
  }
  return null;
}

// ── The layout popover (Shift+S) — core-layout-authoring.md ────────────────
//
// The document's presentation layer is a TREE, not a place in the music, so
// it gets no rung and no cursor: each sentence names a 1-based slot and
// supplies the WHOLE value, which is exactly how the removal sentences
// (`no layout 2`) have always addressed it. Set-or-append, so one verb both
// creates and replaces.
//
//   layout <id>: <content>          layout Choral4Staff: bracket [ soprano, alto ]
//   score "<name>": <body>          score "Part A": layout PartAAlone
//   mmrest m3 x2 [in 2]             (1-based score, default 1)
//
// content := node ("," node)*
// node    := group | staff
// group   := (bracket|brace|group) [unified|individual|instrument|mensurstrich]
//            ["label"] "[" content "]"
// staff   := [("label" | @name | @shortName) ":"] source+
// source  := partId [.staffNumber] [~voiceName] [/up|/down] [@name|@shortName]

export interface LayoutSentence {
  layout: { index: number; id: string; content: MnxLayoutContent[] };
}
export interface ScoreSentence {
  score: { index: number; value: MnxScore };
}
export interface MultimeasureRestSentence {
  multimeasureRest: { scoreIndex: number; start: string; duration: number };
}
export type LayoutGrammarResult =
  | LayoutSentence
  | ScoreSentence
  | MultimeasureRestSentence
  | { removeDocument: 'layout' | 'score' | 'multimeasureRest'; index: number }
  | null;

const LABELREFS = new Set(['name', 'shortName']);
const SYMBOLS: Record<string, MnxLayoutContent['symbol']> = {
  bracket: 'bracket',
  brace: 'brace',
  group: 'noSymbol'
};
const BARLINE_STYLES = new Set(['individual', 'instrument', 'unified', 'mensurstrich']);

/** A tiny hand-rolled scanner: the tree is the first popover sentence that
 *  nests, so a regex cannot do it. Quoted strings survive as single tokens. */
function tokenizeLayout(text: string): string[] | null {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '[' || ch === ']' || ch === ',' || ch === ':') { out.push(ch); i++; continue; }
    if (ch === '"' || ch === '“' || ch === '”') {
      const close = /["“”]/.exec(text.slice(i + 1));
      if (!close) return null;
      out.push(`"${text.slice(i + 1, i + 1 + close.index)}`);
      i += close.index + 2;
      continue;
    }
    const word = /^[^\s[\],:"“”]+/.exec(text.slice(i));
    if (!word) return null;
    out.push(word[0]);
    i += word[0].length;
  }
  return out;
}

const isQuoted = (token: string): boolean => token.startsWith('"');
const unquote = (token: string): string => token.slice(1);

/** `fl1.2~Main/up@shortName` — every part optional but the id. */
function parseSource(token: string): NonNullable<MnxLayoutContent['sources']>[number] | null {
  const match = /^([^.~/@]+)(?:\.(\d+))?(?:~([^/@]+))?(?:\/(up|down))?(?:@(\w+))?$/.exec(token);
  if (!match) return null;
  const [, part, staff, voice, stem, labelref] = match;
  if (!part) return null;
  if (labelref !== undefined && !LABELREFS.has(labelref)) return null;
  return {
    part,
    ...(staff ? { staff: Number(staff) } : {}),
    ...(voice ? { voice } : {}),
    ...(stem ? { stem: stem as 'up' | 'down' } : {}),
    ...(labelref ? { labelref } : {})
  };
}

class LayoutTreeParser {
  private at = 0;
  constructor(private readonly tokens: string[]) {}

  private peek(): string | undefined { return this.tokens[this.at]; }
  private take(): string | undefined { return this.tokens[this.at++]; }

  /** A comma-separated sibling list; stops at `]` or the end. */
  content(): MnxLayoutContent[] | null {
    const nodes: MnxLayoutContent[] = [];
    for (;;) {
      const node = this.node();
      if (!node) return null;
      nodes.push(node);
      if (this.peek() === ',') { this.at++; continue; }
      return nodes;
    }
  }

  private node(): MnxLayoutContent | null {
    const head = this.peek();
    if (head === undefined) return null;
    if (head in SYMBOLS) return this.group();
    return this.staff();
  }

  private group(): MnxLayoutContent | null {
    const symbol = SYMBOLS[this.take()!];
    const node: MnxLayoutContent = { type: 'group' };
    // Declared order is symbol → barline style → label → children, but the
    // JSON key order is fixed by the writer, not by what was typed.
    if (symbol !== 'noSymbol') node.symbol = symbol;
    const style = this.peek();
    if (style !== undefined && BARLINE_STYLES.has(style)) {
      node.barlineStyle = this.take() as MnxLayoutContent['barlineStyle'];
    }
    const label = this.peek();
    if (label !== undefined && isQuoted(label)) node.label = unquote(this.take()!);
    if (this.take() !== '[') return null;
    const content = this.content();
    if (!content || this.take() !== ']') return null;
    node.content = content;
    return node;
  }

  private staff(): MnxLayoutContent | null {
    const node: MnxLayoutContent = { type: 'staff' };
    // A leading `"SA":` or `@name:` labels the staff; without the colon the
    // same token would be ambiguous with a part id.
    const head = this.peek();
    if (head !== undefined && this.tokens[this.at + 1] === ':') {
      if (isQuoted(head)) node.label = unquote(head);
      else if (head.startsWith('@') && LABELREFS.has(head.slice(1))) node.labelref = head.slice(1);
      else return null;
      this.at += 2;
    }
    const sources: NonNullable<MnxLayoutContent['sources']> = [];
    for (;;) {
      const token = this.peek();
      if (token === undefined || token === ',' || token === ']' || token === '[') break;
      if (isQuoted(token)) return null;
      const source = parseSource(token);
      if (!source) return null;
      sources.push(source);
      this.at++;
    }
    if (sources.length === 0) return null;
    node.sources = sources;
    return node;
  }

  done(): boolean { return this.at === this.tokens.length; }
}

function parseLayoutBody(text: string): MnxLayoutContent[] | null {
  const tokens = tokenizeLayout(text);
  if (!tokens || tokens.length === 0) return null;
  const parser = new LayoutTreeParser(tokens);
  const content = parser.content();
  return content && parser.done() ? content : null;
}

/** `m1 layout1, m4 layout2` — a comma per SYSTEM, `>` for a layout change
 *  inside one. A bare `layout <id>` instead sets the score's own default. */
function parseScoreBody(text: string): MnxScore | null {
  const body = text.trim();
  if (body === '') return {};
  const asDefault = /^layout\s+(\S+)$/.exec(body);
  if (asDefault) return { layout: asDefault[1] };
  const systems: NonNullable<NonNullable<MnxScore['pages']>[number]['systems']> = [];
  for (const chunk of body.split(',')) {
    const [head, ...changes] = chunk.split('>');
    const words = head.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 2) return null;
    const system: (typeof systems)[number] = { measure: words[0] };
    if (words[1]) system.layout = words[1];
    for (const change of changes) {
      const parts = change.trim().split(/\s+/).filter(Boolean);
      if (parts.length !== 2) return null;
      (system.layoutChanges ??= []).push({
        layout: parts[1],
        location: { measure: parts[0], position: { fraction: [0, 1] } }
      });
    }
    systems.push(system);
  }
  return { pages: [{ systems }] };
}

/** The Shift+S grammar. Returns null for anything it cannot read, so the
 *  popover can show its own help rather than guessing. */
export function parseLayoutSentence(text: string): LayoutGrammarResult {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const words = trimmed.split(/\s+/);
  const head = words[0].toLowerCase();

  if (head === 'no') {
    const target = (words[1] ?? '').toLowerCase();
    const nth = Number(words[2] ?? '1');
    if (!Number.isInteger(nth) || nth < 1) return null;
    if (target === 'layout') return { removeDocument: 'layout', index: nth - 1 };
    if (target === 'score') return { removeDocument: 'score', index: nth - 1 };
    if (target === 'mmrest' || target === 'multimeasure-rest')
      return { removeDocument: 'multimeasureRest', index: nth - 1 };
    return null;
  }

  if (head === 'mmrest') {
    // `mmrest m3 x2 in 2` — the count carries an `x` so a bare number can
    // never be mistaken for the score it lands in.
    const match = /^mmrest\s+(\S+)\s+x(\d+)(?:\s+in\s+(\d+))?$/i.exec(trimmed);
    if (!match) return null;
    const duration = Number(match[2]);
    const scoreIndex = match[3] ? Number(match[3]) - 1 : 0;
    if (duration < 1 || scoreIndex < 0) return null;
    return { multimeasureRest: { scoreIndex, start: match[1], duration } };
  }

  const colon = trimmed.indexOf(':');
  if (colon < 0) return null;
  const headWords = trimmed.slice(0, colon).trim().split(/\s+/);
  const body = trimmed.slice(colon + 1);
  const kind = headWords[0].toLowerCase();

  if (kind === 'layout') {
    // `layout <id>:` names it; `layout 2 <id>:` replaces the 2nd slot. An id
    // that already exists replaces in place, so the id is the primary key and
    // the index only says where a NEW one goes.
    if (headWords.length < 2 || headWords.length > 3) return null;
    const id = headWords[headWords.length - 1];
    const index = headWords.length === 3 ? Number(headWords[1]) - 1 : Number.NaN;
    if (headWords.length === 3 && (!Number.isInteger(index) || index < 0)) return null;
    const content = parseLayoutBody(body);
    if (!content) return null;
    return { layout: { index, id, content } };
  }

  if (kind === 'score') {
    if (headWords.length < 2) return null;
    const nameToken = headWords.slice(1).join(' ');
    const explicit = /^(\d+)\s+(.*)$/.exec(nameToken);
    const index = explicit ? Number(explicit[1]) - 1 : Number.NaN;
    const rawName = explicit ? explicit[2] : nameToken;
    const name = rawName.replace(/^["“]|["”]$/g, '').trim();
    if (name === '') return null;
    const value = parseScoreBody(body);
    if (!value) return null;
    return { score: { index, value: { name, ...value } } };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Fermata words (core-measure-attributes-gaps.md, item 8). The same words
// serve the event and the bar: `fermata`, then any of a SYMBOL (the sign),
// a DURATION (the performance hint) and a SIDE, in any order — each enum is
// disjoint from the others, so the words need no labels.

export const FERMATA_SYMBOLS = [
  'normal', 'angled', 'square', 'doubleAngled', 'doubleSquare', 'doubleDot', 'halfCurve', 'curlew'
] as const;
export const FERMATA_DURATIONS = ['auto', 'none', 'veryLong', 'long', 'normal', 'short', 'veryShort'] as const;

/** The words after `fermata` → the object, or null for a word none of the
 *  enums own. `normal` is a symbol AND a duration; it means the symbol. */
export function parseFermataWords(words: readonly string[]): MnxFermata | null {
  const fermata: MnxFermata = {};
  for (const raw of words) {
    const lower = raw.toLowerCase();
    const symbol = FERMATA_SYMBOLS.find(s => s.toLowerCase() === lower);
    const duration = FERMATA_DURATIONS.find(d => d.toLowerCase() === lower);
    if (lower === 'above' || lower === 'below') fermata.orient = lower;
    else if (symbol && fermata.symbol === undefined) fermata.symbol = symbol;
    else if (duration && fermata.duration === undefined) fermata.duration = duration;
    else return null;
  }
  return fermata;
}

/** The typed form back: the value half after the word `fermata`. */
export function fermataText(fermata: MnxFermata): string {
  return [
    fermata.symbol,
    fermata.duration,
    fermata.orient === 'below' ? 'below' : fermata.orient === 'above' ? 'above' : undefined
  ].filter((w): w is string => w !== undefined).join(' ');
}
