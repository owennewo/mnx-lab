import { MnxStructure } from '../../model/mnx.ts';
import { layoutNotation, type HideableFeature } from '../layout/notation.ts';
import { computeBoundsSp } from '../render/bounds.ts';
import { fitPxPerSp, renderSvg } from '../render/svg.ts';
import { renderOutcome, type RenderOutcome } from '../render/scale.ts';

/**
 * Thin entry point for the standard-notation view. Mirrors `tabRenderer.ts`:
 * computes layout in staff spaces, renders to SVG, bridges generic sourceId
 * clicks back into the `(noteId, measureIdx, noteIdx)` callback.
 */

const DEFAULT_PX_PER_SP = 10;

/** Breathing room around the cropped content, in staff spaces. */
const CROP_PAD_SP = 1;

export interface RenderNotationOptions {
  container: HTMLElement;
  mnx: MnxStructure;
  width: number;
  activeNoteIds?: string[];
  selectedNoteIds?: string[];
  onNoteClick?: (noteId: string, measureIdx: number, noteIdx: number) => void;
  pxPerSp?: number;
  /** Features the host hid (docs/core-viewer-surface.md) — layout-side ones
   *  reach the layout so the space they reserved is reclaimed. */
  hide?: readonly HideableFeature[];
  /** Horizontal density multiplier (core-render-density-zoom.md). */
  densityH?: number;
  /** Vertical/frame density multiplier (core-vertical-density.md). */
  densityPad?: number;
}

export function renderMnxToSvgNotation(opts: RenderNotationOptions): RenderOutcome {
  const basePxPerSp = opts.pxPerSp ?? DEFAULT_PX_PER_SP;

  const layout = layoutNotation({
    mnx: opts.mnx,
    widthSp: opts.width / basePxPerSp,
    activeNoteIds: opts.activeNoteIds,
    selectedNoteIds: opts.selectedNoteIds,
    hide: opts.hide,
    densityH: opts.densityH,
    densityPad: opts.densityPad
  });

  // An explicit pxPerSp pins the scale; the default scales short scores up to
  // fill the viewport. Tab derives the same factor from the shared horizontal
  // plan, so the `both` view stays column-aligned.
  const fitted = opts.pxPerSp === undefined;
  const pxPerSp = fitted ? fitPxPerSp(opts.width, layout.usedWidthSp, basePxPerSp) : basePxPerSp;

  const widthSp = fitted ? layout.usedWidthSp : layout.widthSp;
  // Crop the row's fixed ledger/stem headroom to the content's real vertical
  // extent. y only — the x window stays the full plan width so notation and
  // tab keep their shared left edge and column alignment in the `both` view.
  const bounds = computeBoundsSp(layout.primitives, CROP_PAD_SP);
  const viewBoxSp = bounds ? { x: 0, y: bounds.y, w: widthSp, h: bounds.h } : undefined;

  renderSvg({
    container: opts.container,
    primitives: layout.primitives,
    widthSp,
    heightSp: layout.heightSp,
    pxPerSp,
    viewBoxSp,
    className: 'mnx-notation-svg',
    onSourceClick: opts.onNoteClick
      ? sourceId => {
          const loc = layout.index.get(sourceId);
          if (loc) opts.onNoteClick!(sourceId, loc.measureIndex, loc.eventIndex);
        }
      : undefined
  });

  return renderOutcome(pxPerSp, fitted, layout.packings);
}
