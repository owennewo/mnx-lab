import { Point, Primitive, GlyphPrim, LinePrim, CurvePrim, TextPrim, RectPrim } from '../primitives.ts';
import { glyphCodepoint } from '../smufl/smufl.ts';

/**
 * Walks a primitive list and emits SVG. Knows nothing about music — primitives
 * carry everything the renderer needs (coordinates in sp, SMuFL glyph names,
 * optional sourceId for hit-testing).
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

const FONT_FAMILY_BODY = 'var(--font-family-sans)';

/**
 * MINIMUM DRAWN INK — a hairline is never allowed below one device pixel.
 *
 * Ink scales with the STAFF (`pxPerSpY`), which is what keeps a barline's
 * weight matching the staff lines it crosses at every size. At the small end
 * of the staff range that arithmetic runs out of pixels rather than out of
 * correctness: at Staff 0.4sp a tab staff line and a tab barline are both
 * 0.1sp × 4px/sp = **0.4px**, which a renderer can only draw as a smear of grey. The
 * reported symptom was an illegible double barline; the giveaway was that the
 * staff lines were exactly as faint, because the whole engraving had dropped
 * under a pixel.
 *
 * So this is a legibility floor and deliberately NOT a scale rule: it changes
 * no position, it applies to stroke weights only, and above 100px/sp of staff
 * it never fires at all. Every committed golden is emitted at 16px/sp where
 * the thinnest ink is 1.6px, so it cannot move one.
 *
 * It also cannot resurrect the overlap it would be easy to fear. Flooring a
 * stroke widens it about its own centre, so two strokes of a compound barline
 * close on each other — but the 0.4sp Staff floor remains above the roughly
 * 0.33sp point where the two would meet.
 */
const MIN_INK_PX = 1;

/** A stroke's drawn weight: ink on the vertical scale, floored for legibility. */
function inkWidth(thicknessSp: number, ky: number): number {
  return Math.max(thicknessSp * ky, MIN_INK_PX);
}
const FONT_FAMILY_MUSIC = 'Bravura';

/** Scale-to-fit ceiling — a one-measure example shouldn't become a poster. */
const FIT_MAX_PX_PER_SP = 16;

/**
 * Scale-to-fit: when a score's content is narrower than the viewport (short
 * examples laid out at their natural, unjustified width), raise px-per-sp so
 * it fills the available width — capped, and never below the base scale.
 */
export function fitPxPerSp(widthPx: number, usedWidthSp: number, basePxPerSp: number): number {
  if (usedWidthSp <= 0) return basePxPerSp;
  return Math.max(basePxPerSp, Math.min(FIT_MAX_PX_PER_SP, widthPx / usedWidthSp));
}

export interface RenderSvgOptions {
  container: HTMLElement;
  primitives: readonly Primitive[];
  widthSp: number;
  heightSp: number;
  /** Horizontal scale: how wide a staff space is. Owns WHERE things sit. */
  pxPerSp: number;
  /**
   * Vertical scale — defaults to `pxPerSp`, i.e. square, which is what every
   * caller but the non-square Staff path wants.
   *
   * The two are separable because the score's axes answer different questions:
   * horizontal position is a musical decision (the spacing plan), vertical
   * extent is a legibility one (how big is the ink). Staff moves the second
   * without disturbing the first — see `staffSp` on the renderers.
   *
   * Positions split by axis; every DIMENSION — glyph size, stroke width, rect
   * extent, dash — follows the VERTICAL scale, because those are ink, and ink
   * that grew in one axis only would render a squashed notehead.
   */
  pxPerSpY?: number;
  /**
   * Optional crop: the visible window in sp (e.g. from computeBoundsSp in
   * bounds.ts). Defaults to the full 0,0 → widthSp,heightSp canvas.
   */
  viewBoxSp?: { x: number; y: number; w: number; h: number };
  /** CSS class added to the root <svg>. */
  className?: string;
  /**
   * Fires when the user activates any element with a sourceId. Delegation
   * happens on the root <svg>, so callers don't pay per-element listener cost.
   * Pointer-down is the primary boundary: taking keyboard ownership can
   * repaint the viewer before the later click reaches the old SVG node. The
   * click fallback covers keyboard and synthetic activation and is deduped
   * from an ordinary pointer sequence.
  */
  onSourceActivate?: (sourceId: string, event: MouseEvent) => void;
  /** Legacy click-only bridge. New interactive viewers should prefer
   * `onSourceActivate`, which survives focus-triggered SVG replacement. */
  onSourceClick?: (sourceId: string, event: MouseEvent) => void;
}

/**
 * The markup for a render, as one string.
 *
 * The emitter builds text rather than DOM nodes because that is what the
 * browser parses fastest: on a 61-bar score `createElementNS` + seven
 * `setAttribute`s per primitive measured ~330ms for 6,345 nodes, where the
 * same markup through `innerHTML` parses in ~170ms
 * (roadmap/inprogress/core-touch-gestures.md, *Performance, measured*).
 * It is also what the goldens are: `harness/helpers/svgString.ts` used to
 * fake the DOM slice the old emitter touched and serialise the result, and
 * this is that serialisation, byte for byte — attributes in the order they
 * were set, `String(number)` for every number, `&<>"` escaped.
 */
export interface SvgMarkupOptions {
  primitives: readonly Primitive[];
  widthSp: number;
  heightSp: number;
  pxPerSp: number;
  pxPerSpY?: number;
  viewBoxSp?: { x: number; y: number; w: number; h: number };
  className?: string;
  /** Declare the namespace on the root — a standalone SVG file needs it;
   *  markup parsed into an HTML document does not. */
  xmlns?: boolean;
}

/**
 * What every primitive of a kind shares, declared once instead of on each.
 *
 * A glyph's font, a glyph's or a text's fill and a line's or curve's stroke
 * used to ride on every element as presentation attributes — some 10,000
 * attributes and a quarter of the markup on a 61-bar score. They are the
 * same value on all but a handful, so they live here and only the handful
 * says otherwise.
 *
 * The handful cannot say so with an attribute: a presentation attribute
 * loses to ANY stylesheet rule, even one with no specificity, so an
 * exception is written as an inline `style`. `:where()` keeps these rules at
 * zero specificity, which is exactly the standing the attributes had — every
 * rule a host writes against a class still wins, as it did before.
 * `svg > …` keeps them off what a host draws into the same root inside its
 * own groups (the selection enclosure, the cursor ghost).
 */
const KIND_DEFAULTS =
  '<style>' +
  `:where(svg>text){font-family:${FONT_FAMILY_MUSIC};fill:currentColor}` +
  ':where(svg>line,svg>path){stroke:currentColor}' +
  '</style>';

export function renderSvgMarkup(opts: SvgMarkupOptions): string {
  const { primitives, widthSp, heightSp, pxPerSp, viewBoxSp, className } = opts;
  const pxPerSpY = opts.pxPerSpY ?? pxPerSp;

  const view = viewBoxSp ?? { x: 0, y: 0, w: widthSp, h: heightSp };
  const widthPx = view.w * pxPerSp;
  const heightPx = view.h * pxPerSpY;

  let out = `<svg width="${n(widthPx)}" height="${n(heightPx)}" viewBox="${n(view.x * pxPerSp)} ${n(view.y * pxPerSpY)} ${n(widthPx)} ${n(heightPx)}"`;
  if (className) out += ` class="${escapeXml(className)}"`;
  if (opts.xmlns) out += ` xmlns="${SVG_NS}"`;
  out += '>' + KIND_DEFAULTS;
  for (const p of primitives) out += emitPrimitive(p, pxPerSp, pxPerSpY);
  return out + '</svg>';
}

/**
 * A number for markup: four decimals, which is the precision the primitives
 * themselves carry (`headless.ts` rounds them so). Under a fractional scale
 * every coordinate is otherwise a seventeen-digit float, and the parser
 * pays for each digit.
 */
function n(v: number): string {
  return String(Math.round(v * 1e4) / 1e4);
}

export function renderSvg(opts: RenderSvgOptions): SVGSVGElement {
  const { container, onSourceActivate, onSourceClick } = opts;

  container.innerHTML = renderSvgMarkup(opts);
  const svg = container.firstElementChild as SVGSVGElement;

  if (onSourceActivate) {
    let pointerSource: string | null = null;
    const sourceFrom = (event: Event): string | null => {
      const target = event.target;
      if (!(target instanceof Element)) return null;
      return target.closest('[data-source-id]')?.getAttribute('data-source-id') ?? null;
    };
    svg.addEventListener('pointerdown', event => {
      const sourceId = sourceFrom(event);
      if (!sourceId) return;
      pointerSource = sourceId;
      setTimeout(() => {
        pointerSource = null;
      }, 0);
      onSourceActivate(sourceId, event);
    });
    svg.addEventListener('click', event => {
      const sourceId = sourceFrom(event);
      if (!sourceId || pointerSource === sourceId) return;
      onSourceActivate(sourceId, event);
    });
  } else if (onSourceClick) {
    // Preserve the public library face's original click-only behavior.
    svg.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const sourceId = target.closest('[data-source-id]')?.getAttribute('data-source-id');
      if (sourceId) onSourceClick(sourceId, event);
    });
  }

  return svg;
}

// ---------- Per-primitive emit ----------

/** One element: the tag, its attributes in order, its text, an optional
 *  `<title>` child, and — last, as the old emitter set it last — opacity. */
function element(
  name: string,
  attrs: string,
  text: string,
  p: Primitive
): string {
  const title = p.title ? `<title>${escapeXml(p.title)}</title>` : '';
  const opacity = p.opacity !== undefined ? ` opacity="${p.opacity}"` : '';
  return `<${name}${attrs}${opacity}>${text}${title}</${name}>`;
}

/** The identity attributes every primitive may carry, in the order the old
 *  emitter set them. */
function identity(p: Primitive): string {
  let out = '';
  if (p.className) out += ` class="${escapeXml(p.className)}"`;
  if (p.sourceId) out += ` data-source-id="${escapeXml(p.sourceId)}"`;
  if (p.writtenSourceId !== undefined) out += ` data-written-source-id="${escapeXml(p.writtenSourceId)}"`;
  return out;
}

function emitPrimitive(p: Primitive, kx: number, ky: number): string {
  switch (p.kind) {
    case 'glyph': return emitGlyph(p, kx, ky);
    case 'line':  return emitLine(p, kx, ky);
    case 'curve': return emitCurve(p, kx, ky);
    case 'text':  return emitText(p, kx, ky);
    case 'rect':  return emitRect(p, kx, ky);
  }
}

/**
 * A primitive's drawn x: the musical position on the horizontal scale plus the
 * ink offset on the vertical one (see `PrimitiveBase`).
 *
 * Written as `(x + dx·ratio)·kx` rather than `x·kx + dx·ky`, which is the same
 * number in exact arithmetic but NOT the same float. The layouts used to do
 * this subtraction in staff spaces and multiply once, so associating it the
 * same way keeps every committed golden byte-identical: at a square scale the
 * ratio is exactly 1 and this reduces to the arithmetic that produced them.
 */
function drawnX(x: number, dx: number | undefined, kx: number, ky: number): number {
  return dx === undefined ? x * kx : (x + dx * (ky / kx)) * kx;
}

function emitGlyph(p: GlyphPrim, kx: number, ky: number): string {
  // Position on the horizontal scale, ink offset on the vertical one — the
  // two currencies of `PrimitiveBase`. The font and the fill are the kind's
  // defaults; `start` and `alphabetic` are SVG's own initial values (`auto`
  // is alphabetic for horizontal text), so only the others are written.
  let attrs =
    ` x="${n(drawnX(p.x, p.dx, kx, ky))}" y="${n(p.y * ky)}"` +
    ` font-size="${n(4 * ky * (p.scale ?? 1))}"` +
    textPlacement(p.anchor, p.baseline);
  if (p.fill !== undefined && p.fill !== 'currentColor') attrs += ` style="fill:${escapeXml(p.fill)}"`;
  return element('text', attrs + identity(p), glyphCodepoint(p.glyph), p);
}

function emitLine(p: LinePrim, kx: number, ky: number): string {
  let attrs =
    ` x1="${n(drawnX(p.x1, p.dx1, kx, ky))}" y1="${n(p.y1 * ky)}"` +
    ` x2="${n(drawnX(p.x2, p.dx2, kx, ky))}" y2="${n(p.y2 * ky)}"` +
    ` stroke-width="${n(inkWidth(p.thickness, ky))}"` +
    strokeException(p.stroke);
  if (p.dash) attrs += ` stroke-dasharray="${n(p.dash * ky)},${n(p.dash * ky)}"`;
  return element('line', attrs + identity(p), '', p);
}

/** Endpoint width of tapered curves (Bravura's slur/tie endpoint default). */
const CURVE_END_THICKNESS_SP = 0.1;

function emitCurve(p: CurvePrim, kx: number, ky: number): string {
  const [p0, p1, p2, p3] = p.points;
  const X = (pt: Point) => n(pt.x * kx);
  const Y = (pt: Point) => n(pt.y * ky);
  if (!p.taper) {
    const d = `M ${X(p0)} ${Y(p0)} C ${X(p1)} ${Y(p1)}, ${X(p2)} ${Y(p2)}, ${X(p3)} ${Y(p3)}`;
    const attrs =
      ` d="${d}" fill="none" stroke-width="${n(inkWidth(p.thickness, ky))}"` +
      strokeException(p.stroke) +
      identity(p);
    return element('path', attrs, '', p);
  }

  // Tapered body: fill between the spine's control points shifted to either
  // side along the chord normal. Shifting both controls by s moves the curve
  // midpoint by 0.75·s, so the two offset curves sit `thickness − end` apart
  // at mid-curve; the stroke supplies the remaining endpoint width.
  // Measured in PIXELS, not staff spaces: under a non-square scale the chord's
  // direction — and so its normal — is a property of the drawn curve, not of
  // the sp-space one. At kx === ky both scales cancel and this is the same
  // normal the uniform math produced, to the last digit.
  const px = (pt: Point) => pt.x * kx;
  const py = (pt: Point) => pt.y * ky;
  const dx = px(p3) - px(p0), dy = py(p3) - py(p0);
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len, ny = dx / len;
  // Point the normal toward the bulge (the control points' side of the chord).
  if ((px(p1) - px(p0)) * nx + (py(p1) - py(p0)) * ny < 0) { nx = -nx; ny = -ny; }
  const s = (Math.max(0, p.thickness - CURVE_END_THICKNESS_SP) * ky) / 1.5;
  const c = (pt: Point, sign: number) => `${n(px(pt) + sign * nx * s)} ${n(py(pt) + sign * ny * s)}`;
  const d =
    `M ${X(p0)} ${Y(p0)} C ${c(p1, 1)}, ${c(p2, 1)}, ${X(p3)} ${Y(p3)} ` +
    `C ${c(p2, -1)}, ${c(p1, -1)}, ${X(p0)} ${Y(p0)} Z`;
  // The body is filled in the stroke's colour: the attribute is kept here
  // because a path's fill has no kind default (an open curve is unfilled).
  const attrs =
    ` d="${d}" fill="${escapeXml(p.stroke ?? 'currentColor')}"` +
    ` stroke-width="${n(inkWidth(CURVE_END_THICKNESS_SP, ky))}" stroke-linejoin="round"` +
    strokeException(p.stroke) +
    identity(p);
  return element('path', attrs, '', p);
}

function emitText(p: TextPrim, kx: number, ky: number): string {
  // Body text is the exception to the glyph font, so it says so inline
  // (see KIND_DEFAULTS for why an attribute could not).
  let style = `font-family:${FONT_FAMILY_BODY}`;
  if (p.fill !== undefined && p.fill !== 'currentColor') style += `;fill:${escapeXml(p.fill)}`;
  let attrs =
    ` x="${n(drawnX(p.x, p.dx, kx, ky))}" y="${n(p.y * ky)}"` +
    ` font-size="${n(p.size * ky)}"` +
    textPlacement(p.anchor, p.baseline);
  if (p.font === 'bodyItalic') attrs += ` font-style="italic"`;
  if (p.weight !== undefined) attrs += ` font-weight="${p.weight}"`;
  attrs += ` style="${style}"`;
  return element('text', attrs + identity(p), escapeXml(p.text), p);
}

function emitRect(p: RectPrim, kx: number, ky: number): string {
  let attrs =
    ` x="${n(drawnX(p.x, p.dx, kx, ky))}" y="${n(p.y * ky)}"` +
    ` width="${n(p.w * (p.spanW ? kx : ky))}" height="${n(p.h * ky)}"` +
    ` fill="${escapeXml(p.fill ?? 'none')}"`;
  if (p.radius !== undefined) attrs += ` rx="${n(p.radius * ky)}" ry="${n(p.radius * ky)}"`;
  if (p.spanEndX !== undefined) attrs += ` data-span-end="${n(drawnX(p.spanEndX, p.spanEndDx, kx, ky))}"`;
  if (p.stroke) {
    // A zero thickness means "no border" and stays that way — the floor
    // makes a hairline legible, it does not invent one.
    attrs += ` stroke="${escapeXml(p.stroke)}" stroke-width="${p.thickness ? n(inkWidth(p.thickness, ky)) : 0}"`;
  }
  return element('rect', attrs + identity(p), '', p);
}

// ---------- Attribute helpers ----------

/** Anchor and baseline, only when they differ from SVG's initial values. */
function textPlacement(
  anchor: 'start' | 'middle' | 'end' | undefined,
  baseline: 'alphabetic' | 'middle' | 'central' | 'hanging' | undefined
): string {
  let out = '';
  if (anchor !== undefined && anchor !== 'start') out += ` text-anchor="${anchor}"`;
  if (baseline !== undefined && baseline !== 'alphabetic') out += ` dominant-baseline="${baseline}"`;
  return out;
}

/** A stroke other than the kind default, inline (see KIND_DEFAULTS). */
function strokeException(stroke: string | undefined): string {
  return stroke !== undefined && stroke !== 'currentColor' ? ` style="stroke:${escapeXml(stroke)}"` : '';
}

// ---------- Text helper ----------

/** The four characters markup cannot carry literally — the same four the
 *  golden serialiser escaped, so goldens and browser markup agree. */
function escapeXml(s: string): string {
  return s.replace(/[&<>"]/g, ch =>
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&quot;'
  );
}
