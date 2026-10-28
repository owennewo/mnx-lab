/**
 * The drawing-primitive contract between the layout engine and the renderer.
 *
 * All coordinates and dimensions are in **staff spaces (sp)**. The renderer
 * converts to pixels at emit time using a single pixels-per-staff-space factor;
 * nothing above this layer reasons in pixels and nothing below it reasons in
 * music. SMuFL glyphs are referenced by canonical name; the renderer resolves
 * to a Unicode codepoint and draws them in the loaded music font (Bravura).
 *
 * `sourceId`, when set, is the MNX id of the element this primitive represents.
 * The renderer attaches it as `data-source-id` on the SVG element so DOM
 * queries (hit-testing, highlight sync) can trace primitives back to the model.
 */

// Type-only, and the only import in this file: `LayoutResult` carries the
// packing input back out of a layout (see its `packings`), and the shape of
// that input belongs to the module that owns horizontal geometry.
import type { PackingInput } from './layout/spacing.ts';

export interface Point {
  x: number;
  y: number;
}

export type Primitive =
  | GlyphPrim
  | LinePrim
  | CurvePrim
  | TextPrim
  | RectPrim;

/**
 * INK OFFSETS — the fix for a whole class of non-square-scale bugs
 * (roadmap/complete/core-ink-offset-fields.md).
 *
 * Every horizontal distance in a layout is one of two things, and they scale
 * differently once the staff scale is non-square (`pxPerSpY !== pxPerSp`):
 *
 *   - a MUSICAL POSITION — where an event sits on the line. Scales with the
 *     horizontal scale, because that is what the spacing plan decided.
 *   - an INK OFFSET — the distance from a position to a mark, or between two
 *     marks: half a notehead, a stem anchor, the gap between the two strokes
 *     of a double barline. This is ink, and ink scales with the VERTICAL
 *     scale so it stays proportional to the staff.
 *
 * Written into `x`, an ink offset is silently scaled as a position, and the
 * mark drifts away from what it belongs to as the staff grows. Every instance
 * of this we have found — rigid columns, note clusters, the tab fret mask, the
 * compound barlines — was one subtraction done in the wrong currency, and each
 * was invisible in the corpus because every committed golden is SQUARE, where
 * the two scales are equal and the mistake is arithmetically a no-op.
 *
 * So the currency is now part of the type: put positions in `x`, put ink
 * offsets in `dx`, and the emitter scales each correctly with no judgement at
 * the call site. `x: barlineEnd, dx: -gapSp` rather than `x: barlineEnd - gapSp`.
 *
 * Only the HORIZONTAL axis needs this. A vertical position and a vertical ink
 * offset both scale with the vertical scale, so they coincide and no `dy` is
 * possible to get wrong.
 */
export interface PrimitiveBase {
  /** CSS class added to the emitted element (multiple classes allowed). */
  className?: string;
  /** MNX id of the source element, surfaced as `data-source-id` on the DOM node. */
  sourceId?: string;
  /** Written identity behind occurrence geometry; absent in written order. */
  writtenSourceId?: string;
  /** Explicit visual distinction for ink outside a performed slice. */
  opacity?: number;
  /** Plain-text tooltip, emitted as an SVG `<title>` child (native hover). */
  title?: string;
  /** Only for a host that paints the selection itself (layout/selectionHooks.ts):
   *  the ids that select ink whose selection is a class and no colour. */
  selects?: string;
  /**
   * The element this ink draws and where the document keeps it — emitted as
   * `data-element` / `data-measure`, the click target's address
   * (roadmap/inprogress/core-editor-click-targets.md). Present only when the
   * layout was asked for `elementTargets`, which the viewer does and the
   * goldens never do, so no committed primitive carries it.
   */
  element?: ElementTag;
  /**
   * What this ink was drawn for, stamped where it is drawn
   * (roadmap/complete/core-ink-provenance.md). Readers take it from here rather
   * than working it back out from where the ink landed. Never part of a golden:
   * `rounded()` strips it and the SVG emitter does not write it.
   */
  origin?: InkOrigin;
  /**
   * What the ink IS, for the engine's own decisions — set where it is drawn, so no
   * layout reads it back out of `className`, which is the stylesheet's
   * (roadmap/complete/core-ink-provenance.md, phase 3). Never part of a golden.
   */
  role?: InkRole;
}

/**
 * - `frame`: the staff's furniture — staff lines, barlines, braces, brackets, a
 *   group's label. Not ink anything clears or hangs under.
 * - `lyric`: a verse's words, hyphens and gaps.
 * - `event`: the ink a note or rest IS — a notehead, a fret digit, a rest — as
 *   opposed to what decorates it.
 * - `direction`: a performance direction set on a staff's side; `between`, one
 *   set in the gap between two staves, which that gap must hold.
 */
export type InkRole = 'frame' | 'lyric' | 'event' | 'direction' | 'between';

/** Where a primitive came from — see `PrimitiveBase.origin`. */
export interface InkOrigin {
  /** The system row it was drawn for: an index into the layout's `rows`. */
  row: number;
  /** The staff it was drawn on: an index into its row's `displays` (and `staves`).
   *  Absent on ink that belongs to the system rather than one staff — a barline
   *  through several staves, a brace, a heading over the system. */
  display?: number;
  /** The written measure (an index into `global.measures`) it was drawn for.
   *  Absent on ink that spans bars — a slur, a volta, a verse. */
  measure?: number;
  /** The performed visit (the bar played, from 0) it was drawn for, in a view that
   *  draws each visit of a bar — the unrolled view. Absent where one drawn bar
   *  stands for all its visits. */
  visit?: number;
}

/**
 * Stamp everything pushed since `from` as drawn for `origin`, filling only what a
 * primitive does not say yet. Emitters stamp the range they pushed; an inner emitter
 * that knew more — the staff, or the row of each half of a split curve — has stamped
 * its own pieces first, and they keep it.
 */
export function stamp(primitives: readonly Primitive[], from: number, origin: InkOrigin): void {
  for (let k = from; k < primitives.length; k++) {
    const p = primitives[k]!;
    const own = p.origin;
    if (!own) { p.origin = { ...origin }; continue; }
    // Each primitive's origin is its own object (a copy that moves rows gets a new one —
    // `offsetRows`), so what it does not say yet is filled in place.
    if (own.display === undefined && origin.display !== undefined) own.display = origin.display;
    if (own.measure === undefined && origin.measure !== undefined) own.measure = origin.measure;
    if (own.visit === undefined && origin.visit !== undefined) own.visit = origin.visit;
  }
}

/** Name the staff of everything pushed since `from` that was stamped with its row but
 *  no staff — a post-pass that knows the staff it walked, around emitters that knew
 *  only the row of each piece. */
export function stampDisplay(primitives: readonly Primitive[], from: number, display: number): void {
  for (let k = from; k < primitives.length; k++) {
    const p = primitives[k]!;
    if (p.origin && p.origin.display === undefined) p.origin.display = display;
  }
}

/** `stamp` with the row alone. */
export function stampRow(primitives: readonly Primitive[], from: number, row: number): void {
  stamp(primitives, from, { row });
}

/** Offset the rows of primitives laid out on their own (a segment, a score block, a staff
 *  composed into a system) to where their first row lands in the whole layout. */
export function offsetRows(primitives: readonly Primitive[], by: number): void {
  if (by === 0) return;
  for (const p of primitives) if (p.origin) p.origin = { ...p.origin, row: p.origin.row + by };
}

/** Which element a piece of ink belongs to: its kind (`edit/elementWalk.ts`'s
 *  vocabulary) and the global measure that declares it. */
export interface ElementTag {
  kind: 'repeat-end' | 'repeat-start' | 'ending';
  measureIndex: number;
}

/** Tag everything pushed since `from` as one element's ink — a no-op without a tag. */
export function tagElement(primitives: Primitive[], from: number, tag: ElementTag | undefined): void {
  if (!tag) return;
  for (let k = from; k < primitives.length; k++) primitives[k]!.element = tag;
}

export interface GlyphPrim extends PrimitiveBase {
  kind: 'glyph';
  /** SMuFL canonical name, e.g. `6stringTabClef`, `timeSig4`, `noteheadBlack`. */
  glyph: string;
  x: number;
  /** Ink offset from `x` — see PrimitiveBase's note. */
  dx?: number;
  y: number;
  /** Multiplier on the standard 4-sp em (default 1). */
  scale?: number;
  anchor?: 'start' | 'middle' | 'end';
  /** SMuFL design origin sits on the alphabetic baseline by default;
   *  override only when a glyph needs centring (e.g. annotations).  */
  baseline?: 'alphabetic' | 'middle' | 'central' | 'hanging';
  fill?: string;
}

export interface LinePrim extends PrimitiveBase {
  kind: 'line';
  x1: number;
  /** Ink offset from `x1` — see PrimitiveBase's note. */
  dx1?: number;
  y1: number;
  x2: number;
  /** Ink offset from `x2`. */
  dx2?: number;
  y2: number;
  /** Thickness in staff spaces. */
  thickness: number;
  stroke?: string;
  /** Dash on-length in staff spaces (equal gap); solid when omitted. */
  dash?: number;
}

export interface CurvePrim extends PrimitiveBase {
  kind: 'curve';
  /** Cubic Bezier control points: [P0, P1, P2, P3]. */
  points: [Point, Point, Point, Point];
  thickness: number;
  /**
   * Slur/tie engraving: drawn as a filled body that is `thickness` wide at
   * mid-curve and thins toward the endpoints (no SMuFL glyph exists for
   * arbitrary-length curves). Without it, a constant-width stroke.
   */
  taper?: boolean;
  stroke?: string;
}

export interface TextPrim extends PrimitiveBase {
  kind: 'text';
  text: string;
  x: number;
  /** Ink offset from `x` — see PrimitiveBase's note. */
  dx?: number;
  y: number;
  /** `body` and `bodyItalic` map to the project body font via CSS; `fret`
   *  (tab digits) and `lyric` (verse syllables) are the score's own lettering,
   *  each with its own family token and the body font as fallback. */
  font: 'body' | 'bodyItalic' | 'fret' | 'lyric';
  /** Em size in staff spaces (so font-size in px = size * pxPerSp). */
  size: number;
  anchor?: 'start' | 'middle' | 'end';
  baseline?: 'alphabetic' | 'middle' | 'central' | 'hanging';
  weight?: 'normal' | 'bold' | number;
  fill?: string;
  /** A PLAYBACK-ONLY name, as on `RectPrim`: a lyric syllable carries its
   *  event's note key so the playhead can light the word being sung. Present
   *  only under `durationSpans`, so the goldens never see it. */
  playbackId?: string;
  /** The verse a syllable belongs to (its lyric line id), beside `playbackId`
   *  and under the same flag: the paint lights the verse the pass sings. */
  lyricLine?: string;
}

export interface RectPrim extends PrimitiveBase {
  kind: 'rect';
  x: number;
  /** Ink offset from `x`. A rect's WIDTH is already ink (see `spanW`), so a
   *  rect placed by its right edge wants `dx: -w` and nothing else. */
  dx?: number;
  y: number;
  w: number;
  h: number;
  /** Corner radius in staff spaces. */
  radius?: number;
  fill?: string;
  stroke?: string;
  /** A lyric gap's verse row (lyric line id), as on `TextPrim`. */
  lyricLine?: string;
  /** Stroke thickness in staff spaces (only meaningful when `stroke` is set). */
  thickness?: number;
  /**
   * Where the masked note's DURATION ends — a layout x like `x`, with
   * `spanEndDx` an ink-scale offset back from it like `dx`. Emitted as
   * `data-span-end` (px) so the playback paint can stretch a fret mask to the
   * note's release without a relayout (docs/player-element.md). Present only
   * when the layout was asked for it (`durationSpans`); the goldens never ask,
   * so the field is invisible to every committed primitive.
   */
  spanEndX?: number;
  spanEndDx?: number;
  /**
   * A PLAYBACK-ONLY name, emitted as `data-playback-id`.
   *
   * Deliberately not `sourceId`: that attribute is the selection's and the
   * hit-test's vocabulary as well as the paint's, so a rect carrying it would
   * join the enclosure the editor draws around a selected rest and become a
   * click target the reader cannot see. This rect exists for the playhead
   * alone — `render/playbackInk.ts` lights it, nothing else looks.
   *
   * Present only when the layout was asked for `durationSpans`, so — like
   * `spanEndX` above — the goldens never see it.
   */
  playbackId?: string;
  /**
   * `w` is a HORIZONTAL DISTANCE in layout space — the gap between two musical
   * x positions — rather than ink measured in staff spaces.
   *
   * The distinction is invisible under a square scale and load-bearing under a
   * non-square one (staff scale — see `pxPerSpY` in render/svg.ts): a rect
   * whose width was computed as `x2 - x1` has to keep meeting x1 and x2, while
   * a barline's thickness or a box drawn around a label has to keep its
   * proportions against the glyphs. Ink is the common case and the default.
   */
  spanW?: boolean;
}

/** Shifts a primitive vertically in place (score/system stacking). */
export function translatePrimitiveY(p: Primitive, dy: number): void {
  switch (p.kind) {
    case 'glyph':
    case 'text':
    case 'rect':
      p.y += dy;
      break;
    case 'line':
      p.y1 += dy;
      p.y2 += dy;
      break;
    case 'curve':
      for (const pt of p.points) pt.y += dy;
      break;
  }
}

/**
 * Map from MNX source id to where its primitive lives in the score, so the
 * host application can answer "the user clicked id X — which measure/voice/event
 * is that?" without re-walking the MNX tree.
 */
export type SpatialIndex = Map<string, SourceLocation>;

export interface SourceLocation {
  measureIndex: number;
  voiceIndex: number;
  eventIndex: number;
}

/** The written key and the visit behind an id drawn for one visit of a bar (`w2:…`). */
export interface Occurrence {
  key: string;
  visit: number;
}

/** Output of every layout module. */
/**
 * `validation` — the document is musically wrong in a way the user can and
 * should fix (e.g. bar duration arithmetic). `warning` — the document is
 * legal and may well be intentional, but is ambiguous enough that consumers
 * disagree about it (e.g. two voices sharing one string in tab). `render` —
 * content this renderer doesn't support yet, or an error it swallowed
 * (forgiving render).
 */
export type DiagnosticKind = 'validation' | 'warning' | 'render';

/** One per-measure problem, also drawn into the score as a warning marker. */
export interface LayoutDiagnostic {
  measureIndex: number;
  message: string;
  kind: DiagnosticKind;
}

/**
 * Vertical band of one laid-out system row: the top line of its first staff to
 * the bottom line of its last. Metadata for composition (the `both` view's
 * system composer) — never serialized into goldens.
 */
export interface RowBandSp {
  staffTop: number;
  staffBottom: number;
}

export interface LayoutResult {
  primitives: Primitive[];
  /** Total layout width in staff spaces. */
  widthSp: number;
  /** Total layout height in staff spaces. */
  heightSp: number;
  /**
   * Width actually occupied by content (widest system + margins), ≤ widthSp.
   * Lets the renderer scale short scores up to fill the viewport.
   */
  usedWidthSp: number;
  /**
   * What `usedWidthSp` would be at horizontal density 1 — the score's NATURAL
   * extent, and the only honest input to the fit.
   *
   * `fitPxPerSp` exists to stop a one-measure example being drawn at its own
   * tiny natural width ("a one-measure example shouldn't become a poster"), so
   * the question it means to ask is about the SCORE. Asked of `usedWidthSp` it
   * accidentally asks about the density KNOB too: density squeezes the music,
   * `usedWidthSp` shrinks, and the fit zooms straight back in to fill the
   * viewport — cancelling the knob, and over-cancelling it enough that bar
   * widths ran BACKWARDS from density 0.02 to 0.3 (measured on
   * twelve-bar-blues at 1500px: bar 1 went 178px → 158px as density tripled).
   *
   * Absent when density is already 1, where it would equal `usedWidthSp` — so
   * the default path pays nothing for it.
   */
  naturalWidthSp?: number;
  index: SpatialIndex;
  /** Non-fatal problems encountered while laying out (forgiving render). */
  diagnostics: LayoutDiagnostic[];
  /** Staff bands per system row, in layout order (see RowBandSp). */
  rows: RowBandSp[];
  /** Per row, per display staff (notation staves, then any injected tab
   *  staff, in display order): the band from its top line to its bottom line.
   *  Metadata, like `rows` — never serialized into goldens. */
  displays?: RowBandSp[][];
  /**
   * The system-packing input behind this layout, one per laid-out segment.
   *
   * Metadata for composition, like `rows`: never serialized into goldens, and
   * absent from the trivial layouts that pack nothing. It exists so a host can
   * ask `densityLadder` which OTHER density values would draw this score
   * differently — the answer is mostly "very few", and a control that steps
   * blindly spends most of its clicks on values that change nothing
   * (roadmap/complete/core-render-density-zoom.md).
   */
  packings?: PackingInput[];
  /** Every bar drawn, in the order drawn: the row it is on and its extent, from its
   *  left barline (the system's left edge for a system's first bar) to its right.
   *  What the overlays read instead of finding bars among barline strokes. */
  bars?: BarSp[];
  /** Per row, per display staff (parallel to `displays`): which staff it draws. */
  staves?: DisplayStaff[][];
  /** In a view that draws each visit of a bar (the unrolled view), every id it drew
   *  for one visit — performed or not — with the written key and the visit behind it,
   *  so a reader looks them up rather than decoding the id. */
  occurrences?: Map<string, Occurrence>;
}

/** One drawn bar — see `LayoutResult.bars`. */
export interface BarSp {
  row: number;
  /** Its index in the layout's plan: the ordinal `packedRowMeasures` lists. */
  index: number;
  /** The written measure it draws. */
  measure: number;
  x: number;
  width: number;
}

/** Which staff a display band draws — see `LayoutResult.staves`. */
export interface DisplayStaff {
  /** Index into the laid-out document's `parts`. */
  partIndex: number;
  /** 1-based, as everywhere in the cursor's address. */
  staffIndex: number;
  projection: 'notation' | 'tab';
  /** Its line count: five for notation, the string count for tab. */
  lines: number;
}
