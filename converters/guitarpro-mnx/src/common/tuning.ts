import { MnxPitch, MnxStep, MnxTuningEntry } from './types.js';

/**
 * STRING NUMBERING — the single easiest thing to get silently wrong.
 *
 *   MNX `_x.mnxLab.tab.position.string`: 1 = HIGHEST-pitched string (E4 on a guitar).
 *   alphaTab / Guitar Pro `note.string`: 1 = LOWEST-pitched string (E2).
 *
 * They run in opposite directions, so every crossing needs an inversion.
 * Verified empirically against alphaTab 1.8.4: with
 * `stringTuning.tunings = [64, 59, 55, 50, 45, 40]` (high→low), a note with
 * `string = 1, fret = 0` reports `realValue = 40` (E2).
 *
 * alphaTab's `tunings` ARRAY is ordered high→low (index 0 = highest string),
 * which matches MNX tuning entries sorted by ascending string number — so the
 * array order agrees even though the note numbering does not.
 */
export function mnxStringToAlphaTab(mnxString: number, stringCount: number): number {
  return stringCount + 1 - mnxString;
}

export function alphaTabStringToMnx(alphaTabString: number, stringCount: number): number {
  return stringCount + 1 - alphaTabString;
}

const STEP_SEMITONES: Record<MnxStep, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11
};
const STEP_NAMES: MnxStep[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/** MIDI note number for an MNX pitch (C4 = 60). */
export function pitchToMidi(pitch: MnxPitch): number {
  return (pitch.octave + 1) * 12 + STEP_SEMITONES[pitch.step] + (pitch.alter || 0);
}

/**
 * Spells a MIDI note number as an MNX pitch. Guitar Pro stores only string +
 * fret, so a spelling has to be chosen on import; `fifths` (the key signature)
 * decides between sharps and flats, which is the difference between a readable
 * score and one full of wrong-looking accidentals.
 */
export function midiToPitch(midi: number, fifths = 0): MnxPitch {
  const pitchClass = ((midi % 12) + 12) % 12;
  // Flat keys spell black notes as flats; sharp keys (and C) as sharps.
  const preferFlats = fifths < 0;
  const alters = preferFlats ? [0, -1, 1] : [0, 1, -1];

  for (const alter of alters) {
    const naturalPc = (((pitchClass - alter) % 12) + 12) % 12;
    const step = STEP_NAMES.find(s => STEP_SEMITONES[s] === naturalPc);
    if (step) {
      const octave = Math.floor((midi - STEP_SEMITONES[step] - alter) / 12) - 1;
      return alter !== 0 ? { step, octave, alter } : { step, octave };
    }
  }
  return { step: 'C', octave: Math.floor(midi / 12) - 1 };
}

/** Standard 6-string guitar, used when a document declares no tuning. */
export const STANDARD_GUITAR_MIDI = [64, 59, 55, 50, 45, 40]; // high → low

/**
 * MNX tuning entries → alphaTab's high→low MIDI array. Entries are sorted by
 * string number (1 = highest) so array order is derived, never assumed.
 */
export function mnxTuningToAlphaTab(tuning: MnxTuningEntry[] | undefined): number[] {
  if (!tuning || tuning.length === 0) return [...STANDARD_GUITAR_MIDI];
  return [...tuning]
    .sort((a, b) => a.string - b.string)
    .map(entry => pitchToMidi(entry.pitch));
}

/** alphaTab's high→low MIDI array → MNX tuning entries (string 1 = highest). */
export function alphaTabTuningToMnx(tunings: number[], fifths = 0): MnxTuningEntry[] {
  return tunings.map((midi, index) => ({
    string: index + 1,
    pitch: midiToPitch(midi, fifths)
  }));
}

/**
 * Sounding pitch of a fingerboard position, from an MNX tuning.
 * `mnxString` is 1 = highest.
 *
 * A capo raises every string, and `_x.mnxLab.tab` fret numbers are measured FROM the
 * capo (`docs/mnx-extensions.md`), so the full relation is
 * `sounding = openString + capo + fret`. Leaving the capo out silently detunes
 * a whole score — Sun-did-glide is capo 4, i.e. a major third.
 */
export function positionToMidi(
  tunings: number[],
  mnxString: number,
  fret: number,
  capo = 0
): number | null {
  const open = tunings[mnxString - 1];
  return open === undefined ? null : open + capo + fret;
}

/**
 * Chooses a playable string/fret for a pitch that carries no `_x.mnxLab.tab.position`.
 * Mirrors the app's "lowest reasonable position" heuristic
 * ([src/tab/guitarPositions.ts]): prefer the highest-numbered (lowest-pitched)
 * string that can reach the note within `maxFret`, which keeps the hand low on
 * the neck. Returns MNX string numbering (1 = highest).
 *
 * Frets are relative to the capo, and nothing below it is reachable.
 */
export function choosePosition(
  midi: number,
  tunings: number[],
  maxFret = 24,
  capo = 0
): { string: number; fret: number } | null {
  let best: { string: number; fret: number } | null = null;
  for (let index = tunings.length - 1; index >= 0; index--) {
    const fret = midi - tunings[index] - capo;
    if (fret >= 0 && fret <= maxFret) {
      const candidate = { string: index + 1, fret };
      if (!best || candidate.fret < best.fret) best = candidate;
    }
  }
  return best;
}
