import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MnxStructure } from '../../src/model/mnx.ts';
import { planNotation } from '../../src/engine/notation/notationRenderer.ts';
import { planTab } from '../../src/engine/tab/tabRenderer.ts';
import { planBoth } from '../../src/engine/both/bothRenderer.ts';
import { createLayoutCache } from '../../src/engine/render/layoutCache.ts';
import { initSmufl } from '../helpers/corpusPrimitives.ts';

initSmufl();
const blues = JSON.parse(fs.readFileSync(new URL(
  '../../scenarios/lab/00-document/04-twelve-bar-blues/document.mnx.json', import.meta.url
), 'utf8')) as MnxStructure;
const short = structuredClone(blues);
short.global.measures = short.global.measures.slice(0, 1);
for (const part of short.parts) part.measures = part.measures.slice(0, 1);

// Exercise the public projection entry points: hosts must get the same scale,
// viewport and gesture contracts regardless of which staff they display.
for (const [projection, plan] of [
  ['notation', planNotation], ['tab', planTab], ['both', planBoth]
] as const) {
  describe(`${projection} render plan`, () => {
    it('fits short scores, while explicit and natural scales retain the viewport width', () => {
      const opts = { mnx: short, width: 1200 };
      const fitted = plan(opts);
      expect(fitted.pxPerSp).toBeGreaterThan(10);
      expect(fitted.pxPerSpY).toBe(fitted.pxPerSp);
      expect(fitted.outcome.fitted).toBe(true);
      const fixed = plan({ ...opts, pxPerSp: 12 });
      expect(fixed.pxPerSp).toBe(12);
      expect(fixed.widthSp).toBe(100);
      expect(fixed.outcome.fitted).toBe(false);
      const natural = plan({ ...opts, spacingMode: 'natural' });
      expect(natural.pxPerSp).toBe(10);
      expect(natural.widthSp).toBe(120);
      for (const result of [fitted, fixed, natural]) {
        expect(result.projection).toBe(projection);
        expect(result.className).toBe(`mnx-${projection}-svg`);
        expect(result.viewBoxSp).toMatchObject({ x: 0, w: result.widthSp });
        expect(result.viewBoxSp!.h).toBeGreaterThan(0);
        expect(result.outcome.pxPerSp).toBe(result.pxPerSpY);
      }
    });

    it.each(['fill', 'natural'] as const)('keeps staff size absolute and the horizontal scale stable in %s spacing', spacingMode => {
      const opts = { mnx: short, width: 1200, spacingMode };
      const square = plan(opts);
      const scaled = plan({ ...opts, staffSp: 1.7 });
      expect(scaled.pxPerSp).toBe(square.pxPerSp);
      expect(scaled.pxPerSpY).toBe(17);
      expect(scaled.outcome.staffSp).toBe(1.7);
      expect(scaled.primitives).not.toEqual(square.primitives);
      expect(plan({ ...opts, staffScale: 1.7 })).toEqual(scaled);
      expect(plan({ ...opts, staffSp: 1.7, staffScale: 0.5 })).toEqual(scaled);
    });

    it('reuses only the square pass during a staff gesture and agrees with uncached plans', () => {
      const cache = createLayoutCache();
      const opts = { mnx: blues, width: 800, densityH: 0.7, densityPad: 0.8 };
      plan({ ...opts, cache });
      const square = cache.square;
      for (const staffSp of [0.6, 1.2, 2.4]) {
        expect(plan({ ...opts, staffSp, cache })).toEqual(plan({ ...opts, staffSp }));
        expect(cache.square).toBe(square);
      }
      const resized = { ...opts, width: 600, staffSp: 1.2 };
      expect(plan({ ...resized, cache })).toEqual(plan(resized));
      expect(cache.square).not.toBe(square);
    });
  });
}
