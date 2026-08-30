// THE NON-SQUARE SWEEP — the half of the golden strategy the goldens cannot be.
//
// Every committed golden is rendered at a SQUARE scale, where the horizontal
// and vertical scales are equal. That makes a whole class of bug arithmetically
// invisible to the corpus: an INK distance written into a POSITION field is
// multiplied by the wrong scale, and at ratio 1 the wrong scale is the right
// one. Four separate instances of exactly that reached a human's eyes before
// anyone thought to look — the rigid columns (core-ink-priced-columns.md), the
// note clusters, the tab fret mask, and the compound barlines, whose two
// strokes had come to OVERLAP at 640% staff scale and drew as a single line.
//
// So this file renders the corpus at ratios the goldens never see and asserts
// the relationships that must survive any scale. It is deliberately about
// RELATIONSHIPS rather than coordinates: a coordinate at ratio 4 is not
// something a human can review, but "the two strokes of a double barline do
// not touch" is a claim anyone can check and no scale may break.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { layoutNotation } from '../../src/engine/layout/notation.ts';
import { layoutTab } from '../../src/engine/layout/tab.ts';
import { layoutBothSystem } from '../../src/engine/layout/bothSystem.ts';
import { glyphBBox } from '../../src/engine/smufl/smufl.ts';
import { MAX_STAFF_SCALE, MIN_STAFF_SCALE } from '../../src/engine/render/scale.ts';
import { planHorizontal, packSystems } from '../../src/engine/layout/spacing.ts';
import type { LayoutResult, Primitive } from '../../src/engine/primitives.ts';
import { initSmufl, WIDTH_SP } from '../helpers/corpusPrimitives.ts';
import { renderSvgToString } from '../helpers/svgString.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
// @ts-expect-error — plain .mjs module without type declarations
import { loadCorpus } from '../verify/check-scenarios.mjs';

const corpus: { id: string; dir: string }[] = loadCorpus();
const readDoc = (dir: string) =>
  JSON.parse(fs.readFileSync(path.join(dir, 'document.mnx.json'), 'utf8')) as MnxStructure;

/**
 * The ratios swept. 1 proves the sweep agrees with the goldens; 4 is a
 * comfortable non-square; `MAX_STAFF_SCALE` is the worst case the viewer can
 * actually produce, since a fitted paint floors the horizontal scale at the
 * baseline and the ratio is then the staff scale itself.
 */
const RATIOS = [1, 4, MAX_STAFF_SCALE];

const cls = (p: Primitive) => (p.className ?? '').split(' ');

/**
 * A primitive's DRAWN horizontal span, in units where a musical position is
 * 1 and an ink extent is `ink` — exactly the split `svg.ts` emits, so this
 * measures what a reader sees rather than what the layout stored.
 */
function drawnSpan(p: Primitive, ink: number): { l: number; r: number } | null {
  const at = (x: number, dx: number | undefined) => x + (dx ?? 0) * ink;
  switch (p.kind) {
    case 'line': {
      const a = at(p.x1, p.dx1);
      const b = at(p.x2, p.dx2);
      const r = (p.thickness * ink) / 2; // stroke-width is ink, both axes
      return { l: Math.min(a, b) - r, r: Math.max(a, b) + r };
    }
    case 'rect': {
      const l = at(p.x, p.dx);
      return { l, r: l + p.w * (p.spanW ? 1 : ink) };
    }
    case 'glyph': {
      const bb = glyphBBox(p.glyph);
      if (!bb) return null;
      const k = (p.scale ?? 1) * ink;
      const x = at(p.x, p.dx);
      const l =
        p.anchor === 'middle' ? x - (bb.w * k) / 2
        : p.anchor === 'end' ? x - (bb.x + bb.w) * k
        : x + bb.x * k;
      return { l, r: l + bb.w * k };
    }
    case 'text': {
      const w = p.text.length * p.size * 0.6 * ink;
      const x = at(p.x, p.dx);
      const l = p.anchor === 'middle' ? x - w / 2 : p.anchor === 'end' ? x - w : x;
      return { l, r: l + w };
    }
    default:
      return null;
  }
}

/** Every layout the corpus can produce, so nothing hides in one projection. */
function layoutsOf(dir: string, ink: number): LayoutResult[] {
  const out: LayoutResult[] = [];
  for (const make of [
    () => layoutNotation({ mnx: readDoc(dir), widthSp: WIDTH_SP, inkRatio: ink }),
    () => layoutTab({ mnx: readDoc(dir), widthSp: WIDTH_SP, inkRatio: ink }),
    () => layoutBothSystem({ mnx: readDoc(dir), widthSp: WIDTH_SP, inkRatio: ink })
  ]) {
    try {
      out.push(make());
    } catch {
      // A layout that throws is another test's business.
    }
  }
  return out;
}

/**
 * The parts of one barline, grouped by the musical position they hang off.
 *
 * Grouping by `x` is exact only because every part of a compound barline now
 * shares the measure's end x and differs only in `dx` — the ink-offset split
 * is what makes this question answerable at all. Before it, the parts were
 * pre-subtracted into different positions and nothing tied them together.
 */
function barlineGroups(layout: LayoutResult): Map<string, Primitive[]> {
  const groups = new Map<string, Primitive[]>();
  for (const p of layout.primitives) {
    const tokens = cls(p);
    if (tokens[0] !== 'barline') continue;
    const x = p.kind === 'line' ? p.x1 : p.kind === 'rect' ? p.x : null;
    if (x === null) continue;
    const y = p.kind === 'line' ? p.y1 : p.kind === 'rect' ? p.y : 0;
    // One key per (position, staff band, style) — two staves' barlines sit at
    // the same x and are not parts of one another.
    const key = `${Math.round(x * 1e4)}:${Math.round(y * 1e4)}:${tokens[1] ?? ''}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return groups;
}

describe('non-square scale — relationships the goldens cannot see', () => {
  /**
   * A barline cluster's drawn extent RELATIVE to the position it hangs off.
   * For a cluster made only of ink — which is what a barline is — this must be
   * exactly proportional to the ink ratio at every scale.
   *
   * Stated as a ratio-1 comparison on purpose. An absolute claim ("the strokes
   * never touch") trips over things that have nothing to do with scale: two
   * coincident group barlines in `spec/orchestral-layout`, or where
   * `spec/repeats` chooses to anchor a repeat cluster. Those are the same at
   * every scale and are somebody else's argument. What this file is for is the
   * bug that only appears off-square, and "the cluster scales as ink" says it
   * exactly.
   */
  const clusterExtents = (layout: LayoutResult, ink: number) => {
    const out = new Map<string, { l: number; r: number }>();
    for (const [key, parts] of barlineGroups(layout)) {
      const x = parts[0].kind === 'line' ? parts[0].x1 : (parts[0] as { x: number }).x;
      const spans = parts
        .map(p => drawnSpan(p, ink))
        .filter((v): v is { l: number; r: number } => v !== null);
      if (!spans.length) continue;
      out.set(key, {
        l: Math.min(...spans.map(v => v.l)) - x,
        r: Math.max(...spans.map(v => v.r)) - x
      });
    }
    return out;
  };

  it('a barline cluster is pure ink: its extent scales with the ink ratio', () => {
    initSmufl();
    let checked = 0;
    for (const s of corpus) {
      const base = layoutsOf(s.dir, 1).map(l => clusterExtents(l, 1));
      for (const ink of RATIOS.filter(r => r !== 1)) {
        layoutsOf(s.dir, ink).forEach((layout, i) => {
          const at1 = base[i];
          if (!at1) return;
          for (const [key, ext] of clusterExtents(layout, ink)) {
            const b = at1.get(key);
            if (!b) continue;
            checked++;
            expect(ext.l, `${s.id} @ink ${ink}: cluster left edge`).toBeCloseTo(b.l * ink, 6);
            expect(ext.r, `${s.id} @ink ${ink}: cluster right edge`).toBeCloseTo(b.r * ink, 6);
          }
        });
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('and that is not vacuous: the pre-2026-08-21 arithmetic fails it', () => {
    initSmufl();
    // The bug, reconstructed: offsets scaled as POSITIONS while the strokes
    // they separate scaled as INK. On the reported case at 640% the two
    // strokes of a double barline came out 3.4px into each other.
    const layout = layoutTab({
      mnx: readDoc(corpus.find(c => c.id.endsWith('twelve-bar-blues'))!.dir),
      widthSp: 90,
      inkRatio: MAX_STAFF_SCALE
    });
    const doubles = [...barlineGroups(layout).values()].filter(
      parts => parts.length === 2 && cls(parts[0])[1] === 'barline-double'
    );
    expect(doubles.length).toBeGreaterThan(0);
    for (const parts of doubles) {
      const asIs = parts
        .map(p => drawnSpan(p, MAX_STAFF_SCALE)!)
        .sort((a, b) => a.l - b.l);
      expect(asIs[1].l - asIs[0].r).toBeGreaterThan(0);
      // The same strokes with their offsets in the old currency: dx applied
      // at the horizontal scale (×1) while the stroke keeps its ink width.
      const old = parts
        .map(p => {
          const line = p as Extract<Primitive, { kind: 'line' }>;
          const centre = line.x1 + (line.dx1 ?? 0); // <-- position-scaled: the bug
          const half = (line.thickness * MAX_STAFF_SCALE) / 2;
          return { l: centre - half, r: centre + half };
        })
        .sort((a, b) => a.l - b.l);
      expect(old[1].l - old[0].r).toBeLessThan(0);
    }
  });

  it('a mask stays over the thing it masks, at every ratio', () => {
    initSmufl();
    let masks = 0;
    for (const s of corpus) {
      for (const ink of RATIOS) {
        for (const layout of layoutsOf(s.dir, ink)) {
          const bgs = layout.primitives.filter(p => cls(p)[0] === 'fret-bg');
          const digits = layout.primitives.filter(p => cls(p)[0] === 'fret-number');
          if (bgs.length !== digits.length) continue;
          for (let i = 0; i < bgs.length; i++) {
            const bg = drawnSpan(bgs[i], ink);
            const d = digits[i];
            if (!bg || d.kind !== 'text') continue;
            masks++;
            const centre = d.x + (d.dx ?? 0) * ink;
            expect(
              Math.abs((bg.l + bg.r) / 2 - centre),
              `${s.id} @ink ${ink}: fret mask off its digit`
            ).toBeLessThan(1e-9);
          }
        }
      }
    }
    expect(masks).toBeGreaterThan(0);
  });

  it('an event column is ink around its slot, so columns cannot converge', () => {
    initSmufl();
    // The same claim one level out: a notehead or fret digit is ink hanging off
    // a plan slot, so the distance from the slot to the glyph's edges scales
    // with ink too. This is what stops a chord from closing up as the staff
    // grows — the failure the note-cluster pricing fixed.
    let checked = 0;
    for (const s of corpus) {
      const heads1 = layoutsOf(s.dir, 1).map(l =>
        l.primitives.filter(p => cls(p)[0] === 'notehead' || cls(p)[0] === 'fret-number')
      );
      for (const ink of RATIOS.filter(r => r !== 1)) {
        layoutsOf(s.dir, ink).forEach((layout, i) => {
          const before = heads1[i];
          if (!before) return;
          const after = layout.primitives.filter(
            p => cls(p)[0] === 'notehead' || cls(p)[0] === 'fret-number'
          );
          if (before.length !== after.length || !before.length) return;
          for (let k = 0; k < before.length; k++) {
            const a = drawnSpan(before[k], 1);
            const b = drawnSpan(after[k], ink);
            if (!a || !b) continue;
            checked++;
            // Width is pure ink…
            expect(b.r - b.l, `${s.id} @ink ${ink}: glyph width`).toBeCloseTo((a.r - a.l) * ink, 6);
          }
        });
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// The other end of the range. Everything above is about ink growing; this is
// about ink running out of pixels. Ink scales with the STAFF, so at the bottom
// of the staff range a hairline falls under one device pixel and a renderer
// can only draw it as grey — the reported symptom was an illegible double
// barline, and the giveaway was that the staff lines were exactly as faint.
describe('minimum drawn ink — a line is always at least a line', () => {
  const MIN_INK_PX = 1;

  /** What the emitter actually writes, at a given pair of scales. */
  const strokeWidths = (mnx: MnxStructure, pxPerSp: number, pxPerSpY: number) => {
    const layout = layoutTab({ mnx, widthSp: 90, inkRatio: pxPerSpY / pxPerSp });
    const svg = renderSvgToString({
      primitives: layout.primitives,
      widthSp: layout.usedWidthSp,
      heightSp: layout.heightSp,
      pxPerSp,
      pxPerSpY
    });
    return [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map(m => Number(m[1]));
  };

  const blues = () => readDoc(corpus.find(c => c.id.endsWith('twelve-bar-blues'))!.dir);

  it('no stroke renders thinner than a device pixel, anywhere in the staff range', () => {
    initSmufl();
    for (const staffScale of [MIN_STAFF_SCALE, 1, MAX_STAFF_SCALE]) {
      const widths = strokeWidths(blues(), 10, staffScale * 10);
      expect(widths.length).toBeGreaterThan(0);
      for (const w of widths) {
        expect(w, `staff ${staffScale}: stroke below a pixel`).toBeGreaterThanOrEqual(MIN_INK_PX);
      }
    }
  });

  it('and that is not vacuous: unfloored, the smallest staff draws 0.6px hairlines', () => {
    initSmufl();
    // The reported case. A tab staff line and a tab barline are both 0.1sp,
    // and at 60% the staff is 6px/sp.
    expect(0.1 * MIN_STAFF_SCALE * 10).toBeCloseTo(0.6, 6);
    expect(0.1 * MIN_STAFF_SCALE * 10).toBeLessThan(MIN_INK_PX);
    // The floor is what closes that gap, and only there. At 60% the thinnest
    // stroke comes out exactly at the floor; at 100% a tab hairline is
    // already exactly a pixel on its own (0.1sp × 10px/sp), which is a neat
    // reminder of how close to the edge the default sits; and by 640% the
    // floor is nowhere near firing.
    expect(Math.min(...strokeWidths(blues(), 10, MIN_STAFF_SCALE * 10))).toBe(MIN_INK_PX);
    expect(Math.min(...strokeWidths(blues(), 10, 10))).toBe(MIN_INK_PX);
    expect(Math.min(...strokeWidths(blues(), 10, MAX_STAFF_SCALE * 10))).toBeGreaterThan(
      MIN_INK_PX * 5
    );
  });

  it('flooring cannot close a compound barline up, anywhere in range', () => {
    initSmufl();
    // Widening a stroke about its own centre brings the two strokes of a
    // double barline toward each other, so the floor has to be checked
    // against the very thing the ink-offset work fixed. At 60% they keep
    // 0.8px; they would only meet below ~33%, which the clamp never reaches.
    const layout = layoutTab({ mnx: blues(), widthSp: 90, inkRatio: MIN_STAFF_SCALE });
    const ky = MIN_STAFF_SCALE * 10;
    const kx = 10;
    for (const parts of [...barlineGroups(layout).values()]) {
      if (parts.length < 2) continue;
      const spans = parts
        .map(p => {
          const line = p as Extract<Primitive, { kind: 'line' }>;
          const centre = (line.x1 + (line.dx1 ?? 0) * (ky / kx)) * kx;
          const half = Math.max(line.thickness * ky, MIN_INK_PX) / 2;
          return { l: centre - half, r: centre + half };
        })
        .sort((a, b) => a.l - b.l);
      for (let i = 1; i < spans.length; i++) {
        expect(spans[i].l - spans[i - 1].r).toBeGreaterThan(0);
      }
    }
  });
});

// A full row justifies, at any staff scale (2026-08-21).
//
// `MAX_STRETCH` was applied to every row, including rows packed as tight as
// the line allows. Below 100% staff scale the rigid columns shrink — they are
// ink — so the springs must supply more of the line and the needed stretch
// crosses 2.5. The row was then left short of the margin, and every time
// density wrapped a bar away the row got SHORTER still: the music narrowed as
// the reader asked for more space. Invisible to the goldens, which are square.
describe('a full row reaches the margin, whatever the staff scale', () => {
  const LADDER = [0.02, 0.03, 0.07, 0.16, 0.27, 0.5, 1];

  const rowWidths = (mnx: MnxStructure, widthSp: number, densityH: number, ink: number) => {
    const l = layoutTab({ mnx, widthSp, densityH, inkRatio: ink });
    const packing = planHorizontal(mnx, widthSp, { staffKind: 'tab' }).packing;
    const rows = packSystems(packing, densityH);
    return l.rows!.map((b, r) => {
      const xs = [
        ...new Set(
          l.primitives
            .filter(
              (p): p is Extract<Primitive, { kind: 'line' }> =>
                p.kind === 'line' &&
                cls(p)[0] === 'barline' &&
                Math.abs(p.y1 - b.staffTop) < 1e-6
            )
            .map(p => Math.round(p.x1 * 1e4) / 1e4)
        )
      ].sort((a, b2) => a - b2);
      return { width: xs[xs.length - 1] - xs[0], full: rows[r]?.full ?? false };
    });
  };

  it('fills the line at every staff scale, not just at 100%', () => {
    initSmufl();
    const mnx = readDoc(corpus.find(c => c.id.endsWith('twelve-bar-blues'))!.dir);
    const widthSp = 96.6;
    const line = widthSp - 2 * 2; // the plan's line, inside its page margins
    let checked = 0;
    for (const ink of [0.6, 0.8, 1, 1.6]) {
      for (const d of LADDER) {
        for (const row of rowWidths(mnx, widthSp, d, ink)) {
          if (!row.full) continue;
          checked++;
          // Reaches the margin or overruns it — never falls short. Overrun is
          // the documented degradation of freezing packing square
          // (core-ink-priced-columns.md): at a high ink ratio the row holds
          // bars chosen at ratio 1 whose grown rigid columns no longer fit, so
          // it draws past the margin rather than colliding. Falling SHORT is
          // the thing that has no defence, and the thing that was happening.
          expect(
            row.width,
            `ink ${ink} density ${d}: full row short of the margin`
          ).toBeGreaterThanOrEqual(line - 1e-4);
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('so the music never narrows as the reader asks for more space', () => {
    initSmufl();
    // The reported symptom, at the staff scale that produced it: SPACE 3 → 7
    // used to take the system from 86.5sp to 80.2sp.
    const mnx = readDoc(corpus.find(c => c.id.endsWith('twelve-bar-blues'))!.dir);
    for (const ink of [0.6, 0.8, 1]) {
      let previous = -Infinity;
      for (const d of LADDER) {
        const first = rowWidths(mnx, 96.6, d, ink)[0];
        if (!first.full) continue;
        expect(first.width, `ink ${ink}: system 1 narrowed at density ${d}`).toBeGreaterThanOrEqual(
          previous - 1e-6
        );
        previous = first.width;
      }
    }
  });
});
