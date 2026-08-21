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
 * correctness: at 60% a tab staff line and a tab barline are both 0.1sp × 6px
 * = **0.60px**, which a renderer can only draw as a smear of grey. The
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
 * close on each other — but at the bottom of the supported staff range (60%)
 * the double barline still keeps 0.8px of clear space, and the two would only
 * meet below ~33%, which `MIN_STAFF_SCALE` does not reach.
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
   * caller but the staff-scale one wants.
   *
   * The two are separable because the score's axes answer different questions:
   * horizontal position is a musical decision (the spacing plan), vertical
   * extent is a legibility one (how big is the ink). Staff scale moves the
   * second without disturbing the first — see `staffScale` on the renderers.
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

export function renderSvg(opts: RenderSvgOptions): SVGSVGElement {
  const {
    container,
    primitives,
    widthSp,
    heightSp,
    pxPerSp,
    viewBoxSp,
    className,
    onSourceActivate,
    onSourceClick
  } = opts;
  const pxPerSpY = opts.pxPerSpY ?? pxPerSp;

  container.innerHTML = '';

  const view = viewBoxSp ?? { x: 0, y: 0, w: widthSp, h: heightSp };
  const widthPx = view.w * pxPerSp;
  const heightPx = view.h * pxPerSpY;

  const svg = el('svg', {
    width: widthPx,
    height: heightPx,
    viewBox: `${view.x * pxPerSp} ${view.y * pxPerSpY} ${widthPx} ${heightPx}`
  }) as SVGSVGElement;
  if (className) svg.setAttribute('class', className);

  for (const p of primitives) {
    svg.appendChild(emitPrimitive(p, pxPerSp, pxPerSpY));
  }

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

  container.appendChild(svg);
  return svg;
}

// ---------- Per-primitive emit ----------

function emitPrimitive(p: Primitive, kx: number, ky: number): SVGElement {
  const node = (() => {
    switch (p.kind) {
      case 'glyph': return emitGlyph(p, kx, ky);
      case 'line':  return emitLine(p, kx, ky);
      case 'curve': return emitCurve(p, kx, ky);
      case 'text':  return emitText(p, kx, ky);
      case 'rect':  return emitRect(p, kx, ky);
    }
  })();
  if (p.title) {
    const title = el('title', {});
    title.textContent = p.title;
    node.appendChild(title);
  }
  return node;
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

function emitGlyph(p: GlyphPrim, kx: number, ky: number): SVGElement {
  const node = el('text', {
    // Position on the horizontal scale, ink offset on the vertical one — the
    // two currencies of `PrimitiveBase`.
    x: drawnX(p.x, p.dx, kx, ky),
    y: p.y * ky,
    'font-family': FONT_FAMILY_MUSIC,
    'font-size': 4 * ky * (p.scale ?? 1),
    'text-anchor': p.anchor ?? 'start',
    'dominant-baseline': p.baseline ?? 'alphabetic',
    fill: p.fill ?? 'currentColor'
  });
  if (p.className) node.setAttribute('class', p.className);
  if (p.sourceId) node.setAttribute('data-source-id', p.sourceId);
  node.textContent = glyphCodepoint(p.glyph);
  return node;
}

function emitLine(p: LinePrim, kx: number, ky: number): SVGElement {
  const node = el('line', {
    x1: drawnX(p.x1, p.dx1, kx, ky),
    y1: p.y1 * ky,
    x2: drawnX(p.x2, p.dx2, kx, ky),
    y2: p.y2 * ky,
    stroke: p.stroke ?? 'currentColor',
    'stroke-width': inkWidth(p.thickness, ky)
  });
  if (p.dash) node.setAttribute('stroke-dasharray', `${p.dash * ky},${p.dash * ky}`);
  if (p.className) node.setAttribute('class', p.className);
  if (p.sourceId) node.setAttribute('data-source-id', p.sourceId);
  return node;
}

/** Endpoint width of tapered curves (Bravura's slur/tie endpoint default). */
const CURVE_END_THICKNESS_SP = 0.1;

function emitCurve(p: CurvePrim, kx: number, ky: number): SVGElement {
  const [p0, p1, p2, p3] = p.points;
  const X = (pt: Point) => pt.x * kx;
  const Y = (pt: Point) => pt.y * ky;
  if (!p.taper) {
    const d = `M ${X(p0)} ${Y(p0)} C ${X(p1)} ${Y(p1)}, ${X(p2)} ${Y(p2)}, ${X(p3)} ${Y(p3)}`;
    const node = el('path', {
      d,
      fill: 'none',
      stroke: p.stroke ?? 'currentColor',
      'stroke-width': inkWidth(p.thickness, ky)
    });
    if (p.className) node.setAttribute('class', p.className);
    if (p.sourceId) node.setAttribute('data-source-id', p.sourceId);
    return node;
  }

  // Tapered body: fill between the spine's control points shifted to either
  // side along the chord normal. Shifting both controls by s moves the curve
  // midpoint by 0.75·s, so the two offset curves sit `thickness − end` apart
  // at mid-curve; the stroke supplies the remaining endpoint width.
  // Measured in PIXELS, not staff spaces: under a non-square scale the chord's
  // direction — and so its normal — is a property of the drawn curve, not of
  // the sp-space one. At kx === ky both scales cancel and this is the same
  // normal the uniform math produced, to the last digit.
  const dx = X(p3) - X(p0), dy = Y(p3) - Y(p0);
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len, ny = dx / len;
  // Point the normal toward the bulge (the control points' side of the chord).
  if ((X(p1) - X(p0)) * nx + (Y(p1) - Y(p0)) * ny < 0) { nx = -nx; ny = -ny; }
  const s = (Math.max(0, p.thickness - CURVE_END_THICKNESS_SP) * ky) / 1.5;
  const c = (pt: Point, sign: number) => `${(X(pt) + sign * nx * s)} ${(Y(pt) + sign * ny * s)}`;
  const d =
    `M ${X(p0)} ${Y(p0)} C ${c(p1, 1)}, ${c(p2, 1)}, ${X(p3)} ${Y(p3)} ` +
    `C ${c(p2, -1)}, ${c(p1, -1)}, ${X(p0)} ${Y(p0)} Z`;
  const node = el('path', {
    d,
    fill: p.stroke ?? 'currentColor',
    stroke: p.stroke ?? 'currentColor',
    'stroke-width': inkWidth(CURVE_END_THICKNESS_SP, ky),
    'stroke-linejoin': 'round'
  });
  if (p.className) node.setAttribute('class', p.className);
  if (p.sourceId) node.setAttribute('data-source-id', p.sourceId);
  return node;
}

function emitText(p: TextPrim, kx: number, ky: number): SVGElement {
  const family = p.font === 'bodyItalic' ? FONT_FAMILY_BODY : FONT_FAMILY_BODY;
  const node = el('text', {
    x: drawnX(p.x, p.dx, kx, ky),
    y: p.y * ky,
    'font-family': family,
    'font-size': p.size * ky,
    'text-anchor': p.anchor ?? 'start',
    'dominant-baseline': p.baseline ?? 'alphabetic',
    fill: p.fill ?? 'currentColor'
  });
  if (p.font === 'bodyItalic') node.setAttribute('font-style', 'italic');
  if (p.weight !== undefined) node.setAttribute('font-weight', String(p.weight));
  if (p.className) node.setAttribute('class', p.className);
  if (p.sourceId) node.setAttribute('data-source-id', p.sourceId);
  node.textContent = p.text;
  return node;
}

function emitRect(p: RectPrim, kx: number, ky: number): SVGElement {
  const attrs: Record<string, string | number> = {
    x: drawnX(p.x, p.dx, kx, ky),
    y: p.y * ky,
    width: p.w * (p.spanW ? kx : ky),
    height: p.h * ky,
    fill: p.fill ?? 'none'
  };
  if (p.radius !== undefined) {
    attrs.rx = p.radius * ky;
    attrs.ry = p.radius * ky;
  }
  if (p.stroke) {
    attrs.stroke = p.stroke;
    // A zero thickness means "no border" and stays that way — the floor
    // makes a hairline legible, it does not invent one.
    attrs['stroke-width'] = p.thickness ? inkWidth(p.thickness, ky) : 0;
  }
  const node = el('rect', attrs);
  if (p.className) node.setAttribute('class', p.className);
  if (p.sourceId) node.setAttribute('data-source-id', p.sourceId);
  return node;
}

// ---------- DOM helper ----------

function el(name: string, attrs: Record<string, string | number>): SVGElement {
  const e = document.createElementNS(SVG_NS, name) as SVGElement;
  for (const [k, v] of Object.entries(attrs)) {
    e.setAttribute(k, String(v));
  }
  return e;
}
