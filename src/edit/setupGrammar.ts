// The setup popovers' typed grammar — roadmap/complete/core-editor-input-layer.md.
//
// Setup (tuning, time signature) is low-frequency, so it gets no single keys;
// its keyboard story is the popover tier (survey §6.2, Dorico's Shift+letter):
// a small prompt whose text parses into an existing setup INTENT. Parsing
// lives in edit/ — it is input-layer logic, DOM-free and unit-testable; the
// popover chrome in ui/ only hosts the input box.
import type { MnxPitch, MnxTuningEntry } from '../model/mnx.ts';

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
