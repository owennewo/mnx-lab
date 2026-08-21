// Vertical distance is measured ink to ink
// (roadmap/proposed/core-ink-measured-gaps.md).
//
// Stage A — the score-text row. A section/rehearsal label and a tempo mark
// sit exactly one COHESION clearance above whatever ink their bar already
// carries over its top staff (stems, beams, voltas, brackets — things a `.y`
// read could never see), or at the minimum rise when the space is clear. The
// equality is the point: a lower bound alone proves non-collision; the upper
// bound is what proves the label belongs to its staff rather than floating.
//
// Written against the primitives, not the helper: bars are read off the
// barlines and "the ink above the bar" is re-derived here, so the engine's
// scan and this test can only agree by both being right.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  layoutNotation,
  MIN_STAFF_GAP_SP,
  SEPARATION_CLEAR_SP
} from '../../src/engine/layout/notation.ts';
import { layoutTab } from '../../src/engine/layout/tab.ts';
import { layoutBothSystem } from '../../src/engine/layout/bothSystem.ts';
import { TAB_STAFF_HEIGHT_SP } from '../../src/engine/layout/tabStaff.ts';
import { anchorY } from '../../src/engine/layout/verticalDensity.ts';
import {
  COHESION_CLEAR_SP,
  TEXT_MIN_RISE_SP,
  TEXT_SIDE_CLEAR_SP
} from '../../src/engine/layout/scoreText.ts';
import { computeBoundsSp } from '../../src/engine/render/bounds.ts';
import { glyphBBox } from '../../src/engine/smufl/smufl.ts';
import type { LayoutResult, Primitive } from '../../src/engine/primitives.ts';
import { initSmufl, WIDTH_SP } from '../helpers/corpusPrimitives.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
// @ts-expect-error — plain .mjs module without type declarations
import { loadCorpus } from '../verify/check-scenarios.mjs';

const corpus: { id: string; dir: string }[] = loadCorpus();

function readDoc(dir: string): MnxStructure {
  return JSON.parse(fs.readFileSync(path.join(dir, 'score.mnx.json'), 'utf8')) as MnxStructure;
}

const hasScoreText = (mnx: MnxStructure) =>
  (mnx.global.measures ?? []).some(gm => gm.rehearsal || gm.section || (gm.tempos ?? []).length);

const cls = (p: Primitive) => p.className.split(' ')[0];
const LABEL_CLASSES = new Set(['rehearsal-label', 'section-label', 'rehearsal-box']);
// Navigation marks sit at their own rise and are placed AFTER the tempo mark
// on the tab staff, so the tempo does not clear them (they share no x); the
// labels, placed last, clear everything.
const NAV_CLASSES = new Set(['segno', 'fine', 'jump']);
const isLabel = (p: Primitive) => LABEL_CLASSES.has(cls(p));
const isTempo = (p: Primitive) => cls(p) === 'tempo';
const isNav = (p: Primitive) => NAV_CLASSES.has(cls(p));

/** The text's own bottom ink: a baseline for text, the rect bottom for the
 *  rehearsal box, the glyph's bbox bottom for a metronome note. */
function bottomInkOf(p: Primitive): number {
  switch (p.kind) {
    case 'text': return p.y;
    case 'rect': return p.y + p.h;
    case 'glyph': {
      const bb = glyphBBox(p.glyph);
      return bb ? p.y - bb.y * (p.scale ?? 1) : p.y;
    }
    default: return Number.NaN;
  }
}

/** Highest ink over [x0,x1] rising above the top line and belonging to this
 *  row — this test's own reading of the rule, through the same SMuFL boxes. */
function inkTopOver(
  prims: readonly Primitive[],
  x0: number,
  x1: number,
  staffTop: number,
  floor: number
): number | null {
  let top: number | null = null;
  for (const p of prims) {
    const b = computeBoundsSp([p]);
    if (!b || b.x + b.w < x0 || b.x > x1) continue;
    if (b.y >= staffTop - 0.25 || b.y + b.h <= floor) continue;
    top = top === null ? b.y : Math.min(top, b.y);
  }
  return top;
}

/** Bars of a row, read off its barlines: consecutive distinct x's. */
function barsOf(layout: LayoutResult, row: number): [number, number][] {
  const band = layout.rows[row];
  const xs = [...new Set(
    layout.primitives
      .filter(p => p.kind === 'line' && cls(p) === 'barline' &&
        p.y1 >= band.staffTop - 1e-6 && p.y1 <= band.staffBottom + 1e-6)
      .map(p => (p.kind === 'line' ? Math.round(p.x1 * 1e4) / 1e4 : 0))
  )].sort((a, b) => a - b);
  const bars: [number, number][] = [];
  for (let k = 0; k + 1 < xs.length; k++) {
    if (xs[k + 1] - xs[k] > 1) bars.push([xs[k], xs[k + 1]]); // skip repeat-sign pairs
  }
  return bars;
}

/** Where this row's space ends and the system above begins: the midpoint of
 *  the inter-row gap — `tightenRows`' own ownership rule, and (at the default
 *  pads) exactly the engine's `rowTop`. */
const floorOf = (layout: LayoutResult, row: number) =>
  row > 0 ? (layout.rows[row - 1].staffBottom + layout.rows[row].staffTop) / 2 : -Infinity;

interface Checked { labels: number; tempos: number; clear: number; atMinRise: number }

/** Every bar of every row: assert the clearance for each text group found. */
function checkLayout(layout: LayoutResult): Checked {
  const out: Checked = { labels: 0, tempos: 0, clear: 0, atMinRise: 0 };
  const prims = layout.primitives;
  layout.rows.forEach((band, row) => {
    const staffTop = band.staffTop;
    const floor = floorOf(layout, row);
    for (const [x0, x1] of barsOf(layout, row)) {
      const inBar = (p: Primitive) => {
        const px = (p as { x?: number }).x;
        const py = (p as { y?: number }).y;
        return px !== undefined && py !== undefined &&
          px >= x0 - 1e-6 && px <= x1 + 1e-6 && py < staffTop && py > floor;
      };
      const labels = prims.filter(p => isLabel(p) && inBar(p));
      const tempos = prims.filter(p => isTempo(p) && inBar(p));

      const assertGroup = (group: Primitive[], others: Primitive[]) => {
        const bottom = Math.max(...group.map(bottomInkOf));
        // The window is the text's OWN footprint plus the side clearance —
        // a tempo mark does not climb over a segno at the other end of the bar.
        const foot = computeBoundsSp(group)!;
        const inkTop = inkTopOver(
          others, foot.x - TEXT_SIDE_CLEAR_SP, foot.x + foot.w + TEXT_SIDE_CLEAR_SP, staffTop, floor
        );
        if (inkTop === null) {
          expect(bottom).toBeCloseTo(staffTop - TEXT_MIN_RISE_SP, 6);
          out.atMinRise++;
        } else {
          expect(inkTop - bottom).toBeCloseTo(COHESION_CLEAR_SP, 6);
          out.clear++;
        }
      };
      if (labels.length) {
        out.labels++;
        assertGroup(labels, prims.filter(p => !isLabel(p)));
      }
      if (tempos.length) {
        out.tempos++;
        assertGroup(tempos, prims.filter(p => !isTempo(p) && !isLabel(p) && !isNav(p)));
      }
    }
  });
  return out;
}

function sum(into: Checked, c: Checked): void {
  for (const k of Object.keys(into) as (keyof Checked)[]) into[k] += c[k];
}

describe('ink-measured gaps — stage A, the score-text row', () => {
  const withText = corpus.filter(s => hasScoreText(readDoc(s.dir)));

  it('the corpus has score text to check', () => {
    expect(withText.length).toBeGreaterThanOrEqual(8);
  });

  it('on the tab staff, every label and tempo mark sits one clearance above the ink', () => {
    initSmufl();
    const total: Checked = { labels: 0, tempos: 0, clear: 0, atMinRise: 0 };
    for (const s of withText) {
      let layout: LayoutResult;
      try {
        layout = layoutTab({ mnx: readDoc(s.dir), widthSp: WIDTH_SP });
      } catch {
        continue;
      }
      sum(total, checkLayout(layout));
    }
    expect(total.labels + total.tempos).toBeGreaterThan(0);
    // A tab staff has no stems: most of its text sits at the minimum rise —
    // the "floating label" screenshot, fixed. Some is lifted by a tempo mark
    // or a navigation sign, which is the other half of the rule.
    expect(total.atMinRise).toBeGreaterThan(0);
  });

  it('on the notation staff, every label and tempo mark sits one clearance above the ink', () => {
    initSmufl();
    const total: Checked = { labels: 0, tempos: 0, clear: 0, atMinRise: 0 };
    for (const s of withText) {
      let layout: LayoutResult;
      try {
        layout = layoutNotation({ mnx: readDoc(s.dir), widthSp: WIDTH_SP });
      } catch {
        continue;
      }
      sum(total, checkLayout(layout));
    }
    expect(total.labels + total.tempos).toBeGreaterThan(0);
    // Notation has stems and clefs above the line: the clearance case must
    // actually occur, or the rule was never exercised.
    expect(total.clear).toBeGreaterThan(0);
  });

  it('the screenshot: on twelve-bar-blues each label sits one clearance above the ink under it', () => {
    initSmufl();
    const s = corpus.find(c => c.id.endsWith('twelve-bar-blues'))!;
    const layout = layoutNotation({ mnx: readDoc(s.dir), widthSp: WIDTH_SP });
    const labels = layout.primitives.filter(p => cls(p) === 'section-label');
    expect(labels.length).toBeGreaterThan(0);
    let overInk = 0;
    for (const label of labels) {
      const ly = (label as { y: number }).y;
      const row = layout.rows.findIndex((b, r) => ly < b.staffTop && (r === 0 || ly > layout.rows[r - 1].staffBottom));
      const staffTop = layout.rows[row].staffTop;
      const foot = computeBoundsSp([label])!;
      const ink = inkTopOver(
        layout.primitives.filter(p => !isLabel(p)),
        foot.x - TEXT_SIDE_CLEAR_SP, foot.x + foot.w + TEXT_SIDE_CLEAR_SP, staffTop, floorOf(layout, row)
      );
      // "Head" and "Turnaround" open their systems, so what sits under them
      // is the clef and key signature rising above the top line — not 2.8sp
      // of fixed air, and not the stems further along the bar, which are not
      // under the label and are not its business.
      if (ink === null) {
        expect(bottomInkOf(label)).toBeCloseTo(staffTop - TEXT_MIN_RISE_SP, 6);
        continue;
      }
      overInk++;
      expect(ink - bottomInkOf(label)).toBeCloseTo(COHESION_CLEAR_SP, 6);
    }
    expect(overInk).toBeGreaterThan(0);
  });
});

// Stage B — the display staves of the `both` view. The gap above a tab staff,
// and above the notation staff that follows one, is no longer a line-to-line
// constant: it is the ink either side plus SEPARATION_CLEAR_SP, floored. The
// ink is re-derived here from the primitives — the same bucketing by anchor,
// the same structural exclusions — so the assembler's measurement and this
// test can only agree by both being right.
describe('ink-measured gaps — stage B, display staves in the both view', () => {
  const STRUCTURAL = new Set(['barline', 'staff-line', 'brace', 'bracket', 'group-label']);
  // The tab staff's own vocabulary (tabStaff.ts). Everything else is the
  // notation staff's — attributed to the NEAREST notation band, never to a
  // tab band, which is the point: a verse row hanging 7sp under a notation
  // staff belongs to that staff however close the strings below have come.
  // The engine attributes by a different method (a probe layout with the gap
  // thrown wide open); the two must agree.
  const TAB_CLASSES = new Set(['fret-number', 'fret-bg', 'tab-clef', 'tab-capo', 'tab-tuning-letter']);
  // Drawn on either kind of staff (time signatures, repeat dots, diagnostic
  // badges): attributed by containment, else to the nearest band of any kind.
  const SHARED_CLASSES = new Set(['time-sig', 'time-sig-num', 'time-sig-den', 'repeat-dot', 'diagnostic-marker']);
  const withBoth = corpus.filter(s => fs.existsSync(path.join(s.dir, 'expected.both.svg')));

  interface Pair { lineGap: number; inkGap: number; expected: number; measured: boolean }

  /** Every adjacent display pair of every row, with the gap the rule predicts. */
  function pairsOf(layout: LayoutResult): Pair[] {
    const displays = layout.displays!;
    const rows = layout.rows!;
    const isTab = (b: { staffTop: number; staffBottom: number }) =>
      Math.abs(b.staffBottom - b.staffTop - TAB_STAFF_HEIGHT_SP) < 1e-6;
    const rowBounds = rows.slice(0, -1).map((b, r) => (b.staffBottom + rows[r + 1].staffTop) / 2);
    const rowOf = (y: number) => { let r = 0; while (r < rowBounds.length && y >= rowBounds[r]) r++; return r; };
    const buckets: Primitive[][][] = displays.map(bands => bands.map(() => []));
    const distance = (y: number, b: { staffTop: number; staffBottom: number }) =>
      y < b.staffTop ? b.staffTop - y : y > b.staffBottom ? y - b.staffBottom : 0;
    for (const p of layout.primitives) {
      if (STRUCTURAL.has(cls(p))) continue;
      const y = anchorY(p);
      const r = rowOf(y);
      const bands = displays[r];
      const kind = TAB_CLASSES.has(cls(p)) ? 'tab' : SHARED_CLASSES.has(cls(p)) ? 'any' : 'notation';
      let best = -1;
      bands.forEach((b, d) => {
        if (kind !== 'any' && isTab(b) !== (kind === 'tab')) return;
        if (best < 0 || distance(y, b) < distance(y, bands[best])) best = d;
      });
      if (best < 0) best = 0;
      buckets[r][best].push(p);
    }
    const out: Pair[] = [];
    displays.forEach((bands, r) => {
      for (let d = 1; d < bands.length; d++) {
        const upper = bands[d - 1];
        const lower = bands[d];
        const up = computeBoundsSp(buckets[r][d - 1]);
        const lo = computeBoundsSp(buckets[r][d]);
        const inkBelow = Math.max(0, (up ? up.y + up.h : upper.staffBottom) - upper.staffBottom);
        const inkAbove = Math.max(0, lower.staffTop - (lo ? lo.y : lower.staffTop));
        const lineGap = lower.staffTop - upper.staffBottom;
        const measured = isTab(upper) || isTab(lower);
        out.push({
          lineGap,
          inkGap: lineGap - inkBelow - inkAbove,
          expected: Math.max(inkBelow + inkAbove + SEPARATION_CLEAR_SP, MIN_STAFF_GAP_SP),
          measured
        });
      }
    });
    return out;
  }

  it('there are both-view scenarios to check', () => {
    expect(withBoth.length).toBeGreaterThan(10);
  });

  it('every gap adjacent to a tab staff is ink + separation (floored), and no other gap moved', () => {
    initSmufl();
    let measured = 0;
    let narrowed = 0;
    let widened = 0;
    let untouched = 0;
    for (const s of withBoth) {
      let layout: LayoutResult;
      try {
        layout = layoutBothSystem({ mnx: readDoc(s.dir), widthSp: WIDTH_SP });
      } catch {
        continue;
      }
      if (!layout.displays) continue;
      for (const pair of pairsOf(layout)) {
        if (pair.measured) {
          measured++;
          expect(pair.lineGap).toBeCloseTo(pair.expected, 6);
          // Separation really holds — and is met exactly unless the floor won.
          expect(pair.inkGap).toBeGreaterThanOrEqual(SEPARATION_CLEAR_SP - 1e-6);
          if (pair.lineGap < 6 - 1e-6) narrowed++;
          if (pair.lineGap > 6 + 1e-6) widened++;
        } else {
          // Stage B's scope: notation↔notation gaps keep the provisional 6sp.
          untouched++;
          expect(pair.lineGap).toBeCloseTo(6, 6);
        }
      }
    }
    expect(measured).toBeGreaterThan(0);
    // Both directions occur: the air under a tab staff collapses, the
    // down-stems above one push it away. Neither alone would be the rule.
    expect(narrowed).toBeGreaterThan(0);
    expect(widened).toBeGreaterThan(0);
    void untouched;
  });

  it('the standalone layouts are not touched: no tab staff, no second pass', () => {
    initSmufl();
    // A notation-only segment has nothing to measure in stage B and must
    // return its first pass — the whole standalone golden set is the proof,
    // and this is the same claim on one score.
    const layout = layoutNotation({ mnx: readDoc(withBoth[0].dir), widthSp: WIDTH_SP });
    for (const pair of pairsOf(layout)) expect(pair.lineGap).toBeCloseTo(6, 6);
  });
});
