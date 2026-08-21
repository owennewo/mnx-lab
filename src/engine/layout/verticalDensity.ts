import { Primitive, RowBandSp, translatePrimitiveY } from '../primitives.ts';
import { computeBoundsSp } from '../render/bounds.ts';

/**
 * VERTICAL DENSITY — the third axis of roadmap/complete/core-vertical-density.md:
 * systems pack closer without the staff getting smaller.
 *
 * Every layout reserves fixed vertical headroom per system — 6sp above and
 * below a notation staff, 4sp around a tab staff — sized for the worst case
 * that row can hold (ledger lines, stems, tempo marks, rehearsal boxes, lyric
 * blocks). Measured across the committed goldens, almost no row uses it:
 *
 * | view | above the staff | below the staff | reserved |
 * |---|---|---|---|
 * | notation (101) | median 0.5sp, p90 5.5sp | median 1.0sp, p90 4.5sp | 6 + 6 |
 * | tab (20) | median 0.0sp, p90 1.1sp | median 0.5sp, p90 2.3sp | 4 + 4 |
 *
 * So a fixed multiplier on the pads is the wrong instrument: scaled far enough
 * to help the median score it clips the p90 one, and clipping here is not the
 * graceful degradation `densityH` enjoys. Density scales springs and never the
 * rigid columns, so no horizontal value can make two glyphs collide; the row
 * pads ARE the vertical clearance, and halving them puts one system's stems
 * through the system above.
 *
 * This axis therefore tightens toward what each row ACTUALLY contains rather
 * than toward zero. Each gap between systems is
 *
 *     max(ink below + ink above + MIN_CLEAR_SP, gapAtDensityOne * padDensity)
 *
 * so `padDensity` walks from today's uniform reservation down to the point
 * where consecutive systems nearly touch, and cannot pass it. A tab row whose
 * staff carries nothing above it collapses almost entirely; a notation row
 * under a rehearsal mark and a two-verse lyric block barely moves. That
 * difference is the feature — the space that disappears is the space nothing
 * was using.
 *
 * It runs as a POST-PASS over a finished `LayoutResult`, which is why it needs
 * no knowledge of any layout's row arithmetic: `rows[]` says where each system
 * band sits, the primitives say where its ink actually reaches, and rows move
 * by translation. One implementation serves notation, tab and the combined
 * `both` system, and none of the three had to make `ROW_HEIGHT_SP` per-layout
 * — the refactor the parent doc expected and this shape sidesteps.
 */

/** Clear space left between one system's lowest ink and the next's highest. */
const MIN_CLEAR_SP = 1;
/** Floor on the page margin above the first system and below the last. */
const MIN_PAGE_MARGIN_SP = 0.5;

export const MIN_PAD_DENSITY = 0;
export const MAX_PAD_DENSITY = 2;

/**
 * Bounded like `clampDensity`, and for the same reason: a bad value should
 * degrade to something drawable rather than throw. The floor can be 0 because
 * the ink-derived clearance above does the safety work — asking for zero
 * padding gets you `MIN_CLEAR_SP` between systems, not overlap.
 */
export function clampPadDensity(value: number | undefined | null): number {
  if (value === undefined || value === null || !Number.isFinite(value)) return 1;
  return Math.min(MAX_PAD_DENSITY, Math.max(MIN_PAD_DENSITY, value));
}

/**
 * The coupling: one reader-facing intent ("fit more music") over two engine
 * scalars. `densityH` decides how much music fits on a line, this decides how
 * many lines fit on a screen, and a control that offered them separately would
 * be asking the reader to solve for something they don't think in.
 *
 * Square root rather than linear, because the two axes buy very different
 * amounts per unit. Horizontal density runs to 0.02 before packing bottoms
 * out (`MIN_DENSITY`'s retune note); padding is spent by ~0.3. Coupling them
 * linearly would have padding hit its ink floor in the first tenth of the
 * arm's travel and sit there for the rest of it, which reads as a broken
 * control rather than an exhausted one.
 *
 * Held in the ENGINE as a mapping and applied by the SURFACE (`ScoreViewer`
 * derives `densityPad` from the effective `densityH` only when the host has
 * not set one). core-vertical-density.md's own ruling: coupling in the control
 * is reversible, conflating the scalars in the engine would not be.
 */
export const PAD_COUPLING_EXPONENT = 0.5;

export function padDensityFor(densityH: number): number {
  return clampPadDensity(Math.pow(densityH, PAD_COUPLING_EXPONENT));
}

export interface TightenRowsArgs {
  /** Mutated in place — rows move by translation. */
  primitives: Primitive[];
  /** The finished row bands, top to bottom. */
  rows: readonly RowBandSp[];
  /** The finished total height. */
  heightSp: number;
  padDensity: number;
}

export interface TightenedRows {
  heightSp: number;
  rows: RowBandSp[];
}

/**
 * Re-places a finished layout's systems at `padDensity`, translating each
 * row's primitives. Returns null — and touches nothing — when no row needs to
 * move.
 *
 * It used to return null at density 1 unconditionally, as the golden-safety
 * clause. Read the gap formula again, though: at density 1 it is
 * `max(ink, gap)`, which can only ever WIDEN a gap whose ink has overrun the
 * fixed pads — it is collision insurance with zero effect on every row that
 * fits, and every committed golden fit. So it runs at every density now
 * (core-ink-measured-gaps.md, stage A, where labels started clearing stems and
 * could climb past `ROW_PAD_TOP_SP`); the null return is earned by measuring
 * rather than assumed from the density, which is the stronger guarantee.
 */
export function tightenRows(args: TightenRowsArgs): TightenedRows | null {
  const { primitives, rows, heightSp, padDensity } = args;
  if (rows.length === 0) return null;

  // Which row each primitive belongs to: the bands are ordered and disjoint,
  // so the midpoint between one row's bottom line and the next's top line is
  // an unambiguous boundary. Derived from `rows` rather than from a row pitch,
  // because a notation layout stacks several segments (per-system layouts,
  // titled score blocks) whose rows are NOT uniformly spaced.
  const boundaries: number[] = [];
  for (let r = 0; r + 1 < rows.length; r++) {
    boundaries.push((rows[r].staffBottom + rows[r + 1].staffTop) / 2);
  }
  const rowOf = (y: number): number => {
    let r = 0;
    while (r < boundaries.length && y >= boundaries[r]) r++;
    return r;
  };

  // Ink extents per row, through the same measurement the snug-crop viewport
  // already uses (`computeBoundsSp`) — glyph extents from the font's own SMuFL
  // bounding boxes, not from the baseline. That distinction is the whole
  // safety argument here: a treble clef's baseline sits on the G line and its
  // ink reaches 2.5sp above the staff, so measuring anchors would tighten a
  // system straight through the clef of the one below.
  const buckets: Primitive[][] = rows.map(() => []);
  const owner = new Map<Primitive, number>();
  for (const p of primitives) {
    const r = rowOf(anchorY(p));
    owner.set(p, r);
    buckets[r].push(p);
  }
  const inkTop = rows.map((b, r) => Math.min(b.staffTop, computeBoundsSp(buckets[r])?.y ?? b.staffTop));
  const inkBottom = rows.map((b, r) => {
    const bb = computeBoundsSp(buckets[r]);
    return Math.max(b.staffBottom, bb ? bb.y + bb.h : b.staffBottom);
  });

  // Each gap tightens toward the ink either side of it, never past it. The
  // page's own top and bottom margins tighten the same way against a floor.
  const topGap = rows[0].staffTop;
  const newTopGap = Math.max(
    (rows[0].staffTop - inkTop[0]) + MIN_PAGE_MARGIN_SP,
    topGap * padDensity
  );

  const offsets: number[] = [newTopGap - topGap];
  for (let r = 0; r + 1 < rows.length; r++) {
    const gap = rows[r + 1].staffTop - rows[r].staffBottom;
    const ink =
      (inkBottom[r] - rows[r].staffBottom) +
      (rows[r + 1].staffTop - inkTop[r + 1]) +
      MIN_CLEAR_SP;
    offsets.push(offsets[r] + (Math.max(ink, gap * padDensity) - gap));
  }

  const last = rows.length - 1;
  const bottomGap = heightSp - rows[last].staffBottom;
  const newBottomGap = Math.max(
    (inkBottom[last] - rows[last].staffBottom) + MIN_PAGE_MARGIN_SP,
    bottomGap * padDensity
  );

  // Nothing moved and nothing grew: the layout is already the answer. Return
  // null so callers keep their own objects — byte-identical by measurement.
  if (offsets.every(o => o === 0) && newBottomGap === bottomGap) return null;

  for (const p of primitives) {
    const r = owner.get(p);
    if (r === undefined || offsets[r] === 0) continue;
    translatePrimitiveY(p, offsets[r]);
  }

  return {
    heightSp: rows[last].staffBottom + offsets[last] + newBottomGap,
    rows: rows.map((b, r) => ({
      staffTop: b.staffTop + offsets[r],
      staffBottom: b.staffBottom + offsets[r]
    }))
  };
}

/**
 * Shifts a finished layout down so nothing sits above the page top.
 *
 * A layout's first-row offset is a FIXED reservation, and a fixed reservation
 * can be too small as easily as too large: the tab layout keeps 4sp above its
 * staff, which is ample for a capo line and not nearly enough for a rehearsal
 * box stacked over a metronome mark. The overflow is silent — the primitives
 * are emitted at negative y and simply fall outside the viewport, so a
 * reviewer sees a score with its labels missing rather than a score that is
 * wrong.
 *
 * Measuring is the fix, and it is the same move `tightenRows` makes one level
 * up: the frame follows the ink instead of predicting it. Unlike that pass
 * this one runs at every density — a label that would be clipped is not a
 * density question — but it is a no-op whenever the reservation was already
 * enough, which is every scenario in the corpus that has no labels.
 */
export function ensureTopMargin(
  primitives: Primitive[],
  rows: readonly RowBandSp[],
  heightSp: number,
  marginSp: number
): TightenedRows | null {
  const bounds = computeBoundsSp(primitives);
  if (!bounds || bounds.y >= marginSp) return null;

  const dy = marginSp - bounds.y;
  for (const p of primitives) translatePrimitiveY(p, dy);
  return {
    heightSp: heightSp + dy,
    rows: rows.map(b => ({ staffTop: b.staffTop + dy, staffBottom: b.staffBottom + dy }))
  };
}

/** The y a primitive is anchored at, for deciding which row owns it. */
function anchorY(p: Primitive): number {
  switch (p.kind) {
    case 'glyph':
    case 'text':
    case 'rect':
      return p.y;
    case 'line':
      return (p.y1 + p.y2) / 2;
    case 'curve':
      return (p.points[0].y + p.points[3].y) / 2;
  }
}
