/**
 * Where the page's systems, staves and bars are, in the drawn SVG's own units —
 * the layout's answers (`LayoutResult.rows`, `displays`, `staves`, `bars`) put
 * through the emitter's scale, so an overlay reads them instead of finding them
 * in the drawing (roadmap/inprogress/core-ink-provenance.md, phase 2).
 *
 * The emitter draws a staff-space position at `x · pxPerSp` and a height at
 * `y · pxPerSpY`; the viewBox crops but does not move user units. So the
 * conversion is exactly the emitter's. The one measurement, a row's `reach`, is
 * of the ink the layout stamped as that row's — never of where ink happens to lie.
 */
import type { DisplayStaff, LayoutResult, Primitive } from '../primitives.ts';
import { computeBoundsSp } from './bounds.ts';

export interface PageGeometry {
  /** One per system row, top to bottom: `LayoutResult.rows`. */
  rows: PageRow[];
}

export interface PageRow {
  top: number;
  bottom: number;
  /** The row's left and right edges: its first bar's left, its last bar's right. */
  x1: number;
  x2: number;
  /** Its staves top to bottom: `LayoutResult.displays` with what each draws. */
  staves: PageStaff[];
  /** Its bars left to right. */
  bars: PageBar[];
  /** How far the row's own ink reaches — its staves, and what it carries over and
   *  under them: verses, headings, directions. What a reveal brings into view. */
  reach: { top: number; bottom: number };
}

export interface PageStaff extends DisplayStaff {
  top: number;
  bottom: number;
  x1: number;
  x2: number;
  /** The distance between two of its lines. */
  lineGap: number;
}

export interface PageBar {
  /** The plan ordinal `packedRowMeasures` lists for this bar. */
  index: number;
  /** The written measure it draws. */
  measure: number;
  x1: number;
  x2: number;
}

export function pageGeometry(layout: LayoutResult, pxPerSp: number, pxPerSpY: number): PageGeometry {
  const ink: Primitive[][] = layout.rows.map(() => []);
  for (const p of layout.primitives) if (p.origin) ink[p.origin.row]?.push(p);
  return {
    rows: layout.rows.map((band, r) => {
      const reach = computeBoundsSp(ink[r]!);
      const bars = (layout.bars ?? []).filter(bar => bar.row === r)
        .map(bar => ({ index: bar.index, measure: bar.measure, x1: bar.x * pxPerSp, x2: (bar.x + bar.width) * pxPerSp }));
      const x1 = bars.length ? Math.min(...bars.map(bar => bar.x1)) : 0;
      const x2 = bars.length ? Math.max(...bars.map(bar => bar.x2)) : layout.widthSp * pxPerSp;
      const displays = layout.displays?.[r] ?? [band];
      return {
        top: band.staffTop * pxPerSpY,
        bottom: band.staffBottom * pxPerSpY,
        x1, x2,
        bars,
        reach: {
          top: Math.min(band.staffTop, reach?.y ?? band.staffTop) * pxPerSpY,
          bottom: Math.max(band.staffBottom, reach ? reach.y + reach.h : band.staffBottom) * pxPerSpY
        },
        staves: displays.map((display, d) => {
          const staff = layout.staves?.[r]?.[d] ?? { partIndex: 0, staffIndex: 1, projection: 'notation' as const, lines: 5 };
          return {
            ...staff,
            top: display.staffTop * pxPerSpY,
            bottom: display.staffBottom * pxPerSpY,
            x1, x2,
            lineGap: ((display.staffBottom - display.staffTop) / Math.max(1, staff.lines - 1)) * pxPerSpY
          };
        })
      };
    })
  };
}
