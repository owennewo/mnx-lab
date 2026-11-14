// Shift+O enters an artificial (harp) harmonic (roadmap/inprogress/core-artificial-harmonics.md).
// MNX pitch is what sounds, so the toggle is not a flag alone: on, the note
// sounds an octave above the fret held, keeps that fret, and names the octave
// node as its touching pitch; off — or retyped to natural — it sounds the fret
// held again. O and Shift+O share the slide's grammar: the same kind removes,
// the other retypes in place.
import { describe, it, expect } from 'vitest';
import { EditorSession } from '../../src/edit/session.ts';
import { TAB_DIGIT_LAYER, resolveIntent } from '../../src/edit/keymap.ts';
import { fingerboardOf } from '../../src/edit/inspector.ts';
import type { MnxStructure, MnxTabTechnique, MnxPitch } from '../../src/model/mnx.ts';
import { STANDARD_GUITAR_STRINGS } from '../../src/model/mnx.ts';

/** One 4/4 bar: a whole note on the G string at the 7th fret (D4). */
function heldAtSeven(): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }] },
    parts: [{
      id: 'p1',
      _x: { mnxLab: { strings: [...STANDARD_GUITAR_STRINGS] } },
      measures: [{
        sequences: [{
          content: [{
            duration: { base: 'whole' },
            notes: [{ id: 'a', pitch: { step: 'D', octave: 4 }, _x: { mnxLab: { string: 3 } } }]
          }]
        }]
      }]
    }]
  } as unknown as MnxStructure;
}

type Note = { pitch: MnxPitch; _x?: { mnxLab?: { string?: number; fret?: number; tab?: { technique?: MnxTabTechnique } } } };
const noteOf = (session: EditorSession): Note =>
  (session.doc.parts![0].measures![0].sequences![0].content[0] as unknown as { notes: Note[] }).notes[0];

const ARTIFICIAL = { type: 'toggleTechnique', kind: 'harmonic', harmonicType: 'artificial' } as const;
const NATURAL = { type: 'toggleTechnique', kind: 'harmonic' } as const;

describe('the artificial harmonic — Shift+O', () => {
  it('sounds an octave above the fret held, keeps the fret, and names the node', () => {
    const session = new EditorSession(heldAtSeven());
    expect(session.handleIntent(ARTIFICIAL)).toBe(true);
    const note = noteOf(session);
    expect(note.pitch).toEqual({ step: 'D', octave: 5 });
    expect(note._x!.mnxLab!.fret).toBe(7);
    expect(note._x!.mnxLab!.tab!.technique).toEqual({ harmonic: { type: 'artificial', touchingPitch: { step: 'D', octave: 5 } } });
    // The inspector's fret is the one held, not the one that sounds.
    expect(fingerboardOf(session.doc, 'a')?.fret).toBe(7);
  });

  it('toggles off back to the note it was', () => {
    const session = new EditorSession(heldAtSeven());
    session.handleIntent(ARTIFICIAL);
    expect(session.handleIntent(ARTIFICIAL)).toBe(true);
    const note = noteOf(session);
    expect(note.pitch).toEqual({ step: 'D', octave: 4 });
    expect(note._x!.mnxLab!.tab).toBeUndefined();
  });

  it('retypes natural ↔ artificial in place, moving the pitch with it', () => {
    const session = new EditorSession(heldAtSeven());
    session.handleIntent(NATURAL);
    expect(noteOf(session).pitch).toEqual({ step: 'D', octave: 4 });
    session.handleIntent(ARTIFICIAL);
    expect(noteOf(session).pitch).toEqual({ step: 'D', octave: 5 });
    expect(noteOf(session)._x!.mnxLab!.tab!.technique!.harmonic!.type).toBe('artificial');
    session.handleIntent(NATURAL);
    expect(noteOf(session).pitch).toEqual({ step: 'D', octave: 4 });
    expect(noteOf(session)._x!.mnxLab!.tab!.technique).toEqual({ harmonic: { type: 'natural' } });
  });

  it('is one undo', () => {
    const session = new EditorSession(heldAtSeven());
    session.handleIntent(ARTIFICIAL);
    expect(session.handleIntent({ type: 'undo' })).toBe(true);
    expect(noteOf(session)).toEqual(noteOf(new EditorSession(heldAtSeven())));
  });

  it('Shift+O resolves to it, and O stays natural', () => {
    expect(resolveIntent({ code: 'KeyO', shift: true }, [TAB_DIGIT_LAYER])).toEqual(ARTIFICIAL);
    expect(resolveIntent({ code: 'KeyO' }, [TAB_DIGIT_LAYER])).toEqual(NATURAL);
  });
});
