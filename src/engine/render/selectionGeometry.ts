export interface SelectionRectGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Locate a rhythmic position inside a rendered measure cell. The inset is
 * shared with rest-only range endpoints: headers/barlines are structure, not
 * candidate note columns, so the usable entry span stays inside them. */
export function measurePositionX(
  left: number,
  right: number,
  position: number,
  staffSpace: number
): number {
  const width = Math.max(0, right - left);
  const inset = Math.min(1.2 * staffSpace, width * 0.18);
  const usable = Math.max(0, width - 2 * inset);
  const clamped = Math.max(0, Math.min(1, position));
  return left + inset + usable * clamped;
}

/** A measureless part has no staff or barline geometry to read. Give it one
 * compact panel-shaped vacancy inside the otherwise blank score viewport: a
 * place for a bar, not a fabricated bar or staff. */
export function emptyPartGhostRect(
  viewBox: SelectionRectGeometry,
  staffSpace: number
): SelectionRectGeometry {
  const horizontalPad = Math.min(2 * staffSpace, viewBox.width * 0.12);
  const verticalPad = Math.min(2 * staffSpace, viewBox.height * 0.12);
  const width = Math.max(
    2 * staffSpace,
    Math.min(14 * staffSpace, viewBox.width - 2 * horizontalPad)
  );
  const height = Math.max(
    2 * staffSpace,
    Math.min(6 * staffSpace, viewBox.height - 2 * verticalPad)
  );
  return {
    x: viewBox.x + horizontalPad,
    y: viewBox.y + (viewBox.height - height) / 2,
    width,
    height
  };
}

/**
 * The section rung's own channel (workbench-rung-legibility.md): a chip lit
 * behind each section label the enclosure claims.
 *
 * Bar and section share `panel-wide`, and the bar's slot deliberately covers
 * the strip where score-wide labels sit — so the enclosure's own extent
 * cannot tell the pair apart, and in a one-bar section the two shapes are
 * identical. Lighting the label does: the label is what makes a section a
 * section, and only the section rung claims it.
 *
 * A label is claimed by its ANCHOR — the start point engraving put at the
 * barline — not by its box, because a long name overhangs its cell on
 * purpose (`emitScoreLabels`) and a box test would drop exactly the sections
 * whose names are worth reading.
 */
export function sectionLabelChips(
  enclosure: readonly SelectionRectGeometry[],
  labels: readonly SelectionRectGeometry[],
  staffSpace: number
): SelectionRectGeometry[] {
  const padX = 0.45 * staffSpace;
  const padY = 0.3 * staffSpace;
  return labels
    .filter(label => {
      const x = label.x;
      const y = label.y + label.height / 2;
      return enclosure.some(
        r => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height
      );
    })
    .map(label => ({
      x: label.x - padX,
      y: label.y - padY,
      width: label.width + 2 * padX,
      height: label.height + 2 * padY
    }));
}
