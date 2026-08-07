// Pitch↔string helpers for the edit layer.
//
// String numbering follows `_x.mnxLab.tab`: string 1 = highest-pitched, drawn
// as the TOP tab line (printed-tab convention — Guitar Pro, Soundslice). The
// physical guitarist's "top string" (the thickest) is string 6, the BOTTOM
// line. Converters own the Guitar Pro numbering inversion; nothing here does.
//
// `defaultStringFor` is a deliberately small echo of the engine's
// lowest-reasonable-position heuristic (src/engine/tab/guitarPositions.ts,
// which edit/ may not import): it exists so that typing a digit on an
// unannotated note keeps the digit on the line where the renderer was already
// drawing the note, instead of yanking it to string 1.
import type { MnxPart, MnxPitch, MnxTuningEntry } from '../model/mnx.ts';

const STEP_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function midiOfPitch(pitch: MnxPitch): number {
  return (pitch.octave + 1) * 12 + STEP_SEMITONES[pitch.step] + (pitch.alter ?? 0);
}

/** Standard guitar tuning (consumers assume it when a tab part omits one). */
export const STANDARD_TUNING: MnxTuningEntry[] = [
  { string: 1, pitch: { step: 'E', octave: 4 } },
  { string: 2, pitch: { step: 'B', octave: 3 } },
  { string: 3, pitch: { step: 'G', octave: 3 } },
  { string: 4, pitch: { step: 'D', octave: 3 } },
  { string: 5, pitch: { step: 'A', octave: 2 } },
  { string: 6, pitch: { step: 'E', octave: 2 } }
];

export function tuningOf(part: MnxPart | undefined): MnxTuningEntry[] {
  const tuning = part?._x?.mnxLab?.tab?.tuning;
  return tuning && tuning.length > 0 ? tuning : STANDARD_TUNING;
}

const MAX_FRET = 24;

/** The string the note most plausibly sits on: the one giving the lowest
 *  non-negative fret (ties → the lower-pitched string). A pitch below every
 *  open string lands on the lowest string; capo is ignored for now. */
export function defaultStringFor(pitch: MnxPitch, tuning: MnxTuningEntry[]): number {
  const midi = midiOfPitch(pitch);
  let best: { string: number; fret: number } | null = null;
  let lowest = tuning[0];
  for (const entry of tuning) {
    if (midiOfPitch(entry.pitch) < midiOfPitch(lowest.pitch)) lowest = entry;
    const fret = midi - midiOfPitch(entry.pitch);
    if (fret < 0 || fret > MAX_FRET) continue;
    if (!best || fret < best.fret || (fret === best.fret && entry.string > best.string)) {
      best = { string: entry.string, fret };
    }
  }
  return best?.string ?? lowest.string;
}
