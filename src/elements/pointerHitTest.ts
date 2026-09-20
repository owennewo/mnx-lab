/**
 * Where a pointer landed on the engraved score
 * (roadmap/complete/core-editor-pointer-placement.md).
 *
 * This is the enclosure's questions asked in reverse. The enclosure is handed a
 * model address and finds the ink; here a point on the page has to become an
 * address, and the engraved SVG carries no identity to look one up with — no
 * staff, system or bar is labelled, only note ink is. So the answer is a JOIN
 * of two things neither of which can produce it alone:
 *
 *  - **geometry**, measured off the finished SVG (`scoreGeometry.ts`): the
 *    staff bands, which of them share a system, and where the bars divide;
 *  - **the paint's own staff table**, which the viewer builds while it draws,
 *    because the walk from a part and staff to a position on the page depends
 *    on the view, on which parts are hidden and on each part's tab setup —
 *    model facts no amount of looking at the picture recovers.
 *
 * What comes out is deliberately NOT a cursor. It is the measurement, in the
 * terms the edit session can snap: spacing is not linear in music, so an x
 * yields a neighbourhood (`fraction`) rather than an onset, and only the
 * cursor grid knows which stop that neighbourhood belongs to.
 */
import {
  assignSystems,
  bandDistance,
  bandLineGap,
  collectBarlines,
  collectStaves,
  collectSystemBands,
  isTabBand,
  measureBoundaries,
  tabBandMarkers,
  type StaffBand,
  type SystemBand
} from './scoreGeometry.ts';
import { measurePositionAt, measurePositionX } from '../engine/render/selectionGeometry.ts';

/**
 * One rendered staff, in model terms. The viewer builds this list in the order
 * the staves are drawn down a system, so its index IS the ordinal the
 * enclosure already speaks in.
 */
export interface RenderedStaff {
  partIndex: number;
  /** 1-based, as everywhere in the cursor's address. */
  staffIndex: number;
  /** Which space this rendered staff shows — the `both` view draws two. */
  projection: 'notation' | 'tab';
  /** How many staves the part has, for the clamp the enclosure applies. */
  staffCount: number;
}

/** What a click or a hover resolves to, before the session snaps it. */
export interface PointerPlacement {
  measureIndex: number;
  partIndex: number;
  staffIndex: number;
  projection: 'notation' | 'tab';
  /** A string number (tab) or a staff position (notation). */
  line: number;
  /** Where along the bar, 0…1 of its metric span. */
  fraction: number;
  /** The note the pointer was actually over, when it was over one. */
  noteKey?: string;
}

/** The measured page, built once per paint and asked many times. */
export interface ScorePointerMap {
  sp: number;
  staves: StaffBand[];
  systems: SystemBand[];
  markers: number[];
  /** Measure indices per rendered system row, top row first. */
  rows: number[][];
  /** Rendered staves in system order — the ordinal table. */
  table: RenderedStaff[];
  /** Per-band line spacing, by band index. */
  gaps: number[];
  boundaries: (number | undefined)[][];
}

/**
 * Measure the page. Everything here is a read, so it is done once per paint and
 * thrown away when the DOM is rebuilt — a hover that re-measured on every
 * `pointermove` would walk the whole tree at the frame rate.
 */
export function buildPointerMap(
  svg: SVGSVGElement,
  rows: number[][],
  table: RenderedStaff[],
  unitsPerSp: number
): ScorePointerMap {
  const barlines = collectBarlines(svg);
  const staves = assignSystems(collectStaves(svg, unitsPerSp), barlines);
  const systems = collectSystemBands(staves);
  const markers = tabBandMarkers(svg);
  const gaps = staves.map(band => bandLineGap(svg, band, unitsPerSp));
  const boundaries = systems.map((system, rowIndex) => {
    const count = rows[rowIndex]?.length ?? 0;
    return count > 0 ? measureBoundaries(system, barlines, count, unitsPerSp) : [];
  });
  return { sp: unitsPerSp, staves, systems, markers, rows, table, gaps, boundaries };
}

/**
 * The join. A point yields a full address or nothing at all — there is no
 * half-answer, because a placement that guessed at a part would move the cursor
 * somewhere the reader did not point.
 *
 * Nothing here clamps the line into the staff: a notehead on a ledger line is
 * outside the band and still a legitimate place to stand, so the raw staff
 * position travels on and the session's own range is what limits it.
 */
export function hitTest(
  map: ScorePointerMap,
  point: { x: number; y: number },
  noteKey?: string
): PointerPlacement | null {
  if (map.systems.length === 0 || map.staves.length === 0) return null;

  // The system first: rows are laid out down the page and never overlap, so
  // the nearest one owns the point even when it fell in the gutter between two.
  let rowIndex = 0;
  let bestSystem = Number.POSITIVE_INFINITY;
  map.systems.forEach((system, index) => {
    const distance = bandDistance(system, point.y);
    if (distance < bestSystem) {
      bestSystem = distance;
      rowIndex = index;
    }
  });
  const system = map.systems[rowIndex];
  const rowMeasures = map.rows[rowIndex];
  if (!system || !rowMeasures || rowMeasures.length === 0) return null;

  // Then the staff within it, again by nearest — the point may be above the
  // top line or below the bottom one and still plainly mean that staff.
  let bandIndex = system.staffIndices[0];
  let bestBand = Number.POSITIVE_INFINITY;
  for (const index of system.staffIndices) {
    const distance = bandDistance(map.staves[index], point.y);
    if (distance < bestBand) {
      bestBand = distance;
      bandIndex = index;
    }
  }
  const band = map.staves[bandIndex];
  const ordinal = system.staffIndices.indexOf(bandIndex);
  const staff = map.table[ordinal];
  if (!band || !staff) return null;

  // The bar: which interval between this row's boundaries holds the x. Past
  // either end the nearest bar owns it, so a click in the margin still lands.
  const boundaries = map.boundaries[rowIndex] ?? [];
  let cell = -1;
  for (let i = 0; i + 1 < boundaries.length; i++) {
    const left = boundaries[i];
    const right = boundaries[i + 1];
    if (left === undefined || right === undefined) continue;
    if (point.x >= left && point.x <= right) {
      cell = i;
      break;
    }
  }
  if (cell < 0) cell = point.x < (boundaries[0] ?? system.x1) ? 0 : rowMeasures.length - 1;
  const measureIndex = rowMeasures[Math.min(cell, rowMeasures.length - 1)];
  if (measureIndex === undefined) return null;
  const left = boundaries[cell] ?? system.x1;
  const right = boundaries[cell + 1] ?? system.x2;

  // The line, in whichever space this band is drawing. The rendered band is
  // the authority, not the table: in the `both` view the reader can point at
  // either of a part's two staves, and which one they pointed at is the whole
  // question. The table supplies the part and staff; the ink supplies the space.
  const tab = isTabBand(map.markers, band, map.sp);
  const gap = map.gaps[bandIndex] || map.sp;
  const line = tab
    ? Math.round((point.y - band.top) / Math.max(gap, 1e-6)) + 1
    : Math.round(((band.top + band.bottom) / 2 - point.y) / Math.max(gap / 2, 1e-6));

  return {
    measureIndex,
    partIndex: staff.partIndex,
    staffIndex: staff.staffIndex,
    projection: tab ? 'tab' : 'notation',
    line,
    fraction: measurePositionAt(left, right, point.x, map.sp),
    ...(noteKey === undefined ? {} : { noteKey })
  };
}

/**
 * The enclosure's forward question, answered from the same table so the two
 * directions cannot drift: which rendered ordinals does this model address
 * occupy? The clamp is the one the enclosure has always applied — a unit
 * naming a staff the part does not have belongs to its last.
 */
export function ordinalsOf(
  table: readonly RenderedStaff[],
  partIndex: number | undefined,
  staffIndex: number | undefined,
  tabOnlyView: boolean
): number[] {
  if (partIndex === undefined || staffIndex === undefined) return [];
  if (tabOnlyView) return partIndex === 0 ? [0] : [];
  const found: number[] = [];
  table.forEach((staff, ordinal) => {
    if (staff.partIndex !== partIndex) return;
    const wanted =
      staff.projection === 'tab'
        ? staffIndex === 1
        : staff.staffIndex === Math.max(1, Math.min(staff.staffCount, staffIndex));
    if (wanted) found.push(ordinal);
  });
  return found;
}

/**
 * The hover ghost: where a click WOULD put the cursor.
 *
 * Its own layer, so neither the enclosure nor the cursor ghost has to know it
 * exists, and it is removed before every draw rather than moved — the page may
 * have been repainted under it. It borrows the cursor ghost's shape and colour
 * deliberately: this is the same object, proposed rather than placed, and a
 * second visual vocabulary would read as a second cursor.
 */
export function drawPointerGhost(
  svg: SVGSVGElement,
  map: ScorePointerMap,
  placement: PointerPlacement | null
): void {
  svg.querySelector(':scope > g.pointer-ghost')?.remove();
  if (!placement) return;
  const rowIndex = map.rows.findIndex(row => row.includes(placement.measureIndex));
  const system = map.systems[rowIndex];
  if (!system) return;
  const ordinals = map.table
    .map((staff, ordinal) => ({ staff, ordinal }))
    .filter(
      ({ staff }) =>
        staff.partIndex === placement.partIndex &&
        staff.projection === placement.projection &&
        (staff.projection === 'tab' || staff.staffIndex === placement.staffIndex)
    )
    .map(({ ordinal }) => ordinal);
  const bandIndex = system.staffIndices[ordinals[0] ?? -1];
  const band = map.staves[bandIndex];
  if (!band) return;

  const cell = (map.rows[rowIndex] ?? []).indexOf(placement.measureIndex);
  const boundaries = map.boundaries[rowIndex] ?? [];
  const left = boundaries[cell] ?? system.x1;
  const right = boundaries[cell + 1] ?? system.x2;
  const gap = map.gaps[bandIndex] || map.sp;
  const x = measurePositionX(left, right, placement.fraction, map.sp);
  const y =
    placement.projection === 'tab'
      ? band.top + (placement.line - 1) * gap
      : (band.top + band.bottom) / 2 - placement.line * (gap / 2);

  const group = svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('class', 'pointer-ghost');
  const side = 1.3 * gap;
  const rect = svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', String(x - side / 2));
  rect.setAttribute('y', String(y - side / 2));
  rect.setAttribute('width', String(side));
  rect.setAttribute('height', String(side));
  rect.setAttribute('rx', String(0.3 * map.sp));
  rect.setAttribute('stroke-width', String(0.12 * map.sp));
  rect.setAttribute('stroke-dasharray', `${0.4 * map.sp} ${0.3 * map.sp}`);
  group.appendChild(rect);
  svg.appendChild(group);
}
