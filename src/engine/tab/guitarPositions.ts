import { MnxNote } from '../../model/mnx.ts';

/**
 * Standard guitar tuning, open string MIDI notes.
 * Index 0 = string 1 (high E, MIDI 64); index 5 = string 6 (low E, MIDI 40).
 */
export const GUITAR_TUNING = [64, 59, 55, 50, 45, 40];

function getMidiNote(step: string, octave: number, alter: number = 0): number {
  const stepOffsets: Record<string, number> = {
    c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11
  };
  const base = stepOffsets[step.toLowerCase()] ?? 0;
  return (octave + 1) * 12 + base + alter;
}

/**
 * Map a chord of MNX notes to fret/string positions.
 * Uses `_x.mnxLab.tab.position` when annotated; otherwise picks the lowest
 * playable fret per pitch, avoiding string collisions within the chord.
 */
export function resolveEventPositions(notes: MnxNote[]): { str: number; fret: number }[] {
  const allAnnotated = notes.every(n => n._x?.mnxLab?.tab?.position !== undefined);
  if (allAnnotated) {
    return notes.map(n => ({
      str: n._x!.mnxLab!.tab!.position!.string,
      fret: n._x!.mnxLab!.tab!.position!.fret
    }));
  }

  const resolved: { str: number; fret: number }[] = [];
  const usedStrings = new Set<number>();

  const notesWithMidi = notes.map((note, index) => {
    const step = note.pitch.step;
    const octave = note.pitch.octave;
    const alter = note.pitch.alter || 0;
    const midi = getMidiNote(step, octave, alter);
    return { note, midi, index };
  });

  notesWithMidi.sort((a, b) => b.midi - a.midi);

  for (const item of notesWithMidi) {
    const pos = item.note._x?.mnxLab?.tab?.position;
    if (pos) {
      resolved.push({ str: pos.string, fret: pos.fret });
      usedStrings.add(pos.string);
    }
  }

  for (const item of notesWithMidi) {
    if (item.note._x?.mnxLab?.tab?.position) {
      continue;
    }

    const midi = item.midi;
    const candidates: { string: number; fret: number }[] = [];
    for (let s = 1; s <= 6; s++) {
      if (usedStrings.has(s)) continue;
      const openMidi = GUITAR_TUNING[s - 1];
      const fret = midi - openMidi;
      if (fret >= 0 && fret <= 24) {
        candidates.push({ string: s, fret });
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => a.fret - b.fret);
      const chosen = candidates[0];
      resolved.push({ str: chosen.string, fret: chosen.fret });
      usedStrings.add(chosen.string);
    } else {
      let chosenStr = 1;
      for (let s = 1; s <= 6; s++) {
        if (!usedStrings.has(s)) {
          chosenStr = s;
          break;
        }
      }
      const alterSuffix = item.note.pitch.alter
        ? (item.note.pitch.alter === 1 ? '#' : 'b')
        : '';
      console.warn(
        `Pitch ${item.note.pitch.step}${alterSuffix}${item.note.pitch.octave} (MIDI ${midi}) outside guitar range or collision. Clamping.`
      );
      const openMidi = GUITAR_TUNING[chosenStr - 1];
      const fret = Math.max(0, Math.min(24, midi - openMidi));
      resolved.push({ str: chosenStr, fret });
      usedStrings.add(chosenStr);
    }
  }

  return resolved;
}
