import { MnxStructure } from '../../model/mnx.ts';
import { PartTabSetups } from '../tab/guitarPositions.ts';
import { layoutBothSystem } from '../layout/bothSystem.ts';
import type { HideableFeature } from '../layout/notation.ts';
import { computeBoundsSp, CROP_PAD_SP } from '../render/bounds.ts';
import { fitPxPerSp, renderSvg } from '../render/svg.ts';
import {
  projectionForSourceClass,
  type RenderedProjection
} from '../render/projection.ts';
import {
  BASELINE_PX_PER_SP,
  clampStaffScale,
  renderOutcome,
  type RenderOutcome
} from '../render/scale.ts';

/**
 * Thin entry point for the combined notation+tab view: one composed system
 * (src/engine/layout/bothSystem.ts), one SVG, one coordinate space — the
 * sourceId click bridge spans both staves through the merged index.
 */

const DEFAULT_PX_PER_SP = 10;


export interface RenderBothOptions {
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
  /** Features the host hid (docs/core-viewer-surface.md). */
  hide?: readonly HideableFeature[];
  /** Horizontal density multiplier (core-render-density-zoom.md). */
  densityH?: number;
  /** Vertical/frame density multiplier (core-vertical-density.md). */
  densityPad?: number;
}

export function renderMnxToSvgBoth(opts: RenderBothOptions): RenderOutcome {
  const basePxPerSp = opts.pxPerSp ?? DEFAULT_PX_PER_SP;

  const layoutArgs = {
    mnx: opts.mnx,
    widthSp: opts.width / basePxPerSp,
    activeNoteIds: opts.activeNoteIds,
    selectedNoteIds: opts.selectedNoteIds,
    tabSetup: opts.tabSetup,
    hide: opts.hide,
    densityH: opts.densityH,
    densityPad: opts.densityPad
  };
  const square = layoutBothSystem(layoutArgs);

  const fitted = opts.pxPerSp === undefined;
  const pxPerSp = fitted ? fitPxPerSp(opts.width, square.usedWidthSp, basePxPerSp) : basePxPerSp;
  // Staff scale is ABSOLUTE against the baseline, not a multiplier on the
  // horizontal scale — 1.2 means the same size ink whatever the viewport did.
  // A control that seeds its first step from the last painted scale (the pad
  // does) needs that: multiplying would re-apply the fit it just read back.
  // Unset leaves the emitter square, which is every other caller and the
  // goldens.
  const staffScale = clampStaffScale(opts.staffScale);
  const pxPerSpY = staffScale === null ? pxPerSp : staffScale * BASELINE_PX_PER_SP;

  // Rigid columns are ink (core-ink-priced-columns.md): under a non-square
  // scale the plan is re-placed at the ink ratio so glyphs keep their columns.
  // The fit is NOT redone — the square plan defined it — and packing stays
  // square inside the plan, so bars never change systems here. One ratio for
  // both staves is what keeps them column-aligned.
  const inkRatio = pxPerSpY / pxPerSp;
  const layout =
    Math.abs(inkRatio - 1) > 1e-9 ? layoutBothSystem({ ...layoutArgs, inkRatio }) : square;

  const widthSp = fitted ? layout.usedWidthSp : layout.widthSp;
  // Crop the rows' fixed headroom to the content's real vertical extent.
  // y only — the x window stays the full plan width (see the other renderers).
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
    className: 'mnx-both-svg',
    onSourceActivate: opts.onNoteClick
      ? (sourceId, event) => {
          const loc = layout.index.get(sourceId);
          const target = event.target instanceof Element
            ? event.target.closest('[data-source-id]')
            : null;
          if (loc && target) {
            opts.onNoteClick!(
              sourceId,
              loc.measureIndex,
              loc.eventIndex,
              projectionForSourceClass(target.getAttribute('class') ?? '')
            );
          }
        }
      : undefined
  });

  // The ink scale is what a zoom readout means; see notationRenderer.ts.
  return renderOutcome(pxPerSpY, fitted, layout.packings);
}
