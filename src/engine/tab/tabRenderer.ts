import type { PerformedEntry } from '../../model/passes.ts';
import { clearanceSpacing } from '../clearance.ts';
import type { DisplayOptions } from '../displayOptions.ts';
import { MnxStructure } from '../../model/mnx.ts';
import { PartTabSetups } from './guitarPositions.ts';
import { layoutTab } from '../layout/tab.ts';
import { computeBoundsSp } from '../render/bounds.ts';
import { fitPxPerSp } from '../render/svg.ts';
import { emitPlan, type RenderPlan } from '../render/plan.ts';
import { squareLayout, type LayoutCache } from '../render/layoutCache.ts';
import type { RenderedProjection } from '../render/projection.ts';
import {
  clampStaffSp,
  renderOutcome,
  staffPxPerSp,
  type RenderOutcome
} from '../render/scale.ts';

/**
 * Thin entry point for the tab view: computes layout in staff spaces,
 * renders SVG, and bridges generic sourceId clicks back into the
 * project's `(noteId, measureIdx, noteIdx)` callback contract using the
 * spatial index produced by the layout pass.
 */

const DEFAULT_PX_PER_SP = 10;


export interface RenderTabOptions {
  entries?: PerformedEntry[];
  container: HTMLElement;
  mnx: MnxStructure;
  /** Total viewport width in pixels. */
  width: number;
  activeNoteIds?: string[];
  /** Record fret-mask duration spans for the playback paint (`RectPrim.spanEndX`). */
  durationSpans?: boolean;
  selectedNoteIds?: string[];
  onNoteClick?: (
    noteId: string,
    measureIdx: number,
    noteIdx: number,
    projection: RenderedProjection
  ) => void;
  /** Pixels per staff space (zoom). Default 10. */
  pxPerSp?: number;
  /**
   * Staff in canonical staff spaces — how big the INK is, and nothing else. 1sp is a
   * square scale and behaves exactly as it always did. See
   * `notationRenderer.ts` for why this is not folded into `pxPerSp`.
   */
  staffSp?: number;
  /** @deprecated Use `staffSp`. Values are identical: 1 = 1sp. */
  staffScale?: number;
  /** Viewer-supplied instrument (strings/capo) — overrides the document's
   *  declaration for rendering; never written back. */
  tabSetup?: PartTabSetups;
  /** Horizontal density multiplier (core-render-density-zoom.md). */
  spacingMode?: 'natural' | 'fill';
  densityH?: number;
  /** Vertical/frame density multiplier (core-vertical-density.md). */
  densityPad?: number;
  /** A caller-owned memo of the square layout across a zoom gesture
   *  (`render/layoutCache.ts`). Absent, every paint lays out afresh. */
  cache?: LayoutCache;
  /** Features the host asked to hide — forwarded to the layout, so
   *  `hide="lyrics"` means the same thing in every view. */
  display?: DisplayOptions;
  hide?: readonly import('../layout/notation.ts').HideableFeature[];
}

/** The DOM-free half — see `render/plan.ts`. */
export type PlanTabOptions = Omit<RenderTabOptions, 'container' | 'onNoteClick'>;

export function renderMnxToSvgTab(opts: RenderTabOptions): RenderOutcome {
  return emitPlan(planTab(opts), opts.container, opts.onNoteClick);
}

export function planTab(opts: PlanTabOptions): RenderPlan {
  const basePxPerSp = opts.pxPerSp ?? DEFAULT_PX_PER_SP;

  const layoutArgs = {
    mnx: opts.mnx,
    entries: opts.entries,
    widthSp: opts.width / basePxPerSp,
    activeNoteIds: opts.activeNoteIds,
    durationSpans: opts.durationSpans,
    selectedNoteIds: opts.selectedNoteIds,
    tabSetup: opts.tabSetup,
    spacingMode: opts.spacingMode,
    densityH: opts.densityH,
    densityPad: opts.densityPad,
    display: opts.display,
    hide: opts.hide
  };
  const square = squareLayout(opts.cache, layoutArgs, () => layoutTab(layoutArgs));

  // The fit asks whether the SCORE is narrower than the viewport, so it reads
  // the natural extent — `usedWidthSp` moves with the density knob and would
  // have the fit cancel it (see `LayoutResult.naturalWidthSp`).
  // An explicit pxPerSp pins the scale; the default scales short scores up to
  // fill the viewport. Notation derives the same factor from the shared
  // horizontal plan, so the `both` view stays column-aligned.
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
  const layout = Math.abs(inkRatio - 1) > 1e-9 ? layoutTab({ ...layoutArgs, inkRatio }) : square;

  const widthSp = fitted && opts.spacingMode !== 'natural' ? layout.usedWidthSp : layout.widthSp;
  // Crop the row's fixed headroom to the content's real vertical extent.
  // y only — the x window stays the full plan width so notation and tab keep
  // their shared left edge and column alignment in the `both` view.
  const bounds = computeBoundsSp(layout.primitives, clearanceSpacing(opts.display?.clearance, opts.densityPad).cropMargin);
  const viewBoxSp = bounds ? { x: 0, y: bounds.y, w: widthSp, h: bounds.h } : undefined;

  return {
    primitives: layout.primitives,
    widthSp,
    heightSp: layout.heightSp,
    pxPerSp,
    pxPerSpY,
    viewBoxSp,
    className: 'mnx-tab-svg',
    index: layout.index,
    projection: 'tab',
    // The ink scale is what a zoom readout means; see notationRenderer.ts.
    outcome: renderOutcome(pxPerSpY, fitted, layout.packings)
  };
}
