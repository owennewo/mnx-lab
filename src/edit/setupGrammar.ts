// The setup popovers' typed grammar — roadmap/complete/core-editor-input-layer.md.
//
// Setup (tuning, time signature) is low-frequency, so it gets no single keys;
// its keyboard story is the popover tier (survey §6.2, Dorico's Shift+letter):
// a small prompt whose text parses into an existing setup INTENT. Parsing
// lives in edit/ — it is input-layer logic, DOM-free and unit-testable; the
// popover chrome in ui/ only hosts the input box.
import type { MnxNoteValueBase, MnxPitch, MnxTuningEntry } from '../model/mnx.ts';
import type {
  MeasureAttribute,
  MeasureAttributeKind,
  PartDeclaration,
  PartDeclarationKind,
  PositionedAttribute
} from './ops.ts';

/** "4/4", "6/8", "12/8" → an MNX time signature. Unit must be a power of two
 *  the notation can express. */
export function parseTimeSignature(text: string): { count: number; unit: number } | null {
  const match = /^\s*(\d{1,2})\s*\/\s*(\d{1,3})\s*$/.exec(text);
  if (!match) return null;
  const count = Number(match[1]);
  const unit = Number(match[2]);
  if (count < 1 || count > 32) return null;
  if (![1, 2, 4, 8, 16, 32, 64].includes(unit)) return null;
  return { count, unit };
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
  if (head === 'no') {
    const kind = PART_REMOVAL_WORDS[(words[1] ?? '').toLowerCase()];
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
// roadmap/inprogress/core-element-ops-clef-key.md). Both grammars accept
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
// roadmap/inprogress/core-element-ops-bar-attributes.md). One popover, ten
// kinds: the first word names the attribute, the rest is its value. Removal is
// `no <attribute>` — where item 5's inherited attributes say `inherit`
// ("revert to the predecessor"), an annotation says it is simply not there.
// The token names the removal CLASS, so the grammar teaches the taxonomy.

const BARLINE_TYPES = [
  'regular', 'dotted', 'dashed', 'heavy', 'double', 'final',
  'heavyLight', 'heavyHeavy', 'tick', 'short', 'noBarline'
] as const;

const TEMPO_UNITS: Record<string, MnxNoteValueBase> = {
  whole: 'whole', half: 'half', quarter: 'quarter', eighth: 'eighth', '16th': '16th'
};

export const BAR_ATTRIBUTE_HELP =
  'barline double · repeat start · repeat end 3 · ending 1,2 · segno · fine · ' +
  'jump dsalfine · tempo 120 · rehearsal A · section Verse 1 · full-measure rest · ' +
  'measure repeat 2 · no <attribute>';

export type BarAttributeResult =
  | { set: MeasureAttribute }
  | { remove: MeasureAttributeKind }
  // Part-measure rhythm declarations (campaign item 11) ride the same popover:
  // it is a SURFACE, not a data-owner, and the user's question is "what about
  // this bar?" — which object holds the answer is our problem, not theirs.
  | { rhythm: 'fullMeasureRest' | 'measureRepeat'; remove?: boolean; number?: number }
  | null;

/** The word a user types → the attribute kind it names. */
const ATTRIBUTE_WORDS: Record<string, MeasureAttributeKind> = {
  barline: 'barline',
  ending: 'ending',
  volta: 'ending',
  segno: 'segno',
  fine: 'fine',
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
    return rest === 'rest' ? { rhythm: 'fullMeasureRest' } : null;
  }

  // `measure repeat` / `measure repeat 2` — repeat the previous N bars.
  if (head === 'measure' && (words[1] ?? '').toLowerCase() === 'repeat') {
    const count = words[2] !== undefined ? Number(words[2]) : 1;
    if (!Number.isInteger(count) || count < 1 || count > 4) return null;
    return { rhythm: 'measureRepeat', number: count };
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
      // "1", "1,2", "1 open" — the numbers, then an optional open flag.
      const open = /\bopen\b/i.test(rest);
      const numbers = rest
        .replace(/\bopen\b/i, '')
        .split(/[,\s]+/)
        .filter(Boolean)
        .map(Number);
      if (numbers.some(n => !Number.isInteger(n) || n < 1)) return null;
      return {
        set: {
          kind: 'ending',
          ...(numbers.length > 0 ? { numbers } : {}),
          ...(open ? { open: true } : {})
        }
      };
    }
    case 'segno':
    case 'fine':
      return rest === '' ? { set: { kind } } : null;
    case 'jump': {
      const type = rest.toLowerCase().replace(/[.\s]/g, '');
      if (type === 'segno' || type === 'ds') return { set: { kind: 'jump', type: 'segno' } };
      if (type === 'dsalfine') return { set: { kind: 'jump', type: 'dsalfine' } };
      return null;
    }
    case 'tempo': {
      // "120" (quarter implied) or "half=80".
      const match = /^(?:([a-z0-9]+)\s*=\s*)?(\d{1,3})$/i.exec(rest);
      if (!match) return null;
      const base = match[1] ? TEMPO_UNITS[match[1].toLowerCase()] : 'quarter';
      const bpm = Number(match[2]);
      if (!base || bpm < 20 || bpm > 400) return null;
      return { set: { kind: 'tempo', bpm, base } };
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
// roadmap/inprogress/core-element-ops-adornments.md). One popover, three kinds
// with two owners: a bare marking word, a bare dynamic word, or `text …`.
// Removal keeps item 7's `no <thing>` token — these are annotations too.

const MARKING_WORDS = [
  'accent', 'breath', 'softAccent', 'spiccato', 'staccatissimo', 'staccato',
  'stress', 'strongAccent', 'tenuto'
] as const;

const DYNAMIC_WORDS = [
  'pppppp', 'ppppp', 'pppp', 'ppp', 'pp', 'p', 'mp', 'mf',
  'f', 'ff', 'fff', 'ffff', 'fffff', 'ffffff', 'n'
] as const;

export const ADORNMENT_HELP =
  'accent · staccato · tenuto · strongAccent · … · a dynamic (pp, mf, fff) · ' +
  'text Play 8x · no accent · no dynamic · no text';

export type AdornmentResult =
  | { marking: string; remove?: boolean }
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

  if (head === 'no') {
    const target = (words[1] ?? '').toLowerCase();
    if (target === 'dynamic') return { removePositioned: 'dynamic' };
    if (target === 'text' || target === 'direction') return { removePositioned: 'direction' };
    const marking = resolveMarking(words[1] ?? '');
    return marking ? { marking, remove: true } : null;
  }

  if (head === 'text') {
    const body = words.slice(1).join(' ');
    return body === '' ? null : { positioned: { kind: 'direction', text: body } };
  }

  const dynamic = DYNAMIC_WORDS.find(d => d === trimmed);
  if (dynamic) return { positioned: { kind: 'dynamic', value: dynamic } };

  const marking = resolveMarking(trimmed);
  return marking ? { marking } : null;
}

function resolveMarking(word: string): string | null {
  const lower = word.toLowerCase();
  const aliased = MARKING_ALIASES[lower] ?? word;
  return MARKING_WORDS.find(m => m.toLowerCase() === aliased.toLowerCase()) ?? null;
}

// ---------------------------------------------------------------------------
// Lyrics (campaign item 12, roadmap/inprogress/core-element-ops-lyrics.md).
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
