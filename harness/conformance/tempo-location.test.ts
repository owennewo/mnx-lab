// A tempo's place in its bar (core-measure-attributes-gaps.md, item 9): every
// mark draws, a located one at its column. The corpus pins the ink
// (`lab/navigation/tempo-change-mid-bar`); this holds the writer and reader.
import { describe, it, expect } from 'vitest';
import { applyOp, readMeasureAttributes } from '../../src/edit/ops.ts';
import { parseBarAttribute } from '../../src/edit/setupGrammar.ts';
import { attributeText, parseInspectorLine } from '../../src/edit/inspector.ts';
import { measureLevelGaps } from '../../src/engine/layout/spacing.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

describe('tempo at', () => {
  it('parses, writes a location, reads back and spells — and no longer badges a second mark', () => {
    expect(parseBarAttribute('tempo 96 at 1/2')).toEqual({ set: { kind: 'tempo', bpm: 96, base: 'quarter', at: [1, 2] } });
    expect(parseBarAttribute('tempo half=80 at end')).toEqual({ set: { kind: 'tempo', bpm: 80, base: 'half', at: 'end' } });
    expect(parseBarAttribute('tempo 96 at x/y')).toBeNull();
    expect(parseBarAttribute('tempo 120')).toEqual({ set: { kind: 'tempo', bpm: 120, base: 'quarter' } });
    let d: MnxStructure = { mnx: { version: 1 }, global: { measures: [{}] }, parts: [] };
    d = applyOp(d, { type: 'setMeasureAttribute', measureIndex: 0, attribute: { kind: 'tempo', bpm: 120, base: 'quarter' } });
    d = applyOp(d, { type: 'setMeasureAttribute', measureIndex: 0, index: 1, attribute: { kind: 'tempo', bpm: 96, base: 'quarter', at: [1, 2] } });
    expect(d.global.measures[0].tempos).toEqual([
      { bpm: 120, value: { base: 'quarter' } },
      { bpm: 96, value: { base: 'quarter' }, location: { fraction: [1, 2] } }
    ]);
    expect(readMeasureAttributes(d.global.measures[0]).filter(a => a.kind === 'tempo')).toEqual([
      { kind: 'tempo', bpm: 120, base: 'quarter' },
      { kind: 'tempo', bpm: 96, base: 'quarter', at: [1, 2] }
    ]);
    expect(attributeText({ kind: 'tempo', bpm: 96, base: 'quarter', at: [1, 2] })).toBe('tempo quarter=96 at 1/2');
    expect(parseInspectorLine('measure', 'tempo', '96 at 1/2', { tempoCount: 1 })).toMatchObject({
      intent: { type: 'setMeasureAttribute', attribute: { kind: 'tempo', bpm: 96, at: [1, 2] } }
    });
    expect(measureLevelGaps(d.global.measures[0], [])).toEqual([]);
  });
});
