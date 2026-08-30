// The technique keys' TARGET resolution — found hands-on 2026-08-30: `h` on
// an ascending pair (the canonical hammer-on) silently refused, while the
// meaningless equal-fret pair classified as a pull-off. Root cause: the
// technique ops resolved their destination through `tieTarget`, the TIE
// resolver, which only matches an equal pitch. A technique's destination is
// `techniqueTarget`: the next timed event's note — same string preferred,
// any pitch allowed — and an equal pitch now refuses the H/P classifier.
import { describe, it, expect } from 'vitest';
import { EditorSession } from '../../src/edit/session.ts';
import type { MnxStructure, MnxTabTechnique } from '../../src/model/mnx.ts';
import { STANDARD_GUITAR_STRINGS } from '../../src/model/mnx.ts';

/** One 4/4 bar of quarters on a declared guitar. Each item is a (string,
 *  fret) pair, annotated the way entry writes them; sounding pitch derived
 *  from standard tuning. */
function bar(items: { string: number; fret: number; id: string }[]): MnxStructure {
  const OPEN: Record<number, { step: string; octave: number; midi: number }> = {
    1: { step: 'E', octave: 4, midi: 64 }, 2: { step: 'B', octave: 3, midi: 59 },
    3: { step: 'G', octave: 3, midi: 55 }, 4: { step: 'D', octave: 3, midi: 50 },
    5: { step: 'A', octave: 2, midi: 45 }, 6: { step: 'E', octave: 2, midi: 40 }
  };
  const STEPS: [string, number][] = [
    ['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0],
    ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0]
  ];
  const pitchOf = (string: number, fret: number) => {
    const midi = OPEN[string].midi + fret;
    const [step, alter] = STEPS[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    return { step, octave, ...(alter ? { alter } : {}) };
  };
  return {
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }] },
    parts: [{
      id: 'p1',
      _x: { mnxLab: { strings: [...STANDARD_GUITAR_STRINGS] } },
      measures: [{
        sequences: [{
          content: items.map(item => ({
            duration: { base: 'quarter' as const },
            notes: [{
              id: item.id,
              pitch: pitchOf(item.string, item.fret),
              _x: { mnxLab: { string: item.string } }
            }]
          }))
        }]
      }]
    }]
  } as unknown as MnxStructure;
}

const techniqueOf = (session: EditorSession, id: string): MnxTabTechnique | undefined => {
  for (const measure of session.doc.parts![0].measures ?? []) {
    for (const sequence of measure.sequences ?? []) {
      for (const item of sequence.content) {
        const notes = (item as { notes?: { id?: string; _x?: { mnxLab?: { tab?: { technique?: MnxTabTechnique } } } }[] }).notes ?? [];
        const note = notes.find(candidate => candidate.id === id);
        if (note) return note._x?.mnxLab?.tab?.technique;
      }
    }
  }
  return undefined;
};

/** The same bar with NO string annotations: pitches only, on a declared
 *  guitar — the derivation ladder's territory. */
function bareBar(items: { string: number; fret: number; id: string }[]): MnxStructure {
  const doc = bar(items) as { parts: { measures?: { sequences?: { content: { notes?: { _x?: unknown }[] }[] }[] }[] }[] };
  for (const measure of doc.parts[0].measures ?? [])
    for (const sequence of measure.sequences ?? [])
      for (const event of sequence.content)
        for (const note of event.notes ?? []) delete note._x;
  return doc as unknown as MnxStructure;
}

describe('the hammer-pull key resolves ANY next pitch, same string first', () => {
  it('h on an ascending pair writes the hammerPull adornment — the case that used to refuse', () => {
    const session = new EditorSession(bar([
      { string: 1, fret: 0, id: 'a' }, { string: 1, fret: 3, id: 'b' }
    ]));
    expect(session.handleIntent({ type: 'toggleTechnique', kind: 'hammerPull' })).toBe(true);
    expect(techniqueOf(session, 'a')).toEqual({ hammerPull: { target: 'b' } });
    // The same press toggles it back off.
    expect(session.handleIntent({ type: 'toggleTechnique', kind: 'hammerPull' })).toBe(true);
    expect(techniqueOf(session, 'a')).toBeUndefined();
  });

  it('h on a descending pair writes the same adornment — direction lives in the pitches', () => {
    const session = new EditorSession(bar([
      { string: 1, fret: 3, id: 'a' }, { string: 1, fret: 0, id: 'b' }
    ]));
    expect(session.handleIntent({ type: 'toggleTechnique', kind: 'hammerPull' })).toBe(true);
    expect(techniqueOf(session, 'a')).toEqual({ hammerPull: { target: 'b' } });
  });

  it('h between equal frets refuses — fingers cannot hammer or pull to the same fret', () => {
    const session = new EditorSession(bar([
      { string: 1, fret: 0, id: 'a' }, { string: 1, fret: 0, id: 'b' }
    ]));
    expect(session.handleIntent({ type: 'toggleTechnique', kind: 'hammerPull' })).toBe(false);
    expect(techniqueOf(session, 'a')).toBeUndefined();
  });

  it('the target is the next note ON THE SAME STRING — an intervening string is skipped', () => {
    // h on string 6 with the next event on string 5: the hammer stays on its
    // string, so the arc bridges to the string-6 note two events away.
    const session = new EditorSession(bar([
      { string: 6, fret: 0, id: 'a' },
      { string: 5, fret: 2, id: 'b' },
      { string: 6, fret: 3, id: 'c' }
    ]));
    expect(session.handleIntent({ type: 'toggleTechnique', kind: 'hammerPull' })).toBe(true);
    expect(techniqueOf(session, 'a')).toEqual({ hammerPull: { target: 'c' } });
  });

  it('refuses when the next same-string note is the same fret, whatever lies between', () => {
    const session = new EditorSession(bar([
      { string: 6, fret: 0, id: 'a' },
      { string: 5, fret: 2, id: 'b' },
      { string: 6, fret: 0, id: 'c' }
    ]));
    expect(session.handleIntent({ type: 'toggleTechnique', kind: 'hammerPull' })).toBe(false);
    expect(techniqueOf(session, 'a')).toBeUndefined();
  });

  it('a BARE note uses its DERIVED string — the ladder, not just the annotation', () => {
    // No annotations anywhere: E2 derives to string 6, D3 to string 4, G2 to
    // string 6 fret 3. h on the E2 must skip the D3 and bridge to the G2.
    const session = new EditorSession(bareBar([
      { string: 6, fret: 0, id: 'a' },
      { string: 4, fret: 0, id: 'b' },
      { string: 6, fret: 3, id: 'c' }
    ]));
    expect(session.handleIntent({ type: 'toggleTechnique', kind: 'hammerPull' })).toBe(true);
    expect(techniqueOf(session, 'a')).toEqual({ hammerPull: { target: 'c' } });

    // And the equal-fret refusal holds on derived strings too.
    const equal = new EditorSession(bareBar([
      { string: 6, fret: 0, id: 'a' },
      { string: 4, fret: 0, id: 'b' },
      { string: 6, fret: 0, id: 'c' }
    ]));
    expect(equal.handleIntent({ type: 'toggleTechnique', kind: 'hammerPull' })).toBe(false);
  });

  it('a slide travels to a different fret too', () => {
    const session = new EditorSession(bar([
      { string: 1, fret: 0, id: 'a' }, { string: 1, fret: 3, id: 'b' }
    ]));
    expect(session.handleIntent({ type: 'toggleTechnique', kind: 'slide' })).toBe(true);
    expect(techniqueOf(session, 'a')).toEqual({ slide: { type: 'legato', target: 'b' } });
  });
});
