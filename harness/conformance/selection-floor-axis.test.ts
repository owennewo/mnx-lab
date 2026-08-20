// The selection floor axis (roadmap: core-selection-floor-axis.md): below
// the event rung there is no temporal extent, so the gesture's axis picks
// the rung — horizontal gestures re-level to the event rung, and ↑/↓ at the
// event rung descends into its noteheads. The invariant this file exists to
// pin: a note selection is always exactly one notehead.
import { describe, expect, it } from 'vitest';
import { EditorSession, replayIntents } from '../../src/edit/session.ts';
import type { EditorIntent } from '../../src/edit/intents.ts';
import type { MnxNote, MnxPitch, MnxStructure } from '../../src/model/mnx.ts';
import { STANDARD_GUITAR_STRINGS } from '../../src/model/mnx.ts';

const note = (
  id: string,
  step: MnxPitch['step'],
  octave: number,
  string: number
): MnxNote => ({ id, pitch: { step, octave }, _x: { mnxLab: { string } } });

/** m0: a two-note chord (strings 1+2) then a single; m1: a whole rest. */
function makeDoc(): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{}, {}] },
    parts: [{
      id: 'p1',
      measures: [
        {
          sequences: [{
            content: [
              { duration: { base: 'quarter' }, notes: [note('n1', 'E', 4, 1), note('n2', 'B', 3, 2)] },
              { duration: { base: 'quarter' }, notes: [note('n3', 'G', 4, 1)] }
            ]
          }]
        },
        { sequences: [{ content: [{ duration: { base: 'whole' }, rest: {} }] }] }
      ],
      _x: { mnxLab: { strings: [...STANDARD_GUITAR_STRINGS] } }
    }]
  };
}

describe('the selection floor axis', () => {
  it('the invariant: a note selection is always exactly one notehead', () => {
    // Every gesture that used to widen the note rung now leaves it instead.
    const widenings: EditorIntent[] = [
      { type: 'extendSelection', direction: 'next' },
      { type: 'extendSelection', direction: 'previous' },
      { type: 'extendSelection', direction: 'end' },
      { type: 'closeSelection' }
    ];
    for (const intent of widenings) {
      const session = new EditorSession(makeDoc());
      expect(session.selectionLevel).toBe('note');
      session.handleIntent(intent);
      expect(session.selectionLevel, JSON.stringify(intent)).toBe('event');
    }

    // And gestures that keep the note rung keep it single-membered.
    const walks: EditorIntent[] = [
      { type: 'nextPosition' },
      { type: 'prevPosition' },
      { type: 'lineDown' },
      { type: 'lineUp' },
      { type: 'jumpNext' },
      { type: 'cycleSlot' }
    ];
    const session = new EditorSession(makeDoc());
    for (const intent of walks) {
      session.handleIntent(intent);
      if (session.selectionLevel === 'note') {
        expect(session.resolvedSelection.members.length,
          JSON.stringify(intent)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('the first Shift press grows the notehead into its own ONE event', () => {
    const session = new EditorSession(makeDoc());
    expect(session.selectedNoteKeys).toEqual(['n1']); // one chord member

    expect(session.handleIntent({ type: 'extendSelection', direction: 'next' })).toBe(true);
    expect(session.selectionLevel).toBe('event');
    expect(session.selectedNoteKeys).toEqual(['n1', 'n2']); // the whole chord — one event, never two

    expect(session.handleIntent({ type: 'extendSelection', direction: 'next' })).toBe(true);
    expect(session.selectedNoteKeys).toEqual(['n1', 'n2', 'n3']); // now it extends
  });

  it('↑/↓ at the event rung descends to the notehead, then walks lines', () => {
    const session = new EditorSession(makeDoc());
    session.handleIntent({ type: 'relaxSelection' }); // → event (the chord)
    expect(session.selectedNoteKeys).toEqual(['n1', 'n2']);

    expect(session.handleIntent({ type: 'lineDown' })).toBe(true);
    expect(session.selectionLevel).toBe('note');
    expect(session.selectedNoteKeys).toEqual(['n1']); // nearest to the carried line

    expect(session.handleIntent({ type: 'lineDown' })).toBe(true);
    expect(session.selectedNoteKeys).toEqual(['n2']); // the note rung's own line walk
  });

  it('a rest event has no noteheads: descent is inert, not an error', () => {
    const session = new EditorSession(makeDoc());
    session.handleIntent({ type: 'relaxSelection' }); // → event
    session.handleIntent({ type: 'goToMeasure', measureIndex: 1 }); // the whole rest
    expect(session.cursor.measureIndex).toBe(1);
    expect(session.handleIntent({ type: 'lineDown' })).toBe(false);
    expect(session.selectionLevel).toBe('event');
  });

  it('the re-leveling gestures replay deterministically as ordinary intents', () => {
    const doc = makeDoc();
    const session = new EditorSession(doc);
    const storm: EditorIntent[] = [
      { type: 'extendSelection', direction: 'next' },
      { type: 'extendSelection', direction: 'next' },
      { type: 'relaxSelection' },
      { type: 'closeSelection' },
      { type: 'lineDown' }
    ];
    for (const intent of storm) session.handleIntent(intent);
    const replay = replayIntents(doc, session.trace().intents);
    expect(replay.selection).toEqual(session.selection);
    expect(replay.doc).toEqual(session.doc);
  });
});
