/**
 * The scale a render actually used.
 *
 * Every renderer already decides this internally — `fitPxPerSp` scales a short
 * score up to fill the viewport unless the host pinned `pxPerSp` — and until
 * now it threw the answer away. A host composing a zoom control cannot print an
 * honest number without it: "100%" on load would be a guess about whether
 * fitting kicked in (roadmap/proposed/core-zoom-density-pad.md, ruling 2).
 *
 * Deliberately a RETURN value, not an option: the renderers stay
 * fire-and-forget for every caller that doesn't care, and the corpus harness
 * ignores it entirely.
 */
export interface RenderScale {
  /** Pixels per staff space the SVG was actually emitted at. */
  pxPerSp: number;
  /** Multiplier against the 10px/sp baseline — what a zoom readout prints. */
  staffScale: number;
  /**
   * True when no `pxPerSp` was supplied and the renderer fitted the score to
   * the viewport. A control showing `staffScale` should say so: the number is
   * derived from the music's width, so it moves when the window does, and the
   * user did not choose it.
   */
  fitted: boolean;
}

/** The baseline every `staffScale` is measured against. One definition, so the
 *  three renderers cannot drift on what "100%" means. */
export const BASELINE_PX_PER_SP = 10;

export function renderScale(pxPerSp: number, fitted: boolean): RenderScale {
  return { pxPerSp, staffScale: pxPerSp / BASELINE_PX_PER_SP, fitted };
}

/**
 * Staff-scale bounds, from the design's own 60–160%.
 *
 * Bounded for the same reason `clampDensity` is: a bad value should degrade to
 * the edge of the useful range, not produce a 40,000px SVG or a staff one pixel
 * tall. The clamp lives here rather than in the control so that a host writing
 * `zoom="9"` by hand gets the same answer the pad would give it — the element
 * binds behavior the engine owns.
 */
export const MIN_STAFF_SCALE = 0.6;
export const MAX_STAFF_SCALE = 1.6;

export function clampStaffScale(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.min(MAX_STAFF_SCALE, Math.max(MIN_STAFF_SCALE, value));
}
