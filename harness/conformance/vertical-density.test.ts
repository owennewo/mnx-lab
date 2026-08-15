// The vertical-density axis's engine contract
// (roadmap/complete/core-vertical-density.md).
//
// The axis exists because the row pads are worst-case reservations that almost
// no row uses: measured over the committed goldens, a notation staff reserves
// 6sp above itself and uses a median of 0.5, and a tab staff reserves 4sp and
// uses a median of 0.0. So the interesting claims are not "the knob moves a
// number" but the two that make the knob safe to offer:
//
//  1. **Density 1 does not run.** The pass returns null and no primitive
//     moves, which is why every committed golden is byte-identical rather
//     than identical-by-arithmetic. `npm run update:primitives` is the other
//     half of this assertion; this half pins the mechanism.
//
//  2. **Tightening is floored by ink, not by a constant.** `densityH` enjoys
//     a structural collision guarantee — springs scale, rigid columns do not
//     — and this axis has no equivalent: the row pads ARE the vertical
//     clearance. The floor is therefore each row's measured ink, and the
//     guarantee asserted here is that consecutive systems never overlap at
//     ANY value down to and past the clamp. If that stops holding, the pads
//     are back to being the only thing standing between one system's stems
//     and the system above.
//
// The third claim is the payoff, and it is asymmetric on purpose: the same
// density buys far more on a tab score than a notation one, because the space
// reclaimed is the space nothing was using.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { layoutTab } from '../../src/engine/layout/tab.ts';
import { layoutNotation } from '../../src/engine/layout/notation.ts';
import {
  clampPadDensity,
  padDensityFor,
  MIN_PAD_DENSITY,
  MAX_PAD_DENSITY
} from '../../src/engine/layout/verticalDensity.ts';
import { computeBoundsSp } from '../../src/engine/render/bounds.ts';
import { initSmufl, WIDTH_SP } from '../helpers/corpusPrimitives.ts';
// @ts-expect-error — plain .mjs module without type declarations
import { ROOT } from '../verify/check-scenarios.mjs';
import type { MnxStructure } from '../../src/model/mnx.ts';
import type { LayoutResult, Primitive } from '../../src/engine/primitives.ts';

initSmufl();

function load(id: string): MnxStructure {
  return JSON.parse(
    fs.readFileSync(path.join(ROOT, 'scenarios', id, 'score.mnx.json'), 'utf8')
  ) as MnxStructure;
}

/** A score that wraps to several systems in both views — so there are gaps
 *  between systems for this axis to have an opinion about. */
const MULTI_SYSTEM = 'lab/00-document/04-twelve-bar-blues';

/**
 * The ink extent of each row, measured the way the layout pass measures it:
 * primitives bucketed to the nearest row band, then through the same
 * `computeBoundsSp` the snug-crop viewport uses (real SMuFL glyph boxes, not
 * baselines).
 */
function rowInk(layout: LayoutResult): { top: number; bottom: number }[] {
  const boundaries: number[] = [];
  for (let r = 0; r + 1 < layout.rows.length; r++) {
    boundaries.push((layout.rows[r].staffBottom + layout.rows[r + 1].staffTop) / 2);
  }
  const anchor = (p: Primitive): number =>
    p.kind === 'line' ? (p.y1 + p.y2) / 2
    : p.kind === 'curve' ? (p.points[0].y + p.points[3].y) / 2
    : p.y;
  const buckets: Primitive[][] = layout.rows.map(() => []);
  for (const p of layout.primitives) {
    let r = 0;
    while (r < boundaries.length && anchor(p) >= boundaries[r]) r++;
    buckets[r].push(p);
  }
  return buckets.map(b => {
    const bb = computeBoundsSp(b);
    return bb ? { top: bb.y, bottom: bb.y + bb.h } : { top: 0, bottom: 0 };
  });
}

describe('vertical density — the clamp and the coupling', () => {
  it('defaults to 1, and 1 is the identity', () => {
    expect(clampPadDensity(undefined)).toBe(1);
    expect(clampPadDensity(null)).toBe(1);
    expect(clampPadDensity(Number.NaN)).toBe(1);
    expect(padDensityFor(1)).toBe(1);
  });

  it('clamps out of range, both ends', () => {
    expect(clampPadDensity(-5)).toBe(MIN_PAD_DENSITY);
    expect(clampPadDensity(99)).toBe(MAX_PAD_DENSITY);
  });

  it('couples monotonically, and sub-linearly', () => {
    // Sub-linear is the whole reason the coupling is a curve and not a copy:
    // horizontal density runs usefully to 0.02, padding is spent by ~0.3, so
    // a linear coupling would park the pads on their floor for nearly the
    // entire travel of the arm that drives them.
    expect(padDensityFor(0.25)).toBeGreaterThan(0.25);
    expect(padDensityFor(0.5)).toBeGreaterThan(0.5);
    expect(padDensityFor(2)).toBeLessThan(2);
    for (const [lo, hi] of [[0.02, 0.1], [0.1, 0.5], [0.5, 1], [1, 2]]) {
      expect(padDensityFor(lo)).toBeLessThan(padDensityFor(hi));
    }
  });
});

describe('vertical density — density 1 does not run', () => {
  for (const view of ['tab', 'notation'] as const) {
    it(`${view}: an unset value and an explicit 1 are the same layout`, () => {
      const mnx = load(MULTI_SYSTEM);
      const run = (densityPad?: number) =>
        view === 'tab'
          ? layoutTab({ mnx, widthSp: WIDTH_SP, densityPad })
          : layoutNotation({ mnx, widthSp: WIDTH_SP, densityPad });
      const unset = run();
      const one = run(1);
      expect(one.heightSp).toBe(unset.heightSp);
      expect(one.primitives).toEqual(unset.primitives);
      expect(one.rows).toEqual(unset.rows);
    });
  }
});

describe('vertical density — the floor is ink, not a constant', () => {
  for (const view of ['tab', 'notation'] as const) {
    // Past the clamp as well as at it: a host may send anything, and the
    // guarantee is not allowed to depend on the clamp having caught it.
    for (const k of [0.6, 0.3, MIN_PAD_DENSITY, -1]) {
      it(`${view}: systems never overlap at padDensity ${k}`, () => {
        const mnx = load(MULTI_SYSTEM);
        const layout =
          view === 'tab'
            ? layoutTab({ mnx, widthSp: WIDTH_SP, densityPad: k })
            : layoutNotation({ mnx, widthSp: WIDTH_SP, densityPad: k });
        expect(layout.rows.length).toBeGreaterThan(1);
        const ink = rowInk(layout);
        for (let r = 0; r + 1 < ink.length; r++) {
          expect(ink[r + 1].top).toBeGreaterThan(ink[r].bottom);
        }
      });
    }
  }

  it('tightening is monotone in the knob', () => {
    const mnx = load(MULTI_SYSTEM);
    const at = (densityPad: number) => layoutTab({ mnx, widthSp: WIDTH_SP, densityPad }).heightSp;
    expect(at(0.3)).toBeLessThan(at(0.6));
    expect(at(0.6)).toBeLessThan(at(1));
    expect(at(1)).toBeLessThan(at(1.5));
  });
});

describe('vertical density — what the axis actually buys', () => {
  it('reclaims more from tab than from notation, because tab reserves more it does not use', () => {
    const mnx = load(MULTI_SYSTEM);
    const shrink = (full: number, tight: number) => (full - tight) / full;

    const tab = shrink(
      layoutTab({ mnx, widthSp: WIDTH_SP }).heightSp,
      layoutTab({ mnx, widthSp: WIDTH_SP, densityPad: 0 }).heightSp
    );
    const notation = shrink(
      layoutNotation({ mnx, widthSp: WIDTH_SP }).heightSp,
      layoutNotation({ mnx, widthSp: WIDTH_SP, densityPad: 0 }).heightSp
    );

    // Both are real; tab is the dramatic one. A tab staff's median ink above
    // it is 0.0sp against a 4sp reservation.
    expect(notation).toBeGreaterThan(0.1);
    expect(tab).toBeGreaterThan(notation);
  });

  it('scales the page margin too, floored so a system is never flush to the edge', () => {
    const mnx = load(MULTI_SYSTEM);
    const wide = layoutTab({ mnx, widthSp: WIDTH_SP });
    const tight = layoutTab({ mnx, widthSp: WIDTH_SP, densityPad: 0 });
    const leftOf = (l: LayoutResult) =>
      Math.min(...l.primitives.filter(p => p.kind === 'line').map(p => Math.min(p.x1, p.x2)));
    expect(leftOf(tight)).toBeLessThan(leftOf(wide));
    expect(leftOf(tight)).toBeGreaterThan(0);
  });
});
