// A pickup bar (roadmap/proposed/core-anacrusis.md): stored at its true length
// and marked `number: 0`, it is ENGRAVED as a printed copy shows it — the next
// bar's signature drawn once at the pickup, none on the bar after it, none on
// a last bar that completes it, and no number on the pickup itself.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { planHorizontal } from '../../src/engine/layout/spacing.ts';
import { layoutNotation } from '../../src/engine/layout/notation.ts';
import { engravingEntries } from '../../src/engine/layout/unrolled.ts';
import { completesPickup, pickupSignature } from '../../src/model/pickup.ts';
import type { MnxGlobalMeasure, MnxStructure } from '../../src/model/mnx.ts';
import { measurePills, parseInspectorLine } from '../../src/edit/inspector.ts';
import { applyOp } from '../../src/edit/ops.ts';

const scenario = JSON.parse(readFileSync('scenarios/lab/11-rhythm/06-pickup-bar/document.mnx.json', 'utf8')) as MnxStructure;
const withFirst = (first: MnxGlobalMeasure): MnxStructure =>
  ({ ...scenario, global: { ...scenario.global, measures: [first, ...scenario.global.measures.slice(1)] } });
const drawn = (doc: MnxStructure, unrolled = false) =>
  planHorizontal(doc, 400, unrolled ? { entries: engravingEntries(doc, true) } : undefined).measures
    .map(m => (m.showTimeSig ? `${m.timeSigShown.count}/${m.timeSigShown.unit}` : '-'));

describe('a pickup bar', () => {
  it('is a short first bar numbered 0 — the number alone, or the shortness alone, is not one', () => {
    const m = scenario.global.measures;
    expect(pickupSignature(m)).toEqual({ count: 4, unit: 4 });
    expect(pickupSignature([{ ...m[0]!, number: undefined }, ...m.slice(1)])).toBeNull();
    expect(pickupSignature([{ ...m[0]!, time: { count: 4, unit: 4 } }, ...m.slice(1)])).toBeNull();
    expect(completesPickup(m, 3, { count: 4, unit: 4 })).toBe(true);
    // 2/4 + the 1/4 pickup is not a whole bar of 4/4: that last bar is a real change.
    expect(completesPickup([...m.slice(0, 3), { time: { count: 2, unit: 4 } }], 3, { count: 4, unit: 4 })).toBe(false);
  });

  it('draws 4/4 once, at the pickup, and nothing on the bar after it or the bar completing it', () => {
    expect(drawn(scenario)).toEqual(['4/4', '-', '-', '-']);
    expect(drawn(scenario, true)).toEqual(['4/4', '-', '-', '-']);
  });

  it('keeps the true length where time is measured: the pickup still beams and spaces as one beat', () => {
    expect(planHorizontal(scenario, 400).measures[0]!.timeSig).toMatchObject({ count: 1, unit: 4 });
  });

  it('without the 0 it is an ordinary 1/4 bar, and every signature draws as written', () => {
    expect(drawn(withFirst({ ...scenario.global.measures[0]!, number: undefined }))).toEqual(['1/4', '4/4', '-', '3/4']);
  });

  it('prints no number on the pickup', () => {
    const texts = layoutNotation({ mnx: scenario, widthSp: 400 }).primitives
      .filter(p => p.kind === 'text' && p.className === 'measure-number');
    expect(texts).toEqual([]);
  });
});

describe('marking a pickup in the bar inspector', () => {
  const plain = withFirst({ ...scenario.global.measures[0]!, number: undefined });

  it('`pickup` sets the first bar\'s number to 0, and `no pickup` takes it away', () => {
    expect(parseInspectorLine('measure', null, 'pickup')).toEqual({ intent: { type: 'setMeasureAttribute', attribute: { kind: 'number', value: 0 } } });
    expect(parseInspectorLine('measure', null, 'no pickup')).toEqual({ intent: { type: 'removeMeasureAttribute', kind: 'number' } });
    const marked = applyOp(plain, { type: 'setMeasureAttribute', measureIndex: 0, attribute: { kind: 'number', value: 0 } });
    expect(pickupSignature(marked.global.measures)).toEqual({ count: 4, unit: 4 });
  });

  it('the chip reads "pickup" on a pickup, and "number 0" on a full first bar', () => {
    expect(measurePills(scenario, 0).find(p => p.key === 'number')).toMatchObject({ word: 'pickup', value: '' });
    const full = withFirst({ number: 0, time: { count: 4, unit: 4 } });
    expect(measurePills(full, 0).find(p => p.key === 'number')).toMatchObject({ word: 'number', value: '0' });
  });
});
