import { clearanceSpacing, clampPadDensity } from '../clearance.ts';
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
 * than toward zero. **Since stage D of core-ink-measured-gaps.md the pads are
 * not consulted at all**: each gap between systems is
 *
 *     ink below + ink above + resolved system clearance
 *
 * The pads were a prediction of the worst case a row might hold; this is a
 * measurement of what it does hold, and the two are only ever the same by
 * luck. A tab row carrying nothing above it closes right up; a row under a
 * section label keeps exactly the room the label needs. That difference is
 * the feature — the space that disappears is the space nothing was using —
 * and it is what makes an unlabelled row sit closer than a labelled one
 * without anybody encoding "unlabelled rows are closer".
 *
 * Clearance selects relationship-specific anchors. The legacy `padDensity`
 * input can still scale the same distances when a host explicitly supplies it.
 *
 * It runs as a POST-PASS over a finished `LayoutResult`, which is why it needs
 * no knowledge of any layout's row arithmetic: `rows[]` says where each system
 * band sits, the primitives say where its ink actually reaches, and rows move
 * by translation. One implementation serves notation, tab and the combined
 * `both` system, and none of the three had to make `ROW_HEIGHT_SP` per-layout
 * — the refactor the parent doc expected and this shape sidesteps.
 */

/**
 * Clear space between two things that do NOT belong to each other: two staves
 * of one system (stage C), and — since stage D — two systems. Separation, not
 * cohesion, which is why it is three times the clearance a label keeps from
 * the staff it names (`COHESION_CLEAR_SP`).
 */
export const SEPARATION_CLEAR_SP = 3;

export const MIN_PAD_DENSITY = 0;
export const MAX_PAD_DENSITY = 2;

/**
 * Bounded like `clampDensity`, and for the same reason: a bad value should
 * degrade to something drawable rather than throw. The floor can be 0 because
 * the ink-derived clearance above does the safety work — asking for zero
 * padding gets you 1sp between one system's ink and
 * the next's, not overlap.
 */
export { clampPadDensity } from '../clearance.ts';

/** Optional legacy coupling helper for hosts. The viewer keeps Space and
 * Clearance independent and never calls this automatically. */
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
  padDensity?: number;
  clearance?: number;
  /** Internal fixed-point pass: retain the outer margins chosen on pass one
   *  while re-measuring content ownership inside the page. */
  preserveOuterMargins?: boolean;
  /** Below-staff space each row RESERVES for content that belongs to it — a
   *  lyric verse block. Row attribution is by the gap's midpoint, which
   *  mis-files a deep verse row with the system BELOW (it then translates
   *  with the wrong row). The reservation pushes the boundary past the
   *  block. Uniform per layout; thread per-row data if a layout ever needs
   *  to mix reserved and unreserved rows. */
  reservedBelowSp?: number;
  /** Ownership decided by an earlier pass, reused instead of re-derived.
   *
   *  Attribution is geometric, so it is only trustworthy against the geometry
   *  it was measured on. Once a pass has moved the rows, asking again where a
   *  primitive falls asks about a page that no longer exists — and a flag
   *  sitting high above its staff is exactly the ink that changes side when rows
   *  close up. Which row emitted a primitive is a fact, not a measurement, so
   *  the fixed-point loop settles it once and carries it. */
  owners?: ReadonlyMap<Primitive, number>;
}

/** A layout whose rows have moved. */
export interface TranslatedRows {
  heightSp: number;
  rows: RowBandSp[];
}

export interface TightenedRows extends TranslatedRows {
  /** The attribution this pass used, for the next pass to reuse. */
  owners: ReadonlyMap<Primitive, number>;
  /** Ink extent per row after the move, measured against that attribution. */
  ink: { top: number; bottom: number }[];
}

/**
 * Re-places a finished layout's systems at the resolved clearance, translating each
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
  const { primitives, rows, heightSp } = args;
  const clearance = clearanceSpacing(args.clearance, args.padDensity);
  if (rows.length === 0) return null;

  // Which row each primitive belongs to: the bands are ordered and disjoint,
  // so the midpoint between one row's bottom line and the next's top line is
  // an unambiguous boundary. Derived from `rows` rather than from a row pitch,
  // because a notation layout stacks several segments (per-system layouts,
  // titled score blocks) whose rows are NOT uniformly spaced.
  const boundaries = rowBoundariesSp(rows, args.reservedBelowSp ?? 0);
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
    // A caller mid-fixed-point already knows the answer from the geometry the
    // attribution was actually valid for; re-deriving it here would re-file
    // ink against rows this loop has since moved.
    const prior = args.owners?.get(p);
    const r = prior !== undefined && prior < rows.length ? prior : rowOf(anchorY(p));
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
  const newTopGap = args.preserveOuterMargins
    ? topGap
    : clearance.verticalMargin(topGap, rows[0].staffTop - inkTop[0]);

  const offsets: number[] = [newTopGap - topGap];
  for (let r = 0; r + 1 < rows.length; r++) {
    const gap = rows[r + 1].staffTop - rows[r].staffBottom;
    // STAGE D (core-ink-measured-gaps.md): the gap IS the ink either side plus
    // the separation clearance — the reserved pads are not consulted. They
    // were a prediction of the worst case every row might hold; this is the
    // measurement of what each row actually holds, so a system under a section
    // label gets room for it and a bare one directly below closes up.
    //
    // Clearance changes the discretionary air after actual ink is measured.
    // Its tight anchor remains positive, so systems never touch or overlap.
    const ink =
      (inkBottom[r] - rows[r].staffBottom) +
      (rows[r + 1].staffTop - inkTop[r + 1]) +
      clearance.systemInk;
    offsets.push(offsets[r] + (ink - gap));
  }

  const last = rows.length - 1;
  const bottomGap = heightSp - rows[last].staffBottom;
  const newBottomGap = args.preserveOuterMargins
    ? bottomGap
    : clearance.verticalMargin(bottomGap, inkBottom[last] - rows[last].staffBottom);

  // Nothing moved and nothing grew: the layout is already the answer. Return
  // null so callers keep their own objects — byte-identical by measurement.
  if (offsets.every(o => o === 0) && newBottomGap === bottomGap) return null;

  for (const p of primitives) {
    const r = owner.get(p);
    if (r === undefined || offsets[r] === 0) continue;
    translatePrimitiveY(p, offsets[r]);
  }

  return {
    owners: owner,
    ink: rows.map((_, r) => ({ top: inkTop[r] + offsets[r], bottom: inkBottom[r] + offsets[r] })),
    heightSp: rows[last].staffBottom + offsets[last] + newBottomGap,
    rows: rows.map((b, r) => ({
      staffTop: b.staffTop + offsets[r],
      staffBottom: b.staffBottom + offsets[r]
    }))
  };
}

/**
 * Re-measures the gaps after each move, until the row bands settle.
 *
 * Ownership is NOT re-measured. Pass one decides which row emitted each
 * primitive, on the only geometry where that question has a geometric answer,
 * and every later pass reuses it. Re-deriving it was the bug: closing the gaps
 * moves the midpoint boundary past any ink that reaches well beyond its own
 * staff, and the next pass then carries that ink away with the neighbouring
 * row.
 */
export function fitRowsToClearance(args: TightenRowsArgs): TightenedRows | null {
  let rows = args.rows;
  let heightSp = args.heightSp;
  let final: TightenedRows | null = null;
  // Ownership is settled on the FIRST pass and carried, never re-measured.
  // Re-deriving it each pass was the bug: pass one closes the gaps, and a flag
  // on an up-stem — anchored at the stem tip, well above its own staff — then
  // falls on the far side of the risen boundary. Pass two duly translates it
  // with the row above while its stem goes with the row below, and the two
  // separate for good. It only ever bit when rows CLOSE UP, which is why the
  // tight half of the clearance range showed it and the spacious half did not.
  let owners: ReadonlyMap<Primitive, number> | undefined = args.owners;
  // A primitive can cross at most one ordered boundary per pass. The extra
  // pass proves the fixed point; the cap protects malformed input.
  for (let pass = 0; pass <= args.rows.length; pass++) {
    const next = tightenRows({
      ...args,
      owners,
      rows,
      heightSp,
      preserveOuterMargins: pass > 0
    });
    if (!next) return final;
    final = next;
    owners = next.owners;
    rows = next.rows;
    heightSp = next.heightSp;
  }
  return final;
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
 *
 * It reports no ownership: every primitive moves by the same `dy`, so nothing
 * changes row and there is no attribution to carry.
 */
export function ensureTopMargin(
  primitives: Primitive[],
  rows: readonly RowBandSp[],
  heightSp: number,
  marginSp: number
): TranslatedRows | null {
  const bounds = computeBoundsSp(primitives);
  if (!bounds || bounds.y >= marginSp) return null;

  const dy = marginSp - bounds.y;
  for (const p of primitives) translatePrimitiveY(p, dy);
  return {
    heightSp: heightSp + dy,
    rows: rows.map(b => ({ staffTop: b.staffTop + dy, staffBottom: b.staffBottom + dy }))
  };
}

/** Row-ownership boundaries between consecutive bands: the gap's midpoint,
 *  pushed past any below-staff reservation (a lyric verse block) so deep
 *  content stays with the row it hangs from. ONE rule, used by tightenRows
 *  and by the conformance measurement that checks its identity — the two
 *  diverging is exactly the bug the reservation exists to prevent. */
export function rowBoundariesSp(rows: readonly RowBandSp[], reservedBelowSp = 0): number[] {
  const boundaries: number[] = [];
  for (let r = 0; r + 1 < rows.length; r++) {
    const mid = (rows[r].staffBottom + rows[r + 1].staffTop) / 2;
    boundaries.push(Math.min(rows[r + 1].staffTop, Math.max(mid, rows[r].staffBottom + reservedBelowSp)));
  }
  return boundaries;
}

/** The y a primitive is anchored at, for deciding which row (or display
 *  band) owns it — shared with the display-gap measurement in notation.ts. */
export function anchorY(p: Primitive): number {
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
