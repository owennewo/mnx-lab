/** Geometry shared by the SVG selection enclosure and its presentation-only
 * rung transition. Values are SVG user units, not client pixels. */
export interface EnclosureRectGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  stroke: number;
}

const GEOMETRY_FIELDS: readonly (keyof EnclosureRectGeometry)[] = [
  'x',
  'y',
  'width',
  'height',
  'radius',
  'stroke'
];

/** Whether a redraw preserved the visible enclosure exactly enough that a
 * transition would be imperceptible. Kind is deliberately absent: measure
 * and section share a visual kind but have different extents. */
export function sameEnclosureRects(
  left: readonly EnclosureRectGeometry[],
  right: readonly EnclosureRectGeometry[],
  tolerance = 0.0001
): boolean {
  return left.length === right.length && left.every((rect, index) =>
    GEOMETRY_FIELDS.every(field => Math.abs(rect[field] - right[index][field]) <= tolerance)
  );
}

/** Pair fragments for a topology-changing morph. One→many duplicates the
 * source; many→one converges every source on the target — the both-view echo
 * merge. Other count changes preserve document/drawing order. */
export function pairEnclosureRects(
  from: readonly EnclosureRectGeometry[],
  to: readonly EnclosureRectGeometry[]
): { from: EnclosureRectGeometry; to: EnclosureRectGeometry }[] {
  if (from.length === 0 || to.length === 0) return [];
  const count = Math.max(from.length, to.length);
  return Array.from({ length: count }, (_, index) => ({
    from: from[Math.floor((index * from.length) / count)],
    to: to[Math.floor((index * to.length) / count)]
  }));
}
