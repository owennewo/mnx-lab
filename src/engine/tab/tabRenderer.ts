import { MnxStructure } from '../../model/mnx.ts';
import { TabSetup } from './guitarPositions.ts';
import { layoutTab } from '../layout/tab.ts';
import { computeBoundsSp } from '../render/bounds.ts';
import { fitPxPerSp, renderSvg } from '../render/svg.ts';

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
  onNoteClick?: (noteId: string, measureIdx: number, noteIdx: number) => void;
  /** Pixels per staff space (zoom). Default 10. */
  pxPerSp?: number;
  /** Viewer-supplied instrument (strings/capo) — overrides the document's
   *  declaration for rendering; never written back. */
  tabSetup?: TabSetup;
}

export function renderMnxToSvgTab(opts: RenderTabOptions): void {
  const basePxPerSp = opts.pxPerSp ?? DEFAULT_PX_PER_SP;

  const layout = layoutTab({
    mnx: opts.mnx,
    widthSp: opts.width / basePxPerSp,
    activeNoteIds: opts.activeNoteIds,
    selectedNoteIds: opts.selectedNoteIds,
    tabSetup: opts.tabSetup
  });

  // An explicit pxPerSp pins the scale; the default scales short scores up to
  // fill the viewport. Notation derives the same factor from the shared
  // horizontal plan, so the `both` view stays column-aligned.
  const fitted = opts.pxPerSp === undefined;
  const pxPerSp = fitted ? fitPxPerSp(opts.width, layout.usedWidthSp, basePxPerSp) : basePxPerSp;

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
    viewBoxSp,
    className: 'mnx-tab-svg',
    onSourceClick: opts.onNoteClick
      ? sourceId => {
          const loc = layout.index.get(sourceId);
          if (loc) {
            opts.onNoteClick!(sourceId, loc.measureIndex, loc.eventIndex);
          }
        }
      : undefined
  });
}
