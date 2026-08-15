// The notation cursor's SPACE — roadmap/inprogress/core-selection-ladder.md.
//
// Note-level navigation is spatial in both projections: tab's space is the
// fingerboard (string × beat), notation's is the staff (staff position ×
// beat). This module owns the staff half: staff positions in MNX units
// (half-staff-spaces from the middle line, positive up — the same unit
// `rest.staffPosition` uses), their mapping to pitches under a clef, and the
// key-signature default alteration an entered position receives.
import type { MnxPitch, MnxStructure } from '../model/mnx.ts';

export interface ClefSpec {
  sign: string;
  /** The staff position the clef sits on (MNX `positioned-clef`). */
  staffPosition: number;
  /** Octave displacement (treble-8 guitar clef = -1). */
  octave: number;
}

/** Conventional seat per sign, used when a clef omits `staffPosition`. */
const DEFAULT_SEAT: Record<string, number> = { G: -2, F: 2, C: 0 };

export const DEFAULT_CLEF: ClefSpec = { sign: 'G', staffPosition: -2, octave: 0 };

/** The clef governing a part's staff-1 at a measure: the last one declared at
 *  or before it (mid-measure clef changes are ignored — the cursor's grain is
 *  the measure for now). */
export function clefAt(
  doc: MnxStructure,
  measureIndex: number,
  partIndex = 0,
  staffIndex = 1
): ClefSpec {
  let current = DEFAULT_CLEF;
  const measures = doc.parts?.[partIndex]?.measures ?? [];
  for (let i = 0; i <= measureIndex && i < measures.length; i++) {
    for (const positioned of measures[i].clefs ?? []) {
      if ((positioned.staff ?? 1) !== staffIndex) continue;
      const clef = positioned.clef;
      current = {
        sign: clef.sign,
        staffPosition: clef.staffPosition ?? DEFAULT_SEAT[clef.sign] ?? 0,
        octave: clef.octave ?? 0
      };
    }
  }
  return current;
}

const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
type Step = (typeof STEPS)[number];

/** Diatonic index: C-1 = -7 … C4 = 28, one per letter name. */
function diatonic(step: Step, octave: number): number {
  return octave * 7 + STEPS.indexOf(step);
}

/** The pitch each sign pins to the staff position it sits on. */
const CLEF_REFERENCE: Record<string, { step: Step; octave: number }> = {
  G: { step: 'G', octave: 4 },
  F: { step: 'F', octave: 3 },
  C: { step: 'C', octave: 4 }
};

function referenceDiatonic(clef: ClefSpec): number {
  const ref = CLEF_REFERENCE[clef.sign] ?? CLEF_REFERENCE.G;
  return diatonic(ref.step, ref.octave) + clef.octave * 7;
}

/** The key signature governing a measure (fifths; persists until changed). */
export function keyFifthsAt(doc: MnxStructure, measureIndex: number): number {
  let fifths = 0;
  const measures = doc.global?.measures ?? [];
  for (let i = 0; i <= measureIndex && i < measures.length; i++) {
    const key = measures[i].key;
    if (key) fifths = key.fifths;
  }
  return fifths;
}

const SHARP_ORDER = 'FCGDAEB';
const FLAT_ORDER = 'BEADGCF';

/** The alteration the key signature gives a letter (the entry DEFAULT — an
 *  explicit accidental is a later editing act, Alt+↑↓). */
export function keyAlter(step: Step, fifths: number): number {
  if (fifths > 0 && SHARP_ORDER.slice(0, Math.min(fifths, 7)).includes(step)) return 1;
  if (fifths < 0 && FLAT_ORDER.slice(0, Math.min(-fifths, 7)).includes(step)) return -1;
  return 0;
}

/** The pitch a staff position names under a clef, spelled per the key. */
export function pitchAtStaffPosition(
  clef: ClefSpec,
  staffPosition: number,
  fifths = 0
): MnxPitch {
  const d = referenceDiatonic(clef) + (staffPosition - clef.staffPosition);
  const octave = Math.floor(d / 7);
  const step = STEPS[((d % 7) + 7) % 7];
  const alter = keyAlter(step, fifths);
  return alter !== 0 ? { step, octave, alter } : { step, octave };
}

/** The staff position a pitch sits on under a clef (alteration-blind: C and
 *  C# share a position — the position is the LETTER's seat). */
export function staffPositionOfPitch(clef: ClefSpec, pitch: MnxPitch): number {
  return clef.staffPosition + (diatonic(pitch.step as Step, pitch.octave) - referenceDiatonic(clef));
}

// ── Spelling (campaign item 6) ─────────────────────────────────────────────
//
// A MIDI number names a sound; a PITCH names how it is written, and MNX stores
// the writing. Everything that turns a sound back into notation needs a policy
// for the choice, and the placeholder ("prefer a natural, then a sharp") made
// E♭ unwritable: transposing E down a semitone produced D♯, in every key, in
// both directions.

const SEMITONE_OF: Record<Step, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** MIDI note number for a spelled pitch (C4 = 60). */
export function midiOfSpelling(step: Step, octave: number, alter = 0): number {
  return (octave + 1) * 12 + SEMITONE_OF[step] + alter;
}

/**
 * Every way this sound can be written with at most `maxAlter` accidentals,
 * nearest spelling first (plainest letter, then flat before sharp).
 *
 * This is the respell verb's cycle AND the policy's candidate set — one list,
 * so a spelling the policy would never choose is still reachable by asking.
 */
export function enharmonicSpellings(midi: number, maxAlter = 2): MnxPitch[] {
  const found: MnxPitch[] = [];
  for (const alter of [0, -1, 1, -2, 2].filter(a => Math.abs(a) <= maxAlter))
    for (const step of STEPS) {
      // The octave is whatever makes this letter sound at `midi` — B♯3 and C4
      // are the same key, and only the letter tells them apart.
      const octave = Math.round((midi - SEMITONE_OF[step] - alter) / 12) - 1;
      if (midiOfSpelling(step, octave, alter) !== midi) continue;
      found.push(alter === 0 ? { step, octave } : { step, octave, alter });
    }
  return found;
}

/**
 * How to write this sound here: the key signature decides, and where the key
 * is silent the DIRECTION of the move does.
 *
 * 1. A letter the key already alters this way is the plain answer — in E♭
 *    major, the black key below F is E♭, not D♯, because the key says E is
 *    flat and the reader is already carrying that.
 * 2. Otherwise follow the key's sign: flat keys spell flats, sharp keys sharps.
 * 3. In C (and where the sign does not settle it), spell the direction of the
 *    move — down is a flat, up is a sharp. This is the ordinary convention,
 *    and it is what makes Alt+↓ from E write E♭ instead of D♯.
 *
 * Double accidentals are never *chosen*, only asked for (`respell`).
 */
export function spellPitch(midi: number, fifths = 0, direction: 1 | -1 = 1): MnxPitch {
  const candidates = enharmonicSpellings(midi, 1);
  const natural = candidates.find(p => p.alter === undefined);
  if (natural && keyAlter(natural.step as Step, fifths) === 0) return natural;

  const keyed = candidates.find(p => (p.alter ?? 0) !== 0 && keyAlter(p.step as Step, fifths) === p.alter);
  if (keyed) return keyed;
  if (natural) return natural;

  const sign = fifths !== 0 ? Math.sign(fifths) : direction;
  return (
    candidates.find(p => Math.sign(p.alter ?? 0) === sign) ?? candidates[0] ?? { step: 'C', octave: 4 }
  );
}
