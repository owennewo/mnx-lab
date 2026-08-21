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

/**
 * Which row a primitive belongs to — this test's own rule, independent of the
 * engine's (which knows by construction what it drew for which row). Score
 * text sits above its staff, so it belongs to the first row whose top line is
 * below it; everything else belongs to the row whose band is nearest by the
 * inter-row midpoint, `tightenRows`' rule. Two methods, one answer.
 */
const TEXT_ROW_CLASSES = new Set([...LABEL_CLASSES, 'tempo', ...NAV_CLASSES]);
function rowPrims(layout: LayoutResult, row: number): Primitive[] {
  const rows = layout.rows!;
  const bounds = rows.slice(0, -1).map((b, r) => (b.staffBottom + rows[r + 1].staffTop) / 2);
  return layout.primitives.filter(p => {
    const y = anchorY(p);
    if (TEXT_ROW_CLASSES.has(cls(p))) {
      let r = rows.findIndex(b => b.staffTop > y);
      if (r < 0) r = rows.length - 1;
      return r === row;
    }
    let r = 0;
    while (r < bounds.length && y >= bounds[r]) r++;
    return r === row;
  });
}

interface Checked { labels: number; tempos: number; clear: number; atMinRise: number }

/** Every bar of every row: assert the clearance for each text group found. */
function checkLayout(layout: LayoutResult): Checked {
  const out: Checked = { labels: 0, tempos: 0, clear: 0, atMinRise: 0 };
  layout.rows.forEach((band, row) => {
    const staffTop = band.staffTop;
    const prims = rowPrims(layout, row);
    const floor = -Infinity;
    for (const [x0, x1] of barsOf(layout, row)) {
      const inBar = (p: Primitive) => {
        const px = (p as { x?: number }).x;
        const py = (p as { y?: number }).y;
        return px !== undefined && py !== undefined &&
          px >= x0 - 1e-6 && px <= x1 + 1e-6 && py < staffTop;
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
        rowPrims(layout, row).filter(p => !isLabel(p)),
        foot.x - TEXT_SIDE_CLEAR_SP, foot.x + foot.w + TEXT_SIDE_CLEAR_SP, staffTop, -Infinity
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

  /**
   * Every adjacent display pair of every row of the REAL layout, with the
   * gap the rule predicts — the ink reaches measured on a PROBE layout of the
   * same score. Attribution at the real gap is ambiguous whichever way it is
   * done: the guitar's second voice sits between the staves and its up-stems
   * are nearer the bass staff than the treble they belong to, and class
   * vocabulary cannot tell a treble stem from a bass one. At a 100sp gap
   * nothing is ambiguous, and ink reaches relative to a staff's own lines are
   * the same in both layouts. Content positioned BY the gap (`between`
   * directions) is collected per gap and must fit with a clearance each side.
   */
  function pairsOf(real: LayoutResult, probe: LayoutResult): Pair[] {
    const displays = probe.displays!;
    const rows = probe.rows!;
    const isTab = (b: { staffTop: number; staffBottom: number }) =>
      Math.abs(b.staffBottom - b.staffTop - TAB_STAFF_HEIGHT_SP) < 1e-6;
    const rowBounds = rows.slice(0, -1).map((b, r) => (b.staffBottom + rows[r + 1].staffTop) / 2);
    const rowOf = (y: number) => { let r = 0; while (r < rowBounds.length && y >= rowBounds[r]) r++; return r; };
    const buckets: Primitive[][][] = displays.map(bands => bands.map(() => []));
    const held: Primitive[][][] = displays.map(bands => bands.map(() => []));
    for (const p of probe.primitives) {
      const tokens = p.className.split(' ');
      if (STRUCTURAL.has(tokens[0])) continue;
      const y = anchorY(p);
      const r = rowOf(y);
      const bands = displays[r];
      if (tokens.includes('direction-between')) {
        let d = 1;
        while (d + 1 < bands.length && y >= bands[d].staffTop) d++;
        held[r][d].push(p);
        continue;
      }
      let d = 0;
      while (d + 1 < bands.length && y >= (bands[d].staffBottom + bands[d + 1].staffTop) / 2) d++;
      buckets[r][d].push(p);
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
        const heldH = computeBoundsSp(held[r][d])?.h ?? 0;
        const forHeld = heldH > 0 ? 2 * Math.max(inkBelow, inkAbove) + 2 * SEPARATION_CLEAR_SP + heldH : 0;
        const realBands = real.displays![r];
        const lineGap = realBands[d].staffTop - realBands[d - 1].staffBottom;
        out.push({
          lineGap,
          inkGap: lineGap - inkBelow - inkAbove,
          expected: Math.max(inkBelow + inkAbove + SEPARATION_CLEAR_SP, forHeld, MIN_STAFF_GAP_SP),
          measured: isTab(upper) || isTab(lower)
        });
      }
    });
    return out;
  }

  const PROBE = 100;
  const bothPair = (mnx: MnxStructure) => ({
    real: layoutBothSystem({ mnx, widthSp: WIDTH_SP }),
    probe: layoutBothSystem({ mnx, widthSp: WIDTH_SP, displayGapProbeSp: PROBE })
  });
  const notationPair = (mnx: MnxStructure) => ({
    real: layoutNotation({ mnx, widthSp: WIDTH_SP }),
    probe: layoutNotation({ mnx, widthSp: WIDTH_SP, displayGapProbeSp: PROBE })
  });

  it('there are both-view scenarios to check', () => {
    expect(withBoth.length).toBeGreaterThan(10);
  });

  it('every display gap in the both view is ink + separation (floored)', () => {
    initSmufl();
    let measured = 0;
    let narrowed = 0;
    let widened = 0;
    for (const s of withBoth) {
      let pair2: { real: LayoutResult; probe: LayoutResult };
      try {
        pair2 = bothPair(readDoc(s.dir));
      } catch {
        continue;
      }
      if (!pair2.real.displays) continue;
      for (const pair of pairsOf(pair2.real, pair2.probe)) {
        measured++;
        expect(pair.lineGap).toBeCloseTo(pair.expected, 6);
        // Separation really holds — and is met exactly unless the floor won.
        expect(pair.inkGap).toBeGreaterThanOrEqual(SEPARATION_CLEAR_SP - 1e-6);
        if (pair.lineGap < 6 - 1e-6) narrowed++;
        if (pair.lineGap > 6 + 1e-6) widened++;
      }
    }
    expect(measured).toBeGreaterThan(0);
    // Both directions occur: the air under a tab staff collapses, the
    // down-stems above one push it away. Neither alone would be the rule.
    expect(narrowed).toBeGreaterThan(0);
    expect(widened).toBeGreaterThan(0);
  });

  // Stage C — the same rule between notation staves (grand staff, ensemble).
  it('every display gap in plain notation is ink + separation (floored), corpus-wide', () => {
    initSmufl();
    let pairs = 0;
    let scenarios = 0;
    for (const s of corpus) {
      let pair2: { real: LayoutResult; probe: LayoutResult };
      try {
        pair2 = notationPair(readDoc(s.dir));
      } catch {
        continue;
      }
      if (!pair2.real.displays || pair2.real.displays[0].length < 2) continue;
      scenarios++;
      for (const pair of pairsOf(pair2.real, pair2.probe)) {
        pairs++;
        expect(pair.lineGap).toBeCloseTo(pair.expected, 6);
        expect(pair.inkGap).toBeGreaterThanOrEqual(SEPARATION_CLEAR_SP - 1e-6);
      }
    }
    expect(scenarios).toBeGreaterThan(0);
    expect(pairs).toBeGreaterThan(0);
  });

  it('a single-staff layout takes no second pass: there is no gap to measure', () => {
    initSmufl();
    // Same claim the single-staff golden set makes — one staff, one band,
    // the provisional layout returned as is.
    const single = corpus.find(s => {
      try {
        return layoutNotation({ mnx: readDoc(s.dir), widthSp: WIDTH_SP }).displays?.[0].length === 1;
      } catch {
        return false;
      }
    })!;
    const pair2 = notationPair(readDoc(single.dir));
    expect(pairsOf(pair2.real, pair2.probe)).toEqual([]);
  });
});

// Stage D — the gap BETWEEN systems. The reserved row pads are no longer
// consulted: a gap is the ink either side plus SEPARATION_CLEAR_SP, the same
// constant stage C put between two staves of one system. The visible
// consequence, and the thing that was asked for: a system with a section
// label above it keeps room for the label, and one without closes up — with
// nobody encoding "unlabelled rows are closer".
describe('ink-measured gaps — stage D, between systems', () => {
  const labelledTabDir = corpus.find(s => s.id.endsWith('twelve-bar-blues'))!.dir;

  /** Ink reach per row, mirroring `tightenRows`' own bucketing. */
  function rowInk(layout: LayoutResult): { top: number; bottom: number }[] {
    const rows = layout.rows!;
    const bounds = rows.slice(0, -1).map((b, r) => (b.staffBottom + rows[r + 1].staffTop) / 2);
    const buckets: Primitive[][] = rows.map(() => []);
    for (const p of layout.primitives) {
      const y = anchorY(p);
      let r = 0;
      while (r < bounds.length && y >= bounds[r]) r++;
      buckets[r].push(p);
    }
    return rows.map((b, r) => {
      const bb = computeBoundsSp(buckets[r]);
      return {
        top: Math.min(b.staffTop, bb?.y ?? b.staffTop),
        bottom: Math.max(b.staffBottom, bb ? bb.y + bb.h : b.staffBottom)
      };
    });
  }

  const gapsOf = (layout: LayoutResult) => {
    const rows = layout.rows!;
    const ink = rowInk(layout);
    return rows.slice(0, -1).map((b, r) => ({
      lineGap: rows[r + 1].staffTop - b.staffBottom,
      inkGap: rows[r + 1].staffTop - b.staffBottom
        - (ink[r].bottom - b.staffBottom)
        - (rows[r + 1].staffTop - ink[r + 1].top)
    }));
  };

  /**
   * A gap holding a SCORE TITLE is excluded, and the reason is the same one
   * stage C met with `between` directions: a title sits between two score
   * blocks and belongs to neither system, so it is content the gap must HOLD
   * rather than a demand either side makes. `tightenRows` buckets it to one
   * row by the midpoint rule, and which row that is flips as the gap closes —
   * so the identity below is not the right claim there. It keeps room for the
   * title either way, which is what matters; four gaps in two multi-score
   * scenarios are affected.
   */
  const holdsTitle = (layout: LayoutResult, r: number) => {
    const rows = layout.rows!;
    return layout.primitives.some(
      p => cls(p) === 'score-title' && anchorY(p) > rows[r].staffBottom && anchorY(p) < rows[r + 1].staffTop
    );
  };

  it('every inter-system gap is the ink either side plus one separation, corpus-wide', () => {
    initSmufl();
    let checked = 0;
    let skipped = 0;
    for (const s of corpus) {
      let layout: LayoutResult;
      try {
        layout = layoutNotation({ mnx: readDoc(s.dir), widthSp: WIDTH_SP });
      } catch {
        continue;
      }
      if ((layout.rows?.length ?? 0) < 2) continue;
      gapsOf(layout).forEach((gap, r) => {
        if (holdsTitle(layout, r)) {
          skipped++;
          // Still bounded: a title never makes a gap TIGHTER than the rule.
          expect(gap.inkGap).toBeGreaterThan(SEPARATION_CLEAR_SP - 1e-6);
          return;
        }
        checked++;
        expect(gap.inkGap).toBeCloseTo(SEPARATION_CLEAR_SP, 6);
      });
    }
    expect(checked).toBeGreaterThan(0);
    // The exclusion is narrow — if it ever starts swallowing ordinary gaps,
    // this is where that shows up. (Today: 4 title gaps against 14 ordinary
    // ones, in a corpus where multi-system scores are the minority.)
    expect(checked).toBeGreaterThan(skipped * 2);
  });

  it('a system under a section label keeps room for it; one without closes up', () => {
    initSmufl();
    // The reported case: twelve-bar-blues as tab, wrapped narrow enough to
    // put "Head" and "Turnaround" on different systems.
    const layout = layoutTab({ mnx: readDoc(labelledTabDir), widthSp: 46 });
    const rows = layout.rows!;
    expect(rows.length).toBeGreaterThan(3);
    const labelTops = layout.primitives
      .filter(p => cls(p) === 'section-label')
      .map(p => (p as { y: number }).y);
    // Which rows carry a label: the first row whose top line is below it.
    const labelled = new Set(
      labelTops.map(y => {
        const r = rows.findIndex(b => b.staffTop > y);
        return r < 0 ? rows.length - 1 : r;
      })
    );
    const gaps = gapsOf(layout);
    const before = (r: number) => gaps[r - 1].lineGap;
    const withLabel = [...labelled].filter(r => r > 0);
    const without = rows.map((_b, r) => r).filter(r => r > 0 && !labelled.has(r));
    expect(withLabel.length).toBeGreaterThan(0);
    expect(without.length).toBeGreaterThan(0);
    // Every labelled row stands further off than every unlabelled one.
    expect(Math.min(...withLabel.map(before))).toBeGreaterThan(
      Math.max(...without.map(before)) + 0.5
    );
  });
});
