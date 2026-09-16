/**
 * The scale a render actually used.
 *
 * Every renderer already decides this internally — `fitPxPerSp` scales a short
 * score up to fill the viewport unless the host pinned `pxPerSp` — and until
 * now it threw the answer away. A host composing a zoom control cannot print an
 * honest number without it: "1sp" on load would be a guess about whether
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
  /** Requested/drawn line gap in canonical staff spaces. */
  staffSp: number;
  /** @deprecated Compatibility alias for `staffSp`. */
  staffScale: number;
  /**
   * True when no `pxPerSp` was supplied and the renderer fitted the score to
   * the viewport. A control showing `staffSp` should say so: the number is
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

/** The baseline at Staff 1sp. One definition, so the three renderers cannot
 * drift on the affine line's gain. */
export const BASELINE_PX_PER_SP = 10;

/** One consumer's response to Staff: `max(0, gain·x + intercept)`. */
export interface StaffLine {
  gain: number;
  intercept: number;
}

/**
 * The Staff calibration table. All engraving geometry deliberately shares one
 * ink currency: splitting glyphs, staff lines or vertical gaps onto different
 * lines would distort the notation rather than calibrate it.
 */
export const STAFF_LINES = {
  inkPxPerSp: { gain: BASELINE_PX_PER_SP, intercept: 0 }
} satisfies Record<string, StaffLine>;

export function staffLineAt(line: StaffLine, x: number): number {
  return Math.max(0, line.gain * x + line.intercept);
}

/**
 * A zero-height staff is meaningless, so Staff stops at 0.4sp. The 8sp
 * ceiling extends the previous 6.4× low-vision range; rigid columns are ink
 * priced, so growth degrades to honest page overflow rather than collisions.
 * The viewer's max-width shrink can still make the drawn value lower than the
 * request, which is why reporting inverts the final pixel scale.
 */
export const MIN_STAFF_SP = 0.4;
export const MAX_STAFF_SP = 8;

export function clampStaffSp(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.min(MAX_STAFF_SP, Math.max(MIN_STAFF_SP, value));
}

export function staffPxPerSp(value: number): number {
  return staffLineAt(STAFF_LINES.inkPxPerSp, clampStaffSp(value) ?? 1);
}

/** Inverse of the affine ink line, used after the browser's final pane shrink. */
export function staffSpFromPxPerSp(pxPerSp: number): number {
  const { gain, intercept } = STAFF_LINES.inkPxPerSp;
  return (pxPerSp - intercept) / gain;
}

export function renderScale(pxPerSp: number, fitted: boolean): RenderScale {
  const staffSp = staffSpFromPxPerSp(pxPerSp);
  return { pxPerSp, staffSp, staffScale: staffSp, fitted };
}

/** The scale plus the layout's packing — what the three renderers return. */
export function renderOutcome(
  pxPerSp: number,
  fitted: boolean,
  packings: PackingInput[] | undefined
): RenderOutcome {
  return { ...renderScale(pxPerSp, fitted), packings: packings ?? [] };
}

/** @deprecated Use `MIN_STAFF_SP`. */
export const MIN_STAFF_SCALE = MIN_STAFF_SP;
/** @deprecated Use `MAX_STAFF_SP`. */
export const MAX_STAFF_SCALE = MAX_STAFF_SP;

/** @deprecated Use `clampStaffSp`. */
export function clampStaffScale(value: number | null | undefined): number | null {
  return clampStaffSp(value);
}
