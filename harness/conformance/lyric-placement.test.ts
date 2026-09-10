// Lyric placement follows the ink and the clearance control.
//
// A verse used to hang a fixed 4.5sp under its staff whatever was there: too
// far when the staff carried nothing below it — at the tight end of the
// clearance range the words sat nearer the NEXT system than their own — and
// too close when down-stems reached past it. A verse now sits `lyricInk` below
// the deepest ink its own staff carries in that system, one level baseline per
// system, and that air is the clearance control's to set.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { layoutNotation } from '../../src/engine/layout/notation.ts';
import { layoutTab } from '../../src/engine/layout/tab.ts';
import { LYRIC_LINE_SPACING_SP } from '../../src/engine/layout/lyricRuns.ts';
import { clearanceSpacing } from '../../src/engine/clearance.ts';
import { inkEdgesSp } from '../../src/engine/render/bounds.ts';
import type { LayoutResult, Primitive } from '../../src/engine/primitives.ts';
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
const isLyric = (p: Primitive) => p.kind === 'text' && p.className === 'lyric';
/** Where a primitive hangs from — a line or curve by its top, else its anchor. */
const hangY = (p: Primitive) =>
  p.kind === 'line' ? Math.min(p.y1, p.y2) : p.kind === 'curve' ? Math.min(...p.points.map(q => q.y)) : p.y;

interface SystemVerses {
  /** Verse ink top minus the deepest ink (or bottom line) of the owning staff. */
  airAbove: number;
  /** The next system's topmost ink minus the verses' ink bottom. */
  airBelow: number;
  baselines: number[];
  lyrics: Primitive[];
}

function versesBySystem(layout: LayoutResult): SystemVerses[] {
  const rows = layout.rows ?? [];
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
      airAbove: lyricTop - deepest,
      airBelow: nextTop - lyricBottom,
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
      it(`${docName}, ${viewName}: each verse sits lyricInk under its own staff's deepest ink, at every level`, () => {
        initSmufl();
        const doc = read(rel);
        let systems = 0;
        for (const clearance of LEVELS) {
          const lyricInk = clearanceSpacing(clearance).lyricInk;
          const result = layout({ mnx: doc, widthSp: WIDTH_SP, display: { clearance } } as never) as LayoutResult;
          for (const sys of versesBySystem(result)) {
            systems++;
            expect(sys.airAbove).toBeCloseTo(lyricInk, 6);
            // The words read as their own system's: nearer it than the next one.
            expect(sys.airAbove).toBeLessThan(sys.airBelow);
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
        for (const sys of versesBySystem(result)) {
          for (const syllable of sys.lyrics) {
            const hit = ink.find(p => overlaps(syllable, p));
            expect(hit, `"${(syllable as { text?: string }).text}" overlaps ${hit?.kind}:${hit?.className}`).toBeUndefined();
          }
        }
      });
    }
  }
});
