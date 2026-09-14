/**
 * Hiding parts from the score without re-addressing the notes left on it.
 *
 * A reader can take a part off the page (studio's Instruments sheet) while it
 * keeps sounding, so the layout draws a document WITHOUT that part while the
 * performance is still compiled from the whole one. The two must keep naming
 * notes alike, or the playback highlight and a click-to-seek land on the wrong
 * ink: a note without an `id` is named by its position, and the position
 * carries the part index (`@p2.m0.v0.e0.n0`), which dropping an earlier part
 * would shift.
 *
 * So every id-less note in the copy is first given the key it has in the
 * WHOLE document as its id — `noteKeyAt` prefers an id — and only then are the
 * hidden parts removed. Layout sources that name a removed part are already
 * skipped by the engine (`resolveLayoutTree`), so score layouts need no pruning.
 *
 * Kit notes are not re-keyed: their positional form differs between the
 * performance and the engine already, and no kit highlight depends on it.
 */
import type { MnxPart, MnxStructure } from './mnx.ts';
import { forEachNoteAddress } from './noteWalk.ts';

export interface VisibleParts<T extends MnxStructure = MnxStructure> {
  /** The document to lay out — the input itself when nothing is hidden. */
  mnx: T;
  /** Each laid-out part's index in the whole document, in order. */
  originalIndex: readonly number[];
}

/**
 * The document with `hidden` part indices removed. Returns the input unchanged
 * (same reference) when no listed index names a part, and refuses to hide every
 * part — a score with nothing on it is never what a reader meant.
 */
export function withHiddenParts<T extends MnxStructure>(doc: T, hidden: readonly number[]): VisibleParts<T> {
  const parts = doc.parts ?? [];
  const drop = new Set(hidden.filter((i) => Number.isInteger(i) && i >= 0 && i < parts.length));
  if (drop.size === 0 || drop.size >= parts.length) return { mnx: doc, originalIndex: parts.map((_, i) => i) };
  const copy = structuredClone(doc);
  forEachNoteAddress(copy, ({ note, key }) => {
    if (note.id === undefined) note.id = key;
  });
  const originalIndex: number[] = [];
  const kept: MnxPart[] = [];
  copy.parts.forEach((part, i) => {
    if (drop.has(i)) return;
    kept.push(part);
    originalIndex.push(i);
  });
  copy.parts = kept;
  return { mnx: copy, originalIndex };
}
