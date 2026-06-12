import { MnxStructure } from '../types/mnx.ts';
import { layoutTab } from '../layout/tab.ts';
import { fitPxPerSp, renderSvg } from '../render/svg.ts';

/**
 * Thin entry point for the tab view: computes layout in staff spaces,
 * renders SVG, and bridges generic sourceId clicks back into the
 * project's `(noteId, measureIdx, noteIdx)` callback contract using the
 * spatial index produced by the layout pass.
 */

const DEFAULT_PX_PER_SP = 10;

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
}

export function renderMnxToSvgTab(opts: RenderTabOptions): void {
  const basePxPerSp = opts.pxPerSp ?? DEFAULT_PX_PER_SP;

  const layout = layoutTab({
    mnx: opts.mnx,
    widthSp: opts.width / basePxPerSp,
    activeNoteIds: opts.activeNoteIds,
    selectedNoteIds: opts.selectedNoteIds
  });

  // An explicit pxPerSp pins the scale; the default scales short scores up to
  // fill the viewport. Notation derives the same factor from the shared
  // horizontal plan, so the `both` view stays column-aligned.
  const fitted = opts.pxPerSp === undefined;
  const pxPerSp = fitted ? fitPxPerSp(opts.width, layout.usedWidthSp, basePxPerSp) : basePxPerSp;

  renderSvg({
    container: opts.container,
    primitives: layout.primitives,
    widthSp: fitted ? layout.usedWidthSp : layout.widthSp,
    heightSp: layout.heightSp,
    pxPerSp,
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
