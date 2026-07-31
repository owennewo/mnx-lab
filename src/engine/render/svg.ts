import { Point, Primitive, GlyphPrim, LinePrim, CurvePrim, TextPrim, RectPrim } from '../primitives.ts';
import { glyphCodepoint } from '../smufl/smufl.ts';

/**
 * Walks a primitive list and emits SVG. Knows nothing about music — primitives
 * carry everything the renderer needs (coordinates in sp, SMuFL glyph names,
 * optional sourceId for hit-testing).
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

const FONT_FAMILY_BODY = 'var(--font-family-sans)';
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
  pxPerSp: number;
  /**
   * Optional crop: the visible window in sp (e.g. from computeBoundsSp in
   * bounds.ts). Defaults to the full 0,0 → widthSp,heightSp canvas.
   */
  viewBoxSp?: { x: number; y: number; w: number; h: number };
  /** CSS class added to the root <svg>. */
  className?: string;
  /**
   * Fires when the user clicks any element with a sourceId. Implemented with
   * event delegation on the root <svg>, so callers don't pay per-element
   * listener cost.
   */
  onSourceClick?: (sourceId: string, event: MouseEvent) => void;
}

export function renderSvg(opts: RenderSvgOptions): SVGSVGElement {
  const { container, primitives, widthSp, heightSp, pxPerSp, viewBoxSp, className, onSourceClick } = opts;

  container.innerHTML = '';

  const view = viewBoxSp ?? { x: 0, y: 0, w: widthSp, h: heightSp };
  const widthPx = view.w * pxPerSp;
  const heightPx = view.h * pxPerSp;

  const svg = el('svg', {
    width: widthPx,
    height: heightPx,
    viewBox: `${view.x * pxPerSp} ${view.y * pxPerSp} ${widthPx} ${heightPx}`
  }) as SVGSVGElement;
  if (className) svg.setAttribute('class', className);

  for (const p of primitives) {
    svg.appendChild(emitPrimitive(p, pxPerSp));
  }

  if (onSourceClick) {
    svg.addEventListener('click', e => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const sourced = target.closest('[data-source-id]');
      if (!sourced) return;
      const sid = sourced.getAttribute('data-source-id');
      if (sid) onSourceClick(sid, e);
    });
  }

  container.appendChild(svg);
  return svg;
}

// ---------- Per-primitive emit ----------

function emitPrimitive(p: Primitive, pxPerSp: number): SVGElement {
  const node = (() => {
    switch (p.kind) {
      case 'glyph': return emitGlyph(p, pxPerSp);
      case 'line':  return emitLine(p, pxPerSp);
      case 'curve': return emitCurve(p, pxPerSp);
      case 'text':  return emitText(p, pxPerSp);
      case 'rect':  return emitRect(p, pxPerSp);
    }
  })();
  if (p.title) {
    const title = el('title', {});
    title.textContent = p.title;
    node.appendChild(title);
  }
  return node;
}

function emitGlyph(p: GlyphPrim, k: number): SVGElement {
  const node = el('text', {
    x: p.x * k,
    y: p.y * k,
    'font-family': FONT_FAMILY_MUSIC,
    'font-size': 4 * k * (p.scale ?? 1),
    'text-anchor': p.anchor ?? 'start',
    'dominant-baseline': p.baseline ?? 'alphabetic',
    fill: p.fill ?? 'currentColor'
  });
  if (p.className) node.setAttribute('class', p.className);
  if (p.sourceId) node.setAttribute('data-source-id', p.sourceId);
  node.textContent = glyphCodepoint(p.glyph);
  return node;
}

function emitLine(p: LinePrim, k: number): SVGElement {
  const node = el('line', {
    x1: p.x1 * k,
    y1: p.y1 * k,
    x2: p.x2 * k,
    y2: p.y2 * k,
    stroke: p.stroke ?? 'currentColor',
    'stroke-width': p.thickness * k
  });
  if (p.dash) node.setAttribute('stroke-dasharray', `${p.dash * k},${p.dash * k}`);
  if (p.className) node.setAttribute('class', p.className);
  if (p.sourceId) node.setAttribute('data-source-id', p.sourceId);
  return node;
}

/** Endpoint width of tapered curves (Bravura's slur/tie endpoint default). */
const CURVE_END_THICKNESS_SP = 0.1;

function emitCurve(p: CurvePrim, k: number): SVGElement {
  const [p0, p1, p2, p3] = p.points;
  if (!p.taper) {
    const d = `M ${p0.x * k} ${p0.y * k} C ${p1.x * k} ${p1.y * k}, ${p2.x * k} ${p2.y * k}, ${p3.x * k} ${p3.y * k}`;
    const node = el('path', {
      d,
      fill: 'none',
      stroke: p.stroke ?? 'currentColor',
      'stroke-width': p.thickness * k
    });
    if (p.className) node.setAttribute('class', p.className);
    if (p.sourceId) node.setAttribute('data-source-id', p.sourceId);
    return node;
  }

  // Tapered body: fill between the spine's control points shifted to either
  // side along the chord normal. Shifting both controls by s moves the curve
  // midpoint by 0.75·s, so the two offset curves sit `thickness − end` apart
  // at mid-curve; the stroke supplies the remaining endpoint width.
  const dx = p3.x - p0.x, dy = p3.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len, ny = dx / len;
  // Point the normal toward the bulge (the control points' side of the chord).
  if ((p1.x - p0.x) * nx + (p1.y - p0.y) * ny < 0) { nx = -nx; ny = -ny; }
  const s = (Math.max(0, p.thickness - CURVE_END_THICKNESS_SP) * k) / 1.5;
  const c = (pt: Point, sign: number) => `${(pt.x * k + sign * nx * s)} ${(pt.y * k + sign * ny * s)}`;
  const d =
    `M ${p0.x * k} ${p0.y * k} C ${c(p1, 1)}, ${c(p2, 1)}, ${p3.x * k} ${p3.y * k} ` +
    `C ${c(p2, -1)}, ${c(p1, -1)}, ${p0.x * k} ${p0.y * k} Z`;
  const node = el('path', {
    d,
    fill: p.stroke ?? 'currentColor',
    stroke: p.stroke ?? 'currentColor',
    'stroke-width': CURVE_END_THICKNESS_SP * k,
    'stroke-linejoin': 'round'
  });
  if (p.className) node.setAttribute('class', p.className);
  if (p.sourceId) node.setAttribute('data-source-id', p.sourceId);
  return node;
}

function emitText(p: TextPrim, k: number): SVGElement {
  const family = p.font === 'bodyItalic' ? FONT_FAMILY_BODY : FONT_FAMILY_BODY;
  const node = el('text', {
    x: p.x * k,
    y: p.y * k,
    'font-family': family,
    'font-size': p.size * k,
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

function emitRect(p: RectPrim, k: number): SVGElement {
  const attrs: Record<string, string | number> = {
    x: p.x * k,
    y: p.y * k,
    width: p.w * k,
    height: p.h * k,
    fill: p.fill ?? 'none'
  };
  if (p.radius !== undefined) {
    attrs.rx = p.radius * k;
    attrs.ry = p.radius * k;
  }
  if (p.stroke) {
    attrs.stroke = p.stroke;
    attrs['stroke-width'] = (p.thickness ?? 0) * k;
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
