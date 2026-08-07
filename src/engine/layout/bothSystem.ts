import { MnxStructure } from '../../model/mnx.ts';
import { layoutNotation } from './notation.ts';
import { LayoutResult } from '../primitives.ts';

/**
 * The `both` view as ONE system, natively: the notation layout's system
 * assembler draws each tab-bearing part's tab staff inside the same system
 * walk (`includeTabStaves`) — shared barlines and the system-start barline
 * are ordinary primitives of one system, columns align because the tab staff
 * reads the same plan slots as its notation sibling, and multi-system
 * documents interleave notation ↔ tab per system.
 *
 * This entry point is the API seam (phase 1 of
 * roadmap/inprogress/both-view-single-system.md shipped a composer here that
 * stacked and stitched the two standalone layouts; phase 2 made the staff
 * native and retired the stitch).
 */

export interface LayoutBothOptions {
  mnx: MnxStructure;
  widthSp: number;
  activeNoteIds?: readonly string[];
  selectedNoteIds?: readonly string[];
}

export function layoutBothSystem(opts: LayoutBothOptions): LayoutResult {
  return layoutNotation({ ...opts, includeTabStaves: true });
}
