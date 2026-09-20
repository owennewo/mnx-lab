/**
 * Reading the FINISHED score's geometry back off the SVG.
 *
 * The engraved tree carries no identity for a staff, a system or a bar: the
 * emitter writes `data-source-id` on note ink and nothing else, and every
 * primitive is a flat child of one `<svg>`. So everything structural an
 * overlay needs — where the staves are, which of them share a system, where
 * the bars divide — is *measured*, not looked up.
 *
 * This module is those measurements, and only those: DOM reads returning plain
 * numbers. The arithmetic that needs no DOM lives in
 * `engine/render/selectionGeometry.ts`; the drawing that needs both lives in
 * `enclosure.ts`, which is where all of this came from. It was pulled out when
 * pointer placement (roadmap/complete/core-editor-pointer-placement.md) became
 * a second reader: a hit-test asks exactly the questions the enclosure asks,
 * in reverse, and two copies of these rules would drift.
 */

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

export interface Barline {
  x: number;
  y1: number;
  y2: number;
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

/** Staff lines grouped into staves; a gap > 2.5 sp starts the next staff. */
export function collectStaves(svg: SVGSVGElement, sp: number): Omit<StaffBand, 'system'>[] {
  const lines = [...svg.querySelectorAll<SVGLineElement>('line.staff-line')]
    .map(l => ({
      y: l.y1.baseVal.value,
      x1: Math.min(l.x1.baseVal.value, l.x2.baseVal.value),
      x2: Math.max(l.x1.baseVal.value, l.x2.baseVal.value)
    }))
    .sort((a, b) => a.y - b.y);
  const staves: Omit<StaffBand, 'system'>[] = [];
  for (const line of lines) {
    const current = staves[staves.length - 1];
    if (current && line.y - current.bottom <= 2.5 * sp) {
      current.bottom = line.y;
      current.x1 = Math.min(current.x1, line.x1);
      current.x2 = Math.max(current.x2, line.x2);
    } else {
      staves.push({ top: line.y, bottom: line.y, x1: line.x1, x2: line.x2 });
    }
  }
  return staves;
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

export function collectBarlines(svg: SVGSVGElement): Barline[] {
  return [...svg.querySelectorAll<SVGLineElement>('line.barline')].map(l => ({
    x: l.x1.baseVal.value,
    y1: Math.min(l.y1.baseVal.value, l.y2.baseVal.value),
    y2: Math.max(l.y1.baseVal.value, l.y2.baseVal.value)
  }));
}

/** Join staves into systems: two staves sharing a barline share a system —
 *  the both view's single-stroke barlines make the pair one system. */
export function assignSystems(staves: Omit<StaffBand, 'system'>[], barlines: Barline[]): StaffBand[] {
  const parent = staves.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const overlaps = (s: Omit<StaffBand, 'system'>, b: Barline) =>
    b.y1 <= s.bottom + 0.01 && b.y2 >= s.top - 0.01;
  for (const bar of barlines) {
    let first = -1;
    staves.forEach((staff, i) => {
      if (!overlaps(staff, bar)) return;
      if (first < 0) first = i;
      else parent[find(i)] = find(first);
    });
  }
  return staves.map((staff, i) => ({ ...staff, system: find(i) }));
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

/** Snap an x-range outward to the enclosing barlines (else the staff edges). */
export function snapToBarlines(
  band: { top: number; bottom: number; x1: number; x2: number },
  barlines: Barline[],
  minX: number,
  maxX: number
): { left: number; right: number } {
  const xs = barlines
    .filter(b => b.y1 <= band.bottom + 0.01 && b.y2 >= band.top - 0.01)
    .map(b => b.x)
    .sort((a, b) => a - b);
  const eps = 0.01;
  const left = [...xs].reverse().find(x => x <= minX + eps) ?? band.x1;
  const right = xs.find(x => x >= maxX - eps) ?? band.x2;
  return { left, right };
}

export function collectSystemBands(staves: StaffBand[]): SystemBand[] {
  return [...new Set(staves.map(staff => staff.system))]
    .map(id => {
      const staffIndices = staves
        .map((staff, index) => ({ staff, index }))
        .filter(item => item.staff.system === id)
        .map(item => item.index);
      const systemStaves = staffIndices.map(index => staves[index]);
      return {
        id,
        top: Math.min(...systemStaves.map(staff => staff.top)),
        bottom: Math.max(...systemStaves.map(staff => staff.bottom)),
        x1: Math.min(...systemStaves.map(staff => staff.x1)),
        x2: Math.max(...systemStaves.map(staff => staff.x2)),
        staffIndices
      };
    })
    .sort((a, b) => a.top - b.top);
}

/** Logical bar boundaries for one rendered row. Repeats/final barlines emit
 * multiple close strokes, so collapse those clusters before matching them to
 * the row's measure count. A no-barline style can leave too few visible
 * dividers; interpolation is the honest last resort for an overlay whose
 * layout metadata deliberately contains rows, not coordinates. */
export function measureBoundaries(
  band: SystemBand,
  barlines: readonly Barline[],
  measureCount: number,
  sp: number
): number[] {
  const candidates = [
    band.x1,
    ...barlines
      .filter(bar => bar.y1 <= band.bottom + 0.01 && bar.y2 >= band.top - 0.01)
      .map(bar => bar.x),
    band.x2
  ].sort((a, b) => a - b);
  const clusters: number[][] = [];
  for (const x of candidates) {
    const current = clusters[clusters.length - 1];
    if (current && x - current[current.length - 1] <= 0.8 * sp) current.push(x);
    else clusters.push([x]);
  }
  let xs = clusters.map(cluster => cluster.reduce((sum, x) => sum + x, 0) / cluster.length);
  const wanted = measureCount + 1;
  while (xs.length > wanted && xs.length > 2) {
    let nearest = 0;
    for (let i = 1; i < xs.length - 1; i++) {
      if (xs[i + 1] - xs[i] < xs[nearest + 1] - xs[nearest]) nearest = i;
    }
    xs.splice(nearest, 2, (xs[nearest] + xs[nearest + 1]) / 2);
  }
  if (xs.length !== wanted) {
    const left = xs[0] ?? band.x1;
    const right = xs[xs.length - 1] ?? band.x2;
    xs = Array.from({ length: wanted }, (_, index) =>
      left + ((right - left) * index) / Math.max(1, measureCount)
    );
  }
  return xs;
}

/**
 * The y of every tab marker in the score — a tab clef or a fret digit. A band
 * holding one of these is a tab staff, which is how the overlay tells the two
 * projections apart in the `both` view without the renderer telling it.
 * Collected once per read, because a per-band query would walk the tree again
 * for every staff on the page.
 */
export function tabBandMarkers(svg: SVGSVGElement): number[] {
  return [...svg.querySelectorAll<SVGTextElement>('text.tab-clef, text.fret-number')]
    .map(el => (el.y.baseVal.numberOfItems > 0 ? el.y.baseVal.getItem(0).value : NaN))
    .filter(y => Number.isFinite(y));
}

/** Whether a band is a tab staff, by the markers above. */
export function isTabBand(
  markers: readonly number[],
  band: { top: number; bottom: number },
  sp: number
): boolean {
  return markers.some(y => y >= band.top - sp && y <= band.bottom + sp);
}

/**
 * Line spacing INSIDE one band. A tab staff and a notation staff on the same
 * page do not share it, so the band's own first gap is the only honest answer;
 * `sp` is the fallback for a band with a single line.
 */
export function bandLineGap(
  svg: SVGSVGElement,
  band: { top: number; bottom: number },
  sp: number
): number {
  const ys = [...svg.querySelectorAll<SVGLineElement>('line.staff-line')]
    .map(l => l.y1.baseVal.value)
    .filter(y => y >= band.top - 0.01 && y <= band.bottom + 0.01)
    .sort((a, b) => a - b);
  for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] > 0.01) return ys[i] - ys[i - 1];
  return sp;
}

/** Interval distance from a point to a band: zero inside it. */
export function bandDistance(band: { top: number; bottom: number }, y: number): number {
  return Math.max(0, band.top - y, y - band.bottom);
}
