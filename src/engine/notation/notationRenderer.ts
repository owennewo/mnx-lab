import { MnxStructure } from '../../model/mnx.ts';
import { layoutNotation } from '../layout/notation.ts';
import { fitPxPerSp, renderSvg } from '../render/svg.ts';

/**
 * Thin entry point for the standard-notation view. Mirrors `tabRenderer.ts`:
 * computes layout in staff spaces, renders to SVG, bridges generic sourceId
 * clicks back into the `(noteId, measureIdx, noteIdx)` callback.
 */

const DEFAULT_PX_PER_SP = 10;

export interface RenderNotationOptions {
  container: HTMLElement;
  mnx: MnxStructure;
  width: number;
  activeNoteIds?: string[];
  selectedNoteIds?: string[];
  onNoteClick?: (noteId: string, measureIdx: number, noteIdx: number) => void;
  pxPerSp?: number;
}

export function renderMnxToSvgNotation(opts: RenderNotationOptions): void {
  const basePxPerSp = opts.pxPerSp ?? DEFAULT_PX_PER_SP;

  const layout = layoutNotation({
    mnx: opts.mnx,
    widthSp: opts.width / basePxPerSp,
    activeNoteIds: opts.activeNoteIds,
    selectedNoteIds: opts.selectedNoteIds
  });

  // An explicit pxPerSp pins the scale; the default scales short scores up to
  // fill the viewport. Tab derives the same factor from the shared horizontal
  // plan, so the `both` view stays column-aligned.
  const fitted = opts.pxPerSp === undefined;
  const pxPerSp = fitted ? fitPxPerSp(opts.width, layout.usedWidthSp, basePxPerSp) : basePxPerSp;

  renderSvg({
    container: opts.container,
    primitives: layout.primitives,
    widthSp: fitted ? layout.usedWidthSp : layout.widthSp,
    heightSp: layout.heightSp,
    pxPerSp,
    className: 'mnx-notation-svg',
    onSourceClick: opts.onNoteClick
      ? sourceId => {
          const loc = layout.index.get(sourceId);
          if (loc) opts.onNoteClick!(sourceId, loc.measureIndex, loc.eventIndex);
        }
      : undefined
  });
}
