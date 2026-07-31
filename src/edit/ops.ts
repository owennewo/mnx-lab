// The edit seam — deliberately a placeholder (structure-lab). This is the
// point the editor UI and the AI loop are intended to CONVERGE on: today the
// assist loop replaces whole documents; the plan is for it to emit EditOp[]
// instead, and for editor chrome to funnel through applyOp, so undo/redo,
// validation and provenance all live in one place. Three ops prove the shape;
// grow the union as real editing features land.
import type { MnxStructure, MnxNote } from '../model/mnx.ts';

export type EditOp =
  | {
      /** Shift the selected notes (or every note) by a signed semitone count. */
      type: 'transposeSelection';
      semitones: number;
      noteIds?: string[];
    }
  | {
      /** Set the tab position of one note (string 1 = highest-pitched, like `_x.mnxLab.tab`). */
      type: 'setFret';
      noteId: string;
      string: number;
      fret: number;
    }
  | {
      /** Append an empty measure to every part and the global timeline. */
      type: 'appendMeasure';
    };

const NOTE_STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const STEP_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function midiOf(note: MnxNote): number {
  const { step, octave, alter = 0 } = note.pitch;
  return (octave + 1) * 12 + STEP_SEMITONES[step] + alter;
}

function setPitchFromMidi(note: MnxNote, midi: number): void {
  const octave = Math.floor(midi / 12) - 1;
  const pc = midi - (octave + 1) * 12;
  // Prefer a natural, then a sharp — good enough for a placeholder; real
  // spelling policy arrives with the editor feature work.
  for (const step of NOTE_STEPS) {
    if (STEP_SEMITONES[step] === pc) {
      note.pitch = { step, octave };
      return;
    }
  }
  for (const step of NOTE_STEPS) {
    if (STEP_SEMITONES[step] === pc - 1) {
      note.pitch = { step, octave, alter: 1 };
      return;
    }
  }
}

function forEachNote(doc: MnxStructure, fn: (note: MnxNote) => void): void {
  for (const part of doc.parts ?? []) {
    for (const measure of part.measures ?? []) {
      for (const seq of measure.sequences ?? []) {
        for (const item of seq.content ?? []) {
          for (const note of (item as { notes?: MnxNote[] }).notes ?? []) fn(note);
        }
      }
    }
  }
}

/** Pure: returns a new document with the op applied; never mutates `doc`. */
export function applyOp(doc: MnxStructure, op: EditOp): MnxStructure {
  const next = JSON.parse(JSON.stringify(doc)) as MnxStructure;
  switch (op.type) {
    case 'transposeSelection':
      forEachNote(next, note => {
        if (op.noteIds && op.noteIds.length > 0 && !op.noteIds.includes(note.id ?? '')) return;
        setPitchFromMidi(note, midiOf(note) + op.semitones);
      });
      return next;
    case 'setFret':
      forEachNote(next, note => {
        if (note.id !== op.noteId) return;
        const x = ((note._x ??= {}).mnxLab ??= {});
        x.tab = { ...x.tab, position: { string: op.string, fret: op.fret } };
      });
      return next;
    case 'appendMeasure': {
      next.global.measures.push({});
      for (const part of next.parts ?? []) {
        part.measures?.push({ sequences: [{ content: [] }] });
      }
      return next;
    }
  }
}

/** Minimal undo/redo over applyOp — the history contract the UI will consume. */
export class EditHistory {
  private past: MnxStructure[] = [];
  private future: MnxStructure[] = [];

  constructor(private present: MnxStructure) {}

  get current(): MnxStructure {
    return this.present;
  }

  apply(op: EditOp): MnxStructure {
    this.past.push(this.present);
    this.present = applyOp(this.present, op);
    this.future = [];
    return this.present;
  }

  undo(): MnxStructure {
    const prev = this.past.pop();
    if (prev) {
      this.future.push(this.present);
      this.present = prev;
    }
    return this.present;
  }

  redo(): MnxStructure {
    const next = this.future.pop();
    if (next) {
      this.past.push(this.present);
      this.present = next;
    }
    return this.present;
  }
}
