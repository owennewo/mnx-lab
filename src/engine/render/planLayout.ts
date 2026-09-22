import type { PerformedEntry } from '../../model/passes.ts';
import type { MnxStructure } from '../../model/mnx.ts';
import { clearanceSpacing } from '../clearance.ts';
import type { DisplayOptions } from '../displayOptions.ts';
import type { HideableFeature } from '../layout/notation.ts';
import type { SystemBookends } from '../layout/systemBookends.ts';
import type { LayoutResult } from '../primitives.ts';
import { computeBoundsSp } from './bounds.ts';
import { squareLayout, type LayoutCache } from './layoutCache.ts';
import type { NoteClickHandler, RenderPlan } from './plan.ts';
import { clampStaffSp, renderOutcome, staffPxPerSp } from './scale.ts';
import { fitPxPerSp } from './svg.ts';

const DEFAULT_PX_PER_SP = 10;

/** The shared host contract; projection-specific options stay with their renderer. */
export interface RenderOptions {
  entries?: PerformedEntry[];
  container: HTMLElement;
  mnx: MnxStructure;
  width: number;
  activeNoteIds?: string[];
  /** Record fret-mask duration spans for the playback paint (`RectPrim.spanEndX`). */
  durationSpans?: boolean;
  selectedNoteIds?: string[];
  onNoteClick?: NoteClickHandler;
  pxPerSp?: number;
  /**
   * Staff in canonical staff spaces — how big the INK is, and nothing else. 1sp is a
   * square scale and behaves exactly as it always did.
   *
   * Deliberately NOT folded into `pxPerSp`, which is how zoom used to arrive.
   * That spelling made the two axes one: raising it shrank `widthSp`, so the
   * spacing plan was handed a different amount of room, re-packed the systems
   * and moved every note sideways. Staff scale is a legibility control; the
   * horizontal axis belongs to `densityH`. Keeping them apart is what lets the
   * pad's crosshair actually behave like a crosshair.
   */
  staffSp?: number;
  /** @deprecated Use `staffSp`. Values are identical: 1 = 1sp. */
  staffScale?: number;
  /** Features the host hid (docs/core-viewer-surface.md) — layout-side ones
   *  reach the layout so the space they reserved is reclaimed. */
  display?: DisplayOptions;
  hide?: readonly HideableFeature[];
  /** Natural spacing keeps the base scale instead of fitting the viewport. */
  spacingMode?: 'natural' | 'fill';
  /** Horizontal density multiplier (core-render-density-zoom.md). */
  densityH?: number;
  /** Vertical/frame density multiplier (core-vertical-density.md). */
  densityPad?: number;
  /** A caller-owned memo of the square layout across a zoom gesture
   *  (`render/layoutCache.ts`). Absent, every paint lays out afresh. */
  cache?: LayoutCache;
  /** Optional host-owned regions before/after the first/last system. */
  systemBookends?: SystemBookends;
}

/** Options shared by the DOM-free plan entry points. */
export type PlanOptions = Omit<RenderOptions, 'container' | 'onNoteClick'>;

/** Deliberately forward only layout inputs: host scale/cache state is not a cache key. */
export function commonLayoutArgs(opts: PlanOptions) {
  return {
    mnx: opts.mnx,
    entries: opts.entries,
    widthSp: opts.width / (opts.pxPerSp ?? DEFAULT_PX_PER_SP),
    activeNoteIds: opts.activeNoteIds,
    durationSpans: opts.durationSpans,
    selectedNoteIds: opts.selectedNoteIds,
    display: opts.display,
    hide: opts.hide,
    spacingMode: opts.spacingMode,
    densityH: opts.densityH,
    densityPad: opts.densityPad,
    systemBookends: opts.systemBookends
  };
}

/** All projections share fitting, staff scaling and cropping; each retains its own layout. */
export function planLayout<A extends ReturnType<typeof commonLayoutArgs>>(
  opts: PlanOptions,
  layoutArgs: A,
  layoutScore: (args: A & { inkRatio?: number }) => LayoutResult,
  projection: RenderPlan['projection']
): RenderPlan {
  const basePxPerSp = opts.pxPerSp ?? DEFAULT_PX_PER_SP;
  const square = squareLayout(opts.cache, layoutArgs, () => layoutScore(layoutArgs));

  // The fit asks whether the SCORE is narrower than the viewport, so it reads
  // the natural extent — `usedWidthSp` moves with the density knob and would
  // have the fit cancel it (see `LayoutResult.naturalWidthSp`).
  // An explicit pxPerSp pins the scale; the default scales short scores up to
  // fill the viewport. Tab derives the same factor from the shared horizontal
  // plan, so the `both` view stays column-aligned.
  const fitted = opts.pxPerSp === undefined;
  const pxPerSp = fitted && opts.spacingMode !== 'natural' ? fitPxPerSp(opts.width, square.naturalWidthSp ?? square.usedWidthSp, basePxPerSp) : basePxPerSp;
  // Staff is ABSOLUTE through its affine ink line, not a multiplier on the
  // horizontal scale — 1.2 means the same size ink whatever the viewport did.
  // A control that seeds its first step from the last painted scale (the pad
  // does) needs that: multiplying would re-apply the fit it just read back.
  // Unset leaves the emitter square, which is every other caller and the
  // goldens.
  const staffSp = clampStaffSp(opts.staffSp ?? opts.staffScale);
  const pxPerSpY = staffSp === null ? pxPerSp : staffPxPerSp(staffSp);

  // Rigid columns are ink (core-ink-priced-columns.md): under a non-square
  // scale the plan is re-placed at the ink ratio so glyphs keep their columns.
  // The fit is NOT redone — the square plan defined it — and bars are re-packed
  // using the actual symbol widths.
  const inkRatio = pxPerSpY / pxPerSp;
  const layout =
    Math.abs(inkRatio - 1) > 1e-9 ? layoutScore({ ...layoutArgs, inkRatio }) : square;

  const widthSp = fitted && opts.spacingMode !== 'natural' ? layout.usedWidthSp : layout.widthSp;
  // Crop the row's fixed ledger/stem headroom to the content's real vertical
  // extent. y only — the x window stays the full plan width so notation and
  // tab keep their shared left edge and column alignment in the `both` view.
  const bounds = computeBoundsSp(layout.primitives, clearanceSpacing(opts.display?.clearance, opts.densityPad).cropMargin);
  const viewBoxSp = bounds ? { x: 0, y: bounds.y, w: widthSp, h: bounds.h } : undefined;

  return {
    primitives: layout.primitives,
    widthSp,
    heightSp: layout.heightSp,
    pxPerSp,
    pxPerSpY,
    viewBoxSp,
    className: `mnx-${projection}-svg`,
    index: layout.index,
    projection,
    // The INK scale is what a zoom readout means by "how big is this", so that
    // is the one reported — `pxPerSp` is now the horizontal axis's business.
    outcome: renderOutcome(pxPerSpY, fitted, layout.packings)
  };
}
