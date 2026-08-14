// The setup popovers' typed grammar — roadmap/complete/core-editor-input-layer.md.
//
// Setup (tuning, time signature) is low-frequency, so it gets no single keys;
// its keyboard story is the popover tier (survey §6.2, Dorico's Shift+letter):
// a small prompt whose text parses into an existing setup INTENT. Parsing
// lives in edit/ — it is input-layer logic, DOM-free and unit-testable; the
// popover chrome in ui/ only hosts the input box.
import type { MnxNoteValueBase, MnxPitch, MnxTuningEntry } from '../model/mnx.ts';
import type { MeasureAttribute, MeasureAttributeKind } from './ops.ts';

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
  'jump dsalfine · tempo 120 · rehearsal A · section Verse 1 · no <attribute>';

export type BarAttributeResult =
  | { set: MeasureAttribute }
  | { remove: MeasureAttributeKind }
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
    if (target === 'repeat') return { remove: 'repeatEnd' };
    const kind = ATTRIBUTE_WORDS[target];
    return kind ? { remove: kind } : null;
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
