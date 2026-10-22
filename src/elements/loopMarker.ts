/**
 * The loop on the score (roadmap/inprogress/studio-player-practice.md; marker A on the Loop
 * practice canvas, 2026-10-22): a wash behind the loop's bars, a bracket over them that runs off
 * a system's end and picks up on the next, and a chip at its start naming it — or, during a
 * count-in, counting it. Drawn from the rendered SVG's own geometry after the engine is done, as
 * the selection's enclosure is (enclosure.ts), so the renderer never learns about playback.
 */
import { assignSystems, collectBarlines, collectStaves, collectSystemBands, measureBoundaries, unitsPerSp } from './scoreGeometry.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface LoopMarker {
  /** The bars the wash covers, as the rows of the drawn page number them. */
  measures: readonly number[];
  /** The bar the loop starts in (its chip and start tick) and ends in (its end tick). */
  start: number;
  end: number;
  label: string;
}

const element = <K extends keyof SVGElementTagNameMap>(name: K, attributes: Record<string, string | number>) => {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
};

/** Draw `loop` on `svg`, whose systems hold `rows` (measure numbers per system, top to bottom); null clears it. */
export function drawLoopMarker(svg: SVGSVGElement, loop: LoopMarker | null, rows: readonly (readonly number[])[] | null): void {
  for (const layer of svg.querySelectorAll(':scope > g.loop-wash-layer, :scope > g.loop-marker')) layer.remove();
  if (!loop || !rows?.length || !loop.measures.length) return;
  const sp = unitsPerSp(svg);
  const barlines = collectBarlines(svg);
  const systems = collectSystemBands(assignSystems(collectStaves(svg, sp), barlines));
  const wanted = new Set(loop.measures);
  const wash = element('g', { class: 'loop-wash-layer', 'aria-hidden': 'true' });
  const marks = element('g', { class: 'loop-marker', 'aria-hidden': 'true' });
  systems.forEach((system, row) => {
    const measures = rows[row];
    if (!measures?.length) return;
    const xs = measureBoundaries(system, barlines, measures.length, sp);
    for (let i = 0; i < measures.length; i++) {
      if (!wanted.has(measures[i]!)) continue;
      let j = i;
      while (j + 1 < measures.length && wanted.has(measures[j + 1]!)) j++;
      const x0 = xs[i]!, x1 = xs[j + 1]!, y = system.top - 3 * sp;
      wash.appendChild(element('rect', { class: 'loop-wash', x: x0, y: y + 0.6 * sp, width: x1 - x0, height: system.bottom + sp - (y + 0.6 * sp) }));
      marks.appendChild(element('line', { class: 'loop-bracket', x1: x0, y1: y, x2: x1, y2: y, 'stroke-width': 0.25 * sp }));
      if (measures[i] === loop.start) {
        marks.appendChild(element('line', { class: 'loop-bracket', x1: x0, y1: y, x2: x0, y2: y + 2 * sp, 'stroke-width': 0.25 * sp }));
        const chip = element('g', { class: 'loop-chip' });
        const text = element('text', { x: x0 + 0.9 * sp, y, 'font-size': 1.3 * sp, 'dominant-baseline': 'central' });
        text.textContent = loop.label;
        chip.append(element('rect', { x: x0 + 0.35 * sp, y: y - 1.1 * sp, width: (loop.label.length * 0.68 + 1.1) * sp, height: 2.2 * sp, rx: 0.2 * sp }), text);
        marks.appendChild(chip);
      }
      if (measures[j] === loop.end)
        marks.appendChild(element('line', { class: 'loop-bracket', x1: x1, y1: y, x2: x1, y2: y + 2 * sp, 'stroke-width': 0.25 * sp }));
      else if (j === measures.length - 1)
        marks.appendChild(element('path', { class: 'loop-continues', d: `M${x1 - 0.2 * sp} ${y - 0.7 * sp}L${x1 + 0.8 * sp} ${y}L${x1 - 0.2 * sp} ${y + 0.7 * sp}Z` }));
      i = j;
    }
  });
  if (wash.childElementCount) svg.insertBefore(wash, svg.firstChild);
  if (marks.childElementCount) svg.appendChild(marks);
  // The chip fits its words, measured once they are drawn.
  for (const chip of marks.querySelectorAll<SVGGElement>('.loop-chip')) {
    const width = chip.querySelector('text')?.getComputedTextLength?.() ?? 0;
    if (width > 0) chip.querySelector('rect')?.setAttribute('width', String(width + 1.1 * sp));
  }
}
