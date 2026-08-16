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

function containerDoc(): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{}] },
    parts: [
      {
        measures: [
          {
            sequences: [
              {
                content: [
                  {
                    type: 'tuplet',
                    inner: { multiple: 3, duration: { base: 'eighth' } },
                    outer: { multiple: 2, duration: { base: 'eighth' } },
                    content: [
                      {
                        duration: { base: 'eighth' },
                        notes: [note('inside-1', 'C', 5, 1)]
                      },
                      {
                        duration: { base: 'eighth' },
                        notes: [note('inside-2', 'D', 5, 1)]
                      }
                    ]
                  },
                  {
                    duration: { base: 'quarter' },
                    notes: [note('outside', 'E', 5, 1)]
                  }
                ]
              }
            ]
          }
        ],
        _x: { mnxLab: { strings: [...STANDARD_GUITAR_STRINGS] } }
      }
    ]
  };
}

function ensembleDoc(): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{ section: { label: 'All' } }] },
    parts: [
      {
        id: 'lead',
        measures: [
          { sequences: [{ content: [{ duration: { base: 'whole' }, notes: [note('lead', 'E', 4, 1)] }] }] }
        ],
        _x: { mnxLab: { strings: [...STANDARD_GUITAR_STRINGS] } }
      },
      {
        id: 'keys',
        staves: 2,
        measures: [
          {
            sequences: [
              { content: [{ duration: { base: 'whole' }, notes: [note('right', 'C', 5, 1)] }] },
              {
                staff: 2,
                content: [{ duration: { base: 'whole' }, notes: [note('left', 'C', 3, 1)] }]
              }
            ]
          }
        ]
      }
    ]
  };
}

function kitDoc(): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{}] },
    parts: [
      {
        kit: { snare: { staffPosition: 0 } },
        measures: [
          {
            sequences: [
              {
                content: [
                  {
                    duration: { base: 'whole' },
                    kitNotes: [{ kitComponent: 'snare' }]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  } as unknown as MnxStructure;
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

  it('keeps container children on the event rung and in every wider footprint', () => {
    const session = new EditorSession(containerDoc());
    expect(session.selectedNoteKeys).toEqual(['inside-1']);
    session.handleIntent(relax);
    expect(session.selectionLevel).toBe('event');
    expect(session.selectedNoteKeys).toEqual(['inside-1']);
    session.handleIntent(relax);
    expect(session.selectionLevel).toBe('voiceMeasure');
    expect(session.selectedNoteKeys).toEqual(['inside-1', 'inside-2', 'outside']);
  });

  it('makes global measure, section and score footprints cross every part and staff', () => {
    const session = new EditorSession(ensembleDoc());
    while (session.selectionLevel !== 'partMeasure') session.handleIntent(relax);
    expect(session.selectedNoteKeys).toEqual(['lead']);

    session.handleIntent(relax);
    expect(session.selectionLevel).toBe('measure');
    expect(session.selectedNoteKeys.sort()).toEqual(['lead', 'left', 'right']);
    session.handleIntent(relax);
    expect(session.selectionLevel).toBe('section');
    expect(session.selectedNoteKeys.sort()).toEqual(['lead', 'left', 'right']);
    session.handleIntent(relax);
    expect(session.selectionLevel).toBe('score');
    expect(session.selectedNoteKeys.sort()).toEqual(['lead', 'left', 'right']);
  });

  it('makes Delete obey the rung before the ink under the cursor', () => {
    const session = new EditorSession(makeDoc());
    while (session.selectionLevel !== 'measure') session.handleIntent(relax);
    const before = session.doc;
    expect(session.handleIntent({ type: 'delete' })).toBe(false);
    expect(session.doc).toEqual(before);
    expect(session.doc.parts[0].measures?.[0].sequences?.[0].content[0].notes).toHaveLength(2);
  });

  it('counts container children as ink when guarding bar removal', () => {
    const session = new EditorSession(containerDoc());
    while (session.selectionLevel !== 'measure') session.handleIntent(relax);
    expect(session.handleIntent({ type: 'delete' })).toBe(false);
    expect(session.selectedNoteKeys.sort()).toEqual(['inside-1', 'inside-2', 'outside']);
  });

  it('routes note-rung Delete through the kit-note operation for percussion', () => {
    const session = new EditorSession(kitDoc());
    expect(session.selectedNoteKeys).toEqual(['@m0.v0.e0.k0']);
    expect(session.handleIntent({ type: 'delete' })).toBe(true);
    const event = session.doc.parts[0].measures?.[0].sequences?.[0].content[0] as {
      kitNotes?: unknown[];
    };
    expect(event.kitNotes).toBeUndefined();
  });

  it('removes the addressed empty part at score level and clamps the cursor', () => {
    const doc = ensembleDoc();
    doc.parts[1].measures![0].sequences = [];
    const session = new EditorSession(doc);
    expect(session.handleIntent({ type: 'setPart', partIndex: 1 })).toBe(true);
    while (session.selectionLevel !== 'score') session.handleIntent(relax);
    expect(session.handleIntent({ type: 'delete' })).toBe(true);
    expect(session.doc.parts.map(part => part.id)).toEqual(['lead']);
    expect(session.cursor.partIndex).toBeUndefined();
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

  it('the cursor follows a transpose across a staff line (C#→D moves, C→C# does not)', () => {
    const session = new EditorSession(makeDoc());
    session.handleIntent({ type: 'setProjection', projection: 'notation' });
    // The cursor sits on n1 (E4); its notation line is the staff position.
    const before = session.cursor.line;
    expect(session.selectedNoteKeys).toEqual(['n1']);

    // E4 → F4: the letter changes, the notehead moves one staff step, and
    // the cursor must move WITH it — not stay behind on the empty line.
    session.handleIntent({ type: 'transpose', semitones: 1 });
    expect(session.cursor.line).toBe(before + 1);
    expect(session.selectedNoteKeys).toEqual(['n1']);

    // F4 → F#4: same letter, same staff position — the cursor holds still.
    session.handleIntent({ type: 'transpose', semitones: 1 });
    expect(session.cursor.line).toBe(before + 1);
    expect(session.selectedNoteKeys).toEqual(['n1']);
  });

  it('replays through a trace: ladder intents are recorded like any navigation', () => {
    const session = new EditorSession(makeDoc());
    session.handleIntent(relax);
    session.handleIntent(relax);
    expect(session.trace().intents).toEqual([relax, relax]);
  });
});
