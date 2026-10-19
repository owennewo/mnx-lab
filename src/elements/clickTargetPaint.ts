/**
 * Element click targets on a drawn page (roadmap/inprogress/core-editor-click-targets.md):
 * reading them off the SVG, and outlining one. The rules — which target a
 * point means, how far each answers, what a double press is — are DOM-free in
 * `engine/render/clickTargets.ts`.
 */
import { CLICKABLE_KINDS, type ClickTarget, type ClickableKind } from '../engine/render/clickTargets.ts';
import { inkBox, union, type Box } from './scoreGeometry.ts';

const LYRIC_INK = '.lyric[data-playback-id][data-lyric-line], .lyric-gap[data-playback-id][data-lyric-line]';

/** Every clickable piece of ink on the page. Measured once per paint, with the pointer map. */
export function collectClickTargets(svg: SVGSVGElement, sp: number): ClickTarget[] {
  const targets: ClickTarget[] = [];
  for (const el of svg.querySelectorAll<SVGGraphicsElement>(LYRIC_INK)) {
    if (el.classList.contains('unperformed')) continue;
    const noteKey = el.getAttribute('data-playback-id')!;
    const lyricLine = el.getAttribute('data-lyric-line')!;
    targets.push({ key: `lyric:${lyricLine}:${noteKey}`, kind: 'lyric', box: inkBox(el, sp), noteKey, lyricLine });
  }
  for (const el of svg.querySelectorAll<SVGGraphicsElement>('[data-element][data-measure]')) {
    const kind = el.getAttribute('data-element') as ClickableKind;
    const measureIndex = Number(el.getAttribute('data-measure'));
    if (!(CLICKABLE_KINDS as readonly string[]).includes(kind) || !Number.isSafeInteger(measureIndex)) continue;
    targets.push({ key: `${kind}:${measureIndex}`, kind, box: inkBox(el, sp), measureIndex });
  }
  return targets;
}

/**
 * Outline one element's ink — every piece sharing `key` — in its own layer.
 * The hover (`element-hover`) and the selected element (`element-focus`) use
 * the same shape so the press visibly keeps what the hover promised.
 */
export function drawTargetOutline(
  svg: SVGSVGElement,
  targets: readonly ClickTarget[],
  key: string | null | undefined,
  layer: 'element-hover' | 'element-focus',
  sp: number
): void {
  svg.querySelector(`:scope > g.${layer}`)?.remove();
  if (!key) return;
  const pieces = targets.filter(target => target.key === key);
  if (pieces.length === 0) return;
  const group = svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('class', layer);
  // Pieces within a staff space of each other become one outline.
  for (const box of mergeNear(pieces.map(piece => piece.box), sp)) {
    const pad = 0.3 * sp;
    const rect = svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(box.x - pad));
    rect.setAttribute('y', String(box.y - pad));
    rect.setAttribute('width', String(box.w + 2 * pad));
    rect.setAttribute('height', String(box.h + 2 * pad));
    rect.setAttribute('rx', String(0.3 * sp));
    rect.setAttribute('stroke-width', String(0.12 * sp));
    group.appendChild(rect);
  }
  svg.appendChild(group);
}

/** Boxes within a staff space of each other become one. */
function mergeNear(boxes: Box[], sp: number): Box[] {
  const out: Box[] = [];
  for (const box of [...boxes].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const near = out.findIndex(other =>
      box.x <= other.x + other.w + sp && other.x <= box.x + box.w + sp &&
      box.y <= other.y + other.h + sp && other.y <= box.y + box.h + sp);
    if (near < 0) out.push(box);
    else out[near] = union([out[near]!, box]);
  }
  return out;
}
