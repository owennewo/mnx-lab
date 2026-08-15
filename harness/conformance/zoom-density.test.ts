// The zoom/density pad's engine-side contract
// (roadmap/proposed/core-zoom-density-pad.md).
//
// The pad itself lives in `workbench/`, which nothing may import — so what is
// testable here is exactly what should be: the ENGINE behavior the pad binds.
// Three claims, each of which the doc argues in prose and would otherwise have
// to keep arguing:
//
//  1. **The horizontal floor is a legibility floor, not a collision floor.**
//     Ruling 1 deletes a whole feature — the mock's "computed floor,
//     recomputed each layout pass" — on the grounds that no density can make
//     ink collide. That guarantee is asserted here at and below the clamp. If
//     it ever stops holding, the deleted feature is owed a second look, and
//     this is where that gets noticed.
//
//     Scope note, because it was measured rather than assumed: this pins the
//     GUARANTEE, not the mechanism. Collision is prevented twice over — the
//     rigid columns density never scales, AND the justifier, which hands width
//     back to the springs when the rigid sum shrinks. Deliberately scaling the
//     rigid core (the mutation this test was checked against) moves the
//     tightest gap on `twelve-bar-blues` from 1.745sp to 1.540sp and still
//     does not breach CORE_SP — so no plan-level assertion can isolate the
//     springs-only design as the sole cause. The mechanism's own guard is
//     viewer-surface.test.ts's "leaves the RIGID prefix alone", which reads
//     the prefix geometry directly.
//
//  2. **Unset staff scale means FITTED, not 1.** The precedence chain's
//     "unset defers downward" applied to a scalar, which is the one place it
//     is easy to get wrong: sending `pxPerSp: 10` and sending nothing look
//     equivalent until a short score stops filling the viewport.
//
//  3. **The standalone tab view honours density.** It shipped without it and
//     so ignored `density=` entirely — found only when the pad had to drive
//     all three views.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { layoutTab } from '../../src/engine/layout/tab.ts';
import {
  planHorizontal,
  clampDensity,
  CORE_SP,
  MIN_DENSITY,
  MAX_DENSITY
} from '../../src/engine/layout/spacing.ts';
import {
  BASELINE_PX_PER_SP,
  MIN_STAFF_SCALE,
  MAX_STAFF_SCALE,
  clampStaffScale,
  renderScale
} from '../../src/engine/render/scale.ts';
import { initSmufl } from '../helpers/corpusPrimitives.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
// @ts-expect-error — plain .mjs module without type declarations
import { loadCorpus } from '../verify/check-scenarios.mjs';

const dirById = new Map<string, string>(
  loadCorpus().map((s: { id: string; dir: string }) => [s.id, s.dir])
);

function doc(id: string): MnxStructure {
  const dir = dirById.get(id);
  if (!dir) throw new Error(`unknown scenario id: ${id}`);
  return JSON.parse(fs.readFileSync(path.join(dir, 'score.mnx.json'), 'utf8')) as MnxStructure;
}

describe('zoom / density', () => {
  describe('the horizontal floor is legibility, not collision (ruling 1)', () => {
    // A plan exposes each event as its notehead column's CENTRE (`EventSlot`
    // is `{x}` and nothing else). Every such column is the rigid CORE_SP wide,
    // so two columns overlap exactly when their centres come closer together
    // than CORE_SP. That is the whole collision question, in one number.
    // `widthSp` matters more than it looks. On a comfortably-wide line the
    // justifier stretches springs to fill the row, so it would MASK a broken
    // rigid invariant — shrink the columns and justification quietly hands the
    // width back to the springs. The honest test is a SQUEEZED row, where the
    // springs are already at their compression floor and the rigid columns are
    // all that is holding the glyphs apart.
    const tightestGapSp = (densityH: number, widthSp = 20) => {
      const plan = planHorizontal(doc('lab/document/twelve-bar-blues'), widthSp, { densityH });
      let tightest = Infinity;
      for (const measure of plan.measures) {
        for (const staff of measure.staves) {
          for (const voice of staff) {
            for (let i = 1; i < voice.length; i++) {
              tightest = Math.min(tightest, voice[i].x - voice[i - 1].x);
            }
          }
        }
      }
      return tightest;
    };

    it('no glyph columns overlap, at the floor or below it', () => {
      initSmufl();
      // Squeezed AND comfortable: the two rows behave differently, and the
      // guarantee has to hold on both.
      expect(tightestGapSp(MIN_DENSITY)).toBeGreaterThanOrEqual(CORE_SP - 1e-9);
      expect(tightestGapSp(MIN_DENSITY, 80)).toBeGreaterThanOrEqual(CORE_SP - 1e-9);
      // Below the floor too: planHorizontal clamps internally, so an absurd
      // value is survivable rather than merely rejected.
      expect(tightestGapSp(0.01)).toBeGreaterThanOrEqual(CORE_SP - 1e-9);
    });

    it('the springs really did shrink — the gap test is not vacuous', () => {
      initSmufl();
      // Guards the assertions above: if density stopped tightening anything,
      // they would all pass while proving nothing. Read on a WIDE line, where
      // there is still spring left to remove.
      expect(tightestGapSp(MIN_DENSITY, 80)).toBeLessThan(tightestGapSp(1, 80));
    });

    it('the floor still BITES, so a control has something to report', () => {
      initSmufl();
      expect(clampDensity(0.01)).toBe(MIN_DENSITY);
      expect(clampDensity(99)).toBe(MAX_DENSITY);
      // Exported so the pad shows the engine's real bound instead of restating
      // a number that could drift out of step with it.
      expect(MIN_DENSITY).toBeLessThan(1);
      expect(MAX_DENSITY).toBeGreaterThan(1);
    });
  });

  describe('staff scale (ruling 2)', () => {
    it('clamps to the design range, and passes null through as FITTED', () => {
      expect(clampStaffScale(0.1)).toBe(MIN_STAFF_SCALE);
      expect(clampStaffScale(9)).toBe(MAX_STAFF_SCALE);
      expect(clampStaffScale(1.2)).toBe(1.2);
      // null is not 1 and must never become 1: it is the absence that tells
      // the renderers to fit. A clamp that "helpfully" defaulted would retire
      // fit-to-width for every host that never set the prop.
      expect(clampStaffScale(null)).toBeNull();
      expect(clampStaffScale(undefined)).toBeNull();
      expect(clampStaffScale(Number.NaN)).toBeNull();
    });

    it('reports scale against one baseline, so the three renderers agree', () => {
      expect(renderScale(BASELINE_PX_PER_SP, false).staffScale).toBe(1);
      expect(renderScale(BASELINE_PX_PER_SP * 1.5, false).staffScale).toBe(1.5);
      // `fitted` is carried, not inferred: a control has to say the number was
      // derived from the viewport rather than chosen.
      expect(renderScale(13.4, true).fitted).toBe(true);
    });
  });

  describe('the standalone tab view honours density (ruling: the found gap)', () => {
    const tabWidth = (densityH?: number) =>
      layoutTab({ mnx: doc('lab/tab-positions/open-strings-chord'), widthSp: 80, densityH })
        .usedWidthSp;

    it('compact narrows it and spacious widens it, as on the notation staff', () => {
      initSmufl();
      expect(tabWidth(0.65)).toBeLessThan(tabWidth(1));
      expect(tabWidth(1.5)).toBeGreaterThan(tabWidth(1));
    });

    it('default is byte-identical to passing nothing', () => {
      initSmufl();
      // The guard on the whole change: `density` reaching a view that ignored
      // it must not move that view's DEFAULT engraving. 30 committed tab
      // goldens depend on this being exactly true.
      const plain = layoutTab({
        mnx: doc('lab/tab-positions/open-strings-chord'),
        widthSp: 80
      });
      const explicit = layoutTab({
        mnx: doc('lab/tab-positions/open-strings-chord'),
        widthSp: 80,
        densityH: 1
      });
      expect(JSON.stringify(explicit.primitives)).toBe(JSON.stringify(plain.primitives));
    });
  });
});
