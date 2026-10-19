/**
 * The selection, painted onto a drawn score — the viewer's half of
 * `engine/layout/selectionHooks.ts`. The layout marked every piece of ink the
 * selection could colour with the ids that select it (`data-selects`) and the
 * style properties a lit one takes (`data-select-paint`, where `class` means the
 * `selected` class); this lights the ink
 * whose ids the selection names and puts the rest back, so a cursor move costs
 * a repaint of the ink that changed rather than a layout of the whole score.
 *
 * The rule is the layout's own, read off the drawing: ink is lit when any of
 * its ids is selected — `n:<note key>` from the selected notes, `e:<event key>`
 * from the selected events. The colour is the layouts' selection colour.
 */
const SELECTED_COLOR = 'oklch(0.7 0.15 190)';

interface PaintedPage {
  /** Ink by the id that lights it, built on first paint of this drawing. */
  byId: Map<string, SVGElement[]>;
  /** What the last paint lit, to put back. */
  lit: Set<SVGElement>;
}

const pages = new WeakMap<SVGSVGElement, PaintedPage>();

function pageOf(svg: SVGSVGElement): PaintedPage {
  let page = pages.get(svg);
  if (page) return page;
  const byId = new Map<string, SVGElement[]>();
  for (const ink of svg.querySelectorAll<SVGElement>('[data-selects]')) {
    for (const id of JSON.parse(ink.getAttribute('data-selects') ?? '[]') as string[]) {
      const list = byId.get(id);
      if (list) list.push(ink);
      else byId.set(id, [ink]);
    }
  }
  pages.set(svg, page = { byId, lit: new Set() });
  return page;
}

function light(ink: SVGElement, on: boolean) {
  for (const property of (ink.getAttribute('data-select-paint') ?? '').split(' ')) {
    if (!property) continue;
    if (property === 'class') {
      ink.classList.toggle('selected', on);
      // The echo is a kind of lit: put out, the ink is plain again.
      if (!on) ink.classList.remove('selection-echo');
      continue;
    }
    if (on) ink.style.setProperty(property, SELECTED_COLOR);
    else ink.style.removeProperty(property);
  }
}

/** Light the ink `noteIds` and `eventIds` select in `svg`, and only that. */
export function paintSelection(
  svg: SVGSVGElement,
  noteIds: readonly string[] = [],
  eventIds: readonly string[] = []
): void {
  const page = pageOf(svg);
  const next = new Set<SVGElement>();
  for (const id of noteIds) for (const ink of page.byId.get(`n:${id}`) ?? []) next.add(ink);
  for (const id of eventIds) for (const ink of page.byId.get(`e:${id}`) ?? []) next.add(ink);
  for (const ink of page.lit) if (!next.has(ink)) light(ink, false);
  for (const ink of next) if (!page.lit.has(ink)) light(ink, true);
  page.lit = next;
}
