// The selection enclosure overlay — roadmap/inprogress/core-selection-ladder.md.
//
// One visual vocabulary for every selection level: an enclosure whose extent
// grows and whose fill fades as the level widens (cell → slice → beads →
// panel → panel-wide → frame). Drawn from the RENDERED SVG's own geometry —
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
import type { CursorGhost, EnclosureKind } from './mnxContext.ts';

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
  const glyphs = options.noteIds
    ? previewGlyphs(svg, kind, options.noteIds)
    : [
        ...svg.querySelectorAll<SVGGraphicsElement>(
          kind === 'cell' ? '.notehead.selected, .fret-number.selected' : '.selected'
        )
      ];
  const boxes = glyphs.map(el => inkBox(el, sp));
  if (boxes.length === 0 && kind !== 'frame') return;

  const barlines = collectBarlines(svg);
  const staves = assignSystems(collectStaves(svg, sp), barlines);

  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', `${layer} enc-${kind}`);
  const rect = (x: number, y: number, w: number, h: number, radius: number, stroke: number) => {
    const r = document.createElementNS(SVG_NS, 'rect');
    r.setAttribute('x', String(x));
    r.setAttribute('y', String(y));
    r.setAttribute('width', String(w));
    r.setAttribute('height', String(h));
    r.setAttribute('rx', String(radius));
    r.setAttribute('stroke-width', String(stroke));
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
  if (staves.length > 0) {
    const tabStaves = new Set<number>();
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

  switch (kind) {
    case 'cell': {
      // A snug SQUARE on each selected glyph — a position mark, not an ink
      // claim (the accidental is deliberately outside).
      for (const b of boxes) {
        const side = Math.max(b.w, b.h) + 0.7 * sp;
        rect(b.x + b.w / 2 - side / 2, b.y + b.h / 2 - side / 2, side, side, 0.3 * sp, 0.12 * sp);
      }
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
        rect(u.x - 0.4 * sp, top, u.w + 0.8 * sp, bottom - top, 0.5 * sp, 0.1 * sp);
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
        rect(u.x - 0.4 * sp, top, u.w + 0.8 * sp, bottom - top, 0.5 * sp, 0.1 * sp);
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
 * footprint; this draws only when the cursor's own cell is unoccupied. The
 * column is located from `anchorKeys` (any voice's ink at the cursor's
 * beat); with no ink anywhere at the beat there is nothing to anchor to and
 * the ghost is skipped (known gap: fully empty columns).
 */
export function drawCursorGhost(svg: SVGSVGElement, ghost: CursorGhost): void {
  svg.querySelector(':scope > g.cursor-ghost')?.remove();
  if (ghost.occupied) return;

  const sp = unitsPerSp(svg);
  const barlines = collectBarlines(svg);
  const staves = assignSystems(collectStaves(svg, sp), barlines);
  if (staves.length === 0) return;

  // Tab bands: those with a fret number registered inside them (baseline y).
  const fretYs = [...svg.querySelectorAll<SVGTextElement>('text.fret-number, text.fret-number.selected')].map(
    el => (el.y.baseVal.numberOfItems > 0 ? el.y.baseVal.getItem(0).value : NaN)
  );
  const isTabBand = (band: StaffBand) =>
    fretYs.some(y => y >= band.top - sp && y <= band.bottom + sp);
  const band =
    ghost.string !== null
      ? staves.find(isTabBand) ?? staves[staves.length - 1]
      : staves.find(s => !isTabBand(s)) ?? staves[0];

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
    const el = svg.querySelector<SVGGraphicsElement>(`[data-source-id="${CSS.escape(key)}"]`);
    if (!el) continue;
    const b = el.getBBox();
    x = b.x + b.width / 2;
    break;
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
