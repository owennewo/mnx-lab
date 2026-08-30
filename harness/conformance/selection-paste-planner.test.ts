import { describe, expect, it } from 'vitest';
import { extractSelectionClip } from '../../src/edit/selectionClipExtraction.ts';
import { planSelectionPaste } from '../../src/edit/selectionPastePlanner.ts';
import { restItemsForDuration } from '../../src/edit/selectionStructuralEdit.ts';
import type { EditorCursor } from '../../src/edit/cursor.ts';
import type { SelectionLevel, SelectionState } from '../../src/edit/selection.ts';
import type { MnxNote, MnxStructure } from '../../src/model/mnx.ts';
import { STANDARD_GUITAR_STRINGS } from '../../src/model/mnx.ts';
import validateMnxProposed from '../../worker/generated/validate-mnx-proposed.mjs';

function note(id: string, step: MnxNote['pitch']['step'] = 'E', string = 1): MnxNote {
  return { id, pitch: { step, octave: 4 }, _x: { mnxLab: { string } } };
}

function cursor(
  measureIndex: number,
  num = 0,
  den = 1,
  extra: Partial<EditorCursor> = {}
): EditorCursor {
  return { measureIndex, onset: { num, den }, line: 1, ...extra };
}

function point(level: SelectionLevel, at = cursor(0)): SelectionState {
  return { level, anchor: at, extent: { kind: 'cursor', cursor: { ...at, onset: { ...at.onset } } } };
}

function closure(level: SelectionLevel, at = cursor(0)): SelectionState {
  const scope = level === 'partMeasure'
    ? 'part'
    : level === 'measure'
      ? 'timeline'
      : level === 'document'
        ? 'document'
        : 'voice';
  return { level, anchor: at, extent: { kind: 'closure', scope } };
}

function score(prefix: string, options: { strings?: boolean; sections?: boolean } = {}): MnxStructure {
  const strings = options.strings === false ? undefined : [...STANDARD_GUITAR_STRINGS];
  return {
    mnx: { version: 1, support: { useBeams: true } },
    global: {
      measures: [
        { id: `${prefix}-m1`, key: { fifths: prefix === 'source' ? 2 : -3 }, section: { label: 'A' } },
        { id: `${prefix}-m2`, ...(options.sections ? { section: { label: 'B' } } : {}) }
      ],
      lyrics: {
        lineOrder: ['verse'],
        lineMetadata: { verse: { label: prefix === 'source' ? 'Source verse' : 'Target verse' } }
      }
    },
    parts: [{
      id: `${prefix}-part`,
      _x: strings
        ? { mnxLab: { strings } }
        : { mnxLab: { tab: { staffKind: 'tab' } } },
      measures: [
        {
          sequences: [{ content: [{
            id: `${prefix}-event-1`,
            duration: { base: 'quarter' },
            notes: [note(`${prefix}-note-1`)],
            lyrics: { lines: { verse: { text: 'One' } } }
          }] }]
        },
        {
          sequences: [{ content: [{
            id: `${prefix}-event-2`,
            duration: { base: 'quarter' },
            notes: [note(`${prefix}-note-2`, 'F')]
          }] }]
        }
      ]
    }]
  };
}

function containerScore(prefix: string): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{ id: `${prefix}-m1` }] },
    parts: [{
      id: `${prefix}-part`,
      _x: { mnxLab: { strings: [...STANDARD_GUITAR_STRINGS] } },
      measures: [{ sequences: [{ content: [{
        type: 'tuplet',
        id: `${prefix}-tuplet`,
        inner: { duration: { base: 'eighth' }, multiple: 2 },
        outer: { duration: { base: 'eighth' }, multiple: 1 },
        content: [
          { id: `${prefix}-inner-1`, duration: { base: 'eighth' }, notes: [note(`${prefix}-in-1`)] },
          { id: `${prefix}-inner-2`, duration: { base: 'eighth' }, notes: [note(`${prefix}-in-2`, 'F')] }
        ]
      }] }] }]
    }]
  };
}

function emptyScore(): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{}] },
    parts: [{ measures: [{ sequences: [] }] }]
  };
}

function serialized(doc: MnxStructure, selection: SelectionState): string {
  const result = extractSelectionClip(doc, selection, 'tab');
  if (!result.ok) throw new Error(result.message);
  return result.serialized;
}

function accepted(clip: string, target: MnxStructure, selection: SelectionState) {
  const before = JSON.stringify(target);
  const result = planSelectionPaste(clip, target, selection, 'tab');
  expect(result.ok).toBe(true);
  expect(JSON.stringify(target)).toBe(before);
  if (!result.ok) throw new Error(result.message);
  expect(
    validateMnxProposed(result.document),
    JSON.stringify(validateMnxProposed.errors?.slice(0, 3))
  ).toBe(true);
  return result;
}

describe('pure selection paste planner', () => {
  it('accepts every clip kind at its conservative natural destination', () => {
    const source = score('source');
    const cases: [string, MnxStructure, SelectionState][] = [
      [serialized(source, point('note')), score('target'), point('note')],
      [serialized(source, point('event')), score('target'), point('event')],
      [serialized(source, point('voiceMeasure')), score('target'), point('voiceMeasure')],
      [serialized(source, point('partMeasure')), score('target'), point('partMeasure')],
      [serialized(source, closure('partMeasure')), score('target'), point('partMeasure')],
      [serialized(source, point('measure')), score('target'), point('measure')],
      [serialized(source, point('document')), emptyScore(), point('document')]
    ];
    for (const [clip, target, selection] of cases) accepted(clip, target, selection);

  });

  it('rewrites retained references to fresh ids and keeps destination context', () => {
    const source = score('source');
    const firstEvent = source.parts[0].measures[0].sequences[0].content[0];
    const secondEvent = source.parts[0].measures[1].sequences[0].content[0];
    if (!('duration' in firstEvent) || !('duration' in secondEvent)) throw new Error('fixture');
    firstEvent.notes![0].ties = [{ target: 'source-note-2' }];
    firstEvent.slurs = [{ target: 'source-event-2' }];
    source.parts[0].measures[0].beams = [{ events: ['source-event-1', 'source-event-2'] }];
    const clip = serialized(source, closure('event'));
    const target = score('target');
    const result = accepted(clip, target, closure('event'));

    expect(result.idMap.notes['source-note-1']).toBeTruthy();
    expect(result.idMap.notes['source-note-1']).not.toBe('source-note-1');
    expect(result.idMap.events['source-event-1']).not.toBe('source-event-1');
    const pastedFirst = result.document.parts[0].measures[0].sequences[0].content[0];
    if (!('duration' in pastedFirst)) throw new Error('wrong item');
    expect(pastedFirst.notes?.[0].ties?.[0].target).toBe(result.idMap.notes['source-note-2']);
    expect(pastedFirst.slurs?.[0].target).toBe(result.idMap.events['source-event-2']);
    expect(result.document.parts[0].measures[0].beams?.[0].events).toEqual([
      result.idMap.events['source-event-1'], result.idMap.events['source-event-2']
    ]);
    expect(result.document.global.measures[0].key).toEqual({ fifths: -3 });
  });

  it('carries staff-bar beams across and replaces the target staff beams without detaching', () => {
    const beamedBar = (prefix: string, doc: MnxStructure): void => {
      doc.parts[0].measures[0].sequences[0].content = [
        { id: `${prefix}-event-1`, duration: { base: 'eighth' }, notes: [note(`${prefix}-note-1`)] },
        { id: `${prefix}-event-1b`, duration: { base: 'eighth' }, notes: [note(`${prefix}-note-1b`, 'F')] }
      ];
      doc.parts[0].measures[0].beams = [{ events: [`${prefix}-event-1`, `${prefix}-event-1b`] }];
    };
    const source = score('source');
    beamedBar('source', source);
    const target = score('target');
    beamedBar('target', target);
    const result = accepted(serialized(source, point('partMeasure')), target, point('partMeasure'));
    expect(result.document.parts[0].measures[0].beams).toEqual([{
      events: [result.idMap.events['source-event-1'], result.idMap.events['source-event-1b']]
    }]);
    expect(result.detachedTargetReferences).toBe(0);
  });

  it('preserves event bar boundaries and sparse timeline gaps', () => {
    const sparse = (prefix: string): MnxStructure => {
      const doc = score(prefix);
      doc.global.measures.splice(1, 0, { id: `${prefix}-gap` });
      doc.parts[0].measures.splice(1, 0, { sequences: [] });
      return doc;
    };
    const source = sparse('source');
    const clip = serialized(source, closure('event'));
    const parsed = JSON.parse(clip) as {
      clip: { span: number; bars: { offset: number; onset: [number, number] }[] };
    };
    expect(parsed.clip).toMatchObject({
      span: 3,
      bars: [{ offset: 0, onset: [0, 1] }, { offset: 2, onset: [0, 1] }]
    });
    const result = accepted(clip, sparse('target'), point('event'));
    expect(result.document.parts[0].measures[1].sequences).toEqual([]);
    expect(result.document.parts[0].measures[2].sequences[0].content).toHaveLength(1);

    // A gap bar makes no statement about its destination bar: the shifted
    // document keeps its own material there, and where the clip's outer bar
    // finds no sequence, D4 creates one — counted, never refused.
    const shifted = sparse('shifted');
    shifted.parts[0].measures[1] = shifted.parts[0].measures[2];
    shifted.parts[0].measures[2] = { sequences: [] };
    const landed = accepted(clip, shifted, point('event'));
    expect(landed.accommodations.createdSequences).toBe(1);
    expect(landed.document.parts[0].measures[1].sequences[0].content).toHaveLength(1);
    expect(landed.document.parts[0].measures[2].sequences[0].content).toHaveLength(1);
  });

  it('merges dependencies with destination metadata taking precedence', () => {
    const result = accepted(
      serialized(score('source'), point('event')),
      score('target'),
      point('event')
    );
    expect(result.dependencyMerge).toEqual({
      support: { useBeams: true },
      lyrics: {
        lineOrder: ['verse'],
        lineMetadata: { verse: { label: 'Target verse' } }
      }
    });
  });

  it('overwrites measure columns from the anchor, extending the timeline (D1)', () => {
    const source = score('source');
    // One column onto bar 2 of two: an overwrite, not an insert — the
    // timeline stays two bars and bar 2 becomes the copied column.
    const overwrite = accepted(
      serialized(source, point('measure')),
      score('target'),
      point('measure', cursor(1))
    );
    expect(overwrite.document.global.measures).toHaveLength(2);
    expect(overwrite.landing).toMatchObject({ level: 'measure', measureStart: 1, measureEnd: 1 });
    expect(overwrite.accommodations.appendedBars).toBe(0);

    // Two columns anchored at the last bar: one fits, one appends (rule 4).
    const overrun = accepted(
      serialized(source, closure('measure')),
      score('target'),
      point('measure', cursor(1))
    );
    expect(overrun.document.global.measures).toHaveLength(3);
    expect(overrun.accommodations.appendedBars).toBe(1);

    const range: SelectionState = {
      level: 'measure',
      anchor: cursor(0),
      extent: { kind: 'cursor', cursor: cursor(1) }
    };
    const replace = accepted(serialized(source, closure('measure')), score('target'), range);
    expect(replace.document.global.measures).toHaveLength(2);
  });

  it('adds parts, replaces empty placeholders, and bootstraps empty context', () => {
    const partClip = serialized(score('source'), closure('partMeasure'));
    const populated = accepted(partClip, score('target'), point('partMeasure'));
    expect(populated.document.parts).toHaveLength(2);
    expect(populated.document.global.measures[0].key).toEqual({ fifths: -3 });

    const empty = accepted(partClip, emptyScore(), point('partMeasure'));
    expect(empty.document.parts).toHaveLength(1);
    expect(empty.document.parts[0].id).toBeTruthy();
    expect(empty.document.global.measures).toHaveLength(2);
    expect(empty.document.global.measures[0].key).toEqual({ fifths: 2 });
  });

  it('a score clip replaces any document, rewriting structural ids (D5)', () => {
    const source = score('source');
    source.layouts = [{
      id: 'source-layout',
      content: [{ type: 'staff', sources: [{ part: 'source-part' }] }]
    }];
    source.scores = [{
      name: 'Full score',
      layout: 'source-layout',
      pages: [{ systems: [{ measure: 'source-m1' }] }]
    }];
    const result = accepted(serialized(source, point('document')), emptyScore(), point('document'));
    expect(result.document.parts[0].id).not.toBe('source-part');
    expect(result.document.layouts?.[0].id).not.toBe('source-layout');
    expect(result.document.layouts?.[0].content[0].sources?.[0].part)
      .toBe(result.document.parts[0].id);
    expect(result.document.scores?.[0].pages?.[0].systems?.[0].measure)
      .toBe(result.document.global.measures[0].id);

    // A populated destination is no gate: the footprint of a score is
    // everything, undo restores everything.
    const replaced = accepted(serialized(source, point('document')), score('target'), point('document'));
    expect(replaced.accommodations.replacedDocument).toBe(true);
    expect(replaced.document.parts).toHaveLength(1);
    expect(replaced.document.parts[0].id).not.toBe('target-part');
  });

  it('lands mismatched levels, counts, spans, topology and instruments with counted accommodations', () => {
    const source = score('source');
    // A note clip pasted from an event selection lands on the anchor
    // event's first notehead — the destination rung gates nothing (rule 1).
    const noteOntoEvent = accepted(
      serialized(source, point('note')), score('target'), point('event')
    );
    const firstItem = noteOntoEvent.document.parts[0].measures[0].sequences[0].content[0];
    if (!('duration' in firstItem)) throw new Error('wrong item');
    expect(firstItem.notes?.[0].id).toBe(noteOntoEvent.idMap.notes['source-note-1']);

    // Two copied noteheads onto a one-notehead remainder: the second has
    // nowhere to land and is counted, not silently dropped.
    const twoNotes = serialized(source, closure('note'));
    const shortTarget = score('target');
    shortTarget.parts[0].measures[1].sequences = [];
    const dropped = accepted(twoNotes, shortTarget, point('note'));
    expect(dropped.accommodations.droppedMembers).toBe(1);

    // A quarter clip onto a half note: the half is consumed whole (rule 3)
    // and the uncovered remainder fills with one quarter rest.
    const longTarget = score('target');
    const item = longTarget.parts[0].measures[0].sequences[0].content[0];
    if ('duration' in item) item.duration = { base: 'half' };
    const filled = accepted(serialized(source, point('event')), longTarget, point('event'));
    expect(filled.accommodations.restFills).toBe(1);
    const content = filled.document.parts[0].measures[0].sequences[0].content;
    expect(content).toHaveLength(2);
    expect(content[1]).toMatchObject({ duration: { base: 'quarter' }, rest: {} });

    // A destination part the clip does not cover gets empty columns.
    const topology = score('target');
    topology.parts.push({ measures: topology.global.measures.map(() => ({ sequences: [] })) });
    const uncovered = accepted(serialized(source, point('measure')), topology, point('measure'));
    expect(uncovered.document.parts[1].measures[0]).toEqual({ sequences: [] });

    // No declared instrument: the annotated note lands and is counted for
    // the fingerboard diagnostics, never refused.
    const flagged = accepted(
      serialized(source, point('note')),
      score('target', { strings: false }),
      point('note')
    );
    expect(flagged.accommodations.flaggedNotes).toBe(1);
  });

  it('rejects malformed serialized clips before considering the destination', () => {
    expect(planSelectionPaste('{', score('target'), point('note'), 'tab'))
      .toMatchObject({ ok: false, code: 'invalid-clip' });
  });

  it('extends the timeline when an event run overruns it (rule 4)', () => {
    const clip = serialized(score('source'), closure('event')); // span 2
    const oneBar = score('target');
    oneBar.global.measures.pop();
    oneBar.parts[0].measures.pop();
    const result = accepted(clip, oneBar, point('event'));
    expect(result.accommodations.appendedBars).toBe(1);
    expect(result.accommodations.createdSequences).toBe(1); // the appended bar's voice
    expect(result.document.global.measures).toHaveLength(2);
    expect(result.document.parts[0].measures[1].sequences[0].content).toHaveLength(1);
  });

  it('creates the parts a measures clip carries that the destination lacks (D3)', () => {
    const source = score('source');
    source.parts.push({
      id: 'source-b',
      name: 'Second',
      measures: source.global.measures.map(() => ({
        sequences: [{ content: [{ duration: { base: 'quarter' }, rest: {} }] }]
      }))
    });
    const result = accepted(
      serialized(source, closure('measure')),
      score('target'),
      point('measure')
    );
    expect(result.accommodations.createdParts).toBe(1);
    expect(result.document.parts).toHaveLength(2);
    expect(result.document.parts[1].name).toBe('Second');
    expect(result.document.parts[1].measures[0].sequences[0].content).toHaveLength(1);
  });

  it('a single note inks a rest with the rest’s own duration (D6)', () => {
    const target = score('target');
    target.parts[0].measures[0].sequences[0].content = [
      { id: 'target-rest', duration: { base: 'half' }, rest: {} }
    ];
    const result = accepted(serialized(score('source'), point('note')), target, point('note'));
    const inked = result.document.parts[0].measures[0].sequences[0].content[0];
    if (!('duration' in inked)) throw new Error('wrong item');
    expect(inked.rest).toBeUndefined();
    expect(inked.duration).toEqual({ base: 'half' }); // the destination donates the rhythm
    expect(inked.notes?.[0].id).toBe(result.idMap.notes['source-note-1']);
  });

  it('creates the anchor voice for a voice-bars clip when it does not exist (D4)', () => {
    const target = score('target');
    target.parts[0].measures[0].sequences = [];
    const result = accepted(
      serialized(score('source'), point('voiceMeasure')),
      target,
      point('voiceMeasure')
    );
    expect(result.accommodations.createdSequences).toBe(1);
    expect(result.document.parts[0].measures[0].sequences[0].content).toHaveLength(1);
  });

  it('spells rest fills greedy-binary, falling back to exact authored space', () => {
    expect(restItemsForDuration(3, 8)).toEqual([
      { duration: { base: 'quarter' }, rest: {} },
      { duration: { base: 'eighth' }, rest: {} }
    ]);
    expect(restItemsForDuration(1, 2)).toEqual([{ duration: { base: 'half' }, rest: {} }]);
    expect(restItemsForDuration(0, 4)).toEqual([]);
    // A non-binary remainder (a consumed unit with a non-binary outer span)
    // stays exact as authored space rather than approximating.
    expect(restItemsForDuration(1, 3)).toEqual([{ type: 'space', duration: [1, 3] }]);
  });

  it('a zero-footprint grace clip inserts at the anchor without consuming', () => {
    // The container clip kind retired with the container rung
    // (core-selection-range-grain.md): the same wrapper now travels inside an
    // event-run — a structurally closed event range carries whole wrappers.
    const source = containerScore('source');
    source.parts[0].measures[0].sequences[0].content = [{
      type: 'grace',
      id: 'source-grace',
      content: [{
        id: 'source-grace-event',
        duration: { base: 'eighth' },
        notes: [note('source-grace-note')]
      }]
    }];
    const result = accepted(
      serialized(source, closure('event')),
      containerScore('target'),
      point('event')
    );
    expect(result.accommodations.restFills).toBe(0);
    const content = result.document.parts[0].measures[0].sequences[0].content;
    expect(content).toHaveLength(2);
    expect(content[0]).toMatchObject({ type: 'grace' });
    expect(content[1]).toMatchObject({ type: 'tuplet' });
  });
});

// D8 — a run flows: source distances linearize against the clip's recorded
// effective meters, and the DESTINATION's meters decide where barlines fall.
describe('paste flow (D8)', () => {
  const quarters = (prefix: string, count: number, from = 1) =>
    Array.from({ length: count }, (_, index) => ({
      id: `${prefix}${from + index}`,
      duration: { base: 'quarter' as const },
      notes: [note(`${prefix}${from + index}-n`)]
    }));

  const barsOf = (prefix: string, bars: number, time: { count: number; unit: number }): MnxStructure => ({
    mnx: { version: 1 },
    global: {
      measures: Array.from({ length: bars }, (_, index) => index === 0 ? { time } : {})
    },
    parts: [{
      id: `${prefix}-part`,
      _x: { mnxLab: { strings: [...STANDARD_GUITAR_STRINGS] } },
      measures: Array.from({ length: bars }, (_, index) => ({
        sequences: [{ content: quarters(prefix, time.count, index * time.count + 1) }]
      }))
    }]
  });

  const ids = (result: { document: MnxStructure }, measureIndex: number): (string | undefined)[] =>
    result.document.parts[0].measures[measureIndex].sequences[0].content.map(item =>
      'id' in item ? item.id : undefined
    );

  it('four quarters onto beat 3 fill the bar and continue into the next (the motivating case)', () => {
    const clip = serialized(barsOf('s', 1, { count: 4, unit: 4 }), closure('event'));
    const result = accepted(
      clip,
      barsOf('d', 2, { count: 4, unit: 4 }),
      point('event', cursor(0, 1, 2)) // beat 3
    );
    const pasted = (index: number) => result.idMap.events[`s${index}`];
    expect(ids(result, 0)).toEqual(['d1', 'd2', pasted(1), pasted(2)]);
    expect(ids(result, 1)).toEqual([pasted(3), pasted(4), 'd7', 'd8']);
    expect(result.accommodations.restFills).toBe(0);
    expect(result.accommodations.appendedBars).toBe(0);
    expect(result.landing).toMatchObject({
      measureStart: 0, measureEnd: 1, onsetEnd: [1, 4]
    });
  });

  it('cross-meter: a 4/4 bar of quarters flows into 3/4 bars at the destination’s barlines', () => {
    const clip = serialized(barsOf('s', 1, { count: 4, unit: 4 }), closure('event'));
    const result = accepted(
      clip,
      barsOf('d', 2, { count: 3, unit: 4 }),
      point('event')
    );
    const pasted = (index: number) => result.idMap.events[`s${index}`];
    expect(ids(result, 0)).toEqual([pasted(1), pasted(2), pasted(3)]);
    expect(ids(result, 1)).toEqual([pasted(4), 'd5', 'd6']);
    expect(result.accommodations.restFills).toBe(0);
  });

  it('flow off the end of the score appends bars (rule 4)', () => {
    const clip = serialized(barsOf('s', 1, { count: 4, unit: 4 }), closure('event'));
    const result = accepted(
      clip,
      barsOf('d', 1, { count: 4, unit: 4 }),
      point('event', cursor(0, 1, 2))
    );
    expect(result.accommodations.appendedBars).toBe(1);
    expect(result.accommodations.createdSequences).toBe(1);
    expect(result.document.parts[0].measures[1].sequences[0].content).toHaveLength(2);
  });

  it('a duration that straddles the destination barline lands whole in its bar (D2)', () => {
    const source = barsOf('s', 1, { count: 4, unit: 4 });
    source.parts[0].measures[0].sequences[0].content = [
      { id: 'sh1', duration: { base: 'half' }, notes: [note('sh1-n')] },
      { id: 'sh2', duration: { base: 'half' }, notes: [note('sh2-n')] }
    ];
    const result = accepted(
      serialized(source, closure('event')),
      barsOf('d', 2, { count: 4, unit: 4 }),
      point('event', cursor(0, 1, 4)) // beat 2: the second half straddles
    );
    // Bar 1 holds d1 + both halves (5 beats) — overfull, flagged by the
    // renderer's diagnostics, never split-and-tied here.
    expect(ids(result, 0)).toEqual(['d1', result.idMap.events['sh1'], result.idMap.events['sh2']]);
    expect(ids(result, 1)).toEqual(['d5', 'd6', 'd7', 'd8']);
  });
});
