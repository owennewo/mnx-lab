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
import type { PackingInput } from '../layout/spacing.ts';

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

/**
 * What a render reports back: the scale it used, plus the system packing it
 * built.
 *
 * The packing is here for the same reason `RenderScale` is — a host cannot
 * compose an honest density control without it. Stepping density by a fixed
 * percentage mostly changes nothing (`spacing.ts`, `packingSignature`), so a
 * control has to be able to ask which values are real, and asking means
 * re-packing what this render already worked out. Ignorable by every caller
 * that doesn't, exactly like `fitted`.
 */
export interface RenderOutcome extends RenderScale {
  /** One per laid-out segment; empty when the layout packed nothing. */
  packings: PackingInput[];
}

/** The baseline every `staffScale` is measured against. One definition, so the
 *  three renderers cannot drift on what "100%" means. */
export const BASELINE_PX_PER_SP = 10;

export function renderScale(pxPerSp: number, fitted: boolean): RenderScale {
  return { pxPerSp, staffScale: pxPerSp / BASELINE_PX_PER_SP, fitted };
}

/** The scale plus the layout's packing — what the three renderers return. */
export function renderOutcome(
  pxPerSp: number,
  fitted: boolean,
  packings: PackingInput[] | undefined
): RenderOutcome {
  return { ...renderScale(pxPerSp, fitted), packings: packings ?? [] };
}

/**
 * Staff-scale bounds. The design specified 60–160%; the ceiling went to
 * **640% on 2026-08-21, for low-vision readers** — 160% is a preference knob,
 * and someone who needs the staff four times larger again was simply told no.
 *
 * The ceiling is now bounded by what the engine can still draw HONESTLY rather
 * than by taste, and that bound moved because
 * [core-ink-priced-columns.md] made it move: rigid columns are priced on the
 * ink scale, so at 640% the notehead columns are 6.4× wider too and nothing
 * collides (measured: tightest column gap 10.09sp against the 9.60sp the ink
 * needs). Before that work this ceiling could not have been raised at all —
 * the glyphs would have grown into each other.
 *
 * What DOES happen up here is overflow: the horizontal axis stays fitted to
 * the viewport, so at 640% a system is ~2.6× the line width and the page
 * scrolls sideways. That is the honest degradation for this architecture —
 * the music really is 6.4× bigger and really does need the room — and it is
 * scrollable rather than clipped. Reflowing instead (fewer bars per system as
 * the ink grows) is a real alternative and a real decision, recorded in
 * roadmap/proposed/core-lowvision-reflow.md.
 *
 * Still bounded, for the reason `clampDensity` is: a bad value should degrade
 * to the edge of the useful range, not produce a 40,000px SVG or a staff one
 * pixel tall. The clamp lives here rather than in the control so that a host
 * writing `zoom="99"` by hand gets the same answer the pad would give it — the
 * element binds behavior the engine owns.
 */
export const MIN_STAFF_SCALE = 0.6;
export const MAX_STAFF_SCALE = 6.4;

export function clampStaffScale(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.min(MAX_STAFF_SCALE, Math.max(MIN_STAFF_SCALE, value));
}
