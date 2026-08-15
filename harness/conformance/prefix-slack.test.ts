// What the prefix — barline to first note — actually reserves, and why the
// standalone tab view used to reserve more than it could ever draw.
//
// Two claims, and they are different in kind:
//
//  1. **A tab-only system draws no key signature, so it must not budget for
//     one.** The plan is shared with the notation layout on purpose (columns
//     align in the `both` view), and the cost of sharing was that a tab score
//     in one sharp reserved a key-signature column it had nothing to put in,
//     and sized its clef slot for a treble clef it never draws. That is waste,
//     not a knob — it is fixed at every density.
//
//  2. **The prefix's PADS are whitespace and follow `densityPad`; its glyph
//     SLOTS are rigid and do not.** core-zoom-density-pad.md ruling 1 is why
//     the slots must not move (a clef occupies the width it occupies at a
//     given staff size) — but that ruling was never an argument for the *air*
//     between them being rigid too, which is what made the whole gap ignore
//     the spacing control.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { planHorizontal } from '../../src/engine/layout/spacing.ts';
import { initSmufl, WIDTH_SP } from '../helpers/corpusPrimitives.ts';
// @ts-expect-error — plain .mjs module without type declarations
import { ROOT } from '../verify/check-scenarios.mjs';
import type { MnxStructure } from '../../src/model/mnx.ts';

initSmufl();

/** In one sharp, so a key-signature column is genuinely at stake. */
const KEYED = 'lab/00-document/04-twelve-bar-blues';

function load(id: string): MnxStructure {
  return JSON.parse(
    fs.readFileSync(path.join(ROOT, 'scenarios', id, 'score.mnx.json'), 'utf8')
  ) as MnxStructure;
}

/** Barline → first event of the first measure. */
function prefixSp(mnx: MnxStructure, opts: Parameters<typeof planHorizontal>[2]): number {
  const m = planHorizontal(mnx, WIDTH_SP, opts).measures[0];
  return m.voices[0][0].x - m.x;
}

describe('the prefix a standalone tab staff reserves', () => {
  it('budgets no key-signature column, and a tab-sized clef slot', () => {
    const mnx = load(KEYED);
    const notation = planHorizontal(mnx, WIDTH_SP).measures[0];
    const tab = planHorizontal(mnx, WIDTH_SP, { staffKind: 'tab' }).measures[0];

    // The document really is keyed — otherwise this asserts nothing.
    expect(notation.showKeySig).toBe(true);
    expect(tab.showKeySig).toBe(false);

    // 1sp off the clef slot (3 → 2) and the whole 1.5sp key-signature column.
    expect(notation.timeSigCentreX - tab.timeSigCentreX).toBeCloseTo(2.5, 6);
  });

  it('leaves the notation plan exactly where it was', () => {
    const mnx = load(KEYED);
    const explicit = planHorizontal(mnx, WIDTH_SP, { staffKind: 'notation' }).measures[0];
    const defaulted = planHorizontal(mnx, WIDTH_SP).measures[0];
    expect(explicit).toEqual(defaulted);
  });
});

describe('the prefix and the frame axis', () => {
  it('tightens with densityPad, on both staff kinds', () => {
    const mnx = load(KEYED);
    for (const staffKind of ['notation', 'tab'] as const) {
      expect(prefixSp(mnx, { staffKind, densityPad: 0.5 }))
        .toBeLessThan(prefixSp(mnx, { staffKind }));
    }
  });

  it('never lets the glyphs touch, however far it is pushed', () => {
    const mnx = load(KEYED);
    // The clef slot is rigid, so the gap it opens is the floor the pads keep.
    for (const staffKind of ['notation', 'tab'] as const) {
      const m = planHorizontal(mnx, WIDTH_SP, { staffKind, densityPad: 0 }).measures[0];
      expect(m.clefX - m.x).toBeGreaterThan(0);
      expect(m.timeSigCentreX).toBeGreaterThan(m.clefX);
      expect(m.voices[0][0].x).toBeGreaterThan(m.timeSigCentreX);
    }
  });

  it('does not move the default plan — the goldens are the other half of this', () => {
    const mnx = load(KEYED);
    expect(planHorizontal(mnx, WIDTH_SP, { densityPad: 1 }).measures[0])
      .toEqual(planHorizontal(mnx, WIDTH_SP).measures[0]);
  });
});
