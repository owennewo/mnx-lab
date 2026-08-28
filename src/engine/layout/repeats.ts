/**
 * Repeat barlines — `|:` and `:|` — and their dots, drawn the same way on a
 * notation staff, a native tab staff and the standalone tab staff
 * (core-measure-attributes-gaps.md, item 5: the standalone tab view drew a
 * plain barline where the document said repeat). Factored out of
 * notation.ts primitive-for-primitive, so the notation goldens did not move.
 */
import type { Primitive } from '../primitives.ts';

/** Dots at 1.2× read as repeat dots, not as augmentation dots. */
export const REPEAT_DOT_SCALE = 1.2;
/** Notation: straddling the middle line. */
export const NOTATION_REPEAT_DOT_YS = [1.5, 2.5];
/** Tab: straddling the middle of the six-line staff, the way published tab
 *  repeats do. */
export const TAB_REPEAT_DOT_YS = [2, 3];

export interface RepeatBarlineMetrics {
  thick: number;
  gap: number;
  thin: number;
}

/** Forward repeat `|:` at `x` — thick then thin, spanning top..bottom. The
 *  dots are the caller's (they are per staff, the strokes per group span). */
export function emitRepeatStartStrokes(
  x: number,
  top: number,
  bottom: number,
  metrics: RepeatBarlineMetrics,
  primitives: Primitive[]
): void {
  const thinDx = metrics.thick + metrics.gap;
  primitives.push({
    kind: 'rect',
    x, y: top,
    w: metrics.thick, h: bottom - top,
    fill: 'currentColor',
    className: 'barline repeat-start'
  });
  primitives.push({
    kind: 'line',
    x1: x, dx1: thinDx, y1: top,
    x2: x, dx2: thinDx, y2: bottom,
    thickness: metrics.thin,
    className: 'barline repeat-start'
  });
}

/** Where a forward repeat's dots sit, relative to its x. */
export function repeatStartDotDx(metrics: RepeatBarlineMetrics): number {
  return metrics.thick + metrics.gap + 0.4;
}

/** Backward repeat `:|` ending at `x` — thin then thick (doubles as a final
 *  barline). */
export function emitRepeatEndStrokes(
  x: number,
  top: number,
  bottom: number,
  metrics: RepeatBarlineMetrics,
  primitives: Primitive[]
): void {
  primitives.push({
    kind: 'rect',
    x, dx: -metrics.thick, y: top,
    w: metrics.thick, h: bottom - top,
    fill: 'currentColor',
    className: 'barline repeat-end'
  });
  primitives.push({
    kind: 'line',
    x1: x, dx1: -metrics.thick - metrics.gap,
    y1: top,
    x2: x, dx2: -metrics.thick - metrics.gap,
    y2: bottom,
    thickness: metrics.thin,
    className: 'barline repeat-end'
  });
}

/** Where a backward repeat's dots sit, relative to its x. */
export function repeatEndDotDx(metrics: RepeatBarlineMetrics): number {
  return -metrics.thick - metrics.gap - 0.85;
}

export function emitRepeatDots(
  x: number,
  dx: number,
  staffTop: number,
  ys: readonly number[],
  primitives: Primitive[]
): void {
  for (const dotY of ys) {
    primitives.push({
      kind: 'glyph',
      glyph: 'augmentationDot',
      x, dx,
      y: staffTop + dotY,
      scale: REPEAT_DOT_SCALE,
      className: 'repeat-dot'
    });
  }
}

/** The "4x" over an unconventional backward repeat. */
export function emitRepeatTimes(
  times: number | undefined,
  x: number,
  staffTop: number,
  primitives: Primitive[]
): void {
  if (times === undefined || times === 2) return;
  primitives.push({
    kind: 'text',
    text: `${times}x`,
    x,
    y: staffTop - 1.2,
    font: 'body',
    size: 1.4,
    weight: 'bold',
    anchor: 'end',
    className: 'repeat-times'
  });
}
