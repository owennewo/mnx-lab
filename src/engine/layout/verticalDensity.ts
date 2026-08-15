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
 * row's primitives. Returns null — and touches nothing — at density 1, which
 * is what keeps every committed golden byte-identical: the default path does
 * not merely compute the same numbers, it does not run.
 */
export function tightenRows(args: TightenRowsArgs): TightenedRows | null {
  const { primitives, rows, heightSp, padDensity } = args;
  if (padDensity === 1 || rows.length === 0) return null;

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
