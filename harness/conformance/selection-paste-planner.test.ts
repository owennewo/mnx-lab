import { describe, expect, it } from 'vitest';
import { extractSelectionClip } from '../../src/edit/selectionClipExtraction.ts';
import { planSelectionPaste } from '../../src/edit/selectionPastePlanner.ts';
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
    : level === 'measure' || level === 'section'
      ? 'timeline'
      : level === 'score'
        ? 'score'
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
      [serialized(source, point('section')), score('target'), point('section')],
      [serialized(source, point('score')), emptyScore(), point('score')]
    ];
    for (const [clip, target, selection] of cases) accepted(clip, target, selection);

    accepted(
      serialized(containerScore('source'), point('container')),
      containerScore('target'),
      point('container')
    );
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

    const shifted = sparse('shifted');
    shifted.parts[0].measures[1] = shifted.parts[0].measures[2];
    shifted.parts[0].measures[2] = { sequences: [] };
    expect(planSelectionPaste(clip, shifted, point('event'), 'tab'))
      .toMatchObject({ ok: false, code: 'metric-span-mismatch' });
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

  it('inserts measure and section packages at points and replaces equal ranges', () => {
    const source = score('source');
    const measureInsert = accepted(
      serialized(source, point('measure')),
      score('target'),
      point('measure', cursor(1))
    );
    expect(measureInsert.document.global.measures).toHaveLength(3);
    expect(measureInsert.landing).toMatchObject({ level: 'measure', measureStart: 1, measureEnd: 1 });

    const sectionInsert = accepted(
      serialized(source, point('section')),
      score('target', { sections: true }),
      point('section', cursor(1))
    );
    expect(sectionInsert.document.global.measures).toHaveLength(4);

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

  it('replaces only an empty document with a complete score and rewrites structural ids', () => {
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
    const result = accepted(serialized(source, point('score')), emptyScore(), point('score'));
    expect(result.document.parts[0].id).not.toBe('source-part');
    expect(result.document.layouts?.[0].id).not.toBe('source-layout');
    expect(result.document.layouts?.[0].content[0].sources?.[0].part)
      .toBe(result.document.parts[0].id);
    expect(result.document.scores?.[0].pages?.[0].systems?.[0].measure)
      .toBe(result.document.global.measures[0].id);

    const refusal = planSelectionPaste(
      serialized(source, point('score')), score('target'), point('score'), 'tab'
    );
    expect(refusal).toMatchObject({ ok: false, code: 'document-not-empty' });
  });

  it('refuses mismatched levels, counts, spans, topology and instruments precisely', () => {
    const source = score('source');
    expect(planSelectionPaste(
      serialized(source, point('note')), score('target'), point('event'), 'tab'
    )).toMatchObject({ ok: false, code: 'wrong-destination-level' });

    const twoNotes = serialized(source, closure('note'));
    expect(planSelectionPaste(twoNotes, score('target'), point('note'), 'tab'))
      .toMatchObject({ ok: false, code: 'member-count-mismatch' });

    const longTarget = score('target');
    const item = longTarget.parts[0].measures[0].sequences[0].content[0];
    if ('duration' in item) item.duration = { base: 'half' };
    expect(planSelectionPaste(
      serialized(source, point('event')), longTarget, point('event'), 'tab'
    )).toMatchObject({ ok: false, code: 'metric-span-mismatch' });

    const topology = score('target');
    topology.parts.push({ measures: topology.global.measures.map(() => ({ sequences: [] })) });
    expect(planSelectionPaste(
      serialized(source, point('measure')), topology, point('measure'), 'tab'
    )).toMatchObject({ ok: false, code: 'part-topology-mismatch' });

    expect(planSelectionPaste(
      serialized(source, point('note')),
      score('target', { strings: false }),
      point('note'),
      'tab'
    )).toMatchObject({ ok: false, code: 'instrument-incompatible' });
  });

  it('rejects malformed serialized clips before considering the destination', () => {
    expect(planSelectionPaste('{', score('target'), point('note'), 'tab'))
      .toMatchObject({ ok: false, code: 'invalid-clip' });
  });
});
