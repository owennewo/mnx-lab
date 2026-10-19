/**
 * What a press on the score can mean — the rules, DOM-free
 * (roadmap/inprogress/core-editor-click-targets.md).
 *
 * Every point on the page is exactly one of:
 *
 *  1. an ELEMENT — ink the document chose, which a press selects;
 *  2. a SLOT — a staff and its reach, inside a bar, where a press places the
 *     cursor (`elements/pointerHitTest.ts` resolves the beat and the line);
 *  3. DEAD SPACE — everything else, where a press changes nothing.
 *
 * Note ink is not here: a notehead or a fret digit is found by
 * `noteTarget.ts`, exactly as before, and outranks everything below.
 *
 * These are the decisions as functions of measured boxes, so the suite can
 * hold them headlessly; reading the boxes off a drawn page and drawing the
 * outlines is `elements/clickTargetPaint.ts`.
 */
import type { PassModel } from '../../model/passes.ts';
import type { MnxStructure } from '../../model/mnx.ts';
import { documentLyricLineIds } from '../layout/lyricRuns.ts';

// ── slots ─────────────────────────────────────────────────────────────────

/**
 * How far past its outer lines a staff still takes a press (decision 1), in
 * its own line gaps. A notation staff reaches three ledger lines out — and
 * half a staff position more, so a press that rounds onto the third ledger
 * line counts; a tab staff, which has no ledger lines, half a gap past its
 * outer strings.
 */
export const NOTATION_REACH_GAPS = 3 + 1 / 4;
export const TAB_REACH_GAPS = 1 / 2;

/** One drawn staff, as the slot rule needs it: its lines, its width, its gap and which kind it is. */
export interface SlotStaff {
  top: number;
  bottom: number;
  x1: number;
  x2: number;
  gap: number;
  tab: boolean;
}

/**
 * The paper a staff answers for: its band widened by its reach, and stopped
 * HALFWAY to any neighbour nearer than that — the combined view hangs a tab
 * staff just under its notation staff, and two slots must never overlap.
 */
export function staffReach(staves: readonly SlotStaff[], index: number): { top: number; bottom: number } | null {
  const band = staves[index];
  if (!band) return null;
  const pad = (band.tab ? TAB_REACH_GAPS : NOTATION_REACH_GAPS) * band.gap;
  let top = band.top - pad;
  let bottom = band.bottom + pad;
  staves.forEach((other, at) => {
    if (at === index) return;
    // Only a staff that shares some of this one's width is a neighbour.
    if (other.x2 < band.x1 || other.x1 > band.x2) return;
    if (other.bottom <= band.top) top = Math.max(top, (other.bottom + band.top) / 2);
    else if (other.top >= band.bottom) bottom = Math.min(bottom, (band.bottom + other.top) / 2);
  });
  return { top, bottom };
}

/**
 * The staff whose slot a point is in, or null for dead space: the gutter
 * between systems (where they stand far enough apart), the margins, the gap
 * between staves past their reach. Horizontally a staff answers from its left
 * edge to its right, so the part-name margin is dead and a line's clef, key
 * and time are still its first bar.
 */
export function slotAt(staves: readonly SlotStaff[], point: { x: number; y: number }): number | null {
  for (let index = 0; index < staves.length; index++) {
    const band = staves[index]!;
    if (point.x < band.x1 || point.x > band.x2) continue;
    const reach = staffReach(staves, index);
    if (reach && point.y >= reach.top && point.y <= reach.bottom) return index;
  }
  return null;
}

// ── elements ──────────────────────────────────────────────────────────────

/**
 * The element kinds a press can select today — `edit/elementWalk.ts`'s
 * `ElementKind` vocabulary, one kind at a time (the suite checks the
 * spelling against it). A kind is clickable once its ink says what it is and
 * where the document keeps it:
 *
 *  - `lyric` — already addressed for the playback lamp: `data-playback-id`
 *    names the note the syllable is sung on, `data-lyric-line` its verse. A
 *    verse row's empty place under a note (`lyric-gap`) is a target too: it
 *    is where a word for that note would go.
 *  - bar-level kinds — tagged by the layout under `elementTargets`
 *    (`PrimitiveBase.element`), emitted as `data-element` / `data-measure`.
 */
export const CLICKABLE_KINDS = ['lyric', 'repeat-end', 'repeat-start', 'ending'] as const;
export type ClickableKind = (typeof CLICKABLE_KINDS)[number];

/** Which inspector pill edits each bar-level kind (`edit/inspector.ts`'s `measurePills` keys). */
export const PILL_OF: Record<Exclude<ClickableKind, 'lyric'>, string> = {
  'repeat-end': 'repeatEnd',
  'repeat-start': 'repeatStart',
  ending: 'ending'
};

export interface TargetBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One piece of a clickable element's ink. Pieces of one element share `key`. */
export interface ClickTarget {
  key: string;
  kind: ClickableKind;
  /** The ink, in page units. */
  box: TargetBox;
  /** Lyric: the drawn key of the note it is sung on — occurrence-qualified (`w3:…`) unrolled. */
  noteKey?: string;
  /** Lyric: the verse row (its lyric line id). */
  lyricLine?: string;
  /** Bar-level kinds: the global measure that declares it. */
  measureIndex?: number;
}

/** What a press on a target tells the host — `element-selected` / `element-activated`. */
export interface ElementPress {
  kind: ClickableKind;
  /** The target's identity, so the host can name it back to the viewer as selected. */
  key: string;
  noteKey?: string;
  lyricLine?: string;
  measureIndex?: number;
}

/** How much past its ink a target answers, in staff spaces (decision 5). */
export const TARGET_MIN_SP = 1;
export const TARGET_MARGIN_SP = 0.25;

/** The area a target answers for: at least `TARGET_MIN_SP` each way, plus a margin. */
export function reachBox(box: TargetBox, sp: number): TargetBox {
  const w = Math.max(box.w, TARGET_MIN_SP * sp) + 2 * TARGET_MARGIN_SP * sp;
  const h = Math.max(box.h, TARGET_MIN_SP * sp) + 2 * TARGET_MARGIN_SP * sp;
  return { x: box.x + box.w / 2 - w / 2, y: box.y + box.h / 2 - h / 2, w, h };
}

/** Attached outranks bar-level (decision 5). */
const RANK: Record<ClickableKind, number> = { lyric: 0, 'repeat-end': 1, 'repeat-start': 1, ending: 1 };

/** The target a point means, or null. Rank first, then the nearest ink. */
export function targetAt(targets: readonly ClickTarget[], point: { x: number; y: number }, sp: number): ClickTarget | null {
  let best: ClickTarget | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const target of targets) {
    const reach = reachBox(target.box, sp);
    if (point.x < reach.x || point.x > reach.x + reach.w || point.y < reach.y || point.y > reach.y + reach.h) continue;
    const dx = Math.max(0, target.box.x - point.x, point.x - (target.box.x + target.box.w));
    const dy = Math.max(0, target.box.y - point.y, point.y - (target.box.y + target.box.h));
    const distance = Math.hypot(dx, dy);
    const rank = RANK[target.kind];
    if (rank < bestRank || (rank === bestRank && distance < bestDistance)) {
      best = target;
      bestRank = rank;
      bestDistance = distance;
    }
  }
  return best;
}

/** The press a target makes. */
export function pressOf(target: ClickTarget): ElementPress {
  return {
    kind: target.kind,
    key: target.key,
    ...(target.noteKey === undefined ? {} : { noteKey: target.noteKey }),
    ...(target.lyricLine === undefined ? {} : { lyricLine: target.lyricLine }),
    ...(target.measureIndex === undefined ? {} : { measureIndex: target.measureIndex })
  };
}

/**
 * Presses on one target close together are counted as a browser counts
 * clicks: the first selects, the second opens, a third is the same gesture's
 * tail. Measured here rather than heard as `dblclick`, because a press can
 * re-engrave the score (core-editor-pointer-placement.md) and a node replaced
 * between the presses gets no click events at all.
 */
export const DOUBLE_PRESS_MS = 450;

export class PressCounter {
  private last: { key: string; at: number; count: number } | null = null;
  /** Record a press; how many presses on this target in a row it makes. */
  press(key: string, at: number): number {
    const count = this.last !== null && this.last.key === key && at - this.last.at <= DOUBLE_PRESS_MS ? this.last.count + 1 : 1;
    this.last = { key, at, count };
    return count;
  }
  reset(): void { this.last = null; }
}

/**
 * The visit a verse is sung on, for a press on a lyric in the WRITTEN view —
 * the lamp's own rule (`model/passes.ts`: a visit's `verse` lights row N), so
 * pressing verse 2 of a repeated bar lands on its second visit. Verse rows
 * count in `documentLyricLineIds` order, as the lamp counts them. Undefined
 * when no visit sings that row (a verse past the repeats) — the cursor then
 * keeps whichever pass it is on.
 */
export function lyricVisit(doc: MnxStructure, model: PassModel, measureIndex: number, lyricLine: string): number | undefined {
  const verse = documentLyricLineIds(doc).indexOf(lyricLine) + 1;
  if (verse < 1) return undefined;
  return model.entries.find(entry => entry.measureIndex === measureIndex && entry.verse === verse)?.ordinal;
}
