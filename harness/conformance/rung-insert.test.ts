// Insert at the rung — roadmap/proposed/core-rung-insert.md.
//
// `I` / `Shift+I` resolve against the rung the cursor addresses. The refusals
// matter as much as the inserts: a key that quietly acts on something wider
// than you were addressing is what the selection ladder exists to prevent.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { EditorSession, replayIntents } from '../../src/edit/session.ts';
import type { EditorIntent } from '../../src/edit/intents.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
import { STANDARD_GUITAR_STRINGS } from '../../src/model/mnx.ts';
import { computePrimitives } from '../helpers/corpusPrimitives.ts';
import { validateDocument } from '../../src/engine/layout/validate.ts';
import {
  EDIT_LAYER,
  NAVIGATION_LAYER,
  resolveKeyAction,
  resolveShellAction,
  strokeOf
} from '../../src/edit/keymap.ts';

const EMPTY = () => ({}) as MnxStructure;

/** A one-bar guitar part — the fingerboard the tab entry path needs. */
const tabDoc = (): MnxStructure => ({
  mnx: { version: 1 },
  global: { measures: [{ time: { count: 4, unit: 4 } }] },
  parts: [{
    id: 'guitar',
    _x: {
      mnxLab: {
        strings: STANDARD_GUITAR_STRINGS.map(entry => ({
          ...entry,
          pitch: { ...entry.pitch }
        })),
        tab: { staffKind: 'tab' as const }
      }
    },
    measures: [{ sequences: [{ content: [{ duration: { base: 'whole' }, rest: {} }] }] }]
  }]
});
const build = (intents: EditorIntent[]) => replayIntents(EMPTY(), intents);

/** A one-part document of `bars` empty 4/4 bars, cursor at bar 0. */
function score(bars: number): EditorSession {
  const intents: EditorIntent[] = [{ type: 'addPart' }];
  for (let i = 0; i < bars; i++) intents.push({ type: 'appendMeasure' });
  intents.push({ type: 'setTimeSignature', count: 4, unit: 4 });
  return build(intents);
}

/** Walk the ladder up to `level` from note. */
function relaxTo(session: EditorSession, level: string): void {
  for (let i = 0; i < 8 && session.selectionLevel !== level; i++)
    session.handleIntent({ type: 'relaxSelection' });
  expect(session.selectionLevel, `could not reach the ${level} rung`).toBe(level);
}

const barCount = (session: EditorSession) => session.doc.global?.measures?.length ?? 0;

describe('insert at the rung', () => {
  it('inserts a bar after and before, and moves into it', () => {
    const after = score(2);
    relaxTo(after, 'measure');
    after.handleIntent({ type: 'goToMeasure', measureIndex: 0 });
    expect(after.handleIntent({ type: 'insertAtRung', side: 'after' })).toBe(true);
    expect(barCount(after)).toBe(3);
    expect(after.cursor.measureIndex, 'cursor did not follow the new bar').toBe(1);

    const before = score(2);
    relaxTo(before, 'measure');
    before.handleIntent({ type: 'goToMeasure', measureIndex: 1 });
    expect(before.handleIntent({ type: 'insertAtRung', side: 'before' })).toBe(true);
    expect(barCount(before)).toBe(3);
    expect(before.cursor.measureIndex).toBe(1);
  });

  it('the new bar arrives padded, like every other bar entry touches', () => {
    const s = score(1);
    relaxTo(s, 'measure');
    s.handleIntent({ type: 'insertAtRung', side: 'after' });
    const content = s.doc.parts![0].measures![1].sequences![0].content;
    expect(content.map(e => (e as { duration: { base: string } }).duration.base))
      .toEqual(['quarter', 'quarter', 'quarter', 'quarter']);
  });

  it('THE PICKUP BAR: a bar before the first, which appendMeasure cannot reach', () => {
    const s = score(1);
    // Put ink in bar 1 so the new bar is provably in FRONT of real music.
    s.handleIntent({ type: 'toggleNote' });
    const before = JSON.parse(JSON.stringify(s.doc.parts![0].measures![0])) as unknown;
    relaxTo(s, 'measure');
    expect(s.handleIntent({ type: 'insertAtRung', side: 'before' })).toBe(true);
    expect(barCount(s)).toBe(2);
    expect(s.cursor.measureIndex, 'the cursor should land in the pickup').toBe(0);
    // The music moved along intact; the new bar is the empty one.
    expect(s.doc.parts![0].measures![1]).toEqual(before);
  });

  it('the part rung inserts VOICES — never a staff, which is still refused', () => {
    // This item's table said partMeasure has no insert, and the reason it gave
    // was about STAVES: "a staff exists for the whole part or not at all". That
    // stands. What it did not consider is that `voiceMeasure` disappears with
    // the last voice and takes its own `I` with it, leaving the verb that
    // CREATES a voice unreachable in the one state that needs it — easy to
    // reach since core-delete-clears-then-removes.md.
    //
    // So the part rung's insert is the voice, exactly as the SCORE rung's is
    // the part: both insert the child they govern, because neither rung's own
    // unit can be inserted at all.
    const s = score(2);
    s.handleIntent({ type: 'toggleNote' });
    relaxTo(s, 'partMeasure');
    const bars = barCount(s);
    const staves = s.doc.parts![0].staves;

    expect(s.handleIntent({ type: 'insertAtRung', side: 'after' })).toBe(true);
    expect(s.doc.parts![0].measures![0].sequences, 'a voice arrived').toHaveLength(2);
    expect(barCount(s), 'no bar was inserted').toBe(bars);
    expect(s.doc.parts![0].staves, 'no staff was inserted').toBe(staves);
    expect(s.doc.parts!.length, 'no part was inserted').toBe(1);
  });

  it('reaches the voice verb from the part rung when there is no voice left', () => {
    // The catch-22 the scoping had: to add a voice you had to stand on
    // `voiceMeasure`, which exists only when a voice already does.
    const s = score(2);
    s.handleIntent({ type: 'toggleNote' });
    relaxTo(s, 'partMeasure');
    s.handleIntent({ type: 'delete' }); // clears the staff bar's ink
    s.handleIntent({ type: 'delete' }); // removes the emptied staff bar
    expect(s.doc.parts![0].measures![0].sequences).toEqual([]);
    expect(s.selectionLevel, 'the ladder stops at the part rung').toBe('partMeasure');

    expect(s.handleIntent({ type: 'insertAtRung', side: 'after' })).toBe(true);
    expect(s.doc.parts![0].measures![0].sequences, 'the voice is back').toHaveLength(1);
    expect(barCount(s)).toBe(2);
  });

  it('the voice rung takes `after` only — a voice ordinal is not an order', () => {
    const s = score(1);
    relaxTo(s, 'voiceMeasure');
    expect(s.handleIntent({ type: 'insertAtRung', side: 'before' })).toBe(false);
    expect(s.doc.parts![0].measures![0].sequences!.length).toBe(1);
    expect(s.handleIntent({ type: 'insertAtRung', side: 'after' })).toBe(true);
    expect(s.doc.parts![0].measures![0].sequences!.length).toBe(2);
  });

  it('the score rung inserts a part in score order', () => {
    const s = build([
      { type: 'addPart', name: 'A' },
      { type: 'appendMeasure' },
      { type: 'addPart', name: 'B' }
    ]);
    relaxTo(s, 'document');
    s.handleIntent({ type: 'setPart', partIndex: 1 });
    relaxTo(s, 'document');
    expect(s.handleIntent({ type: 'insertAtRung', side: 'before' })).toBe(true);
    expect(s.doc.parts!.map(p => p.name)).toEqual(['A', undefined, 'B']);
    expect(s.cursor.partIndex, 'cursor did not follow the new part').toBe(1);
  });
});

describe('End then I replaces the append key', () => {
  it('Shift+M is bound to nothing at all', () => {
    const stroke = strokeOf({
      code: 'KeyM', ctrlKey: false, altKey: false, shiftKey: true, metaKey: false
    });
    expect(resolveKeyAction(stroke, [NAVIGATION_LAYER, EDIT_LAYER])).toBeNull();
    expect(resolveShellAction(stroke)).toBeNull();
  });

  it('End lands on the last bar, Home on the first', () => {
    const s = score(4);
    s.handleIntent({ type: 'goToMeasure', measureIndex: 1 });
    expect(s.handleIntent({ type: 'goToEdge', edge: 'last' })).toBe(true);
    expect(s.cursor.measureIndex).toBe(3);
    expect(s.handleIntent({ type: 'goToEdge', edge: 'first' })).toBe(true);
    expect(s.cursor.measureIndex).toBe(0);
  });

  it('End then I appends, exactly as the retired key did', () => {
    const viaKey = score(2);
    viaKey.handleIntent({ type: 'appendMeasure' });

    const viaEnd = score(2);
    relaxTo(viaEnd, 'measure');
    viaEnd.handleIntent({ type: 'goToEdge', edge: 'last' });
    expect(viaEnd.handleIntent({ type: 'insertAtRung', side: 'after' })).toBe(true);

    expect(JSON.stringify(viaEnd.doc)).toBe(JSON.stringify(viaKey.doc));
    expect(viaEnd.cursor.measureIndex, 'the cursor should be IN the new bar').toBe(2);
  });

  it('GENESIS: the score rung still inserts parts, because that is its unit', () => {
    // End+I cannot express genesis — there is nowhere to travel to, so End
    // refuses — and the score rung's insert is PARTS, which stays meaningful
    // in a document with no bars. Both halves survive
    // core-delete-clears-then-removes.md's genesis case below.
    const s = build([{ type: 'addPart' }]);
    expect(s.doc.global?.measures?.length ?? 0).toBe(0);
    relaxTo(s, 'document');
    expect(s.handleIntent({ type: 'goToEdge', edge: 'last' })).toBe(false);

    s.handleIntent({ type: 'insertAtRung', side: 'after' });
    expect(s.doc.global?.measures?.length ?? 0, 'the score rung made a bar').toBe(0);
    expect(s.doc.parts!.length, 'the score rung inserts parts').toBe(2);
    expect(s.handleIntent({ type: 'appendMeasure' })).toBe(true);
    expect(s.doc.global!.measures!.length).toBe(1);
  });

  it('GENESIS: every rung BELOW the score makes the first bar, because nothing else can', () => {
    // The dead end core-delete-clears-then-removes.md opened up: Delete can
    // now chew a real score down to parts-with-no-bars, and from there the
    // first bar had no keyboard route at all — `goToEdge` refuses, the ghost
    // bar past the end is withheld when there are no bars. An event needs a
    // bar to sit in, so at those rungs `I` means the bar.
    for (const level of ['note', 'partMeasure', 'measure'] as const) {
      const s = build([{ type: 'addPart' }]);
      relaxTo(s, level);
      expect(s.selectionLevel).toBe(level);
      expect(s.handleIntent({ type: 'insertAtRung', side: 'after' }), level).toBe(true);
      expect(s.doc.global!.measures!.length, level).toBe(1);
      // Every part gets its copy, so the bar is immediately writable.
      expect(s.doc.parts!.map(part => part.measures!.length), level).toEqual([1]);
      expect(s.handleIntent({ type: 'toggleNote' }), `${level}: entry after genesis`).toBe(true);
    }
  });
});

describe('insert and the spans anchored by a bar COUNT', () => {
  const spanScore = () => {
    const s = score(4);
    relaxTo(s, 'measure');
    return s;
  };

  it('widens a volta whose reach the new bar lands inside', () => {
    const s = spanScore();
    // A 3-bar ending starting at bar 1 (covers bars 1,2,3).
    s.doc.global!.measures![1].ending = { duration: 3, numbers: [1] };
    s.handleIntent({ type: 'goToMeasure', measureIndex: 2 });
    s.handleIntent({ type: 'insertAtRung', side: 'before' }); // lands at index 2
    expect(s.doc.global!.measures![1].ending!.duration, 'volta silently re-spanned').toBe(4);
  });

  it('leaves a volta alone when the bar lands outside it', () => {
    for (const [at, side] of [[1, 'before'], [3, 'after']] as const) {
      const s = spanScore();
      s.doc.global!.measures![1].ending = { duration: 2, numbers: [1] }; // bars 1,2
      s.handleIntent({ type: 'goToMeasure', measureIndex: at });
      s.handleIntent({ type: 'insertAtRung', side });
      const ending = s.doc.global!.measures!.find(m => m.ending)!.ending!;
      expect(ending.duration, `insert ${side} bar ${at} moved the span`).toBe(2);
    }
  });

  it('widens a measure repeat and a multimeasure rest the same way', () => {
    const s = spanScore();
    (s.doc.parts![0].measures![1] as { measureRepeat?: { number: number } })
      .measureRepeat = { number: 3 };
    s.doc.global!.measures![1].id = 'm2';
    s.doc.scores = [{ multimeasureRests: [{ start: 'm2', duration: 3 }] } as never];
    s.handleIntent({ type: 'goToMeasure', measureIndex: 2 });
    s.handleIntent({ type: 'insertAtRung', side: 'after' }); // lands at index 3
    expect((s.doc.parts![0].measures![1] as { measureRepeat: { number: number } })
      .measureRepeat.number).toBe(4);
    expect(s.doc.scores![0].multimeasureRests![0].duration).toBe(4);
  });
});

describe('insert is safe in the middle of real music', () => {
  const FIXTURE = path.join(__dirname, '../fixtures/construct-traces/ties.json');

  it('ROUND TRIP: insert then remove returns the document byte-identically', () => {
    const intents = (JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as {
      intents: EditorIntent[];
    }).intents;
    const s = replayIntents(EMPTY(), intents);
    const before = JSON.stringify(s.doc);
    relaxTo(s, 'measure');
    s.handleIntent({ type: 'goToMeasure', measureIndex: 0 });
    expect(s.handleIntent({ type: 'insertAtRung', side: 'after' })).toBe(true);
    expect(JSON.stringify(s.doc), 'the insert changed nothing').not.toBe(before);
    // Del at the measure rung is the removal verb — the bar is rests-only, so
    // the guard lets it go.
    expect(s.cursor.measureIndex).toBe(1);
    expect(s.selectionLevel).toBe('measure');
    expect(s.handleIntent({ type: 'delete' })).toBe(true);
    expect(JSON.stringify(s.doc)).toBe(before);
  });

  it('COMMUTATIVITY: building out of order gives the same engraving', () => {
    // Three bars of one note each. In order, then with the middle bar
    // INSERTED after the fact — the same music reached two ways. Staff
    // positions are absolute, because `goToMeasure` re-aims the line at ink.
    // The ladder skips rungs with no referent, so it will not descend to
    // `note` inside a rest-only bar — climb down where there IS ink, then
    // travel. (Pre-existing ladder behaviour; entry itself works from `event`,
    // which is why a player never notices.)
    const descendVia = (session: EditorSession, inkedBar: number) => {
      session.handleIntent({ type: 'goToMeasure', measureIndex: inkedBar });
      for (let i = 0; i < 8 && session.selectionLevel !== 'note'; i++)
        session.handleIntent({ type: 'tightenSelection' });
      expect(session.selectionLevel).toBe('note');
    };
    const noteAt = (session: EditorSession, bar: number, staffPosition: number) => {
      session.handleIntent({ type: 'goToMeasure', measureIndex: bar });
      for (let i = 0; i < 40 && session.cursor.line !== staffPosition; i++)
        session.handleIntent({
          type: session.cursor.line < staffPosition ? 'lineUp' : 'lineDown'
        });
      expect(session.cursor.line).toBe(staffPosition);
      expect(session.handleIntent({ type: 'toggleNote' })).toBe(true);
    };

    const inOrder = score(3);
    noteAt(inOrder, 0, -6);
    noteAt(inOrder, 1, -2);
    noteAt(inOrder, 2, 2);

    const inserted = score(2);
    noteAt(inserted, 0, -6);
    noteAt(inserted, 1, 2); // the LAST bar's music, written second
    relaxTo(inserted, 'measure');
    inserted.handleIntent({ type: 'goToMeasure', measureIndex: 1 });
    expect(inserted.handleIntent({ type: 'insertAtRung', side: 'before' })).toBe(true);
    descendVia(inserted, 0);
    noteAt(inserted, 1, -2); // the middle bar, filled after it was inserted

    expect(JSON.parse(JSON.stringify(computePrimitives(inserted.doc))))
      .toEqual(JSON.parse(JSON.stringify(computePrimitives(inOrder.doc))));
  });
});


describe('the note rung inserts a note, and may overfill the bar', () => {
  const overfills = (session: EditorSession) =>
    validateDocument(session.doc)
      .filter(issue => /overfills/.test(issue.message))
      .map(issue => issue.message);

  /** An exactly full 4/4 bar of four quarters, cursor back on the first. */
  const fullBar = (): EditorSession => {
    const s = score(1);
    for (const line of [-6, -4, -2, 0]) {
      while (s.cursor.line !== line)
        s.handleIntent({ type: s.cursor.line < line ? 'lineUp' : 'lineDown' });
      s.handleIntent({ type: 'toggleNote' });
      s.handleIntent({ type: 'nextPosition' });
    }
    s.handleIntent({ type: 'goToMeasure', measureIndex: 0 });
    while (s.cursor.line !== -6)
      s.handleIntent({ type: s.cursor.line < -6 ? 'lineUp' : 'lineDown' });
    expect(overfills(s), 'the bar should start exactly full').toEqual([]);
    return s;
  };

  const bases = (session: EditorSession) =>
    session.doc.parts![0].measures![0].sequences![0].content.map(
      e => (e as { duration: { base: string } }).duration.base
    );

  it('inserts after the cursor and says the bar is now too long', () => {
    const s = fullBar();
    expect(s.selectionLevel).toBe('note');
    expect(s.handleIntent({ type: 'insertAtRung', side: 'after' })).toBe(true);
    expect(bases(s).length, 'no event was inserted').toBe(5);
    // The warning is the whole point: it counts the beats, per voice.
    expect(overfills(s)).toEqual(['overfills the 4/4 bar: notes sum to 5 of 4 beats']);
  });

  it('THE WORKFLOW: insert, then resolve the overflow by re-valuing two notes', () => {
    const s = fullBar();
    s.handleIntent({ type: 'insertAtRung', side: 'after' });
    expect(overfills(s)).toHaveLength(1);

    // Select the first two events and halve them: 5 beats → 4. The FIRST
    // Shift+→ promotes the note-rung point to a one-event range, so selecting
    // two events takes two presses, not one.
    for (let i = 0; i < 2; i++) s.handleIntent({ type: 'extendSelection', direction: 'next' });
    expect(s.resolvedSelection.members.length).toBe(2);
    expect(s.handleIntent({ type: 'shorterDuration' })).toBe(true);

    // The cursor is on the NEW note (the insert takes you there), so the two
    // halved are it and its neighbour — not the first two.
    expect(bases(s)).toEqual(['quarter', 'eighth', 'eighth', 'quarter', 'quarter']);
    expect(overfills(s), 'the bar should come right').toEqual([]);
  });

  it('a ranged re-value works back-to-front, so onsets stay addressable', () => {
    // Front-to-back, re-valuing the FIRST event moves every later onset, and
    // the next op addresses a moment that no longer holds what it aimed at.
    const s = fullBar();
    for (let i = 0; i < 4; i++) s.handleIntent({ type: 'extendSelection', direction: 'next' });
    expect(s.resolvedSelection.members.length).toBe(4);
    expect(s.handleIntent({ type: 'shorterDuration' })).toBe(true);
    // All four stepped. The bar is now half empty, so `setDuration` re-pads it
    // — §8.11 still governs a RE-VALUE; only the insert suspends it.
    const sounded = s.doc.parts![0].measures![0].sequences![0].content.filter(
      e => ((e as { notes?: unknown[] }).notes?.length ?? 0) > 0
    );
    expect(sounded.map(e => (e as { duration: { base: string } }).duration.base))
      .toEqual(['eighth', 'eighth', 'eighth', 'eighth']);
    expect(overfills(s)).toEqual([]);
  });

  it('Shift+I puts the new note in front', () => {
    const s = score(1);
    while (s.cursor.line !== -6) s.handleIntent({ type: 'lineDown' });
    s.handleIntent({ type: 'toggleNote' });
    while (s.cursor.line !== 2) s.handleIntent({ type: 'lineUp' });
    expect(s.handleIntent({ type: 'insertAtRung', side: 'before' })).toBe(true);
    const first = s.doc.parts![0].measures![0].sequences![0].content[0] as {
      notes?: { pitch: { step: string; octave: number } }[];
    };
    expect(first.notes?.[0].pitch).toEqual({ step: 'D', octave: 5 });
  });
});


describe('the cursor follows an insert, and Delete finishes the job', () => {
  const contentOf = (session: EditorSession) =>
    session.doc.parts![0].measures![0].sequences![0].content as {
      duration: { base: string };
      rest?: unknown;
      notes?: { pitch: { step: string; octave: number } }[];
    }[];

  /** Four quarters, cursor back on the first. */
  const fullBar = (): EditorSession => {
    const s = score(1);
    for (const line of [-6, -4, -2, 0]) {
      while (s.cursor.line !== line)
        s.handleIntent({ type: s.cursor.line < line ? 'lineUp' : 'lineDown' });
      s.handleIntent({ type: 'toggleNote' });
      s.handleIntent({ type: 'nextPosition' });
    }
    s.handleIntent({ type: 'goToMeasure', measureIndex: 0 });
    while (s.cursor.line !== -6)
      s.handleIntent({ type: s.cursor.line < -6 ? 'lineUp' : 'lineDown' });
    return s;
  };

  it('inserting AFTER on beat 1 leaves the cursor on the new note', () => {
    const s = fullBar();
    expect(s.cursor.onset).toEqual({ num: 0, den: 1 });
    s.handleIntent({ type: 'insertAtRung', side: 'after' });
    // The new note is the second event, so the cursor stands one quarter in.
    expect(s.cursor.onset, 'the cursor stayed on the old note').toEqual({ num: 1, den: 4 });
    expect(s.selectionLevel).toBe('note');
    // And it is addressing the NEW note, not the one that was there.
    const slot = contentOf(s)[1];
    expect(slot.notes?.[0].pitch).toEqual({ step: 'C', octave: 4 });
  });

  it('inserting BEFORE leaves the cursor on the new note too', () => {
    const s = fullBar();
    s.handleIntent({ type: 'insertAtRung', side: 'before' });
    expect(s.cursor.onset).toEqual({ num: 0, den: 1 });
    expect(contentOf(s)[0].notes?.[0].pitch).toEqual({ step: 'C', octave: 4 });
  });

  it('TWO PRESSES: Delete empties the event, Delete again removes it', () => {
    const s = fullBar();
    expect(contentOf(s).length).toBe(4);

    // One: the note goes, the event stays as a rest of the same length.
    expect(s.handleIntent({ type: 'delete' })).toBe(true);
    expect(contentOf(s).length, 'the event should still be there').toBe(4);
    expect(contentOf(s)[0].rest, 'the event should be a rest now').toBeTruthy();
    expect(s.selectionLevel, 'the ladder should be at the event rung').toBe('event');

    // Two: the event itself goes, and the bar underfills — which the badge says.
    expect(s.handleIntent({ type: 'delete' })).toBe(true);
    expect(contentOf(s).length, 'the second Delete did nothing').toBe(3);
    expect(
      validateDocument(s.doc).map(i => i.message).filter(m => /underfills/.test(m))
    ).toEqual(['underfills the 4/4 bar: notes sum to 3 of 4 beats']);
  });

  it('Delete never removes an event that still holds ink', () => {
    const s = fullBar();
    // Straight to the event rung, with the note still on it.
    s.handleIntent({ type: 'relaxSelection' });
    expect(s.selectionLevel).toBe('event');
    expect(s.handleIntent({ type: 'delete' })).toBe(true);
    expect(contentOf(s).length, 'ink was spliced out instead of cleared').toBe(4);
    expect(contentOf(s)[0].rest).toBeTruthy();
  });

  it('undo puts the removed event back', () => {
    const s = fullBar();
    const before = JSON.stringify(s.doc);
    s.handleIntent({ type: 'delete' });
    s.handleIntent({ type: 'delete' });
    expect(JSON.stringify(s.doc)).not.toBe(before);
    s.handleIntent({ type: 'undo' });
    s.handleIntent({ type: 'undo' });
    expect(JSON.stringify(s.doc)).toBe(before);
  });
});


describe('the ghost bar past the end', () => {
  /** The document, as text — the only honest way to ask "did anything move?". */
  const text = (session: EditorSession) => JSON.stringify(session.doc);

  /** Walk `→` to the very end of the grid and report where it stopped. */
  const toEnd = (session: EditorSession, presses = 12) => {
    for (let i = 0; i < presses; i++) session.handleIntent({ type: 'nextPosition' });
    return session.cursor.measureIndex;
  };

  it('`→` at the last position is no longer a dead key', () => {
    const s = score(2);
    const before = text(s);
    expect(toEnd(s), 'the cursor should stand one bar past the last').toBe(2);
    expect(text(s), 'arriving on the ghost wrote something').toBe(before);
  });

  it('AUTOREPEAT is harmless: there is ONE ghost and you stop on it', () => {
    // The failure the doc names — holding `→` to skim a piece must not
    // manufacture bars at the key-repeat rate.
    const s = score(2);
    const before = text(s);
    expect(toEnd(s, 40)).toBe(2);
    expect(s.doc.global!.measures!.length).toBe(2);
    expect(text(s)).toBe(before);
  });

  it('arrowing back off it leaves nothing behind', () => {
    const s = score(3);
    const before = text(s);
    const ops = s.appliedOps.length;
    toEnd(s);
    expect(s.handleIntent({ type: 'prevPosition' })).toBe(true);
    expect(s.cursor.measureIndex).toBe(2);
    expect(text(s)).toBe(before);
    expect(s.appliedOps, 'navigation put an op in the history').toHaveLength(ops);
  });

  it('THE RUNG SURVIVES: `→` at the measure rung steps onto it and stays there', () => {
    const s = score(2);
    relaxTo(s, 'measure');
    s.handleIntent({ type: 'goToEdge', edge: 'last' });
    expect(s.handleIntent({ type: 'nextPosition' })).toBe(true);
    expect(s.cursor.measureIndex).toBe(2);
    expect(s.selectionLevel, 'the ladder dropped a rung on arrival').toBe('measure');
    // Nothing exists there, so the selection resolves to no members at all —
    // the vacancy is drawn by the cursor ghost, not by an enclosure.
    expect(s.resolvedSelection.members).toEqual([]);
  });

  it('a RANGE stops at the last real bar — Shift may not reach the ghost', () => {
    const s = score(2);
    relaxTo(s, 'measure');
    s.handleIntent({ type: 'goToEdge', edge: 'last' });
    expect(s.handleIntent({ type: 'extendSelection', direction: 'next' })).toBe(false);
    expect(s.cursor.measureIndex).toBe(1);
  });

  it('"go to bar 99" still means the last bar, not the vacancy past it', () => {
    const s = score(3);
    s.handleIntent({ type: 'goToMeasure', measureIndex: 99 });
    expect(s.cursor.measureIndex).toBe(2);
    s.handleIntent({ type: 'goToEdge', edge: 'last' });
    expect(s.cursor.measureIndex).toBe(2);
  });

  it('MATERIALISES ON THE KEYSTROKE, and undo returns byte-identically', () => {
    const s = score(1);
    const before = text(s);
    const ops = s.appliedOps.length;
    toEnd(s);
    expect(s.cursor.measureIndex).toBe(1);
    expect(s.handleIntent({ type: 'toggleNote' })).toBe(true);
    expect(s.doc.global!.measures!.length, 'the bar did not materialise').toBe(2);
    expect(s.doc.parts![0].measures![1].sequences![0].content.some(
      item => 'notes' in item
    ), 'the note did not land in the new bar').toBe(true);

    // ONE batch: the bar and the note it received are a single history entry,
    // or undo would leave an orphaned empty bar behind the note it removed.
    expect(s.appliedOps).toHaveLength(ops + 1);
    expect(s.appliedOps[ops].type).toBe('batch');
    expect(s.handleIntent({ type: 'undo' })).toBe(true);
    expect(text(s)).toBe(before);
  });

  it('and a FRESH ghost appears past the new end — the score keeps growing', () => {
    const s = score(1);
    toEnd(s);
    s.handleIntent({ type: 'toggleNote' });
    expect(s.cursor.measureIndex, 'the cursor should be in the bar it made').toBe(1);
    expect(toEnd(s)).toBe(2);
    s.handleIntent({ type: 'toggleNote' });
    expect(s.doc.global!.measures!.length).toBe(3);
  });

  it('`I` on the ghost makes it real, and the rung survives that too', () => {
    const s = score(2);
    relaxTo(s, 'measure');
    s.handleIntent({ type: 'goToEdge', edge: 'last' });
    s.handleIntent({ type: 'nextPosition' });
    expect(s.handleIntent({ type: 'insertAtRung', side: 'after' })).toBe(true);
    expect(s.doc.global!.measures!.length).toBe(3);
    expect(s.cursor.measureIndex).toBe(2);
    expect(s.selectionLevel).toBe('measure');
    // Before and after a bar that does not exist are the same bar.
    const viaBefore = score(2);
    relaxTo(viaBefore, 'measure');
    viaBefore.handleIntent({ type: 'goToEdge', edge: 'last' });
    viaBefore.handleIntent({ type: 'nextPosition' });
    viaBefore.handleIntent({ type: 'insertAtRung', side: 'before' });
    expect(text(viaBefore)).toBe(text(s));
  });

  it('a score with NO bars has no ghost — genesis is still `appendMeasure`', () => {
    const s = build([{ type: 'addPart' }]);
    expect(s.positions.ghostMeasureIndex).toBeUndefined();
    expect(s.handleIntent({ type: 'nextPosition' })).toBe(false);
    expect(s.doc.global?.measures?.length ?? 0).toBe(0);
  });

  it('ON THE FINGERBOARD: a digit past the end makes the bar and frets it', () => {
    const s = new EditorSession(tabDoc(), 'ghost-tab');
    const before = JSON.stringify(s.doc);
    for (let i = 0; i < 4; i++) s.handleIntent({ type: 'nextPosition' });
    expect(s.cursor.measureIndex).toBe(1);
    expect(s.handleIntent({ type: 'enterFret', fret: 7 })).toBe(true);
    expect(s.doc.global!.measures!.length).toBe(2);
    expect(s.appliedOps).toHaveLength(1);
    expect(s.appliedOps[0].type).toBe('batch');
    expect(s.handleIntent({ type: 'undo' })).toBe(true);
    expect(JSON.stringify(s.doc)).toBe(before);
  });
});
