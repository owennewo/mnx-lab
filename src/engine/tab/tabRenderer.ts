import { MnxStructure } from '../../model/mnx.ts';
import { PartTabSetups } from './guitarPositions.ts';
import { layoutTab } from '../layout/tab.ts';
import { computeBoundsSp } from '../render/bounds.ts';
import { fitPxPerSp, renderSvg } from '../render/svg.ts';
import type { RenderedProjection } from '../render/projection.ts';
import {
  BASELINE_PX_PER_SP,
  clampStaffScale,
  renderOutcome,
  type RenderOutcome
} from '../render/scale.ts';

/**
 * Thin entry point for the tab view: computes layout in staff spaces,
 * renders SVG, and bridges generic sourceId clicks back into the
 * project's `(noteId, measureIdx, noteIdx)` callback contract using the
 * spatial index produced by the layout pass.
 */

const DEFAULT_PX_PER_SP = 10;

/** Breathing room around the cropped content, in staff spaces. */
const CROP_PAD_SP = 1;

export interface RenderTabOptions {
  container: HTMLElement;
  mnx: MnxStructure;
  /** Total viewport width in pixels. */
  width: number;
  activeNoteIds?: string[];
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
   * Staff scale — how big the INK is, and nothing else. 1 (the default) is a
   * square scale and behaves exactly as it always did. See
   * `notationRenderer.ts` for why this is not folded into `pxPerSp`.
   */
  staffScale?: number;
  /** Viewer-supplied instrument (strings/capo) — overrides the document's
   *  declaration for rendering; never written back. */
  tabSetup?: PartTabSetups;
  /** Horizontal density multiplier (core-render-density-zoom.md). */
  densityH?: number;
  /** Vertical/frame density multiplier (core-vertical-density.md). */
  densityPad?: number;
}

export function renderMnxToSvgTab(opts: RenderTabOptions): RenderOutcome {
  const basePxPerSp = opts.pxPerSp ?? DEFAULT_PX_PER_SP;

  const layout = layoutTab({
    mnx: opts.mnx,
    widthSp: opts.width / basePxPerSp,
    activeNoteIds: opts.activeNoteIds,
    selectedNoteIds: opts.selectedNoteIds,
    tabSetup: opts.tabSetup,
    densityH: opts.densityH,
    densityPad: opts.densityPad
  });

  // An explicit pxPerSp pins the scale; the default scales short scores up to
  // fill the viewport. Notation derives the same factor from the shared
  // horizontal plan, so the `both` view stays column-aligned.
  const fitted = opts.pxPerSp === undefined;
  const pxPerSp = fitted ? fitPxPerSp(opts.width, layout.usedWidthSp, basePxPerSp) : basePxPerSp;
  // Staff scale is ABSOLUTE against the baseline, not a multiplier on the
  // horizontal scale — 1.2 means the same size ink whatever the viewport did.
  // A control that seeds its first step from the last painted scale (the pad
  // does) needs that: multiplying would re-apply the fit it just read back.
  // Unset leaves the emitter square, which is every other caller and the
  // goldens.
  const staffScale = clampStaffScale(opts.staffScale);
  const pxPerSpY = staffScale === null ? pxPerSp : staffScale * BASELINE_PX_PER_SP;

  const widthSp = fitted ? layout.usedWidthSp : layout.widthSp;
  // Crop the row's fixed headroom to the content's real vertical extent.
  // y only — the x window stays the full plan width so notation and tab keep
  // their shared left edge and column alignment in the `both` view.
  const bounds = computeBoundsSp(layout.primitives, CROP_PAD_SP);
  const viewBoxSp = bounds ? { x: 0, y: bounds.y, w: widthSp, h: bounds.h } : undefined;

  renderSvg({
    container: opts.container,
    primitives: layout.primitives,
    widthSp,
    heightSp: layout.heightSp,
    pxPerSp,
    pxPerSpY,
    viewBoxSp,
    className: 'mnx-tab-svg',
    onSourceActivate: opts.onNoteClick
      ? sourceId => {
          const loc = layout.index.get(sourceId);
          if (loc) {
            opts.onNoteClick!(sourceId, loc.measureIndex, loc.eventIndex, 'tab');
          }
        }
      : undefined
  });

  // The ink scale is what a zoom readout means; see notationRenderer.ts.
  return renderOutcome(pxPerSpY, fitted, layout.packings);
}
