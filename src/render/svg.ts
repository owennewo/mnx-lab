import { Primitive, GlyphPrim, LinePrim, CurvePrim, TextPrim, RectPrim } from '../primitives.ts';
import { glyphCodepoint } from '../smufl/smufl.ts';

/**
 * Walks a primitive list and emits SVG. Knows nothing about music — primitives
 * carry everything the renderer needs (coordinates in sp, SMuFL glyph names,
 * optional sourceId for hit-testing).
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

const FONT_FAMILY_BODY = 'var(--font-family-sans)';
const FONT_FAMILY_MUSIC = 'Bravura';

export interface RenderSvgOptions {
  container: HTMLElement;
  primitives: readonly Primitive[];
  widthSp: number;
  heightSp: number;
  pxPerSp: number;
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
  const { container, primitives, widthSp, heightSp, pxPerSp, className, onSourceClick } = opts;

  container.innerHTML = '';

  const widthPx = widthSp * pxPerSp;
  const heightPx = heightSp * pxPerSp;

  const svg = el('svg', {
    width: widthPx,
    height: heightPx,
    viewBox: `0 0 ${widthPx} ${heightPx}`
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
  switch (p.kind) {
    case 'glyph': return emitGlyph(p, pxPerSp);
    case 'line':  return emitLine(p, pxPerSp);
    case 'curve': return emitCurve(p, pxPerSp);
    case 'text':  return emitText(p, pxPerSp);
    case 'rect':  return emitRect(p, pxPerSp);
  }
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
  if (p.className) node.setAttribute('class', p.className);
  if (p.sourceId) node.setAttribute('data-source-id', p.sourceId);
  return node;
}

function emitCurve(p: CurvePrim, k: number): SVGElement {
  const [p0, p1, p2, p3] = p.points;
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
