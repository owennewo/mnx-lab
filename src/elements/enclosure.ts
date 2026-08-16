// The selection enclosure overlay — roadmap/complete/core-selection-ladder.md.
//
// One visual vocabulary for every selection level: an enclosure whose extent
// grows and whose fill fades as the level widens (cell → slice → lasso → run
// → panel → panel-wide → frame). Drawn from the RENDERED SVG's own geometry —
// selected glyphs (`.selected`), staff lines (`.staff-line`) and barlines
// (`.barline`) — so it needs no layout API, works identically in the
// notation, tab and both views, and stays presentation-only: this module
// knows shapes, never editor levels (the workbench maps level → kind).
//
// Geometry is derived, not assumed: 1 staff-space in SVG user units is the
// smallest gap between staff lines, staves are line-groups, and SYSTEMS are
// staves joined by a shared barline — which is why a part-measure panel in
// the both view is one rect spanning the notation+tab pair (the design's
// "two echoes merge at part-measure") without this file knowing what a
// projection is.
import type {
  CursorGhost,
  EnclosureKind,
  SelectionSpan,
  SelectionSpanUnit
} from './mnxContext.ts';
import {
  pairEnclosureRects,
  sameEnclosureRects,
  type EnclosureRectGeometry
} from '../engine/render/enclosureTransition.ts';
import {
  isEchoProjection,
  type RenderedProjection
} from '../engine/render/projection.ts';
import {
  emptyPartGhostRect,
  measurePositionX
} from '../engine/render/selectionGeometry.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface StaffBand {
  top: number;
  bottom: number;
  x1: number;
  x2: number;
  /** Index of the system this staff belongs to (shared-barline join). */
  system: number;
}

interface Barline {
  x: number;
  y1: number;
  y2: number;
}

interface SystemBand {
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
function inkBox(el: SVGGraphicsElement, sp: number): Box {
  const b = el.getBBox();
  if (el.tagName === 'text') {
    const ys = (el as SVGTextElement).y.baseVal;
    const anchor = ys.numberOfItems > 0 ? ys.getItem(0).value : b.y + b.height / 2;
    const h = Math.min(b.height, 1.6 * sp);
    return { x: b.x, y: anchor - h / 2, w: b.width, h };
  }
  return { x: b.x, y: b.y, w: b.width, h: b.height };
}

function union(boxes: Box[]): Box {
  const x0 = Math.min(...boxes.map(b => b.x));
  const y0 = Math.min(...boxes.map(b => b.y));
  const x1 = Math.max(...boxes.map(b => b.x + b.w));
  const y1 = Math.max(...boxes.map(b => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Staff lines grouped into staves; a gap > 2.5 sp starts the next staff. */
function collectStaves(svg: SVGSVGElement, sp: number): Omit<StaffBand, 'system'>[] {
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
function unitsPerSp(svg: SVGSVGElement): number {
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

function collectBarlines(svg: SVGSVGElement): Barline[] {
  return [...svg.querySelectorAll<SVGLineElement>('line.barline')].map(l => ({
    x: l.x1.baseVal.value,
    y1: Math.min(l.y1.baseVal.value, l.y2.baseVal.value),
    y2: Math.max(l.y1.baseVal.value, l.y2.baseVal.value)
  }));
}

/** Join staves into systems: two staves sharing a barline share a system —
 *  the both view's single-stroke barlines make the pair one system. */
function assignSystems(staves: Omit<StaffBand, 'system'>[], barlines: Barline[]): StaffBand[] {
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
function staffIndexOf(staves: StaffBand[], box: Box, candidates?: number[]): number {
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
function snapToBarlines(
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

function collectSystemBands(staves: StaffBand[]): SystemBand[] {
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
function measureBoundaries(
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
 * Options for a SECOND enclosure drawn beside the real one: the selection
 * tray's scope preview (core-selection-tray-mechanism.md). The footprint
 * arrives as note keys rather than a `.selected` class, because previewing
 * must not touch the layout — the renderer tags what the session selected,
 * and a candidate scope is not selected. Note glyphs already carry their key
 * as `data-source-id`, so the overlay can find its own footprint.
 */
export interface EnclosureOptions {
  /** Draw as a dashed candidate into its own layer, not the live selection. */
  preview?: boolean;
  /** The footprint, when it is not the rendered `.selected` set. */
  noteIds?: readonly string[];
  /** Resolved model coverage, including members with no selected SVG ink. */
  span?: SelectionSpan | null;
  /** Measure indices per rendered system, from the packing behind this paint. */
  systemRows?: readonly (readonly number[])[] | null;
  /** Projection-specific model staff → rendered staff ordinals. Used only
   * when a structural unit has no glyph from which to infer its staff. */
  staffOrdinals?: (unit: SelectionSpanUnit) => readonly number[];
  /** Which of the combined view's two rendered spaces owns input. Fine-rung
   * fragments on the other projection are tagged as the quiet echo. */
  primaryProjection?: RenderedProjection | null;
}

export type CursorGhostOptions = Pick<EnclosureOptions, 'systemRows' | 'staffOrdinals'>;

export interface EnclosureSnapshot {
  kind: EnclosureKind;
  viewBox: string;
  rects: EnclosureRectGeometry[];
}

const geometryOf = (rect: SVGRectElement): EnclosureRectGeometry => ({
  x: Number(rect.getAttribute('x') ?? 0),
  y: Number(rect.getAttribute('y') ?? 0),
  width: Number(rect.getAttribute('width') ?? 0),
  height: Number(rect.getAttribute('height') ?? 0),
  radius: Number(rect.getAttribute('rx') ?? 0),
  stroke: Number(rect.getAttribute('stroke-width') ?? 0),
  ...(rect.dataset.projection === 'notation' || rect.dataset.projection === 'tab'
    ? { projection: rect.dataset.projection }
    : {}),
  ...(rect.classList.contains('selection-echo') ? { echo: true } : {})
});

/** The currently visible enclosure, including an interrupted tween's live
 * geometry. Kept as SVG user units so a redraw can replace the whole tree
 * without losing the shape the reader just saw. */
export function snapshotEnclosure(svg: SVGSVGElement): EnclosureSnapshot | null {
  const group =
    svg.querySelector<SVGGElement>(':scope > g.enclosure-transition') ??
    svg.querySelector<SVGGElement>(':scope > g.enclosure');
  if (!group) return null;
  const kindClass = [...group.classList].find(name => name.startsWith('enc-'));
  const kind = kindClass?.slice(4) as EnclosureKind | undefined;
  const rects = [...group.querySelectorAll<SVGRectElement>('rect')].map(geometryOf);
  if (!kind || rects.length === 0) return null;
  return { kind, viewBox: svg.getAttribute('viewBox') ?? '', rects };
}

function writeGeometry(rect: SVGRectElement, geometry: EnclosureRectGeometry): void {
  rect.setAttribute('x', String(geometry.x));
  rect.setAttribute('y', String(geometry.y));
  rect.setAttribute('width', String(Math.max(0, geometry.width)));
  rect.setAttribute('height', String(Math.max(0, geometry.height)));
  rect.setAttribute('rx', String(Math.max(0, geometry.radius)));
  rect.setAttribute('stroke-width', String(Math.max(0, geometry.stroke)));
}

function writePresentation(rect: SVGRectElement, geometry: EnclosureRectGeometry): void {
  if (geometry.projection) rect.dataset.projection = geometry.projection;
  rect.classList.toggle('selection-echo', geometry.echo === true);
}

const mix = (from: number, to: number, t: number) => from + (to - from) * t;

/** Morph the previous rung into the enclosure just drawn in `svg`. The real
 * target stays in the tree (and supplies final anchor geometry) while a short-
 * lived overlay carries the transition. Returns a cancellation hook, or null
 * when the geometry/viewBox did not change or the reader requests reduced motion. */
export function tweenEnclosure(
  svg: SVGSVGElement,
  previous: EnclosureSnapshot | null,
  finished?: () => void,
  duration = 180
): (() => void) | null {
  const target = snapshotEnclosure(svg);
  const targetGroup = svg.querySelector<SVGGElement>(':scope > g.enclosure');
  if (
    !previous ||
    !target ||
    !targetGroup ||
    sameEnclosureRects(previous.rects, target.rects) ||
    previous.viewBox !== target.viewBox ||
    globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    return null;
  }
  const pairs = pairEnclosureRects(previous.rects, target.rects);
  if (pairs.length === 0) return null;

  const transition = document.createElementNS(SVG_NS, 'g');
  transition.setAttribute('class', `enclosure enclosure-transition enc-${target.kind}`);
  const rects = pairs.map(pair => {
    const rect = document.createElementNS(SVG_NS, 'rect');
    writeGeometry(rect, pair.from);
    writePresentation(rect, pair.to);
    transition.appendChild(rect);
    return rect;
  });
  targetGroup.style.opacity = '0';
  svg.insertBefore(transition, targetGroup);

  let frame = 0;
  let cancelled = false;
  const started = performance.now();
  const clean = (notify: boolean) => {
    if (cancelled) return;
    cancelled = true;
    cancelAnimationFrame(frame);
    transition.remove();
    targetGroup.style.removeProperty('opacity');
    if (notify) finished?.();
  };
  const step = (now: number) => {
    const linear = Math.min(1, Math.max(0, (now - started) / duration));
    const eased = linear < 0.5
      ? 4 * linear * linear * linear
      : 1 - Math.pow(-2 * linear + 2, 3) / 2;
    pairs.forEach((pair, index) => {
      writeGeometry(rects[index], {
        x: mix(pair.from.x, pair.to.x, eased),
        y: mix(pair.from.y, pair.to.y, eased),
        width: mix(pair.from.width, pair.to.width, eased),
        height: mix(pair.from.height, pair.to.height, eased),
        radius: mix(pair.from.radius, pair.to.radius, eased),
        stroke: mix(pair.from.stroke, pair.to.stroke, eased)
      });
    });
    if (linear >= 1) clean(true);
    else frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => clean(false);
}

/** Apply the same primary/echo distinction to the selected ink that the
 * enclosure uses. Only the combined view passes a primary projection; split
 * views therefore keep their ordinary full-strength selection. */
export function markProjectionEchoes(
  svg: SVGSVGElement,
  primary: RenderedProjection | null | undefined
): void {
  for (const element of svg.querySelectorAll<SVGGraphicsElement>('.selected')) {
    const projection: RenderedProjection = element.classList.contains('fret-number')
      ? 'tab'
      : 'notation';
    element.classList.toggle('selection-echo', isEchoProjection(projection, primary));
  }
}

export function drawEnclosure(
  svg: SVGSVGElement,
  kind: EnclosureKind,
  options: EnclosureOptions = {}
): void {
  const preview = options.preview === true;
  const layer = preview ? 'enclosure-preview' : 'enclosure';
  svg.querySelector(`:scope > g.${layer}`)?.remove();

  const sp = unitsPerSp(svg);
  let glyphs = options.noteIds
    ? previewGlyphs(svg, kind, options.noteIds)
    : [
        ...svg.querySelectorAll<SVGGraphicsElement>(
          kind === 'cell' ? '.notehead.selected, .fret-number.selected' : '.selected'
        )
      ];
  // Container artifacts do not carry note ids of their own. Once the member
  // notes identify the horizontal extent, include the owning notation ink in
  // that extent so the lasso surrounds the tuplet/grace/tremolo as a thing,
  // not merely its child noteheads.
  if (kind === 'lasso' && glyphs.length > 0) {
    const seed = union(glyphs.map(el => inkBox(el, sp)));
    const artifacts = [
      ...svg.querySelectorAll<SVGGraphicsElement>(
        '.tuplet-bracket, .tuplet-number, .grace-slash, .tremolo-beam'
      )
    ].filter(el => {
      const box = inkBox(el, sp);
      return (
        box.x + box.w >= seed.x - sp &&
        box.x <= seed.x + seed.w + sp &&
        box.y + box.h >= seed.y - 5 * sp &&
        box.y <= seed.y + seed.h + 5 * sp
      );
    });
    glyphs = [...glyphs, ...artifacts];
  }
  const boxes = glyphs.map(el => inkBox(el, sp));
  const hasStructuralSpan = Boolean(options.span?.units.length && options.systemRows?.length);
  if (boxes.length === 0 && kind !== 'frame' && !hasStructuralSpan) return;

  const barlines = collectBarlines(svg);
  const staves = assignSystems(collectStaves(svg, sp), barlines);

  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', `${layer} enc-${kind}`);
  const rect = (
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    stroke: number,
    projection?: RenderedProjection
  ) => {
    const r = document.createElementNS(SVG_NS, 'rect');
    r.setAttribute('x', String(x));
    r.setAttribute('y', String(y));
    r.setAttribute('width', String(w));
    r.setAttribute('height', String(h));
    r.setAttribute('rx', String(radius));
    r.setAttribute('stroke-width', String(stroke));
    if (projection) {
      r.dataset.projection = projection;
      r.classList.toggle(
        'selection-echo',
        isEchoProjection(projection, options.primaryProjection)
      );
    }
    g.appendChild(r);
  };

  /**
   * Boxes per staff index — two-pass, by glyph KIND before proximity: fret
   * numbers sit ON their staff, so they assign first and mark those staves as
   * tab; noteheads then prefer the remaining staves. Pure y-proximity would
   * hand a deep-ledger notehead to the tab staff below it — projection
   * semantics (frets = tab, noteheads = notation) is the honest tiebreak.
   */
  const byStaff = new Map<number, Box[]>();
  const tabStaves = new Set<number>();
  if (staves.length > 0) {
    for (const marker of svg.querySelectorAll<SVGGraphicsElement>('.tab-clef, .fret-number')) {
      tabStaves.add(staffIndexOf(staves, inkBox(marker, sp)));
    }
    glyphs.forEach((el, i) => {
      if (el.classList.contains('fret-number')) tabStaves.add(staffIndexOf(staves, boxes[i]));
    });
    const notationPool = staves.map((_, i) => i).filter(i => !tabStaves.has(i));
    glyphs.forEach((el, i) => {
      const staff = el.classList.contains('fret-number')
        ? staffIndexOf(staves, boxes[i])
        : staffIndexOf(staves, boxes[i], notationPool);
      byStaff.set(staff, [...(byStaff.get(staff) ?? []), boxes[i]]);
    });
  }
  const projectionOfStaff = (staffIndex: number): RenderedProjection =>
    tabStaves.has(staffIndex) ? 'tab' : 'notation';

  /** Range selections are structural spans, not merely unions of ink. Draw
   * them as one continuous enclosure on each row/projection and use the row's
   * measure cells when a rest or empty copy contributes no glyph. */
  if (hasStructuralSpan && kind !== 'frame') {
    const span = options.span!;
    const rows = options.systemRows!;
    const systems = collectSystemBands(staves);
    const isRange = span.units.length > 1;

    systems.forEach((system, rowIndex) => {
      const rowMeasures = rows[rowIndex];
      if (!rowMeasures?.length) return;
      const units = span.units.filter(unit => rowMeasures.includes(unit.measureIndex));
      if (units.length === 0) return;
      const boundaries = measureBoundaries(system, barlines, rowMeasures.length, sp);
      const rowRect = (
        x: number,
        y: number,
        width: number,
        height: number,
        radius: number,
        stroke: number,
        projection?: RenderedProjection
      ) => {
        rect(x, y, width, height, radius, stroke, projection);
        (g.lastElementChild as SVGRectElement | null)?.setAttribute('data-system-row', String(rowIndex));
      };
      const cellOf = (measureIndex: number) => {
        const index = rowMeasures.indexOf(measureIndex);
        return index < 0 ? null : { left: boundaries[index], right: boundaries[index + 1] };
      };
      const systemBoxes = system.staffIndices.flatMap(index => byStaff.get(index) ?? []);

      const fallbackTargets = new Set<number>();
      for (const unit of units) {
        const ordinals = options.staffOrdinals?.(unit) ?? [];
        for (const ordinal of ordinals) {
          const staffIndex = system.staffIndices[ordinal];
          if (staffIndex !== undefined) fallbackTargets.add(staffIndex);
        }
      }
      const glyphTargets = system.staffIndices.filter(index => (byStaff.get(index)?.length ?? 0) > 0);
      const targets = new Set<number>([...glyphTargets, ...fallbackTargets]);
      if (targets.size === 0 && span.coverage !== 'measure') {
        const first = system.staffIndices[0];
        if (first !== undefined) targets.add(first);
      }

      const unitBelongsTo = (unit: SelectionSpanUnit, staffIndex: number) => {
        if (unit.partIndex === undefined || unit.staffIndex === undefined) return true;
        const ordinal = system.staffIndices.indexOf(staffIndex);
        const mapped = options.staffOrdinals?.(unit) ?? [];
        return mapped.length === 0 || mapped.includes(ordinal);
      };
      const boxesInCell = (staffBoxes: Box[], cell: { left: number; right: number }) =>
        staffBoxes.filter(box => {
          const centre = box.x + box.w / 2;
          return centre >= cell.left - 0.01 && centre <= cell.right + 0.01;
        });
      const horizontalRange = (staffIndex?: number) => {
        const relevantUnits = staffIndex === undefined
          ? units
          : units.filter(unit => unitBelongsTo(unit, staffIndex));
        const staffBoxes = staffIndex === undefined ? systemBoxes : byStaff.get(staffIndex) ?? [];
        const ranges: { left: number; right: number }[] = [];
        for (const unit of relevantUnits) {
          const cell = cellOf(unit.measureIndex);
          if (!cell) continue;
          const cellBoxes = boxesInCell(staffBoxes, cell);
          if (span.coverage === 'moment') {
            for (const box of cellBoxes) ranges.push({ left: box.x, right: box.x + box.w });
            // A lone ink-bearing point keeps the old glyph-tight geometry.
            // In a range, onset anchors preserve rest-only endpoints and
            // intermediate silence; with no ink they also represent a point
            // selection on a rest.
            if (isRange || cellBoxes.length === 0) {
              const x = measurePositionX(
                cell.left,
                cell.right,
                unit.position ?? 0,
                sp
              );
              ranges.push({ left: x - 0.4 * sp, right: x + 0.4 * sp });
            }
          } else if (kind === 'run') {
            if (cellBoxes.length > 0) {
              for (const box of cellBoxes) ranges.push({ left: box.x, right: box.x + box.w });
            } else {
              // Empty voice-measure: a visible run through the bar, inset so
              // it cannot be mistaken for the part/global bar ownership.
              ranges.push({ left: cell.left + 0.7 * sp, right: cell.right - 0.7 * sp });
            }
          } else {
            ranges.push({ left: cell.left, right: cell.right });
          }
        }
        if (ranges.length === 0) return null;
        return {
          left: Math.min(...ranges.map(range => range.left)),
          right: Math.max(...ranges.map(range => range.right))
        };
      };

      if (kind === 'panel-wide') {
        const range = horizontalRange();
        if (!range) return;
        const vb = svg.viewBox.baseVal;
        const previous = systems[rowIndex - 1];
        const next = systems[rowIndex + 1];
        const top = previous ? (previous.bottom + system.top) / 2 : vb.y + 0.4 * sp;
        const bottom = next ? (system.bottom + next.top) / 2 : vb.y + vb.height - 0.4 * sp;
        const x0 = Math.max(range.left - 0.35 * sp, vb.x + 0.3 * sp);
        const x1 = Math.min(range.right + 0.35 * sp, vb.x + vb.width - 0.3 * sp);
        rowRect(x0, top, x1 - x0, bottom - top, 0.4 * sp, 0.07 * sp);
        return;
      }

      if (kind === 'panel') {
        const range = horizontalRange();
        if (!range) return;
        const targetStaves = [...targets].map(index => staves[index]);
        const vertical = targetStaves.length > 0 ? targetStaves : system.staffIndices.map(index => staves[index]);
        const targetBoxes = [...targets].flatMap(index => byStaff.get(index) ?? []);
        const topInk = targetBoxes.length ? Math.min(...targetBoxes.map(box => box.y)) - 0.5 * sp : Infinity;
        const bottomInk = targetBoxes.length
          ? Math.max(...targetBoxes.map(box => box.y + box.h)) + 0.5 * sp
          : -Infinity;
        const top = Math.min(...vertical.map(staff => staff.top), topInk) - 0.4 * sp;
        const bottom = Math.max(...vertical.map(staff => staff.bottom), bottomInk) + 0.4 * sp;
        rowRect(
          range.left + 0.25 * sp,
          top,
          Math.max(0.2 * sp, range.right - range.left - 0.5 * sp),
          bottom - top,
          0.4 * sp,
          0.07 * sp
        );
        return;
      }

      for (const staffIndex of targets) {
        const staff = staves[staffIndex];
        const range = horizontalRange(staffIndex);
        if (!range) continue;
        const staffBoxes = byStaff.get(staffIndex) ?? [];
        const selectedBox = staffBoxes.length ? union(staffBoxes) : null;
        if (kind === 'cell' && !isRange && selectedBox) {
          const side = Math.max(selectedBox.w, selectedBox.h) + 0.7 * sp;
          rowRect(
            selectedBox.x + selectedBox.w / 2 - side / 2,
            selectedBox.y + selectedBox.h / 2 - side / 2,
            side,
            side,
            0.3 * sp,
            0.12 * sp,
            projectionOfStaff(staffIndex)
          );
          continue;
        }
        const top = (kind === 'cell' || kind === 'lasso') && selectedBox
          ? selectedBox.y - 0.5 * sp
          : Math.min(staff.top - (kind === 'slice' ? 1.5 : 1) * sp, selectedBox?.y ?? Infinity);
        const bottom = (kind === 'cell' || kind === 'lasso') && selectedBox
          ? selectedBox.y + selectedBox.h + 0.5 * sp
          : Math.max(
              staff.bottom + (kind === 'slice' ? 1.5 : 1) * sp,
              selectedBox ? selectedBox.y + selectedBox.h : -Infinity
            );
        rowRect(
          range.left - 0.4 * sp,
          top,
          range.right - range.left + 0.8 * sp,
          bottom - top,
          kind === 'cell' ? 0.3 * sp : 0.5 * sp,
          kind === 'cell' ? 0.12 * sp : 0.1 * sp,
          projectionOfStaff(staffIndex)
        );
      }
    });

    if (g.childElementCount > 0) svg.insertBefore(g, svg.firstChild);
    return;
  }

  switch (kind) {
    case 'cell': {
      // A snug SQUARE on each selected glyph — a position mark, not an ink
      // claim (the accidental is deliberately outside).
      boxes.forEach((b, index) => {
        const side = Math.max(b.w, b.h) + 0.7 * sp;
        const projection: RenderedProjection = glyphs[index].classList.contains('fret-number')
          ? 'tab'
          : 'notation';
        rect(
          b.x + b.w / 2 - side / 2,
          b.y + b.h / 2 - side / 2,
          side,
          side,
          0.3 * sp,
          0.12 * sp,
          projection
        );
      });
      break;
    }
    case 'slice': {
      // A COLUMN through the staff: the event is a moment, not a place. The
      // column stretches to keep deep-ledger notes inside their own moment.
      for (const [i, staffBoxes] of byStaff) {
        const staff = staves[i];
        const u = union(staffBoxes);
        const top = Math.min(staff.top - 1.5 * sp, u.y - 0.5 * sp);
        const bottom = Math.max(staff.bottom + 1.5 * sp, u.y + u.h + 0.5 * sp);
        rect(
          u.x - 0.4 * sp,
          top,
          u.w + 0.8 * sp,
          bottom - top,
          0.5 * sp,
          0.1 * sp,
          projectionOfStaff(i)
        );
      }
      break;
    }
    case 'lasso': {
      // A snug hull around the container's child ink. The structural onset
      // supplies a small honest fallback for an empty container.
      for (const [i, staffBoxes] of byStaff) {
        const u = union(staffBoxes);
        rect(
          u.x - 0.5 * sp,
          u.y - 0.5 * sp,
          u.w + sp,
          u.h + sp,
          0.55 * sp,
          0.1 * sp,
          projectionOfStaff(i)
        );
      }
      break;
    }
    case 'run': {
      // ONE hull around the voice's run of events, first to last — a single
      // shape per staff, chosen over per-event beads so the future
      // relax/tighten tween morphs one object (design revision 2026-08-09;
      // the cost, accepted: in interleaved two-voice writing the hull can
      // contain the other voice's ink).
      for (const [i, staffBoxes] of byStaff) {
        const staff = staves[i];
        const u = union(staffBoxes);
        const top = Math.min(staff.top - sp, u.y - 0.5 * sp);
        const bottom = Math.max(staff.bottom + sp, u.y + u.h + 0.5 * sp);
        rect(
          u.x - 0.4 * sp,
          top,
          u.w + 0.8 * sp,
          bottom - top,
          0.5 * sp,
          0.1 * sp,
          projectionOfStaff(i)
        );
      }
      break;
    }
    case 'panel':
    case 'panel-wide': {
      // A filled band, barline to barline, over each SYSTEM holding selected
      // ink. The two rungs split on a principle: 'panel' (part-measure) owns
      // the staff's INK — the staff band plus any ledger notes, nothing of
      // the space around it, drawn INSIDE the barlines so all four of its
      // sides read as its own; 'panel-wide' (measure) owns the SPACE — the
      // system's whole vertical slot (to the midpoint of the neighbouring
      // system, or the page crop edge) and THROUGH the barlines, clamped
      // just inside the viewBox so no side is ever clipped away.
      const vb = svg.viewBox.baseVal;
      const systemBands = [...new Set(staves.map(s => s.system))]
        .map(id => {
          const ss = staves.filter(s => s.system === id);
          return {
            id,
            top: Math.min(...ss.map(s => s.top)),
            bottom: Math.max(...ss.map(s => s.bottom)),
            x1: Math.min(...ss.map(s => s.x1)),
            x2: Math.max(...ss.map(s => s.x2))
          };
        })
        .sort((a, b) => a.top - b.top);
      const slotOf = (band: (typeof systemBands)[number]) => {
        const i = systemBands.indexOf(band);
        const prev = systemBands[i - 1];
        const next = systemBands[i + 1];
        return {
          top: prev ? (prev.bottom + band.top) / 2 : vb.y + 0.4 * sp,
          bottom: next ? (band.bottom + next.top) / 2 : vb.y + vb.height - 0.4 * sp
        };
      };
      const bySystem = new Map<number, Box[]>();
      for (const [i, staffBoxes] of byStaff) {
        const sys = staves[i].system;
        bySystem.set(sys, [...(bySystem.get(sys) ?? []), ...staffBoxes]);
      }
      for (const [sys, sysBoxes] of bySystem) {
        const band = systemBands.find(b => b.id === sys)!;
        const u = union(sysBoxes);
        const { left, right } = snapToBarlines(band, barlines, u.x, u.x + u.w);
        if (kind === 'panel') {
          const top = Math.min(band.top, u.y - 0.5 * sp) - 0.4 * sp;
          const bottom = Math.max(band.bottom, u.y + u.h + 0.5 * sp) + 0.4 * sp;
          rect(left + 0.25 * sp, top, right - left - 0.5 * sp, bottom - top, 0.4 * sp, 0.07 * sp);
        } else {
          const slot = slotOf(band);
          const x0 = Math.max(left - 0.35 * sp, vb.x + 0.3 * sp);
          const x1 = Math.min(right + 0.35 * sp, vb.x + vb.width - 0.3 * sp);
          rect(x0, slot.top, x1 - x0, slot.bottom - slot.top, 0.4 * sp, 0.07 * sp);
        }
      }
      break;
    }
    case 'frame': {
      // The enclosure's limit case: fill gone, border only, around everything.
      const vb = svg.viewBox.baseVal;
      const inset = 0.6 * sp;
      rect(
        vb.x + inset,
        vb.y + inset,
        vb.width - 2 * inset,
        vb.height - 2 * inset,
        0.8 * sp,
        0.16 * sp
      );
      break;
    }
  }

  svg.insertBefore(g, svg.firstChild);
}

/** The preview footprint's glyphs, found by the note keys the renderer wrote
 *  as `data-source-id` — the same vocabulary `selectedNoteIds` speaks. */
function previewGlyphs(
  svg: SVGSVGElement,
  kind: EnclosureKind,
  noteIds: readonly string[]
): SVGGraphicsElement[] {
  const wanted = new Set(noteIds);
  return [...svg.querySelectorAll<SVGGraphicsElement>('[data-source-id]')].filter(el => {
    if (!wanted.has(el.getAttribute('data-source-id') ?? '')) return false;
    // Mirrors the `.selected` selector's split: a cell is a position mark on
    // the notehead itself, wider rungs take whatever ink they cover.
    return kind !== 'cell'
      ? true
      : el.classList.contains('notehead') || el.classList.contains('fret-number');
  });
}

/**
 * The cursor's GHOST CELL: a hollow dashed square at an empty (line × beat)
 * cell — the visual for "a place for a thing" (selection addresses what is;
 * the cursor may address what could be). Solid cells come from the selection
 * footprint; this draws only when the cursor's own cell is unoccupied. A
 * note/fret at the same moment is the exact column anchor. When the moment
 * has no ink anywhere, the cursor's structural address falls back to the same
 * packed-row + bar-cell geometry used by rest-only range endpoints.
 */
export function drawCursorGhost(
  svg: SVGSVGElement,
  ghost: CursorGhost,
  options: CursorGhostOptions = {}
): void {
  svg.querySelector(':scope > g.cursor-ghost')?.remove();
  const sp = unitsPerSp(svg);

  if (ghost.structuralEmpty === 'part-measure') {
    const view = svg.viewBox.baseVal;
    const box = emptyPartGhostRect(
      { x: view.x, y: view.y, width: view.width, height: view.height },
      sp
    );
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('class', 'cursor-ghost cursor-ghost-panel');
    const panel = document.createElementNS(SVG_NS, 'rect');
    panel.dataset.ghostScope = 'part-measure';
    panel.setAttribute('x', String(box.x));
    panel.setAttribute('y', String(box.y));
    panel.setAttribute('width', String(box.width));
    panel.setAttribute('height', String(box.height));
    panel.setAttribute('rx', String(0.5 * sp));
    panel.setAttribute('stroke-width', String(0.12 * sp));
    panel.setAttribute('stroke-dasharray', `${0.5 * sp} ${0.35 * sp}`);
    group.appendChild(panel);
    svg.appendChild(group);
    return;
  }
  if (ghost.occupied) return;

  const barlines = collectBarlines(svg);
  const staves = assignSystems(collectStaves(svg, sp), barlines);
  if (staves.length === 0) return;

  const markerYs = [
    ...svg.querySelectorAll<SVGTextElement>('text.tab-clef, text.fret-number')
  ].map(el => (el.y.baseVal.numberOfItems > 0 ? el.y.baseVal.getItem(0).value : NaN));
  const isTabBand = (band: StaffBand) =>
    markerYs.some(y => y >= band.top - sp && y <= band.bottom + sp);

  const systems = collectSystemBands(staves);
  const rows = options.systemRows ?? [];
  const measureIndex = ghost.measureIndex ?? -1;
  const rowIndex = rows.findIndex(row => row.includes(measureIndex));
  const system = systems[rowIndex] ?? systems[0];
  if (!system) return;

  const unit: SelectionSpanUnit = {
    measureIndex,
    ...(ghost.partIndex === undefined ? {} : { partIndex: ghost.partIndex }),
    ...(ghost.staffIndex === undefined ? {} : { staffIndex: ghost.staffIndex })
  };
  const mapped = (options.staffOrdinals?.(unit) ?? [])
    .map(ordinal => system.staffIndices[ordinal])
    .filter((index): index is number => index !== undefined);
  const pool = (mapped.length > 0 ? mapped : system.staffIndices).filter(index =>
    ghost.string !== null ? isTabBand(staves[index]) : !isTabBand(staves[index])
  );
  const bandIndex = pool[0] ?? mapped[0] ?? system.staffIndices[0];
  const band = staves[bandIndex];
  if (!band) return;

  // Line spacing within the band (tab and notation staves may differ).
  const lineYs = [...svg.querySelectorAll<SVGLineElement>('line.staff-line')]
    .map(l => l.y1.baseVal.value)
    .filter(y => y >= band.top - 0.01 && y <= band.bottom + 0.01)
    .sort((a, b) => a - b);
  let gap = sp;
  for (let i = 1; i < lineYs.length; i++) {
    const g = lineYs[i] - lineYs[i - 1];
    if (g > 0.01) {
      gap = g;
      break;
    }
  }

  const y =
    ghost.string !== null
      ? band.top + (ghost.string - 1) * gap
      : (band.top + band.bottom) / 2 - (ghost.staffPosition ?? 0) * (gap / 2);

  let x: number | null = null;
  for (const key of ghost.anchorKeys) {
    const candidates = [
      ...svg.querySelectorAll<SVGGraphicsElement>(`[data-source-id="${CSS.escape(key)}"]`)
    ];
    const el = candidates.find(candidate =>
      ghost.string !== null
        ? candidate.classList.contains('fret-number')
        : candidate.classList.contains('notehead')
    );
    if (!el) continue;
    const b = el.getBBox();
    x = b.x + b.width / 2;
    break;
  }
  if (x === null && rowIndex >= 0) {
    const rowMeasures = rows[rowIndex];
    const measureOffset = rowMeasures.indexOf(measureIndex);
    if (measureOffset >= 0) {
      const boundaries = measureBoundaries(system, barlines, rowMeasures.length, sp);
      x = measurePositionX(
        boundaries[measureOffset],
        boundaries[measureOffset + 1],
        ghost.position ?? 0,
        sp
      );
    }
  }
  if (x === null) return;

  const side = 1.3 * gap;
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'cursor-ghost');
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('x', String(x - side / 2));
  rect.setAttribute('y', String(y - side / 2));
  rect.setAttribute('width', String(side));
  rect.setAttribute('height', String(side));
  rect.setAttribute('rx', String(0.3 * sp));
  rect.setAttribute('stroke-width', String(0.12 * sp));
  rect.setAttribute('stroke-dasharray', `${0.4 * sp} ${0.3 * sp}`);
  g.appendChild(rect);
  svg.appendChild(g);
}
