// The selection ladder (roadmap/inprogress/core-selection-ladder.md), phase 1:
// relax/tighten walk the containment chain with the presence rule, the
// footprint paints exactly the rung's notes, bare arrows move by the rung's
// unit, and a mutation re-anchors the selection at the note.
import { describe, it, expect } from 'vitest';
import { EditorSession } from '../../src/edit/session.ts';
import type {
  MnxNote,
  MnxPartMeasure,
  MnxPitch,
  MnxStructure
} from '../../src/model/mnx.ts';
import { STANDARD_GUITAR_STRINGS } from '../../src/model/mnx.ts';

const note = (
  id: string,
  step: MnxPitch['step'],
  octave: number,
  string: number
): MnxNote => ({ id, pitch: { step, octave }, _x: { mnxLab: { string } } });

/**
 * Three bars of a tab part:
 *  m0 — voice 0: a two-note quarter chord (n1, n2) then a quarter (n3), the
 *       bar unfilled past 1/2 (entry ghost); voice 1: a half note (n4).
 *  m1 — a whole rest (an event, but no note — the note rung is absent).
 *  m2 — empty (no sequences — voice/event/note rungs all absent).
 */
function makeDoc(withSections = false): MnxStructure {
  const measures: MnxPartMeasure[] = [
    {
      sequences: [
        {
          content: [
            { duration: { base: 'quarter' }, notes: [note('n1', 'E', 4, 1), note('n2', 'B', 3, 2)] },
            { duration: { base: 'quarter' }, notes: [note('n3', 'G', 4, 1)] }
          ]
        },
        { content: [{ duration: { base: 'half' }, notes: [note('n4', 'G', 3, 3)] }] }
      ]
    },
    { sequences: [{ content: [{ duration: { base: 'whole' }, rest: {} }] }] },
    { sequences: [] }
  ];
  return {
    mnx: { version: 1 },
    global: {
      measures: [
        withSections ? { section: { label: 'Intro' } } : {},
        {},
        withSections ? { section: { label: 'Verse' } } : {}
      ]
    },
    parts: [
      {
        id: 'p1',
        measures,
        _x: { mnxLab: { strings: [...STANDARD_GUITAR_STRINGS] } }
      }
    ]
  };
}

const relax = { type: 'relaxSelection' } as const;
const tighten = { type: 'tightenSelection' } as const;

describe('selection ladder', () => {
  it('relaxes note → event → voiceMeasure → partMeasure → measure → score, painting each rung', () => {
    const session = new EditorSession(makeDoc());
    expect(session.selectionLevel).toBe('note');
    expect(session.selectedNoteKeys).toEqual(['n1']);

    const walk: [string, string[]][] = [
      ['event', ['n1', 'n2']],
      ['voiceMeasure', ['n1', 'n2', 'n3']],
      ['partMeasure', ['n1', 'n2', 'n3', 'n4']],
      ['measure', ['n1', 'n2', 'n3', 'n4']],
      ['score', ['n1', 'n2', 'n3', 'n4']]
    ];
    for (const [level, keys] of walk) {
      expect(session.handleIntent(relax)).toBe(true);
      expect(session.selectionLevel).toBe(level);
      expect(session.selectedNoteKeys.sort()).toEqual(keys);
    }

    // Past the top the session refuses — the mount turns that into deselect.
    expect(session.handleIntent(relax)).toBe(false);
    expect(session.selectionLevel).toBe('score');
  });

  it('tightens back down the same chain — the cursor is the breadcrumb', () => {
    const session = new EditorSession(makeDoc());
    for (let i = 0; i < 5; i++) session.handleIntent(relax);
    const down = ['measure', 'partMeasure', 'voiceMeasure', 'event', 'note'];
    for (const level of down) {
      expect(session.handleIntent(tighten)).toBe(true);
      expect(session.selectionLevel).toBe(level);
    }
    expect(session.selectedNoteKeys).toEqual(['n1']);
    // At the bottom, tighten refuses (Enter's future job is to begin input).
    expect(session.handleIntent(tighten)).toBe(false);
  });

  it('skips the note rung under a rest — presence rule', () => {
    const session = new EditorSession(makeDoc());
    session.handleIntent({ type: 'goToMeasure', measureIndex: 1 });
    expect(session.selectedNoteKeys).toEqual([]); // no note to paint
    expect(session.handleIntent(relax)).toBe(true);
    expect(session.selectionLevel).toBe('event'); // the rest IS an event
    expect(session.handleIntent(tighten)).toBe(false); // no note below it
    expect(session.selectionLevel).toBe('event');
  });

  it('skips note, event AND voiceMeasure in an empty measure', () => {
    const session = new EditorSession(makeDoc());
    session.handleIntent({ type: 'goToMeasure', measureIndex: 2 });
    expect(session.handleIntent(relax)).toBe(true);
    expect(session.selectionLevel).toBe('partMeasure');
  });

  it('offers the section rung only when section labels exist, spanning to the next label', () => {
    const plain = new EditorSession(makeDoc(false));
    for (let i = 0; i < 5; i++) plain.handleIntent(relax);
    expect(plain.selectionLevel).toBe('score'); // no sections → rung absent

    const session = new EditorSession(makeDoc(true));
    for (let i = 0; i < 5; i++) session.handleIntent(relax);
    expect(session.selectionLevel).toBe('section'); // Intro: m0..m1
    expect(session.selectedNoteKeys.sort()).toEqual(['n1', 'n2', 'n3', 'n4']);
    expect(session.handleIntent(relax)).toBe(true);
    expect(session.selectionLevel).toBe('score');
  });

  it('moves by the rung unit: positions at note level, bars at measure level, sections at section level', () => {
    const session = new EditorSession(makeDoc(true));
    session.handleIntent({ type: 'nextPosition' });
    expect(session.cursor.measureIndex).toBe(0);
    expect(session.cursor.onset).toEqual({ num: 1, den: 4 });
    session.handleIntent({ type: 'prevPosition' });

    for (let i = 0; i < 4; i++) session.handleIntent(relax); // → measure
    session.handleIntent({ type: 'nextPosition' });
    expect(session.cursor.measureIndex).toBe(1);
    session.handleIntent({ type: 'prevPosition' });

    session.handleIntent(relax); // → section
    session.handleIntent({ type: 'nextPosition' });
    expect(session.cursor.measureIndex).toBe(2); // Intro → Verse
    session.handleIntent({ type: 'prevPosition' });
    expect(session.cursor.measureIndex).toBe(0);

    session.handleIntent(relax); // → score
    expect(session.handleIntent({ type: 'nextPosition' })).toBe(false);
  });

  it('a mutation re-anchors the selection at the note', () => {
    const session = new EditorSession(makeDoc());
    for (let i = 0; i < 4; i++) session.handleIntent(relax); // → measure
    expect(session.selectionLevel).toBe('measure');
    session.handleIntent({ type: 'fretDigit', digit: 5 });
    expect(session.selectionLevel).toBe('note');
    expect(session.selectedNoteKeys).toEqual(['n1']);
  });

  it('replays through a trace: ladder intents are recorded like any navigation', () => {
    const session = new EditorSession(makeDoc());
    session.handleIntent(relax);
    session.handleIntent(relax);
    expect(session.trace().intents).toEqual([relax, relax]);
  });
});
