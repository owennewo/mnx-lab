// The arrows walk a voice in DATA order, so a grace and the host it leads into
// are two stops although they share a moment. Found on 2026-09-19 in bar 1 of
// "Ain't No Sunshine": a grace 2 in front of an eighth rest, and → from the
// grace jumped over the rest to the 5 — the rest, undrawn on tab, had no
// address at all. The owner's rule: a composer expects → to go to the next
// note even when it is coincident in time.
import { describe, it, expect } from 'vitest';
import { EditorSession } from '../../src/edit/session.ts';
import { buildGrid, eventAtCursor } from '../../src/edit/cursor.ts';
import type { MnxStructure, MnxEvent } from '../../src/model/mnx.ts';

const note = (base: string, string: number, fret: number, step: string, octave: number): MnxEvent =>
  ({ duration: { base }, notes: [{ pitch: { step, octave }, _x: { mnxLab: { string, fret } } }] } as MnxEvent);
const bar = (): MnxStructure => ({
  global: { measures: [{ time: { count: 4, unit: 4 } }] },
  parts: [{
    _x: { mnxLab: { strings: [
      { string: 1, pitch: { step: 'E', octave: 4 } }, { string: 2, pitch: { step: 'B', octave: 3 } }, { string: 3, pitch: { step: 'G', octave: 3 } },
      { string: 4, pitch: { step: 'D', octave: 3 } }, { string: 5, pitch: { step: 'A', octave: 2 } }, { string: 6, pitch: { step: 'E', octave: 2 } }] } },
    measures: [{ sequences: [{ content: [
      note('quarter', 4, 5, 'G', 3), note('eighth', 4, 2, 'E', 3), note('eighth', 3, 0, 'G', 3), note('eighth', 3, 2, 'A', 3),
      { type: 'grace', graceType: 'stealPrevious', content: [note('quarter', 3, 2, 'A', 3)] },
      { duration: { base: 'eighth' }, rest: {} }, note('eighth', 3, 5, 'C', 4), { duration: { base: 'eighth' }, rest: {} }
    ] }] }]
  }]
} as unknown as MnxStructure);

const at = (session: EditorSession) => eventAtCursor(session.doc, buildGrid(session.doc), session.cursor, session.projection);
const describeStop = (session: EditorSession) => {
  const event = at(session), onset = `${session.cursor.onset.num}/${session.cursor.onset.den}`;
  return `${onset} ${event?.rest ? 'rest' : `fret ${event?.notes?.[0]?._x?.mnxLab?.fret}`}`;
};
const walk = (session: EditorSession, type: 'nextPosition' | 'prevPosition', steps: number) => {
  const stops: string[] = [];
  for (let i = 0; i < steps; i++) { session.handleIntent({ type }); stops.push(describeStop(session)); }
  return stops;
};

describe('a grace and its host are two stops', () => {
  it('→ visits the grace, then the rest it leads into, then the next note (tab, note rung)', () => {
    const session = new EditorSession(bar());
    expect(session.projection).toBe('tab');
    expect(walk(session, 'nextPosition', 6)).toEqual(['1/4 fret 2', '3/8 fret 0', '1/2 fret 2', '5/8 fret 2', '5/8 rest', '3/4 fret 5']);
    expect(walk(session, 'prevPosition', 3)).toEqual(['5/8 rest', '5/8 fret 2', '1/2 fret 2']);
  });
  it('does the same at the event rung and in the notation projection', () => {
    const session = new EditorSession(bar());
    session.handleIntent({ type: 'goToLevel', level: 'event' });
    expect(walk(session, 'nextPosition', 6)).toEqual(['1/4 fret 2', '3/8 fret 0', '1/2 fret 2', '5/8 fret 2', '5/8 rest', '3/4 fret 5']);
    const notation = new EditorSession(bar());
    notation.handleIntent({ type: 'setProjection', projection: 'notation' });
    expect(walk(notation, 'nextPosition', 6)).toEqual(['1/4 fret 2', '3/8 fret 0', '1/2 fret 2', '5/8 fret 2', '5/8 rest', '3/4 fret 5']);
    expect(walk(notation, 'prevPosition', 2)).toEqual(['5/8 rest', '5/8 fret 2']);
  });
  it('a digit typed on the rest enters into the rest, not the grace', () => {
    const session = new EditorSession(bar());
    walk(session, 'nextPosition', 5);
    expect(describeStop(session)).toBe('5/8 rest');
    // The walk is string-sticky and began on the first note's string (4); one up is the grace's own
    // string, where a note IS drawn at this moment — the digit must still go into the rest.
    expect(session.cursor.line).toBe(4);
    session.handleIntent({ type: 'lineUp' });
    expect(session.cursor.line).toBe(3);
    expect(describeStop(session)).toBe('5/8 rest');
    // The pending entry duration (a quarter by default) is what the note takes; an eighth fills the rest exactly.
    session.handleIntent({ type: 'shorterDuration' });
    expect(session.handleIntent({ type: 'enterFret', fret: 7 })).toBe(true);
    const content = session.doc.parts[0].measures[0].sequences![0].content as MnxEvent[];
    expect((content[4] as unknown as { type: string }).type).toBe('grace');
    expect((content[4] as unknown as { content: MnxEvent[] }).content[0].notes![0]._x!.mnxLab!.fret).toBe(2);
    expect(content[5].rest).toBeUndefined(); expect(content[5].notes![0]._x!.mnxLab!.fret).toBe(7); expect(content[5].duration!.base).toBe('eighth');
    expect(content).toHaveLength(8);
    // Entry does not advance; the cursor now stands on the note it made, not back on the grace.
    expect(describeStop(session)).toBe('5/8 fret 7');
    expect(walk(session, 'nextPosition', 1)).toEqual(['3/4 fret 5']);
  });
  it('a longer duration typed on the rest is refused out loud, since a note follows', () => {
    const session = new EditorSession(bar());
    walk(session, 'nextPosition', 5);
    const before = JSON.stringify(session.doc);
    expect(session.lastEntryRefusal).toBeNull();
    // The pending duration is a quarter; the rest is an eighth and the 5 stands in the way.
    expect(session.handleIntent({ type: 'enterFret', fret: 7 })).toBe(false);
    expect(session.lastEntryRefusal).toMatch(/quarter does not fit.*Shorten/);
    expect(JSON.stringify(session.doc)).toBe(before);
    expect(session.canUndo).toBe(false);
    session.handleIntent({ type: 'shorterDuration' });
    expect(session.handleIntent({ type: 'enterFret', fret: 7 })).toBe(true);
    expect(session.lastEntryRefusal).toBeNull();
  });
  it('the cursor ghost anchors to the event the cursor means, not to the grace sharing its moment', () => {
    const session = new EditorSession(bar());
    walk(session, 'nextPosition', 4);
    expect(describeStop(session)).toBe('5/8 fret 2');
    expect(session.cursorContext().anchorKeys[0]).toMatch(/e4\.c0/);
    walk(session, 'nextPosition', 1);
    expect(describeStop(session)).toBe('5/8 rest');
    expect(session.cursorContext().anchorKeys[0]).toBe('@m0.v0.e5');
  });
  it('Delete at the event rung removes the rest, and the note after it takes its place', () => {
    const session = new EditorSession(bar());
    walk(session, 'nextPosition', 5);
    session.handleIntent({ type: 'goToLevel', level: 'event' });
    expect(describeStop(session)).toBe('5/8 rest');
    expect(session.handleIntent({ type: 'delete' })).toBe(true);
    const content = session.doc.parts[0].measures[0].sequences![0].content as MnxEvent[];
    expect(content).toHaveLength(7);
    expect((content[4] as unknown as { type: string }).type).toBe('grace');
    expect(content[5].notes![0]._x!.mnxLab!.fret).toBe(5);
  });
});
