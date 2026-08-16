// The selection ladder (roadmap/complete/core-selection-ladder.md), phase 1:
// relax/tighten walk the containment chain with the presence rule, the
// footprint paints exactly the rung's notes, bare arrows move by the rung's
// unit, and a mutation re-anchors the selection at the note.
import { describe, it, expect } from 'vitest';
import { EditorSession } from '../../src/edit/session.ts';
import {
  pointSelection,
  resolveSelection,
  type SelectionState
} from '../../src/edit/selection.ts';
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

  it('adds the owning container between its child event and voice bar', () => {
    const session = new EditorSession(containerDoc());
    expect(session.selectedNoteKeys).toEqual(['inside-1']);
    session.handleIntent(relax);
    expect(session.selectionLevel).toBe('event');
    expect(session.selectedNoteKeys).toEqual(['inside-1']);
    session.handleIntent(relax);
    expect(session.selectionLevel).toBe('container');
    expect(session.resolvedSelection.members).toMatchObject([
      { kind: 'container', containerType: 'tuplet', sequenceIndex: 0, eventIndex: 0 }
    ]);
    expect(session.selectedNoteKeys).toEqual(['inside-1', 'inside-2']);
    session.handleIntent(relax);
    expect(session.selectionLevel).toBe('voiceMeasure');
    expect(session.selectedNoteKeys).toEqual(['inside-1', 'inside-2', 'outside']);
  });

  it('walks and ranges by authored containers, not by their child events', () => {
    const doc = containerDoc();
    doc.parts[0].measures![0].sequences[0].content.push({
      type: 'grace',
      content: [{ duration: { base: 'eighth' }, notes: [note('grace', 'F', 5, 1)] }]
    });
    const session = new EditorSession(doc);
    session.handleIntent(relax); // event
    session.handleIntent(relax); // container
    expect(session.selectionLevel).toBe('container');
    expect(session.selectedNoteKeys).toEqual(['inside-1', 'inside-2']);

    expect(session.handleIntent({ type: 'extendSelection', direction: 'next' })).toBe(true);
    expect(session.resolvedSelection.members.map(member =>
      member.kind === 'container' ? member.containerType : null
    )).toEqual(['tuplet', 'grace']);
    expect(session.selectedNoteKeys).toEqual(['inside-1', 'inside-2', 'grace']);

    expect(session.handleIntent({ type: 'prevPosition' })).toBe(true); // collapse to first edge
    expect(session.handleIntent({ type: 'nextPosition' })).toBe(true);
    expect(session.selectedNoteKeys).toEqual(['grace']);
  });

  it('clears an event to an equal-duration rest and unlinks its ink', () => {
    const doc = makeDoc();
    const measure = doc.parts[0].measures![0];
    const first = measure.sequences[0].content[0] as {
      id?: string; lyrics?: object; markings?: object; slurs?: object[]
    };
    const second = measure.sequences[0].content[1] as { id?: string; slurs?: object[] };
    first.id = 'e1';
    first.lyrics = { lines: { '1': { text: 'word' } } };
    first.markings = { staccato: {} };
    second.id = 'e2';
    second.slurs = [{ target: 'e1', startNote: 'n3', endNote: 'n1' }];
    measure.beams = [{ events: ['e1', 'e2'] }];

    const session = new EditorSession(doc);
    session.handleIntent(relax); // event
    expect(session.handleIntent({ type: 'delete' })).toBe(true);
    const cleared = session.doc.parts[0].measures![0].sequences[0].content[0] as {
      duration: object; notes?: unknown[]; rest?: object; lyrics?: object; markings?: object
    };
    expect(cleared.duration).toEqual({ base: 'quarter' });
    expect(cleared).toMatchObject({ rest: {} });
    expect(cleared.notes).toBeUndefined();
    expect(cleared.lyrics).toBeUndefined();
    expect(cleared.markings).toBeUndefined();
    expect(session.doc.parts[0].measures![0].beams).toBeUndefined();
    expect((session.doc.parts[0].measures![0].sequences[0].content[1] as { slurs?: unknown[] }).slurs)
      .toBeUndefined();
    expect(session.selectionLevel).toBe('event');
  });

  it('deletes an empty container, but refuses one that still owns ink', () => {
    const session = new EditorSession(containerDoc());
    session.handleIntent(relax); // event
    session.handleIntent(relax); // container
    expect(session.handleIntent({ type: 'delete' })).toBe(false);

    session.handleIntent(tighten); // first child event
    expect(session.handleIntent({ type: 'delete' })).toBe(true);
    expect(session.handleIntent({ type: 'nextPosition' })).toBe(true);
    expect(session.handleIntent({ type: 'delete' })).toBe(true);
    session.handleIntent(relax); // container
    expect(session.selectionLevel).toBe('container');
    expect(session.handleIntent({ type: 'delete' })).toBe(true);
    expect(session.selectionLevel).toBe('voiceMeasure');
    expect((session.doc.parts[0].measures![0].sequences[0].content[0] as { type?: string }).type)
      .toBeUndefined();
  });

  it('keeps a cleared grace event distinct from its coincident host', () => {
    const doc = containerDoc();
    doc.parts[0].measures![0].sequences[0].content[0] = {
      type: 'grace',
      content: [{ duration: { base: 'eighth' }, notes: [note('grace', 'E', 5, 1)] }]
    };
    const session = new EditorSession(doc);
    session.handleIntent(relax); // grace child event; pins the coincident event identity
    expect(session.handleIntent({ type: 'delete' })).toBe(true);
    expect(session.selectionLevel).toBe('event');
    expect(session.selectedNoteKeys).toEqual([]);
    session.handleIntent(relax);
    expect(session.selectionLevel).toBe('container');
    expect(session.handleIntent({ type: 'delete' })).toBe(true);
    expect(session.selectionLevel).toBe('voiceMeasure');
    expect(session.selectedNoteKeys).toEqual(['outside']);
  });

  it('guards voice/staff bar removal by ink and repairs to the surviving ancestor', () => {
    const voice = new EditorSession(makeDoc());
    while (voice.selectionLevel !== 'voiceMeasure') voice.handleIntent(relax);
    expect(voice.handleIntent({ type: 'delete' })).toBe(false);
    voice.handleIntent({ type: 'goToMeasure', measureIndex: 1 });
    while (voice.selectionLevel !== 'voiceMeasure') voice.handleIntent(relax);
    expect(voice.handleIntent({ type: 'delete' })).toBe(true);
    expect(voice.doc.parts[0].measures![1].sequences).toEqual([]);
    expect(voice.selectionLevel).toBe('partMeasure');

    const staff = new EditorSession(makeDoc());
    staff.handleIntent({ type: 'goToMeasure', measureIndex: 1 });
    while (staff.selectionLevel !== 'partMeasure') staff.handleIntent(relax);
    expect(staff.handleIntent({ type: 'delete' })).toBe(true);
    expect(staff.doc.parts[0].measures![1]).toEqual({ sequences: [] });
    expect(staff.selectionLevel).toBe('partMeasure');
  });

  it('deletes a section boundary without deleting any bars', () => {
    const session = new EditorSession(makeDoc(true));
    while (session.selectionLevel !== 'section') session.handleIntent(relax);
    expect(session.handleIntent({ type: 'delete' })).toBe(true);
    expect(session.doc.global.measures).toHaveLength(3);
    expect(session.doc.global.measures[0].section).toBeUndefined();
    expect(session.doc.global.measures[2].section?.label).toBe('Verse');
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
    expect(session.trace().expect.selection).toEqual(session.selection);
  });

  it('stores a point selection as two cursor edges and follows ordinary navigation', () => {
    const session = new EditorSession(makeDoc());
    expect(session.selection).toEqual(pointSelection('note', session.cursor));
    session.handleIntent({ type: 'nextPosition' });
    expect(session.selection.anchor).toEqual(session.cursor);
    expect(session.selection.extent).toEqual({ kind: 'cursor', cursor: session.cursor });
  });

  it('resolves forward and reversed note ranges to the same ordered membership', () => {
    const doc = makeDoc();
    const left = { measureIndex: 0, onset: { num: 0, den: 1 }, line: 1 };
    const right = { measureIndex: 0, onset: { num: 1, den: 4 }, line: 1 };
    const forward: SelectionState = {
      level: 'note',
      anchor: left,
      extent: { kind: 'cursor', cursor: right }
    };
    const reversed: SelectionState = {
      level: 'note',
      anchor: right,
      extent: { kind: 'cursor', cursor: left }
    };
    const a = resolveSelection(doc, forward, 'tab');
    const b = resolveSelection(doc, reversed, 'tab');
    expect(a.members).toEqual(b.members);
    expect(a.noteKeys).toEqual(['n1', 'n2', 'n3']);
    expect(b.noteKeys).toEqual(a.noteKeys);
  });

  it('resolves voice closures live across rests, sparse voices and document edits', () => {
    const doc = makeDoc();
    const state: SelectionState = {
      level: 'event',
      anchor: { measureIndex: 0, onset: { num: 0, den: 1 }, line: 1 },
      extent: { kind: 'closure', scope: 'voice' }
    };
    let resolved = resolveSelection(doc, state, 'tab');
    expect(resolved.members).toHaveLength(3); // two pitched events + the whole rest
    expect(resolved.noteKeys).toEqual(['n1', 'n2', 'n3']);

    doc.parts[0].measures![2].sequences = [{
      content: [{ duration: { base: 'whole' }, notes: [note('n5', 'A', 4, 1)] }]
    }];
    resolved = resolveSelection(doc, state, 'tab');
    expect(resolved.members).toHaveLength(4);
    expect(resolved.noteKeys).toEqual(['n1', 'n2', 'n3', 'n5']);

    const sparse: SelectionState = {
      level: 'event',
      anchor: { measureIndex: 0, onset: { num: 0, den: 1 }, line: 3, voiceIndex: 1 },
      extent: { kind: 'closure', scope: 'voice' }
    };
    expect(resolveSelection(doc, sparse, 'tab').noteKeys).toEqual(['n4']);
  });

  it('keeps container children as distinct structural event members', () => {
    const state: SelectionState = {
      level: 'event',
      anchor: { measureIndex: 0, onset: { num: 0, den: 1 }, line: 1 },
      extent: { kind: 'closure', scope: 'voice' }
    };
    const resolved = resolveSelection(containerDoc(), state, 'tab');
    expect(resolved.members).toHaveLength(3);
    expect(resolved.members.map(member => member.kind === 'event' ? member.containerIndex : null))
      .toEqual([0, 1, undefined]);
    expect(resolved.noteKeys).toEqual(['inside-1', 'inside-2', 'outside']);
  });

  it('represents empty multi-staff bar copies structurally while global ink crosses parts', () => {
    const doc = ensembleDoc();
    doc.global!.measures!.push({});
    const partClosure: SelectionState = {
      level: 'partMeasure',
      anchor: {
        measureIndex: 0,
        onset: { num: 0, den: 1 },
        line: 0,
        partIndex: 1
      },
      extent: { kind: 'closure', scope: 'part' }
    };
    const part = resolveSelection(doc, partClosure, 'notation');
    expect(part.members).toHaveLength(4); // two staves × two bars, including both empty copies
    expect(part.noteKeys.sort()).toEqual(['left', 'right']);

    const timeline: SelectionState = {
      level: 'measure',
      anchor: { measureIndex: 0, onset: { num: 0, den: 1 }, line: 0 },
      extent: { kind: 'closure', scope: 'timeline' }
    };
    const global = resolveSelection(doc, timeline, 'notation');
    expect(global.members).toEqual([
      { kind: 'measure', measureIndex: 0 },
      { kind: 'measure', measureIndex: 1 }
    ]);
    expect(global.noteKeys.sort()).toEqual(['lead', 'left', 'right']);
  });

  it('clamps a removed concrete range endpoint to the last surviving member', () => {
    const doc = makeDoc();
    const state: SelectionState = {
      level: 'note',
      anchor: { measureIndex: 0, onset: { num: 0, den: 1 }, line: 1 },
      extent: {
        kind: 'cursor',
        cursor: { measureIndex: 0, onset: { num: 1, den: 4 }, line: 1 }
      }
    };
    doc.parts[0].measures![0].sequences![0].content[1] = {
      duration: { base: 'quarter' },
      rest: {}
    };
    expect(resolveSelection(doc, state, 'tab').noteKeys).toEqual(['n1', 'n2']);
  });

  it('keeps point membership invariant when the active projection changes', () => {
    const session = new EditorSession(makeDoc());
    const before = session.selectedNoteKeys;
    expect(session.handleIntent({ type: 'setProjection', projection: 'notation' })).toBe(true);
    expect(session.selectedNoteKeys).toEqual(before);
    expect(session.selection.anchor).toEqual(session.cursor);
  });

  it('extends from a fixed anchor, reverses through it, and keeps the cursor at the active edge', () => {
    const doc = makeDoc();
    doc.parts[0].measures![0].sequences![0].content.push({
      duration: { base: 'quarter' },
      notes: [note('n6', 'A', 4, 1)]
    });
    const session = new EditorSession(doc);
    session.handleIntent({ type: 'nextPosition' }); // n3 — the middle position
    const anchor = session.cursor;

    expect(session.handleIntent({ type: 'extendSelection', direction: 'previous' })).toBe(true);
    expect(session.selection.anchor).toEqual(anchor);
    expect(session.selectedNoteKeys).toEqual(['n1', 'n2', 'n3']);

    expect(session.handleIntent({ type: 'extendSelection', direction: 'next' })).toBe(true);
    expect(session.selection.extent).toEqual({ kind: 'cursor', cursor: anchor });
    expect(session.handleIntent({ type: 'extendSelection', direction: 'next' })).toBe(true);
    expect(session.selection.anchor).toEqual(anchor); // fixed while the active edge crosses it
    expect(session.selection.extent).toEqual({ kind: 'cursor', cursor: session.cursor });
    expect(session.selectedNoteKeys).toEqual(['n3', 'n6']);
  });

  it('Shift+End reaches the last concrete member, skipping note ghosts but retaining event rests', () => {
    const notes = new EditorSession(makeDoc());
    expect(notes.handleIntent({ type: 'extendSelection', direction: 'end' })).toBe(true);
    expect(notes.cursor.measureIndex).toBe(0); // m1 is a rest; m2 is empty
    expect(notes.selectedNoteKeys).toEqual(['n1', 'n2', 'n3']);

    const events = new EditorSession(makeDoc());
    events.handleIntent(relax); // event
    expect(events.handleIntent({ type: 'extendSelection', direction: 'end' })).toBe(true);
    expect(events.cursor.measureIndex).toBe(1); // the rest is a real event
    expect(events.resolvedSelection.members).toHaveLength(3);
  });

  it('closes at the rung scope and remaps that live scope through the ladder', () => {
    const session = new EditorSession(makeDoc());
    expect(session.handleIntent({ type: 'closeSelection' })).toBe(true);
    expect(session.selection.extent).toEqual({ kind: 'closure', scope: 'voice' });
    expect(session.selectedNoteKeys).toEqual(['n1', 'n2', 'n3']);
    expect(session.handleIntent({ type: 'extendSelection', direction: 'previous' })).toBe(false);
    expect(session.selection.extent).toEqual({ kind: 'closure', scope: 'voice' });

    session.handleIntent(relax); // event: still voice scope
    expect(session.selection.extent).toEqual({ kind: 'closure', scope: 'voice' });
    session.handleIntent(relax); // voice-measure: still voice scope
    session.handleIntent(relax); // part-measure: fork to part scope
    expect(session.selection.extent).toEqual({ kind: 'closure', scope: 'part' });
    session.handleIntent(relax); // measure: global timeline
    expect(session.selection.extent).toEqual({ kind: 'closure', scope: 'timeline' });
    while (session.selectionLevel !== 'score') session.handleIntent(relax);
    expect(session.selection.extent).toEqual({ kind: 'closure', scope: 'score' });
    expect(session.handleIntent({ type: 'closeSelection' })).toBe(false); // idempotent limit
  });

  it('bare horizontal arrows collapse a range to the requested edge before navigating', () => {
    const right = new EditorSession(makeDoc());
    right.handleIntent({ type: 'extendSelection', direction: 'next' });
    const rightEdge = right.cursor;
    expect(right.handleIntent({ type: 'prevPosition' })).toBe(true);
    expect(right.cursor.measureIndex).toBe(0);
    expect(right.cursor.onset).toEqual({ num: 0, den: 1 });
    expect(right.selection).toEqual(pointSelection('note', right.cursor));

    const left = new EditorSession(makeDoc());
    left.handleIntent({ type: 'extendSelection', direction: 'next' });
    expect(left.handleIntent({ type: 'nextPosition' })).toBe(true);
    expect(left.cursor).toEqual(rightEdge); // collapsed; did not navigate again
    expect(left.handleIntent({ type: 'nextPosition' })).toBe(true);
    expect(left.cursor.onset).toEqual({ num: 1, den: 2 }); // the following press reaches the entry ghost

    const closure = new EditorSession(makeDoc());
    closure.handleIntent({ type: 'closeSelection' });
    const active = closure.cursor;
    expect(closure.handleIntent({ type: 'nextPosition' })).toBe(true);
    expect(closure.cursor).toEqual(active);
    expect(closure.selection).toEqual(pointSelection('note', active));
  });

  it('preserves a concrete range and both endpoints across projection changes', () => {
    const session = new EditorSession(makeDoc());
    session.handleIntent({ type: 'extendSelection', direction: 'next' });
    const keys = session.selectedNoteKeys;
    const before = session.selection;
    expect(session.handleIntent({ type: 'setProjection', projection: 'notation' })).toBe(true);
    expect(session.selectedNoteKeys).toEqual(keys);
    expect(session.selection.anchor.measureIndex).toBe(before.anchor.measureIndex);
    expect(session.selection.extent.kind).toBe('cursor');
    expect(session.selection.extent.kind === 'cursor' && session.selection.extent.cursor)
      .toEqual(session.cursor);
  });

  it('records range and closure gestures as intents and asserts the final state', () => {
    const session = new EditorSession(makeDoc());
    const gestures = [
      { type: 'extendSelection', direction: 'next' },
      { type: 'closeSelection' }
    ] as const;
    gestures.forEach(intent => session.handleIntent(intent));
    expect(session.trace().intents).toEqual(gestures);
    expect(session.trace().expect.selection).toEqual(session.selection);
    expect(session.selection.extent).toEqual({ kind: 'closure', scope: 'voice' });
  });
});
