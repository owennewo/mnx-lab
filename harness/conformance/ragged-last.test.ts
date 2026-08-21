// The last system borrows its stretch from the page
// (roadmap/inprogress/core-ragged-last.md).
//
// `packSystems` justifies every row toward the full line width, clamped to
// [MIN_SQUEEZE, MAX_STRETCH]. A full row lands near 1; a sparse FINAL row
// computes a huge stretch and sits at the 2.5 cap — two and a half times the
// texture of every row above it, and still short of the margin. The rule is
// page-relative rather than a fill threshold: the last row may not be looser
// than the loosest other row. These pin the rule itself, its reach across the
// corpus, the reported case, and the single-system scope that confines the
// golden churn.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  planHorizontal,
  packSystems,
  capLastRowStretch,
  MAX_STRETCH,
  MIN_SQUEEZE,
  type PackingInput
} from '../../src/engine/layout/spacing.ts';
import { initSmufl } from '../helpers/corpusPrimitives.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
// @ts-expect-error — plain .mjs module without type declarations
import { loadCorpus } from '../verify/check-scenarios.mjs';

const corpus: { id: string; dir: string }[] = loadCorpus();
const dirById = new Map(corpus.map(s => [s.id, s.dir]));

function doc(id: string): MnxStructure {
  const dir = dirById.get(id);
  if (!dir) throw new Error(`unknown scenario id: ${id}`);
  return JSON.parse(fs.readFileSync(path.join(dir, 'score.mnx.json'), 'utf8')) as MnxStructure;
}

/**
 * The packer's own justification, UNCAPPED and unruled — a deliberate mirror
 * of `packSystems`' arithmetic (same terms, same order) so a test can say what
 * a row WOULD have been and show the rules actually bit.
 */
function rawStretches(
  packing: PackingInput,
  rows: readonly { measures: readonly number[] }[]
): number[] {
  const contentRightPad = packing.contentRightPadSp ?? 0.8;
  return rows.map(({ measures }) => {
    let rowRigid = 0;
    let rowSpring = 0;
    measures.forEach((k, j) => {
      const m = packing.measures[k];
      rowRigid +=
        (j === 0 ? m.prefixFirst : m.prefixRest) + m.rigid + contentRightPad + m.repeatExtra;
      rowSpring += m.spring + m.lead;
    });
    if (rowSpring <= 0) return 1;
    return Math.max(MIN_SQUEEZE, (packing.lineWidthSp - rowRigid) / rowSpring);
  });
}

/**
 * The whole rule on top of those numbers, mirrored: a FULL row justifies to
 * the margin, a row nobody filled is held to the loosest full row — the page's
 * own texture — and `MAX_STRETCH` only stands in when the page has no full row
 * to read (2026-08-21). Then the page-relative last-row cap.
 */
function ruledStretches(
  packing: PackingInput,
  rows: readonly { measures: readonly number[]; full: boolean }[]
): number[] {
  const raw = rawStretches(packing, rows);
  const bodies = raw.filter((_, i) => rows[i].full);
  const ceiling = bodies.length > 0 ? Math.max(...bodies) : MAX_STRETCH;
  return capLastRowStretch(
    raw.map((v, i) => (rows[i].full ? v : Math.max(MIN_SQUEEZE, Math.min(v, ceiling))))
  );
}

describe('ragged last', () => {
  it('the rule: never looser than the loosest other row, never below natural, never raised', () => {
    expect(capLastRowStretch([])).toEqual([]);
    // One system is not a page: nothing to disagree with, today's answer stands.
    expect(capLastRowStretch([2.5])).toEqual([2.5]);
    expect(capLastRowStretch([1.1, 2.5])).toEqual([1.1, 1.1]);
    // Compression is a necessity the full rows were forced into, not a texture.
    expect(capLastRowStretch([0.8, 2.5])).toEqual([0.8, 1]);
    // Only ever lowers — an overfull last row keeps its squeeze.
    expect(capLastRowStretch([1.2, 0.9])).toEqual([1.2, 0.9]);
    expect(capLastRowStretch([1.0, 1.3, 2.5])).toEqual([1.0, 1.3, 1.3]);
    // The others are never touched.
    expect(capLastRowStretch([2.5, 2.4, 0.5])).toEqual([2.5, 2.4, 0.5]);
  });

  it('holds across the whole corpus, at the golden width and a narrow one', () => {
    initSmufl();
    let multiSystem = 0;
    for (const s of corpus) {
      const mnx = JSON.parse(
        fs.readFileSync(path.join(s.dir, 'score.mnx.json'), 'utf8')
      ) as MnxStructure;
      for (const widthSp of [40, 80]) {
        let packing: PackingInput;
        try {
          packing = planHorizontal(mnx, widthSp).packing;
        } catch {
          continue; // unsupported content — not this test's business
        }
        const rows = packSystems(packing, 1);
        if (rows.length < 2) continue;
        multiSystem++;
        const others = rows.slice(0, -1).map(r => r.stretch);
        expect(rows[rows.length - 1].stretch).toBeLessThanOrEqual(Math.max(1, ...others) + 1e-9);
        // And the single shared helper is what produced it — the packer does
        // not carry a second copy of the rule.
        expect(rows.map(r => r.stretch)).toEqual(ruledStretches(packing, rows));
      }
    }
    expect(multiSystem).toBeGreaterThan(0);
  });

  it('the reported case: the leftover bar sets at its page\'s texture, not the cap', () => {
    initSmufl();
    // twelve-bar-blues, swept over widths: wherever the packer strands bars on
    // a final system that could not reach the margin, the uncapped stretch
    // was the cap and the rule pulled it down to the page.
    const mnx = doc('lab/document/twelve-bar-blues');
    let bit = 0;
    for (let widthSp = 50; widthSp <= 140; widthSp += 5) {
      const packing = planHorizontal(mnx, widthSp).packing;
      const rows = packSystems(packing, 1);
      if (rows.length < 2) continue;
      const raw = rawStretches(packing, rows);
      const last = rows[rows.length - 1].stretch;
      const ceiling = Math.max(1, ...rows.slice(0, -1).map(r => r.stretch));
      if (raw[raw.length - 1] > ceiling + 1e-9) {
        bit++;
        expect(last).toBeCloseTo(ceiling, 9);
        expect(last).toBeLessThan(raw[raw.length - 1]);
      }
    }
    expect(bit).toBeGreaterThan(0);
  });

  it('a LOOSE page keeps its leftover row: the ceiling is the page, not the constant', () => {
    initSmufl();
    // 18.4sp of line is the staff at 640% on a full-width pane, and 6% density
    // on top: one bar per system, every full row stretching far past
    // MAX_STRETCH to reach the margin. The final stranded bar used to be
    // pinned at 2.5 — the TIGHTEST system on a very loose page, which is the
    // exact inversion of what this rule exists to prevent — and its stretch
    // was then the only thing on the page density could still move.
    const packing = planHorizontal(doc('lab/document/twelve-bar-blues'), 1180 / 64).packing;
    const rows = packSystems(packing, 0.06);
    expect(rows.length).toBeGreaterThan(2);
    const others = rows.slice(0, -1).map(r => r.stretch);
    // The page IS loose — that is the premise, and the first system being
    // squeezed against its own ink does not change it.
    expect(Math.max(...others)).toBeGreaterThan(MAX_STRETCH);
    const last = rows[rows.length - 1].stretch;
    expect(last).toBeGreaterThan(MAX_STRETCH);
    expect(last).toBeLessThanOrEqual(Math.max(...others) + 1e-9);
  });

  it('a single-system score is untouched — one system is not a page', () => {
    initSmufl();
    const packing = planHorizontal(doc('lab/tab-positions/open-strings-chord'), 80).packing;
    const rows = packSystems(packing, 1);
    expect(rows.length).toBe(1);
    expect(rows[0].stretch).toBe(ruledStretches(packing, [rows[0]])[0]);
  });

  it('the ink-priced path applies the same rule', () => {
    initSmufl();
    // Under an ink ratio the plan re-justifies rows itself (core-ink-priced-
    // columns.md) rather than reading the packer's numbers — so it must cap
    // the same way. Read the last row's stretch back off the plan: with no
    // forward repeat, contentStartX − repeatStartX is the leading spring times
    // the row stretch, and the leading spring is the same in both plans.
    const mnx = doc('lab/document/twelve-bar-blues');
    let checked = 0;
    for (const widthSp of [70, 80, 100]) {
      const square = planHorizontal(mnx, widthSp);
      const priced = planHorizontal(mnx, widthSp, { inkRatio: 1.3 });
      const rows = packSystems(square.packing, 1);
      if (rows.length < 2) continue;
      const lead = (plan: typeof square, i: number) =>
        plan.measures[i].contentStartX - plan.measures[i].repeatStartX;
      // Per row: the leading spring from the square plan (lead ÷ its known
      // stretch), then the priced row's stretch from the priced lead.
      const pricedStretch = rows.map(row => {
        const i = square.packing.measures[row.measures[0]].index;
        if (square.measures[i].repeatStart) return null; // lead would include the |: cluster
        const leadSpring = lead(square, i) / row.stretch;
        return leadSpring > 0 ? lead(priced, i) / leadSpring : null;
      });
      if (pricedStretch.some(s => s === null)) continue;
      const stretches = pricedStretch as number[];
      const others = stretches.slice(0, -1);
      expect(stretches[stretches.length - 1]).toBeLessThanOrEqual(Math.max(1, ...others) + 1e-9);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});
