import { MnxStructure } from '../../model/mnx.ts';
import { PartTabSetups } from '../tab/guitarPositions.ts';
import { layoutBothSystem } from '../layout/bothSystem.ts';
import type { HideableFeature } from '../layout/notation.ts';
import { computeBoundsSp } from '../render/bounds.ts';
import { fitPxPerSp, renderSvg } from '../render/svg.ts';
import { renderOutcome, type RenderOutcome } from '../render/scale.ts';

/**
 * Thin entry point for the combined notation+tab view: one composed system
 * (src/engine/layout/bothSystem.ts), one SVG, one coordinate space — the
 * sourceId click bridge spans both staves through the merged index.
 */

const DEFAULT_PX_PER_SP = 10;

/** Breathing room around the cropped content, in staff spaces. */
const CROP_PAD_SP = 1;

export interface RenderBothOptions {
  container: HTMLElement;
  mnx: MnxStructure;
  /** Total viewport width in pixels. */
  width: number;
  activeNoteIds?: string[];
  selectedNoteIds?: string[];
  onNoteClick?: (noteId: string, measureIdx: number, noteIdx: number) => void;
  /** Pixels per staff space (zoom). Default 10. */
  pxPerSp?: number;
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

  const layout = layoutBothSystem({
    mnx: opts.mnx,
    widthSp: opts.width / basePxPerSp,
    activeNoteIds: opts.activeNoteIds,
    selectedNoteIds: opts.selectedNoteIds,
    tabSetup: opts.tabSetup,
    hide: opts.hide,
    densityH: opts.densityH,
    densityPad: opts.densityPad
  });

  const fitted = opts.pxPerSp === undefined;
  const pxPerSp = fitted ? fitPxPerSp(opts.width, layout.usedWidthSp, basePxPerSp) : basePxPerSp;

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
    viewBoxSp,
    className: 'mnx-both-svg',
    onSourceClick: opts.onNoteClick
      ? sourceId => {
          const loc = layout.index.get(sourceId);
          if (loc) opts.onNoteClick!(sourceId, loc.measureIndex, loc.eventIndex);
        }
      : undefined
  });

  return renderOutcome(pxPerSp, fitted, layout.packings);
}
