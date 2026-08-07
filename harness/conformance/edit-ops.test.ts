// Proves the edit/ placeholder wiring (structure-lab): EditOp → applyOp →
// history. This is the seam the editor UI and the AI loop are meant to
// converge on; these tests pin its contract (purity, undo/redo) so the
// placeholder cannot silently rot before the feature work starts.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { applyOp, EditHistory } from '../../src/edit/ops.ts';
import { syntheticNoteKey } from '../../src/model/noteKeys.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

const doc = (): MnxStructure =>
  JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        '../../scenarios/lab/00-document/01-minimal-single-note/score.mnx.json'
      ),
      'utf8'
    )
  );

const firstNote = (d: MnxStructure) =>
  (d.parts[0].measures![0].sequences![0].content[0] as { notes: { id?: string; pitch: any; _x?: any }[] })
    .notes[0];

describe('edit ops placeholder', () => {
  it('transposes without mutating the input document', () => {
    const original = doc();
    const before = JSON.stringify(original);
    const up = applyOp(original, { type: 'transposeSelection', semitones: 12 });
    expect(JSON.stringify(original)).toBe(before);
    expect(firstNote(up).pitch.octave).toBe(firstNote(original).pitch.octave + 1);
  });

  it('sets a tab position under _x.mnxLab, addressing an id-less note by its synthetic key', () => {
    const original = doc();
    // The minimal scenario's note has no id — ops accept the positional key
    // the layouts synthesize (src/model/noteKeys.ts), so spec mirrors are
    // editable too.
    const key = syntheticNoteKey(0, 0, 0, 0);
    const next = applyOp(original, { type: 'setFret', noteId: key, string: 2, fret: 5 });
    expect(firstNote(next)._x.mnxLab.tab.position).toEqual({ string: 2, fret: 5 });
  });

  it('appends a measure to global and every part in lock-step', () => {
    const original = doc();
    const next = applyOp(original, { type: 'appendMeasure' });
    expect(next.global.measures.length).toBe(original.global.measures.length + 1);
    for (const [i, part] of next.parts.entries()) {
      expect(part.measures!.length).toBe(original.parts[i].measures!.length + 1);
    }
  });

  it('history undoes and redoes through applyOp', () => {
    const history = new EditHistory(doc());
    const start = JSON.stringify(history.current);
    history.apply({ type: 'transposeSelection', semitones: 2 });
    const edited = JSON.stringify(history.current);
    expect(edited).not.toBe(start);
    expect(JSON.stringify(history.undo())).toBe(start);
    expect(JSON.stringify(history.redo())).toBe(edited);
  });

  it('history retains the op log — undo shrinks it, redo regrows it', () => {
    const history = new EditHistory(doc());
    history.apply({ type: 'transposeSelection', semitones: 2 });
    history.apply({ type: 'appendMeasure' });
    expect(history.appliedOps.map(op => op.type)).toEqual(['transposeSelection', 'appendMeasure']);
    history.undo();
    expect(history.appliedOps.map(op => op.type)).toEqual(['transposeSelection']);
    history.redo();
    expect(history.appliedOps.map(op => op.type)).toEqual(['transposeSelection', 'appendMeasure']);
  });
});
