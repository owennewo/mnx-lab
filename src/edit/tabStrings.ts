// Pitch↔string helpers for the edit layer.
//
// String numbering follows `_x.mnxLab`: string 1 = highest-pitched, drawn
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
  const strings = part?._x?.mnxLab?.strings;
  return strings && strings.length > 0 ? strings : STANDARD_TUNING;
}

/** A part is a tab part when it declares any fingerboard setup or a tab view. */
export function isTabPart(part: MnxPart | undefined): boolean {
  const x = part?._x?.mnxLab;
  return !!(x?.strings || x?.capo !== undefined || x?.tab);
}

export function capoOf(part: MnxPart | undefined): number {
  return part?._x?.mnxLab?.capo ?? 0;
}

const MAX_FRET = 24;

/** The string the note most plausibly sits on: the one giving the lowest
 *  non-negative fret against the effective open (capo applied), ties to the
 *  lower string number — the renderer's own rule, so the cursor's line and the
 *  drawn digit agree. A pitch below every open string lands on the lowest
 *  string (the renderer draws nothing there, but the cursor needs a line). */
export function defaultStringFor(pitch: MnxPitch, tuning: MnxTuningEntry[], capo = 0): number {
  const midi = midiOfPitch(pitch);
  const entries = [...tuning].sort((a, b) => a.string - b.string);
  let best: { string: number; fret: number } | null = null;
  let lowest = entries[0];
  for (const entry of entries) {
    if (midiOfPitch(entry.pitch) < midiOfPitch(lowest.pitch)) lowest = entry;
    const fret = midi - (midiOfPitch(entry.pitch) + capo);
    if (fret < 0 || fret > MAX_FRET) continue;
    if (!best || fret < best.fret) {
      best = { string: entry.string, fret };
    }
  }
  return best?.string ?? lowest.string;
}
