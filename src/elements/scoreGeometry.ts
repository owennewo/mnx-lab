/**
 * The FINISHED score's geometry, as the overlays read it.
 *
 * Everything structural an overlay needs — where the staves are, which of them
 * share a system, which are tab, where the bars divide — is the layout's own
 * answer (`RenderOutcome.geometry`, put into the overlays' shapes by
 * `pageBands`). It used to be measured off the drawing: staves by clustering
 * staff lines, systems by which barlines touched them, bars by clustering
 * barline strokes, tab by a fret digit in the band
 * (roadmap/inprogress/core-ink-provenance.md, phase 2). What is still read
 * off the SVG is ink: where a selected glyph or a drawn column actually is.
 *
 * DOM reads and plain numbers only. The arithmetic that needs no DOM lives in
 * `engine/render/selectionGeometry.ts`; the drawing that needs both lives in
 * `enclosure.ts`, which is where all of this came from. It was pulled out when
 * pointer placement (roadmap/complete/core-editor-pointer-placement.md) became
 * a second reader: a hit-test asks exactly the questions the enclosure asks,
 * in reverse, and two copies of these rules would drift.
 */
import type { PageGeometry } from '../engine/render/pageGeometry.ts';
import type { DisplayStaff } from '../engine/primitives.ts';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StaffBand {
  top: number;
  bottom: number;
  x1: number;
  x2: number;
  /** Index of the system this staff belongs to (shared-barline join). */
  system: number;
}

export interface SystemBand {
  id: number;
  top: number;
  bottom: number;
  x1: number;
  x2: number;
  staffIndices: number[];
}

/**
 * The page's staves, systems and bar edges as the overlays read them, from the
 * layout's own geometry (`RenderOutcome.geometry`) — not measured off the
 * drawing. Staves are numbered down the page; a system is a row.
 */
export interface PageBands {
  staves: StaffBand[];
  systems: SystemBand[];
  /** Per staff, by its page index: whether it is a tab staff, and its line gap. */
  tab: boolean[];
  gaps: number[];
  /** Per row: its bar edges left to right, one more than its bars. */
  boundaries: number[][];
  /** Per row: what each of its staves draws, top to bottom. */
  identities: DisplayStaff[][];
}

export function pageBands(geometry: PageGeometry): PageBands {
  const bands: PageBands = { staves: [], systems: [], tab: [], gaps: [], boundaries: [], identities: [] };
  geometry.rows.forEach((row, r) => {
    const staffIndices: number[] = [];
    for (const staff of row.staves) {
      staffIndices.push(bands.staves.length);
      bands.staves.push({ top: staff.top, bottom: staff.bottom, x1: staff.x1, x2: staff.x2, system: r });
      bands.tab.push(staff.projection === 'tab');
      bands.gaps.push(staff.lineGap);
    }
    bands.systems.push({ id: r, top: row.top, bottom: row.bottom, x1: row.x1, x2: row.x2, staffIndices });
    bands.boundaries.push(row.bars.length ? [row.bars[0]!.x1, ...row.bars.map(bar => bar.x2)] : []);
    bands.identities.push(row.staves.map(({ partIndex, staffIndex, projection, lines }) => ({ partIndex, staffIndex, projection, lines })));
  });
  return bands;
}

/**
 * The INK box of a selected glyph. `getBBox()` on a `<text>` glyph returns the
 * font's line box — Bravura's is several staff-spaces tall — so its vertical
 * half is useless. The `y` attribute is trustworthy instead: SMuFL glyphs
 * register on the staff position (a notehead's y IS its center) and fret
 * numbers are emitted with `baseline: central`. Horizontal extent from
 * getBBox (the advance) is fine.
 */
export function inkBox(el: SVGGraphicsElement, sp: number): Box {
  const b = el.getBBox();
  if (el.tagName === 'text') {
    const ys = (el as SVGTextElement).y.baseVal;
    const anchor = ys.numberOfItems > 0 ? ys.getItem(0).value : b.y + b.height / 2;
    const h = Math.min(b.height, 1.6 * sp);
    return { x: b.x, y: anchor - h / 2, w: b.width, h };
  }
  return { x: b.x, y: b.y, w: b.width, h: b.height };
}

export function union(boxes: Box[]): Box {
  const x0 = Math.min(...boxes.map(b => b.x));
  const y0 = Math.min(...boxes.map(b => b.y));
  const x1 = Math.max(...boxes.map(b => b.x + b.w));
  const y1 = Math.max(...boxes.map(b => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** One engraved column of a voice's ink: where a moment was actually DRAWN. */
export interface InkColumn {
  /** The centre of the ink, in page units. */
  x: number;
  /** Vertical centre, so a column can be attributed to the band it sits in. */
  y: number;
  /** The key the renderer stamped on it — a note's or a rest's. */
  key: string;
}

/**
 * Where the moments of this score are actually drawn.
 *
 * MUSIC IS NOT SPACED LINEARLY, and the pointer used to pretend it was:
 * an x became a fraction of the bar's width and the session snapped that to
 * the nearest metric onset. A bar's ink does not start at its barline — a
 * clef and a time signature can push the first column a quarter of the way in
 * — and the columns after it are spread by springs and rods rather than by
 * their share of the meter, so clicking a rest landed on its neighbour. The
 * drawn columns are the honest ruler, and they are right here in the SVG.
 *
 * Noteheads, fret digits and rests only: the marks that ARE a moment. A stem,
 * a beam or a slur carries its event's id too and would drag the column's
 * centre off the beat it belongs to.
 */
export function collectInkColumns(svg: SVGSVGElement, sp: number): InkColumn[] {
  const columns: InkColumn[] = [];
  for (const el of svg.querySelectorAll<SVGGraphicsElement>(
    '.notehead[data-source-id], .fret-number[data-source-id], .rest[data-source-id]'
  )) {
    if (el.classList.contains('unperformed')) continue;
    const key = el.getAttribute('data-source-id');
    if (!key) continue;
    const box = inkBox(el, sp);
    columns.push({ x: box.x + box.w / 2, y: box.y + box.h / 2, key });
  }
  return columns;
}

/** 1 sp in SVG user units: the smallest positive staff-line gap. */
export function unitsPerSp(svg: SVGSVGElement): number {
  const ys = [...svg.querySelectorAll<SVGLineElement>('line.staff-line')]
    .map(l => l.y1.baseVal.value)
    .sort((a, b) => a - b);
  let min = Infinity;
  for (let i = 1; i < ys.length; i++) {
    const gap = ys[i] - ys[i - 1];
    if (gap > 0.01 && gap < min) min = gap;
  }
  if (Number.isFinite(min)) return min;
  // Single-line staves: fall back to the SMuFL em (font-size is 4 sp).
  const glyph = svg.querySelector('text[font-family="Bravura"]');
  const em = glyph ? parseFloat(glyph.getAttribute('font-size') ?? '') : NaN;
  return Number.isFinite(em) ? em / 4 : 10;
}

/** The staff a glyph belongs to: the nearest band (interval distance),
 *  optionally restricted to candidate indices. */
export function staffIndexOf(staves: StaffBand[], box: Box, candidates?: number[]): number {
  const cy = box.y + box.h / 2;
  const pool = candidates && candidates.length > 0 ? candidates : staves.map((_, i) => i);
  let best = pool[0];
  let bestDist = Infinity;
  for (const i of pool) {
    const staff = staves[i];
    const dist = Math.max(0, staff.top - cy, cy - staff.bottom);
    if (dist < bestDist) {
      best = i;
      bestDist = dist;
    }
  }
  return best;
}

/** Snap an x-range outward to the bar edges that enclose it (else the row's edges). */
export function snapToBars(
  edges: readonly number[],
  band: { x1: number; x2: number },
  minX: number,
  maxX: number
): { left: number; right: number } {
  const eps = 0.01;
  const left = [...edges].reverse().find(x => x <= minX + eps) ?? band.x1;
  const right = edges.find(x => x >= maxX - eps) ?? band.x2;
  return { left, right };
}

/** Interval distance from a point to a band: zero inside it. */
export function bandDistance(band: { top: number; bottom: number }, y: number): number {
  return Math.max(0, band.top - y, y - band.bottom);
}

