import { MnxStructure } from '../types/mnx.ts';
import { layoutNotation } from '../layout/notation.ts';
import { renderSvg } from '../render/svg.ts';

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
  const pxPerSp = opts.pxPerSp ?? DEFAULT_PX_PER_SP;

  const layout = layoutNotation({
    mnx: opts.mnx,
    widthSp: opts.width / pxPerSp,
    activeNoteIds: opts.activeNoteIds,
    selectedNoteIds: opts.selectedNoteIds
  });

  renderSvg({
    container: opts.container,
    primitives: layout.primitives,
    widthSp: layout.widthSp,
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
