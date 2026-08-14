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
