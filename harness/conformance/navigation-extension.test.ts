import { describe, expect, it } from 'vitest';
import { emitNavigationMarkers } from '../../src/engine/layout/scoreText.ts';
import type { Primitive } from '../../src/engine/primitives.ts';
import { applyOp, readMeasureAttributes } from '../../src/edit/ops.ts';
import { measureNavigation } from '../../src/model/navigation.ts';
import type { MnxGlobalMeasure, MnxStructure } from '../../src/model/mnx.ts';

const measure = (): MnxGlobalMeasure => ({
  segno: { id: 'segno', location: { fraction: [0, 1] } },
  _x: { mnxLab: { navigation: {
    marks: [
      { id: 'double-segno', kind: 'segno', count: 2, location: { fraction: [0, 1] } },
      { id: 'double-coda', kind: 'coda', count: 2, location: { fraction: [1, 2] } }
    ],
    jumps: [{
      type: 'dalSegnoAlCoda', target: 'double-segno', resumeAt: 'double-coda',
      text: 'D.S.S. al Double Coda', location: { fraction: [1, 1] }
    }]
  } } }
});

describe('lab navigation', () => {
  it('normalizes published and lab objects into one consumer view', () => {
    const navigation = measureNavigation(measure());
    expect(navigation.marks.map(mark => [mark.kind, mark.count, mark.source])).toEqual([
      ['segno', 1, 'published'], ['segno', 2, 'mnxLab'], ['coda', 2, 'mnxLab']
    ]);
    expect(navigation.jumps[0]).toMatchObject({
      type: 'dalSegnoAlCoda', target: 'double-segno', resumeAt: 'double-coda'
    });
  });

  it('engraves double signs and preserves the literal jump caption', () => {
    const primitives: Primitive[] = [];
    emitNavigationMarkers({
      gm: measure(), m: { voices: [], x: 10, width: 30 }, stdSequences: [],
      staffTop: 10, primitives
    });
    expect(primitives.filter(p => p.kind === 'glyph' && p.glyph === 'segno')).toHaveLength(3);
    expect(primitives.filter(p => p.kind === 'glyph' && p.glyph === 'coda')).toHaveLength(2);
    expect(primitives.find(p => p.kind === 'text' && p.className === 'jump'))
      .toMatchObject({ text: 'D.S.S. al Double Coda' });
  });

  it('is visible to the measure inspector and destructible without tombstones', () => {
    let doc = ({ mnx: { version: 1 }, global: { measures: [{}] }, parts: [] }) as MnxStructure;
    doc = applyOp(doc, { type: 'setMeasureAttribute', measureIndex: 0, attribute: {
      kind: 'navigationMark', id: 'coda', markKind: 'coda', count: 2
    } });
    doc = applyOp(doc, { type: 'setMeasureAttribute', measureIndex: 0, attribute: {
      kind: 'navigationJump', type: 'toCoda', target: 'coda', text: 'To Double Coda'
    } });
    expect(readMeasureAttributes(doc.global.measures[0]).map(attribute => attribute.kind))
      .toEqual(['navigationMark', 'navigationJump']);
    doc = applyOp(doc, { type: 'removeMeasureAttribute', measureIndex: 0, kind: 'navigationJump' });
    doc = applyOp(doc, { type: 'removeMeasureAttribute', measureIndex: 0, kind: 'navigationMark' });
    expect(doc.global.measures[0]._x).toBeUndefined();
  });
});
