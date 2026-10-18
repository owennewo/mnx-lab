/** Forgiving pointer targets without changing the engraving or the exported SVG. */
const NOTES = '.notehead[data-source-id], .fret-number[data-source-id]';

export function noteTargetAt(
  event: MouseEvent,
  svg: SVGSVGElement,
  index: ReadonlyMap<string, unknown>
): Element | null {
  const direct = event.target instanceof Element ? event.target.closest('[data-source-id]') : null;
  // Keyboard/synthetic activation retains its exact target. Resolve physical
  // clicks too: a compatibility click must agree with its pointerdown.
  if (!(event instanceof PointerEvent) || !event.pointerType) return direct;
  if (direct?.classList.contains('rest')) return direct;
  const radius = event.pointerType === 'touch' ? 22 : 6;
  let nearest: Element | null = null;
  let best = Infinity;
  for (const element of svg.querySelectorAll<SVGGraphicsElement>(NOTES)) {
    if (!index.has(element.getAttribute('data-source-id') ?? '') || element.classList.contains('unperformed')) continue;
    const matrix = element.getScreenCTM();
    if (!matrix) continue;
    const box = element.getBBox();
    // A music glyph's DOM box is its whole font em. Its y anchor,
    // like a centrally aligned fret digit's, is the note's actual centre.
    const y = Number(element.getAttribute('y'));
    const centre = new DOMPoint(box.x + box.width / 2, y).matrixTransform(matrix);
    const distance = Math.hypot(event.clientX - centre.x, event.clientY - centre.y);
    // Keep the ink itself clickable at large zoom, too.
    const halfWidth = box.width * Math.hypot(matrix.a, matrix.b) / 2;
    const fontSize = Number(element.getAttribute('font-size')) || 0;
    const halfHeight = fontSize * Math.hypot(matrix.c, matrix.d) / 5;
    const onInk = Math.abs(event.clientX - centre.x) <= halfWidth
      && Math.abs(event.clientY - centre.y) <= halfHeight;
    if ((distance <= radius || onInk) && distance < best) {
      nearest = element;
      best = distance;
    }
  }
  // Preserve activation of other source-bearing ink (for library callers).
  return nearest ?? direct;
}
