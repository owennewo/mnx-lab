import { describe, expect, it } from 'vitest';
import { extractSelectionClip } from '../../src/edit/selectionClipExtraction.ts';
import type { EditorCursor } from '../../src/edit/cursor.ts';
import type { SelectionLevel, SelectionState } from '../../src/edit/selection.ts';
import type { MnxNote, MnxStructure } from '../../src/model/mnx.ts';
import { STANDARD_GUITAR_STRINGS } from '../../src/model/mnx.ts';

function note(id: string, step: MnxNote['pitch']['step']): MnxNote {
  return {
    id,
    pitch: { step, octave: 4 },
    _x: { mnxLab: { string: 1 } }
  };
}

function cursor(
  measureIndex: number,
  num = 0,
  den = 1,
  extra: Partial<EditorCursor> = {}
): EditorCursor {
  return { measureIndex, onset: { num, den }, line: 1, ...extra };
}

function point(level: SelectionLevel, at: EditorCursor): SelectionState {
  return { level, anchor: at, extent: { kind: 'cursor', cursor: { ...at, onset: { ...at.onset } } } };
}

function closure(level: SelectionLevel, at: EditorCursor): SelectionState {
  const scope = level === 'partMeasure'
    ? 'part'
    : level === 'measure'
      ? 'timeline'
      : level === 'document'
        ? 'document'
        : 'voice';
  return { level, anchor: at, extent: { kind: 'closure', scope } };
}

function score(): MnxStructure {
  const first = note('n1', 'C');
  first.ties = [{ target: 'n2' }];
  first._x!.mnxLab!.tab = {
    technique: { hammerOn: { target: 'n2' } }
  };
  return {
    mnx: { version: 1, support: { useAccidentalDisplay: true, useBeams: true } },
    global: {
      measures: [
        { id: 'm0', key: { fifths: 2 }, time: { count: 4, unit: 4 }, section: { label: 'A' } },
        { id: 'm1' },
        { id: 'm2', section: { label: 'B' } }
      ],
      lyrics: {
        lineOrder: ['verse', 'unused'],
        lineMetadata: {
          verse: { label: 'Verse', lang: 'en' },
          unused: { label: 'Unused' }
        }
      }
    },
    parts: [
      {
        id: 'p1',
        name: 'Lead',
        staves: 2,
        _x: { mnxLab: { strings: [...STANDARD_GUITAR_STRINGS], capo: 2 } },
        measures: [
          {
            beams: [{ events: ['e1', 'e2'] }],
            ottavas: [{
              position: { fraction: [0, 1] },
              end: { measure: 'm2', position: { fraction: [1, 4] } },
              value: 1
            }],
            dynamics: [{ position: { fraction: [0, 1] }, type: 'immediate', value: 'f' }],
            clefs: [{ clef: { sign: 'G' }, staff: 1 }, { clef: { sign: 'F' }, staff: 2 }],
            sequences: [
              {
                content: [{
                  id: 'e1',
                  duration: { base: 'quarter' },
                  notes: [first],
                  lyrics: { lines: { verse: { text: 'One' } } },
                  slurs: [{ target: 'e2', startNote: 'n1', endNote: 'n2' }]
                }]
              },
              {
                staff: 2,
                content: [{
                  id: 'lower',
                  duration: { base: 'whole' },
                  notes: [{ ...note('lower-note', 'E'), _x: undefined }]
                }]
              }
            ]
          },
          { sequences: [] },
          {
            sequences: [{
              content: [{
                id: 'e2',
                duration: { base: 'quarter' },
                notes: [note('n2', 'D')]
              }]
            }]
          }
        ]
      },
      {
        id: 'p2',
        measures: [
          { sequences: [{ content: [{ duration: { base: 'whole' }, rest: {} }] }] },
          { sequences: [] },
          { sequences: [] }
        ]
      }
    ]
  };
}

function containers(): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{ id: 'container-bar' }] },
    parts: [{
      _x: { mnxLab: { strings: [...STANDARD_GUITAR_STRINGS] } },
      measures: [{
        sequences: [{
          content: [
            {
              type: 'tuplet',
              inner: { duration: { base: 'eighth' }, multiple: 2 },
              outer: { duration: { base: 'eighth' }, multiple: 1 },
              content: [
                { id: 'inner-1', duration: { base: 'eighth' }, notes: [note('inside-1', 'C')] },
                { id: 'inner-2', duration: { base: 'eighth' }, notes: [note('inside-2', 'D')] }
              ]
            },
            { id: 'outside', duration: { base: 'quarter' }, notes: [note('outside-note', 'E')] }
          ]
        }]
      }]
    }]
  };
}

function success(doc: MnxStructure, state: SelectionState) {
  const result = extractSelectionClip(doc, state, 'tab');
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.message);
  return result;
}

describe('selection clip extraction', () => {
  it('materializes every ladder rung into its natural clip kind', () => {
    const doc = score();
    const cases: [SelectionState, string][] = [
      [point('note', cursor(0)), 'note-set'],
      [point('event', cursor(0)), 'event-run'],
      [point('voiceMeasure', cursor(0)), 'voice-bars'],
      [point('partMeasure', cursor(0)), 'staff-bars'],
      [closure('partMeasure', cursor(0)), 'part'],
      [point('measure', cursor(0)), 'measures'],
      [point('document', cursor(0)), 'document']
    ];
    for (const [state, kind] of cases) {
      const result = success(doc, state);
      expect(result.envelope.clip.kind).toBe(kind);
      expect(JSON.parse(result.serialized)).toEqual(result.envelope);
    }

  });

  it('freezes closures, sparse bar offsets, complete parts and empty bar copies', () => {
    const doc = score();
    const voice = success(doc, closure('voiceMeasure', cursor(0)));
    expect(voice.envelope.selection.shape).toBe('closure');
    expect(voice.envelope.clip).toMatchObject({
      kind: 'voice-bars',
      span: 3,
      bars: [{ offset: 0 }, { offset: 2 }]
    });
    const part = success(doc, closure('partMeasure', cursor(0)));
    expect(part.envelope.clip).toEqual({ kind: 'part', part: doc.parts[0] });

    const staffRange: SelectionState = {
      level: 'partMeasure',
      anchor: cursor(2),
      extent: { kind: 'cursor', cursor: cursor(0) }
    };
    const staff = success(doc, staffRange);
    expect(staff.envelope.selection.shape).toBe('range');
    expect(staff.envelope.clip).toMatchObject({
      kind: 'staff-bars',
      span: 3,
      bars: [{ offset: 0 }, { offset: 1 }, { offset: 2 }]
    });
    if (staff.envelope.clip.kind !== 'staff-bars') throw new Error('wrong clip');
    expect(staff.envelope.clip.bars[0].measure.sequences).toHaveLength(1);
    expect(staff.envelope.clip.bars[0].measure.clefs).toHaveLength(1);
    expect(staff.envelope.clip.bars[1].measure).toEqual({ sequences: [] });
  });

  it('orders reversed ranges in document order and clones owned data', () => {
    const doc = score();
    const reversed: SelectionState = {
      level: 'note',
      anchor: cursor(2),
      extent: { kind: 'cursor', cursor: cursor(0) }
    };
    const result = success(doc, reversed);
    expect(result.envelope.clip).toMatchObject({
      kind: 'note-set',
      notes: [{ id: 'n1' }, { id: 'n2' }]
    });
    doc.parts[0].measures[0].sequences[0].content = [];
    expect(result.envelope.clip).toMatchObject({
      kind: 'note-set',
      notes: [{ id: 'n1' }, { id: 'n2' }]
    });
  });

  it('refuses an event point which bisects a rhythm container', () => {
    const result = extractSelectionClip(containers(), point('event', cursor(0)), 'tab');
    expect(result).toMatchObject({ ok: false, code: 'partial-container' });
    const whole = success(containers(), closure('event', cursor(0)));
    expect(whole.envelope.clip).toMatchObject({
      kind: 'event-run',
      span: 1,
      bars: [{ offset: 0, onset: [0, 1], items: [{ type: 'tuplet' }, { id: 'outside' }] }]
    });
  });

  it('retains closed references and reports every relationship crossing the boundary', () => {
    const doc = score();
    const closed = success(doc, closure('event', cursor(0)));
    expect(closed.detached).toEqual([]);
    expect(closed.envelope.relationships).toMatchObject({
      measures: [{
        offset: 0,
        beams: [{ events: ['e1', 'e2'] }],
        ottavas: [{ end: { measure: 'm2' } }]
      }]
    });
    if (closed.envelope.clip.kind !== 'event-run') throw new Error('wrong clip');
    const first = closed.envelope.clip.bars[0].items[0];
    if (!('duration' in first)) throw new Error('wrong item');
    expect(first.notes?.[0].ties).toEqual([{ target: 'n2' }]);
    expect(first.slurs).toHaveLength(1);

    const open = success(doc, point('event', cursor(0)));
    expect(open.detached.map(reference => reference.kind).sort()).toEqual([
      'beam', 'ottava', 'slur', 'slur', 'technique', 'tie'
    ]);
    expect(open.envelope.relationships).toBeUndefined();
    if (open.envelope.clip.kind !== 'event-run') throw new Error('wrong clip');
    const openFirst = open.envelope.clip.bars[0].items[0];
    if (!('duration' in openFirst)) throw new Error('wrong item');
    expect(openFirst.notes?.[0].ties).toBeUndefined();
    expect(openFirst.notes?.[0]._x?.mnxLab?.tab?.technique).toBeUndefined();
    expect(openFirst.slurs).toBeUndefined();
  });

  it('collects only referenced lyric metadata plus source support and measure context', () => {
    const result = success(score(), point('event', cursor(0)));
    expect(result.envelope.context).toEqual({
      // `time` is the DECLARED meter (what a bootstrap re-declares);
      // `effectiveTime` is the inherited-inclusive meter D8's flow
      // linearizes source distances with.
      measures: [{
        id: 'm0',
        key: { fifths: 2 },
        time: { count: 4, unit: 4 },
        effectiveTime: { count: 4, unit: 4 }
      }]
    });
    expect(result.envelope.dependencies).toEqual({
      support: { useAccidentalDisplay: true, useBeams: true },
      lyrics: {
        lineOrder: ['verse'],
        lineMetadata: { verse: { label: 'Verse', lang: 'en' } }
      }
    });
  });

  it('copies complete measure columns across every part', () => {
    const doc = score();
    const measure = success(doc, point('measure', cursor(1)));
    expect(measure.envelope.clip).toMatchObject({
      kind: 'measures',
      parts: [{ id: 'p1', name: 'Lead', staves: 2 }, { id: 'p2' }],
      measures: [{ global: { id: 'm1' }, parts: [{ sequences: [] }, { sequences: [] }] }]
    });
  });

  it('refuses an absent point without borrowing a neighbouring member', () => {
    const result = extractSelectionClip(score(), point('note', cursor(1)), 'tab');
    expect(result).toMatchObject({ ok: false, code: 'empty-selection' });
  });
});
