import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { clearanceSpacing, normalizeClearance } from '../../src/engine/clearance.ts';
import { normalizeDisplayOptions } from '../../src/engine/displayOptions.ts';
import { layoutNotation } from '../../src/engine/layout/notation.ts';
import { layoutBothSystem } from '../../src/engine/layout/bothSystem.ts';
import { layoutTab } from '../../src/engine/layout/tab.ts';
import { planHorizontal, packSystems } from '../../src/engine/layout/spacing.ts';
import { anchorY, tightenRows } from '../../src/engine/layout/verticalDensity.ts';
import { computeBoundsSp } from '../../src/engine/render/bounds.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
import type { Primitive } from '../../src/engine/primitives.ts';
import { initSmufl } from '../helpers/corpusPrimitives.ts';

initSmufl();
const levels = Array.from({ length: 9 }, (_, i) => i / 2);
const load = (id: string): MnxStructure => JSON.parse(readFileSync(`scenarios/${id}/document.mnx.json`, 'utf8'));
const blues = load('lab/00-document/04-twelve-bar-blues');
const layouts = { notation: layoutNotation, tab: layoutTab, both: layoutBothSystem };

// Keep stable content extents and measure the result independently of its policy.
//
// Buckets by the layout's OWN ownership when it reports any. Re-deriving it
// from a midpoint would measure the wrong thing: ownership is settled before
// rows move, so ink that reaches past its own staff can finish nearer a
// neighbour, and filing it there would score a row's own flag as the row
// above's overhang. The midpoint remains the fallback for a layout that moved
// no row, where the two agree by construction.
function rowInk(result: ReturnType<typeof layoutNotation>) {
  if (result.rowInkSp) {
    return result.rowInkSp.map(({ top, bottom }) => ({ y: top, h: bottom - top }));
  }
  const boundaries = result.rows.slice(0, -1).map((row, index) =>
    (row.staffBottom + result.rows[index + 1].staffTop) / 2
  );
  const buckets: Primitive[][] = result.rows.map(() => []);
  for (const p of result.primitives) {
    let row = 0;
    while (row < boundaries.length && anchorY(p) >= boundaries[row]) row++;
    buckets[row].push(p);
  }
  return buckets.map(bucket => computeBoundsSp(bucket)!);
}

describe('clearance levels', () => {
  it('normalizes to nine levels without accepting strings or invalid numbers', () => {
    for (const invalid of [undefined, null, NaN, Infinity, -Infinity, '0', {}, false]) expect(normalizeClearance(invalid)).toBe(2);
    expect(normalizeClearance(-1)).toBe(0);
    expect(normalizeClearance(8)).toBe(4);
    expect(normalizeClearance(1.24)).toBe(1);
    expect(normalizeClearance(1.25)).toBe(1.5);
    expect(normalizeDisplayOptions({ clearance: 3.3 })).toMatchObject({ clearance: 3.5 });
  });

  it('keeps all relationships responsive and preserves grouping', () => {
    const responses = levels.map(level => clearanceSpacing(level));
    for (const current of responses) {
      expect(current.pairedInk).toBeLessThan(current.staffInk);
      expect(current.pairedLines).toBeLessThan(current.staffLines);
      expect(current.pairedInk).toBeGreaterThan(0);
    }
    for (let i = 1; i < responses.length; i++) {
      for (const key of ['horizontalMargin', 'cropMargin', 'pairedInk', 'pairedLines', 'staffInk', 'staffLines', 'systemInk', 'prefixGroupExtra'] as const) {
        expect(responses[i][key], key).toBeGreaterThan(responses[i - 1][key]);
      }
      expect(responses[i].prefixPad(0.6)).toBeGreaterThan(responses[i - 1].prefixPad(0.6));
      expect(responses[i].verticalMargin(6, 2)).toBeGreaterThan(responses[i - 1].verticalMargin(6, 2));
    }
    expect(clearanceSpacing(0)).toMatchObject({
      horizontalMargin: 0.1,
      cropMargin: 0.1
    });
    expect(clearanceSpacing(0).verticalMargin(6, 2)).toBe(2.1);
    expect(clearanceSpacing(0).tabOuterMargin(2)).toBe(0.1);
    expect(clearanceSpacing(2)).toMatchObject({ pairedInk: 2, pairedLines: 3, staffInk: 3, staffLines: 4, horizontalMargin: 2, cropMargin: 0.5 });
  });

  it('retains ink and removes spare vertical reservation at the tight endpoint', () => {
    const primitives: Primitive[] = [
      { kind: 'rect', x: 0, y: 3, w: 5, h: 10, className: 'content' },
      { kind: 'rect', x: 0, y: 23, w: 5, h: 10, className: 'content' }
    ];
    const result = tightenRows({ primitives, rows: [{ staffTop: 6, staffBottom: 10 }, { staffTop: 26, staffBottom: 30 }], heightSp: 40, clearance: 0 })!;
    const first = computeBoundsSp([primitives[0]])!;
    const second = computeBoundsSp([primitives[1]])!;
    expect(first.y).toBeCloseTo(0.1);
    expect(second.y - first.y - first.h).toBeCloseTo(1.5);
    expect(result.heightSp - second.y - second.h).toBeCloseTo(0.1);
  });
});

for (const [name, layout] of Object.entries(layouts)) describe(`${name} clearance`, () => {
  it('preserves default output and explicit legacy overrides', () => {
    const options = { mnx: blues, widthSp: 80, display: {} };
    const baseline = layout(options);
    expect(layout({ ...options, display: { clearance: 2 } })).toEqual(baseline);
    for (const densityPad of [0, 0.5, 1, 2, NaN]) {
      const legacy = layout({ ...options, densityPad });
      for (const clearance of [0, 2, 4]) {
        expect(layout({ ...options, densityPad, display: { clearance } })).toEqual(legacy);
      }
    }
  });

  it('changes structural whitespace without changing music or glyph dimensions', () => {
    const before = JSON.stringify(blues);
    const variants = levels.map(clearance => layout({ mnx: blues, widthSp: 1000, spacingMode: 'natural', display: { clearance } }));
    const ink = (result: typeof variants[number]) => result.primitives.filter(p => p.kind === 'glyph').map(p => {
      if (p.kind !== 'glyph') throw new Error('unreachable');
      return [p.glyph, p.scale];
    });
    for (const result of variants) expect(ink(result)).toEqual(ink(variants[0]));
    for (let i = 1; i < variants.length; i++) {
      expect(variants[i].heightSp).toBeGreaterThan(variants[i - 1].heightSp);
      expect(variants[i].usedWidthSp).toBeGreaterThan(variants[i - 1].usedWidthSp);
    }
    expect(JSON.stringify(blues)).toBe(before);
  });

  it('keeps systems separated through all levels, with lyrics and markings', () => {
    for (const id of ['lab/00-document/04-twelve-bar-blues', 'lab/50-lyrics/02-tab-verses', 'spec/tempo-markings']) {
      const doc = load(id);
      for (const clearance of levels) for (const spacingMode of ['natural', 'fill'] as const) {
        const result = layout({ mnx: doc, widthSp: 42, densityH: 0.6, spacingMode, display: { clearance } });
        const ink = rowInk(result);
        for (let i = 1; i < ink.length; i++) {
          expect(ink[i].y - ink[i - 1].y - ink[i - 1].h, `${id}, ${clearance}, ${spacingMode}`).toBeGreaterThanOrEqual(0.49);
        }
        expect(ink[0].y).toBeGreaterThanOrEqual(-1e-8);
        const last = ink.at(-1)!;
        expect(last.y + last.h).toBeLessThanOrEqual(result.heightSp + 1e-8);
      }
    }
  });
});

it('uses clearance-aware packing snapshots at Staff and Space extremes', () => {
  for (const clearance of levels) for (const densityH of [0.02, 0.6, 1, 2]) for (const inkRatio of [0.5, 1, 3]) {
    const plan = planHorizontal(blues, 80, { densityH, inkRatio, display: { clearance } });
    const rows = packSystems(plan.packing, densityH);
    for (const [row, packed] of rows.entries()) for (const index of packed.measures) {
      expect(plan.measures[plan.packing.measures[index].index].row).toBe(row);
    }
    const baseline = planHorizontal(blues, 80, { densityH, inkRatio, display: { clearance: 2 } });
    expect(plan.packing.measures.map(m => [m.spring, m.lead, m.rigid])).toEqual(baseline.packing.measures.map(m => [m.spring, m.lead, m.rigid]));
  }
});

it('moves every actual Both-view staff gap at every half step', () => {
  const gaps = levels.map(clearance => {
    const result = layoutBothSystem({
      mnx: blues,
      widthSp: 1000,
      spacingMode: 'natural',
      display: { clearance }
    });
    const bands = result.displays![0];
    return bands.slice(1).map((band, index) =>
      band.staffTop - bands[index].staffBottom
    );
  });
  for (let level = 1; level < gaps.length; level++) {
    for (let staff = 0; staff < gaps[level].length; staff++) {
      expect(gaps[level][staff]).toBeGreaterThan(gaps[level - 1][staff]);
    }
  }
});

it('does not add prefix padding to a hidden system-opening repeat', () => {
  const doc = load('spec/repeats');
  doc.global.measures[0].repeatStart = true;
  for (const clearance of levels) {
    const plan = planHorizontal(doc, 80, { display: { clearance, clefs: 'hide', timeSignatures: 'hide' } });
    expect(plan.measures[0].repeatStartX).toBe(plan.measures[0].x);
  }
});

it('keeps every flag on its stem at every clearance level', () => {
  // Row attribution is geometric, and `fitRowsToClearance` used to re-derive it
  // after each pass had already moved the rows. A flag on an up-stem anchors at
  // the stem TIP, well above its own staff, so once a pass closed the gaps the
  // midpoint boundary rose past it and the next pass carried it off with the
  // row above while its stem stayed. Only ever below the default, because only
  // there do rows close up. spec/tie-targets reproduced it on three levels.
  const doc = load('spec/tie-targets');
  let checked = 0;
  // Tab staves carry no flags, so only the layouts that draw them are examined.
  for (const [name, layout] of Object.entries(layouts)) {
    for (const clearance of levels) {
      const result = layout({ mnx: doc, widthSp: 80, display: normalizeDisplayOptions({ clearance }) });
      const stems = result.primitives.filter(p => String(p.className ?? '').startsWith('stem'));
      const flags = result.primitives.filter(p => String(p.className ?? '').startsWith('flag'));
      checked += flags.length;
      for (const flag of flags as { x: number; y: number }[]) {
        const onAStem = stems.some(stem => {
          const s = stem as { x1: number; y1: number; y2: number };
          return Math.abs(s.x1 - flag.x) < 1e-6 &&
            (Math.abs(s.y1 - flag.y) < 1e-6 || Math.abs(s.y2 - flag.y) < 1e-6);
        });
        expect(onAStem, `${name} @ clearance ${clearance}: flag at (${flag.x}, ${flag.y}) has no stem`).toBe(true);
      }
    }
  }
  expect(checked, 'the scenario stopped carrying flags').toBeGreaterThan(0);
});
