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

export interface PrimitiveBase {
  /** CSS class added to the emitted element (multiple classes allowed). */
  className?: string;
  /** MNX id of the source element, surfaced as `data-source-id` on the DOM node. */
  sourceId?: string;
  /** Plain-text tooltip, emitted as an SVG `<title>` child (native hover). */
  title?: string;
}

export interface GlyphPrim extends PrimitiveBase {
  kind: 'glyph';
  /** SMuFL canonical name, e.g. `6stringTabClef`, `timeSig4`, `noteheadBlack`. */
  glyph: string;
  x: number;
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
  y1: number;
  x2: number;
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
  y: number;
  /** `body` and `bodyItalic` map to project body font via CSS. */
  font: 'body' | 'bodyItalic';
  /** Em size in staff spaces (so font-size in px = size * pxPerSp). */
  size: number;
  anchor?: 'start' | 'middle' | 'end';
  baseline?: 'alphabetic' | 'middle' | 'central' | 'hanging';
  weight?: 'normal' | 'bold' | number;
  fill?: string;
}

export interface RectPrim extends PrimitiveBase {
  kind: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  /** Corner radius in staff spaces. */
  radius?: number;
  fill?: string;
  stroke?: string;
  /** Stroke thickness in staff spaces (only meaningful when `stroke` is set). */
  thickness?: number;
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
  index: SpatialIndex;
  /** Non-fatal problems encountered while laying out (forgiving render). */
  diagnostics: LayoutDiagnostic[];
}
