/**
 * Measure repeats — the ％ family (SMuFL `repeat1Bar`, `repeat2Bars`,
 * `repeat4Bars`) and their counters. One emitter, used by the notation staff,
 * the standalone tab staff and the both-view tab staves, so the sign is drawn
 * ONCE per staff the same way everywhere (core-measure-attributes-gaps.md,
 * item 3 — before this the sign was not drawn at all, and the bar carried the
 * amber badge instead).
 *
 * Conventions (Gould, *Behind Bars*, 246–248):
 * - the one-bar sign sits on the middle line, centred in the bar;
 * - the two-bar sign sits ON the barline between the two bars it covers;
 * - longer spans centre over the span, and any span longer than one bar
 *   prints its count above the sign;
 * - a counter (2, 3, 4 … "the third time") prints above the bar, or below
 *   when the document says so.
 */
import type { Primitive } from '../primitives.ts';

export interface MeasureRepeatMark {
  number: number;
  counter?: { count: number; orient?: 'above' | 'below' };
  displayNumber?: boolean;
}

const GLYPH_BY_SPAN: Record<number, string> = {
  1: 'repeat1Bar',
  2: 'repeat2Bars',
  4: 'repeat4Bars'
};

/** Number and counter text: a size that reads at a glance without competing
 *  with a time signature. */
const LABEL_SIZE_SP = 1.2;
const ABOVE_GAP_SP = 1.0;
const BELOW_GAP_SP = 1.9;

export function measureRepeatGlyph(number: number): string {
  return GLYPH_BY_SPAN[number] ?? 'repeat1Bar';
}

export interface EmitMeasureRepeatArgs {
  mark: MeasureRepeatMark;
  /** Where the sign's centre goes — the caller decides from the span. */
  x: number;
  staffTop: number;
  /** 4 for a notation staff, TAB_STAFF_HEIGHT_SP for a tab staff. */
  staffHeight: number;
  /** Draw the number/counter labels (once per system, on the staff that
   *  carries the bar's text). */
  labels: boolean;
  primitives: Primitive[];
}

export function emitMeasureRepeat(args: EmitMeasureRepeatArgs): void {
  const { mark, x, staffTop, staffHeight, labels, primitives } = args;
  const number = Math.max(1, Math.trunc(mark.number || 1));
  primitives.push({
    kind: 'glyph',
    glyph: measureRepeatGlyph(number),
    x,
    y: staffTop + staffHeight / 2,
    anchor: 'middle',
    className: 'measure-repeat'
  });
  if (!labels) return;
  let aboveY = staffTop - ABOVE_GAP_SP;
  // A span longer than a bar says how long, above the sign — unless the
  // document turns the number off.
  if (number > 1 && mark.displayNumber !== false) {
    primitives.push({
      kind: 'text',
      text: `${number}`,
      x,
      y: aboveY,
      font: 'body',
      size: LABEL_SIZE_SP,
      anchor: 'middle',
      weight: 'bold',
      className: 'measure-repeat-number'
    });
    aboveY -= LABEL_SIZE_SP + 0.2;
  }
  if (mark.counter) {
    const below = mark.counter.orient === 'below';
    primitives.push({
      kind: 'text',
      text: `${mark.counter.count}`,
      x,
      y: below ? staffTop + staffHeight + BELOW_GAP_SP : aboveY,
      font: 'body',
      size: LABEL_SIZE_SP,
      anchor: 'middle',
      className: 'measure-repeat-counter'
    });
  }
}

/**
 * The x the sign is centred on, from the bar's own geometry and its span:
 * one bar → the content span's centre; two → the end barline (the sign sits
 * on it); more → the centre of the span when the caller can supply its far
 * edge, else this bar's centre.
 */
export function measureRepeatX(
  number: number,
  bar: { contentStartX: number; x: number; width: number },
  spanEndX?: number
): number {
  if (number === 2) return bar.x + bar.width;
  if (number > 2 && spanEndX !== undefined) return (bar.contentStartX + spanEndX) / 2;
  return (bar.contentStartX + bar.x + bar.width) / 2;
}
