// The note level of the selection-ladder navigation map
// (roadmap/complete/core-selection-ladder.md): spatial cursor in both
// projections, snap-to-ink notation walking, the Ctrl climb at note level,
// and the notation entry toggle — driven over the navigation playground
// scenario, the standing test bed for the per-level reviews.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { EditorSession } from '../../src/edit/session.ts';
import {
  clefAt,
  keyFifthsAt,
  pitchAtStaffPosition,
  staffPositionOfPitch,
  DEFAULT_CLEF
} from '../../src/edit/staffSpace.ts';
import type { MnxEvent, MnxStructure } from '../../src/model/mnx.ts';
import type { SelectionLevel } from '../../src/edit/selection.ts';
import {
  neighbourSystemMeasure,
  packedRowMeasures,
  planHorizontal
} from '../../src/engine/layout/spacing.ts';
import { initSmufl } from '../helpers/corpusPrimitives.ts';

const playground = (): MnxStructure =>
  JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        '../../scenarios/lab/00-document/03-navigation-playground/score.mnx.json'
      ),
      'utf8'
    )
  );

/** A session flipped to the notation projection (the playground is a tab
 *  document, so it boots in the tab projection). */
function notationSession(): EditorSession {
  const session = new EditorSession(playground());
  session.handleIntent({ type: 'setProjection', projection: 'notation' });
  return session;
}

describe('staff space', () => {
  it('maps staff positions to pitches under the default treble clef', () => {
    expect(pitchAtStaffPosition(DEFAULT_CLEF, 0)).toEqual({ step: 'B', octave: 4 });
    expect(pitchAtStaffPosition(DEFAULT_CLEF, -6)).toEqual({ step: 'C', octave: 4 }); // middle C
    expect(pitchAtStaffPosition(DEFAULT_CLEF, 2)).toEqual({ step: 'D', octave: 5 });
  });

  it('applies the key signature as the entry default', () => {
    expect(pitchAtStaffPosition(DEFAULT_CLEF, -3, 1)).toEqual({ step: 'F', octave: 4, alter: 1 });
    expect(pitchAtStaffPosition(DEFAULT_CLEF, 0, -7)).toEqual({ step: 'B', octave: 4, alter: -1 });
    expect(pitchAtStaffPosition(DEFAULT_CLEF, -6, 1)).toEqual({ step: 'C', octave: 4 }); // C stays natural at 1♯
  });

  it('respects the treble-8 guitar clef and round-trips', () => {
    const doc = playground();
    const clef = clefAt(doc, 0);
    expect(clef).toEqual({ sign: 'G', staffPosition: -2, octave: -1 });
    expect(pitchAtStaffPosition(clef, 0)).toEqual({ step: 'B', octave: 3 });
    expect(staffPositionOfPitch(clef, { step: 'E', octave: 4 })).toBe(3);
    expect(staffPositionOfPitch(clef, { step: 'G', octave: 4 })).toBe(5);
    expect(keyFifthsAt(doc, 0)).toBe(0);
  });
});

describe('note-level navigation (notation projection)', () => {
  it('setProjection remaps the line into staff-position space', () => {
    const session = notationSession();
    expect(session.projection).toBe('notation');
    // The tab cursor stood on string 1 (G4, the top-line slot) → p5.
    expect(session.cursor.line).toBe(5);
    expect(session.selectedNoteKeys).toEqual(['l2']); // G4
  });

  it('walks staff positions vertically, occupied or not', () => {
    const session = notationSession();
    session.handleIntent({ type: 'lineDown' }); // p4 — empty space
    expect(session.cursor.line).toBe(4);
    expect(session.cursorContext().occupied).toBe(false);
    session.handleIntent({ type: 'lineDown' }); // p3 — E4
    expect(session.selectedNoteKeys).toEqual(['l1']);
  });

  it('←→ is voice-sticky and lands on the nearest-pitch member', () => {
    const session = notationSession();
    session.handleIntent({ type: 'nextPosition' }); // voice 0: A4 at 1/4
    expect(session.cursor.onset).toEqual({ num: 1, den: 4 });
    expect(session.cursor.line).toBe(6);
    expect(session.selectedNoteKeys).toEqual(['l3']);
  });

  it('a voice-1 anchor skips voice-0 onsets', () => {
    const session = notationSession();
    // Down to E3 (p−4), voice 1's half note at the bar start.
    while (session.cursor.line > -4) session.handleIntent({ type: 'lineDown' });
    expect(session.selectedNoteKeys).toEqual(['l6']);
    session.handleIntent({ type: 'nextPosition' });
    // Voice 1's next event is at 1/2 (G3) — voice 0's 1/4 was skipped.
    expect(session.cursor.onset).toEqual({ num: 1, den: 2 });
    expect(session.selectedNoteKeys).toEqual(['l7']);
  });

  // The anchor voice (core-selection-ladder.md): a two-voice bar where the
  // voices SHARE a staff position at one onset — the case that used to hand
  // the ←→ walk to the other voice, because the anchor was re-derived from
  // whichever slot sat on the line rather than carried by the cursor.
  const twoVoices = (): MnxStructure => ({
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }, {}] },
    parts: [
      {
        measures: [
          {
            clefs: [{ clef: { sign: 'G', staffPosition: -2 } }],
            sequences: [
              {
                content: (['C', 'D', 'E', 'F'] as const).map(step => ({
                  type: 'event' as const,
                  duration: { base: 'quarter' as const },
                  notes: [{ pitch: { step, octave: 4 } }]
                }))
              },
              {
                content: [
                  // C4 shares voice 0's line at onset 0; G5 does not.
                  { type: 'event', duration: { base: 'half' }, notes: [{ pitch: { step: 'C', octave: 4 } }] },
                  { type: 'event', duration: { base: 'half' }, notes: [{ pitch: { step: 'G', octave: 5 } }] }
                ]
              }
            ]
          },
          // One voice only — what the anchor falls back from.
          {
            sequences: [
              {
                content: [
                  { type: 'event', duration: { base: 'whole' }, notes: [{ pitch: { step: 'C', octave: 4 } }] }
                ]
              }
            ]
          }
        ]
      }
    ]
  } as MnxStructure);

  const voiceSession = (): EditorSession => {
    const session = new EditorSession(twoVoices());
    session.handleIntent({ type: 'setProjection', projection: 'notation' });
    return session;
  };

  it('the walk stays in the anchor voice where the voices share a line', () => {
    const session = voiceSession();
    session.handleIntent({ type: 'jumpDown' }); // into voice 1
    expect(session.cursor.voiceIndex).toBe(1);
    expect(session.selectedNoteKeys).toEqual(['@m0.v1.e0.n0']);
    session.handleIntent({ type: 'nextPosition' });
    // Voice 1's own next onset is 1/2 — voice 0's 1/4 belongs to a line the
    // cursor is not reading, however close it sits.
    expect(session.cursor.onset).toEqual({ num: 1, den: 2 });
    expect(session.selectedNoteKeys).toEqual(['@m0.v1.e1.n0']);
  });

  it('vertical movement adopts the voice it lands in', () => {
    const session = voiceSession();
    expect(session.cursor.voiceIndex ?? 0).toBe(0);
    session.handleIntent({ type: 'nextPosition' });
    session.handleIntent({ type: 'nextPosition' }); // voice 0's E4 at 1/2
    expect(session.selectedNoteKeys).toEqual(['@m0.v0.e2.n0']);
    // Climb onto voice 1's G5, sharing the onset: the selection says voice 1,
    // so the walk must too.
    for (let guard = 0; guard < 24 && session.selectedNoteKeys[0] !== '@m0.v1.e1.n0'; guard++) {
      session.handleIntent({ type: 'lineUp' });
    }
    expect(session.selectedNoteKeys).toEqual(['@m0.v1.e1.n0']);
    expect(session.cursor.voiceIndex).toBe(1);
  });

  it('a bar without the anchor voice falls back rather than stranding', () => {
    const session = voiceSession();
    session.handleIntent({ type: 'jumpDown' });
    expect(session.cursor.voiceIndex).toBe(1);
    session.handleIntent({ type: 'goToMeasure', measureIndex: 1 });
    // Bar 2 has one voice; the cursor addresses it rather than a voice that
    // is not there.
    expect(session.cursor.voiceIndex ?? 0).toBe(0);
    expect(session.selectedNoteKeys).toEqual(['@m1.v0.e0.n0']);
  });

  it('chord arrival picks the nearest staff position', () => {
    const session = notationSession();
    session.handleIntent({ type: 'goToMeasure', measureIndex: 4 });
    // Landed on the C-E-G chord; aim at C4 (p1).
    while (session.cursor.line > 1) session.handleIntent({ type: 'lineDown' });
    expect(session.cursorContext().occupied).toBe(true);
    session.handleIntent({ type: 'nextPosition' });
    // D-F-A chord: nearest to p1 is D4 at p2.
    expect(session.cursor.line).toBe(2);
  });

  it('Ctrl climb: bar jump in notation, voice jump vertically', () => {
    const session = notationSession();
    session.handleIntent({ type: 'jumpNext' });
    expect(session.cursor.measureIndex).toBe(1); // bar jump

    const back = notationSession(); // cursor on G4 (voice 0)
    expect(back.handleIntent({ type: 'jumpDown' })).toBe(true);
    expect(back.selectedNoteKeys).toEqual(['l6']); // E3, voice 1
    expect(back.handleIntent({ type: 'jumpUp' })).toBe(true);
    expect(back.cursor.line).toBe(3); // back to voice 0, nearest = E4
  });

  it('voice jump targets the SOUNDING event when onsets do not align', () => {
    const session = notationSession();
    session.handleIntent({ type: 'nextPosition' }); // 1/4 — A4; voice 1 is mid-note
    expect(session.handleIntent({ type: 'jumpDown' })).toBe(true);
    // Voice 1's E3 covers 1/4 (it started at 0) — land on its onset.
    expect(session.cursor.onset).toEqual({ num: 0, den: 1 });
    expect(session.selectedNoteKeys).toEqual(['l6']);
  });

  it('toggleNote adds at an empty cell, removes at an occupied one', () => {
    const session = notationSession();
    session.handleIntent({ type: 'lineDown' }); // p4 — empty (A4 seat is p6... p4 = F4)
    expect(session.handleIntent({ type: 'toggleNote' })).toBe(true);
    const chord = session.doc.parts[0].measures![0].sequences![0].content[0] as MnxEvent;
    expect(chord.notes!.map(n => `${n.pitch.step}${n.pitch.octave}`)).toContain('F4');
    expect(session.cursorContext().occupied).toBe(true);
    // Toggle off again — same cell, same gesture.
    expect(session.handleIntent({ type: 'toggleNote' })).toBe(true);
    const after = session.doc.parts[0].measures![0].sequences![0].content[0] as MnxEvent;
    expect(after.notes!.map(n => `${n.pitch.step}${n.pitch.octave}`)).not.toContain('F4');
  });

  it('toggleNote converts a rest bar and materializes an empty bar', () => {
    const session = notationSession();
    session.handleIntent({ type: 'goToMeasure', measureIndex: 2 }); // whole rest
    expect(session.handleIntent({ type: 'toggleNote' })).toBe(true);
    const m2 = session.doc.parts[0].measures![2].sequences![0].content[0] as MnxEvent;
    expect(m2.rest).toBeUndefined();
    expect(m2.notes).toHaveLength(1);

    session.handleIntent({ type: 'goToMeasure', measureIndex: 3 }); // empty content
    expect(session.handleIntent({ type: 'toggleNote' })).toBe(true);
    const m3 = session.doc.parts[0].measures![3].sequences![0];
    expect(m3.content.length).toBeGreaterThan(0); // note + the §8.11 rest padding
  });

  it('tighten after moving at event level snaps to the nearest chord member', () => {
    const session = notationSession(); // G4, p5
    session.handleIntent({ type: 'relaxSelection' }); // → event
    session.handleIntent({ type: 'nextPosition' }); // next grid stop: 1/4 (A4 only, p6)
    // The carried line (p5) hits no note here — Enter must still descend,
    // landing on the nearest member of the selected event.
    expect(session.handleIntent({ type: 'tightenSelection' })).toBe(true);
    expect(session.selectionLevel).toBe('note');
    expect(session.cursor.line).toBe(6);
    expect(session.selectedNoteKeys).toEqual(['l3']); // A4
  });

  it('undo-all round-trips the toggles byte-identically', () => {
    const session = notationSession();
    session.handleIntent({ type: 'lineDown' });
    session.handleIntent({ type: 'toggleNote' });
    session.handleIntent({ type: 'goToMeasure', measureIndex: 3 });
    session.handleIntent({ type: 'toggleNote' });
    while (session.canUndo) session.handleIntent({ type: 'undo' });
    expect(JSON.stringify(session.doc)).toBe(JSON.stringify(session.initial));
  });
});

describe('note-level navigation (tab projection)', () => {
  it('keeps the grid walk and string stickiness', () => {
    const session = new EditorSession(playground());
    expect(session.projection).toBe('tab');
    session.handleIntent({ type: 'lineDown' });
    const string = session.cursor.line;
    session.handleIntent({ type: 'nextPosition' });
    expect(session.cursor.line).toBe(string); // string-sticky
  });

  it('Ctrl ←→ is the bar jump in tab too (note-level review verdict)', () => {
    // The pure climb rule gave tab an event-skip; the hands-on review
    // overruled it — in single-voice music the grid IS the voice's events,
    // so event-skip read as bare → and the climb continues to the bar.
    const session = new EditorSession(playground());
    session.handleIntent({ type: 'jumpNext' });
    expect(session.cursor.measureIndex).toBe(1);
    session.handleIntent({ type: 'jumpPrev' });
    expect(session.cursor.measureIndex).toBe(0);
  });

  it('refuses the tab projection on a fingerboard-less document', () => {
    const doc = playground();
    delete doc.parts[0]._x;
    const session = new EditorSession(doc);
    expect(session.projection).toBe('notation');
    expect(session.handleIntent({ type: 'setProjection', projection: 'tab' })).toBe(false);
    expect(session.projection).toBe('notation');
  });
});

// The rungs ABOVE note (roadmap/complete/core-selection-ladder.md, the
// per-level navigation map). The vertical axis coarsens as the selection
// widens — line → voice → staff — and the horizontal climb reaches the section
// once the bar step is the rung's own move. Driven over the playground, which
// carries the two-voice bar, the second part and the two sections this needs.
describe('the per-level navigation map', () => {
  /** Widen to a rung, whatever the presence rule skips on the way. */
  const at = (level: SelectionLevel): EditorSession => {
    const session = notationSession();
    for (let guard = 0; guard < 8 && session.selectionLevel !== level; guard++) {
      session.handleIntent({ type: 'relaxSelection' });
    }
    expect(session.selectionLevel).toBe(level);
    return session;
  };

  it('event ↑↓ descends to the notehead; the voice stack is a climb away (the floor axis)', () => {
    const session = at('event');
    expect(session.selectedNoteKeys).toEqual(['l1', 'l2']); // voice 0's chord

    // The floor axis (core-selection-floor-axis.md): the vertical axis at
    // the floor is note-natured, so ↓ descends into the event's noteheads
    // rather than stepping the voice stack.
    expect(session.handleIntent({ type: 'lineDown' })).toBe(true);
    expect(session.selectionLevel).toBe('note');
    expect(session.selectedNoteKeys).toHaveLength(1);

    // The displaced voice jump, reachable from the descended notehead: the
    // Ctrl climb's voice step (the named cost the floor axis accepted).
    expect(session.handleIntent({ type: 'jumpDown' })).toBe(true);
    expect(session.cursor.voiceIndex).toBe(1);
    expect(session.selectedNoteKeys).toEqual(['l6']); // voice 1's event
  });

  it('event ←→ walks THIS voice’s events, not every column', () => {
    const session = at('event');
    session.handleIntent({ type: 'nextPosition' });
    expect(session.cursor.onset).toEqual({ num: 1, den: 4 });
    expect(session.selectedNoteKeys).toEqual(['l3']);
    session.handleIntent({ type: 'nextPosition' });
    expect(session.selectedNoteKeys).toEqual(['l4']);
  });

  it('voice-measure ↑↓ steps voices too — only the horizontal grain changed', () => {
    const session = at('voiceMeasure');
    expect(session.handleIntent({ type: 'lineDown' })).toBe(true);
    expect(session.cursor.voiceIndex).toBe(1);
    expect(session.selectedNoteKeys).toEqual(['l6', 'l7']); // voice 1's whole bar
  });

  it('part-measure ↑↓ walks the staves, and the BAR travels', () => {
    const session = at('partMeasure');
    session.handleIntent({ type: 'nextPosition' }); // bar 2, so the bar has something to keep
    expect(session.cursor.measureIndex).toBe(1);

    expect(session.handleIntent({ type: 'lineDown' })).toBe(true);
    expect(session.cursor.partIndex).toBe(1); // the rhythm part
    expect(session.cursor.measureIndex).toBe(1); // reading the same bar
    // The footprint follows the cursor's part — it used to stay on parts[0],
    // which no bare arrow could reach before this rung existed. (`r2` is the
    // rhythm part's bar-2 note; the lead part's are `l*`.)
    expect(session.selectedNoteKeys).toEqual(['r2']);

    expect(session.handleIntent({ type: 'lineDown' })).toBe(false); // the last staff
    expect(session.handleIntent({ type: 'lineUp' })).toBe(true);
    expect(session.cursor.partIndex ?? 0).toBe(0);
  });

  it('the tab projection follows only when the staff it lands on has no fingerboard', () => {
    const session = new EditorSession(playground()); // lead is a tab part
    expect(session.projection).toBe('tab');
    for (let guard = 0; guard < 8 && session.selectionLevel !== 'partMeasure'; guard++) {
      session.handleIntent({ type: 'relaxSelection' });
    }
    session.handleIntent({ type: 'lineDown' }); // → rhythm, notation only
    expect(session.projection).toBe('notation');
  });

  it('measure and score ↑↓ are the MOUNT’s — the session refuses both', () => {
    // "The neighbouring system" is a fact about the paint and "the next
    // document" one about the host; neither is visible from a DOM-free layer.
    for (const level of ['measure', 'score'] as SelectionLevel[]) {
      const session = at(level);
      expect(session.handleIntent({ type: 'lineDown' })).toBe(false);
      expect(session.handleIntent({ type: 'lineUp' })).toBe(false);
    }
  });

  it('section ↑↓ stays unbound, and ←→ walks section starts', () => {
    const session = at('section');
    expect(session.handleIntent({ type: 'lineDown' })).toBe(false);
    session.handleIntent({ type: 'nextPosition' });
    expect(session.cursor.measureIndex).toBe(4); // Intro → Verse
    session.handleIntent({ type: 'prevPosition' });
    expect(session.cursor.measureIndex).toBe(0);
  });

  it('Ctrl+←→ climbs from the bar to the SECTION once the bar is the rung’s own step', () => {
    for (const level of ['note', 'event'] as SelectionLevel[]) {
      const session = at(level);
      expect(session.handleIntent({ type: 'jumpNext' })).toBe(true);
      expect(session.cursor.measureIndex).toBe(1); // still the bar jump
    }
    for (const level of ['voiceMeasure', 'partMeasure', 'measure'] as SelectionLevel[]) {
      const session = at(level);
      expect(session.handleIntent({ type: 'jumpNext' })).toBe(true);
      expect(session.cursor.measureIndex).toBe(4); // Intro → Verse
      expect(session.handleIntent({ type: 'jumpNext' })).toBe(false); // no third section
    }
    // Nothing wider has a horizontal unit to climb to.
    expect(at('section').handleIntent({ type: 'jumpNext' })).toBe(false);
    expect(at('score').handleIntent({ type: 'jumpNext' })).toBe(false);
  });

  it('Ctrl+↑↓ climbs voice → staff, and dies at the component boundary', () => {
    expect(at('note').handleIntent({ type: 'jumpDown' })).toBe(true); // the voice

    const event = at('event');
    expect(event.handleIntent({ type: 'jumpDown' })).toBe(true); // the staff
    expect(event.cursor.partIndex).toBe(1);

    // part-measure's climb is the system jump — the mount's, like its bare row.
    expect(at('partMeasure').handleIntent({ type: 'jumpDown' })).toBe(false);
    expect(at('score').handleIntent({ type: 'jumpDown' })).toBe(false);
  });

  // The measure rung's ↑↓ and part-measure's Ctrl+↑↓ mean "the neighbouring
  // SYSTEM", which the session cannot see: `src/edit` imports only `src/model`,
  // and where the score wrapped is the layout's answer. The mount asks the
  // viewer and dispatches a resolved `goToMeasure`; the geometry it asks about
  // lives with the packing that decided it, and is pure — so it is testable
  // here, where the element's own resolution would need a browser.
  describe('the system rung’s geometry', () => {
    it('reads which bars landed on which system row', () => {
      initSmufl();
      const packing = planHorizontal(playground(), 60).packing;
      const rows = packedRowMeasures([packing], 1);
      expect(rows.length).toBeGreaterThan(1); // the playground wraps, by design
      expect(rows.flat()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]); // every bar, in order
    });

    it('preserves the COLUMN, clamping onto a shorter row', () => {
      // Text-editor line navigation over the bar-wrap grid: the same rule that
      // puts the caret at the end of a short line above.
      const rows = [
        [0, 1, 2, 3],
        [4, 5],
        [6, 7, 8, 9]
      ];
      expect(neighbourSystemMeasure(rows, 0, 1)).toBe(4);
      expect(neighbourSystemMeasure(rows, 1, 1)).toBe(5);
      expect(neighbourSystemMeasure(rows, 2, 1)).toBe(5); // clamped to the row's last bar
      expect(neighbourSystemMeasure(rows, 5, -1)).toBe(1);
      expect(neighbourSystemMeasure(rows, 9, -1)).toBe(5);
    });

    it('dies at the ends, and on a bar no system holds', () => {
      const rows = [
        [0, 1],
        [2, 3]
      ];
      expect(neighbourSystemMeasure(rows, 0, -1)).toBeNull();
      expect(neighbourSystemMeasure(rows, 3, 1)).toBeNull();
      // A hidden or out-of-range bar is one the reader cannot see.
      expect(neighbourSystemMeasure(rows, 9, 1)).toBeNull();
    });
  });

  it('the selection reads the cursor’s voice, not the ink under it', () => {
    // The bug this closes: stepping off ink left the cursor carrying voice 1
    // while the event slice silently repainted voice 0's event, because an
    // empty cell has no ink to derive a voice from.
    const session = notationSession();
    session.handleIntent({ type: 'jumpDown' }); // into voice 1
    expect(session.cursor.voiceIndex).toBe(1);
    session.handleIntent({ type: 'lineDown' });
    session.handleIntent({ type: 'lineDown' }); // empty staff positions below
    expect(session.selectedNoteKeys).toEqual([]); // no note at this cell — correct

    session.handleIntent({ type: 'relaxSelection' });
    expect(session.selectionLevel).toBe('event');
    expect(session.selectedNoteKeys).toEqual(['l6']); // voice 1's, as the cursor says
  });
});
