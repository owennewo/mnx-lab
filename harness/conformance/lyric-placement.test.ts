// Lyric placement follows the ink and the clearance control.
//
// A verse used to hang a fixed 4.5sp under its staff whatever was there: too
// far when the staff carried nothing below it — at the tight end of the
// clearance range the words sat nearer the NEXT system than their own — and
// too close when down-stems reached past it. A verse now sits `lyricInk` below
// the deepest ink its own staff carries in that system, one level baseline per
// system, and that air is the clearance control's to set.
//
// Over a standalone tab staff the verses stand ABOVE it (2026-10-16): the same
// rule mirrored — `lyricInk` over the highest ink under the verse block's own
// span, nearer its own staff than the system above.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { layoutNotation } from '../../src/engine/layout/notation.ts';
import { layoutTab } from '../../src/engine/layout/tab.ts';
import { LYRIC_LINE_SPACING_SP } from '../../src/engine/layout/lyricRuns.ts';
import { clearanceSpacing } from '../../src/engine/clearance.ts';
import { inkEdgesSp } from '../../src/engine/render/bounds.ts';
import type { LayoutResult, Primitive, TextPrim } from '../../src/engine/primitives.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
import { initSmufl } from '../helpers/corpusPrimitives.ts';

const REPO = path.join(__dirname, '../..');
const read = (rel: string): MnxStructure => JSON.parse(fs.readFileSync(path.join(REPO, rel), 'utf8'));
const DOCS: Record<string, string> = {
  'Sun-did-glide': 'converters/fixtures/Sun-did-glide.mnx.json',
  'tab-verses': 'scenarios/lab/50-lyrics/02-tab-verses/document.mnx.json'
};
const VIEWS = { notation: layoutNotation, tab: layoutTab } as const;
const LEVELS = [0, 1, 2, 3, 4];
const WIDTH_SP = 60;

// The staff's frame and the verses themselves are not ink a verse clears.
const FRAME = /staff-line|barline|lyric|(^|\s)(brace|bracket)(\s|$)/;
const isLyric = (p: Primitive): p is TextPrim => p.kind === 'text' && p.className === 'lyric';
/** Where a primitive hangs from — a line or curve by its top, else its anchor. */
const hangY = (p: Primitive) =>
  p.kind === 'line' ? Math.min(p.y1, p.y2) : p.kind === 'curve' ? Math.min(...p.points.map(q => q.y)) : p.y;

interface SystemVerses {
  /** Air between the verses and their own staff's nearest ink (or line). */
  airOwn: number;
  /** Air between the verses and the neighbouring system's nearest ink. */
  airAway: number;
  baselines: number[];
  lyrics: Primitive[];
}

/** Verses stood over their staff: the tab view. */
function versesAboveBySystem(layout: LayoutResult): SystemVerses[] {
  const rows = layout.rows;
  const lyrics = layout.primitives.filter(isLyric);
  const ink = layout.primitives.filter(p => !FRAME.test(p.className ?? ''));
  const out: SystemVerses[] = [];
  rows.forEach((row, r) => {
    const prev = rows[r - 1];
    if (!prev) return;
    const mine = lyrics.filter(l => l.y < row.staffTop && l.y > prev.staffBottom);
    if (!mine.length) return;
    const edges = mine.map(inkEdgesSp);
    const lyricTop = Math.min(...edges.map(e => e.top));
    const lyricBottom = Math.max(...edges.map(e => e.bottom));
    const x0 = Math.min(...edges.map(e => e.left)) - 0.5;
    const x1 = Math.max(...edges.map(e => e.right)) + 0.5;
    const under = ink.map(inkEdgesSp).filter(e =>
      e.right >= x0 && e.left <= x1 && e.top < row.staffTop && e.top >= lyricBottom && e.bottom <= row.staffBottom);
    const ownTop = Math.min(row.staffTop, ...under.map(e => e.top));
    const prevInk = ink.filter(p => hangY(p) >= prev.staffTop && inkEdgesSp(p).bottom <= lyricTop);
    const prevBottom = Math.max(prev.staffBottom, ...prevInk.map(p => inkEdgesSp(p).bottom));
    out.push({
      airOwn: ownTop - lyricBottom,
      airAway: lyricTop - prevBottom,
      baselines: [...new Set(mine.map(l => l.y))].sort((a, b) => a - b),
      lyrics: mine
    });
  });
  return out;
}

function versesBySystem(layout: LayoutResult, view: string): SystemVerses[] {
  if (view === 'tab') return versesAboveBySystem(layout);
  const rows = layout.rows;
  const lyrics = layout.primitives.filter(isLyric);
  const ink = layout.primitives.filter(p => !FRAME.test(p.className ?? ''));
  const out: SystemVerses[] = [];
  rows.forEach((row, r) => {
    const next = rows[r + 1];
    const mine = lyrics.filter(l => l.y > row.staffBottom && (!next || l.y < next.staffTop));
    if (!mine.length || !next) return;
    const lyricTop = Math.min(...mine.map(l => inkEdgesSp(l).top));
    const lyricBottom = Math.max(...mine.map(l => inkEdgesSp(l).bottom));
    const hanging = ink.filter(p => hangY(p) >= row.staffTop && hangY(p) < lyricTop);
    const deepest = Math.max(row.staffBottom, ...hanging.map(p => inkEdgesSp(p).bottom));
    const nextInk = ink.filter(p => hangY(p) > lyricBottom && hangY(p) < next.staffBottom);
    const nextTop = Math.min(next.staffTop, ...nextInk.map(p => inkEdgesSp(p).top));
    out.push({
      airOwn: lyricTop - deepest,
      airAway: nextTop - lyricBottom,
      baselines: [...new Set(mine.map(l => l.y))].sort((a, b) => a - b),
      lyrics: mine
    });
  });
  return out;
}

const overlaps = (a: Primitive, b: Primitive) => {
  const e = inkEdgesSp(a), f = inkEdgesSp(b);
  return e.left < f.right && f.left < e.right && e.top < f.bottom && f.top < e.bottom;
};

describe('lyric placement hugs the system that owns it', () => {
  it('the clearance control sets the air above a verse, tightest at the minimum', () => {
    const air = LEVELS.map(level => clearanceSpacing(level).lyricInk);
    expect(air[0]).toBeCloseTo(0.2, 9);
    expect(air[2]).toBeCloseTo(1, 9);
    for (let i = 1; i < air.length; i++) expect(air[i]).toBeGreaterThan(air[i - 1]);
  });

  for (const [docName, rel] of Object.entries(DOCS)) {
    for (const [viewName, layout] of Object.entries(VIEWS)) {
      it(`${docName}, ${viewName}: each verse sits lyricInk from its own staff's nearest ink, at every level`, () => {
        initSmufl();
        const doc = read(rel);
        let systems = 0;
        for (const clearance of LEVELS) {
          const lyricInk = clearanceSpacing(clearance).lyricInk;
          const result = layout({ mnx: doc, widthSp: WIDTH_SP, display: { clearance } } as never) as LayoutResult;
          for (const sys of versesBySystem(result, viewName)) {
            systems++;
            expect(sys.airOwn).toBeCloseTo(lyricInk, 6);
            // The words read as their own system's: nearer it than its neighbour.
            expect(sys.airOwn).toBeLessThan(sys.airAway);
            // Verse rows stack at a fixed pitch from one level first baseline.
            for (let k = 1; k < sys.baselines.length; k++) {
              expect(sys.baselines[k] - sys.baselines[k - 1]).toBeCloseTo(LYRIC_LINE_SPACING_SP, 6);
            }
          }
        }
        expect(systems).toBeGreaterThan(0);
      });

      it(`${docName}, ${viewName}: no syllable overlaps other ink at the tightest level`, () => {
        initSmufl();
        const result = layout({ mnx: read(rel), widthSp: WIDTH_SP, display: { clearance: 0 } } as never) as LayoutResult;
        const ink = result.primitives.filter(p => !FRAME.test(p.className ?? ''));
        for (const sys of versesBySystem(result, viewName)) {
          for (const syllable of sys.lyrics) {
            const hit = ink.find(p => overlaps(syllable, p));
            expect(hit, `"${(syllable as { text?: string }).text}" overlaps ${hit?.kind}:${hit?.className}`).toBeUndefined();
          }
        }
      });
    }
  }
});

// A volta over a system that sits under another system's verses: the row fit
// once filed the bracket's line by its midpoint — inside the verse band above —
// and moved it with that row while its hooks stayed with their own, so the
// line floated clear of its hooks (Needle of Death, 2026-09-13).
describe('a volta under a verse row holds together', () => {
  const isEnding = (p: Primitive): p is Extract<Primitive, { kind: 'line' }> => p.kind === 'line' && p.className === 'ending';
  for (const [docName, rel] of Object.entries(DOCS)) {
    for (const [viewName, layout] of Object.entries(VIEWS)) {
      it(`${docName}, ${viewName}: every hook meets its bracket line, at every level`, () => {
        initSmufl();
        const doc = read(rel);
        // A one-bar ending on every bar after the first, so some start a system.
        doc.global.measures.forEach((m, i) => { if (i > 0) m.ending = { numbers: [1], duration: 1 }; });
        let hooks = 0;
        for (const clearance of LEVELS) {
          const result = layout({ mnx: doc, widthSp: WIDTH_SP, display: { clearance } } as never) as LayoutResult;
          const lines = result.primitives.filter(isEnding);
          const bars = lines.filter(l => l.y1 === l.y2);
          for (const hook of lines.filter(l => l.x1 === l.x2 && l.y1 !== l.y2)) {
            hooks++;
            const top = Math.min(hook.y1, hook.y2);
            const bar = bars.find(b => Math.min(b.x1, b.x2) <= hook.x1 + 1e-6 && hook.x1 <= Math.max(b.x1, b.x2) + 1e-6 && Math.abs(b.y1 - top) < 1e-6);
            expect(bar, `hook at x=${hook.x1} y=${top} has no bracket line`).toBeDefined();
          }
        }
        expect(hooks).toBeGreaterThan(0);
      });
    }
  }
});
