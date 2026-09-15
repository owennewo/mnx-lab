import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { planHorizontal, packSystems, packingSignature } from '../../src/engine/layout/spacing.ts';
import { layoutNotation } from '../../src/engine/layout/notation.ts';
import { layoutTab } from '../../src/engine/layout/tab.ts';
import { layoutBothSystem } from '../../src/engine/layout/bothSystem.ts';
import { renderSvgMarkup } from '../../src/engine/render/svg.ts';
import { normalizeDisplayOptions } from '../../src/engine/displayOptions.ts';
import { initSmufl } from '../helpers/corpusPrimitives.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

initSmufl();
const load = (id: string): MnxStructure => JSON.parse(readFileSync(`scenarios/${id}/document.mnx.json`, 'utf8'));
const blues = load('lab/00-document/04-twelve-bar-blues');
const densities = [0.01, 0.1, 0.5, 1, 2, 8];

describe('Staff and Space own whitespace', () => {
  it('re-prices cloned packing snapshots exactly like a fresh plan', () => {
    for (const id of ['lab/00-document/04-twelve-bar-blues', 'spec/repeats']) {
      const mnx = load(id);
      for (const spacingMode of ['natural', 'fill'] as const)
      for (const staffKind of ['notation', 'tab'] as const)
      for (const inkRatio of [0.6, 1, 3])
      for (const clefs of ['show', 'hide'] as const) {
        const opts = { spacingMode, staffKind, inkRatio, display: { clefs }, subsequentLeftInsetSp: 4 };
        for (const from of [0.1, 1, 8]) {
          const snapshot = structuredClone(planHorizontal(mnx, 42, { ...opts, densityH: from }).packing);
          for (const densityH of inkRatio === 1 ? densities : [from]) {
            // Non-square governing voice changes are an existing ladder approximation.
            const fresh = planHorizontal(mnx, 42, { ...opts, densityH });
            const cached = packSystems(snapshot, densityH);
            const actual = packSystems(fresh.packing, densityH);
            expect(cached.map(row => row.measures), JSON.stringify({id, spacingMode, staffKind, inkRatio, clefs, from, densityH})).toEqual(actual.map(row => row.measures));
            cached.forEach((row, i) => expect(row.stretch).toBeCloseTo(actual[i].stretch, 9));
            expect(packingSignature([snapshot], densityH)).toBe(packingSignature([fresh.packing], densityH));
            actual.forEach((row, i) => row.measures.forEach(k =>
              expect(fresh.measures[fresh.packing.measures[k].index].row).toBe(i)));
          }
        }
      }
    }
  });

  it('changes horizontal air while preserving glyph sizes and vertical proportions', () => {
    // One forced system isolates vertical proportions from changes in line breaks.
    const mnx = load('lab/50-lyrics/02-tab-verses');
    for (const layout of [layoutNotation, layoutTab, layoutBothSystem]) {
      const samples = densities.map(densityH => layout({ mnx, widthSp: 2000, densityH, spacingMode: 'natural' }));
      const sizes = (result: typeof samples[number]) => result.primitives.filter(p => p.kind === 'glyph' || p.kind === 'text')
        .map(p => { const { x: _x, ...other } = p; return other; });
      samples.forEach(result => {
        expect(sizes(result)).toEqual(sizes(samples[0]));
        expect(result.rows.map(row => [row.staffTop, row.staffBottom])).toEqual(
          samples[0].rows.map(row => [row.staffTop, row.staffBottom]));
      });
      // The emitter scales vertical geometry once, together with the staff.
      const base = samples[0];
      const svg = (scale: number) => renderSvgMarkup({ ...base, pxPerSp: 10, pxPerSpY: scale });
      const height = (s: string) => Number(/height="([\d.]+)"/.exec(s)![1]);
      expect(height(svg(20))).toBeCloseTo(2 * height(svg(10)), 3);
    }
  });

  it('keeps hidden-prefix forward repeats on their barline at every Space setting', () => {
    const mnx = structuredClone(blues);
    mnx.global.measures[0].repeatStart = true;
    for (const densityH of densities) {
      const plan = planHorizontal(mnx, 42, { densityH, display: { clefs: 'hide', timeSignatures: 'hide' } });
      expect(plan.measures[0].repeatStartX).toBe(plan.measures[0].x);
      expect(plan.packing.contentRightPadSp).toBeGreaterThan(0);
    }
  });

  it('distinguishes automatic whitespace from explicit host overrides', () => {
    expect(normalizeDisplayOptions({})).not.toHaveProperty('clearance');
    expect(normalizeDisplayOptions({ clearance: 2 }).clearance).toBe(2);
    for (const display of [{ clearance: 0 }, { clearance: 2 }, { clearance: 4 }]) {
      const a = planHorizontal(blues, 80, { densityH: 0.1, display });
      const b = planHorizontal(blues, 80, { densityH: 8, display });
      expect(a.packing.contentRightPadSp).toBe(b.packing.contentRightPadSp);
      expect(a.packing.measures.map(m => [m.prefixFirst, m.prefixRest])).toEqual(
        b.packing.measures.map(m => [m.prefixFirst, m.prefixRest]));
    }
  });
});
