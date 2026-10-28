/**
 * The loop on the score (roadmap/inprogress/studio-player-practice.md; marker A on the Loop
 * practice canvas, 2026-10-22): a wash behind the loop's bars, a bracket over them that runs off
 * a system's end and picks up on the next, and a chip at its start naming it — or, during a
 * count-in, counting it. Drawn over the rendered SVG after the engine is done, against the
 * layout's own systems and bars (`RenderOutcome.geometry`), as the selection's enclosure is
 * (enclosure.ts), so the renderer never learns about playback.
 */
import type { PageGeometry } from '../engine/render/pageGeometry.ts';
import { unitsPerSp } from './scoreGeometry.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** The bracket's height over a system's top line: just clear of the bar numbers (their tops
 *  are 1.7 sp up), and low enough that the chip keeps out of the system above. */
const BRACKET_RISE_SP = 2;
const CHIP_HEIGHT_SP = 1.6;

export interface LoopMarker {
  /** The bars the wash covers, as the drawn page's bars number them (`PageBar.index`). */
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

/** Draw `loop` on `svg`, whose systems and bars `geometry` says; null clears it. */
export function drawLoopMarker(svg: SVGSVGElement, loop: LoopMarker | null, geometry: PageGeometry | null): void {
  for (const layer of svg.querySelectorAll(':scope > g.loop-wash-layer, :scope > g.loop-marker')) layer.remove();
  if (!loop || !geometry?.rows.length || !loop.measures.length) return;
  const sp = unitsPerSp(svg);
  const wanted = new Set(loop.measures);
  const numbers = [...svg.querySelectorAll<SVGTextElement>('text.measure-number')].map(text => text.getBBox?.()).filter(box => box && box.width > 0);
  const wash = element('g', { class: 'loop-wash-layer', 'aria-hidden': 'true' });
  const marks = element('g', { class: 'loop-marker', 'aria-hidden': 'true' });
  for (const system of geometry.rows) {
    const measures = system.bars.map(bar => bar.index);
    if (!measures.length) continue;
    const xs = [system.bars[0]!.x1, ...system.bars.map(bar => bar.x2)];
    for (let i = 0; i < measures.length; i++) {
      if (!wanted.has(measures[i]!)) continue;
      let j = i;
      while (j + 1 < measures.length && wanted.has(measures[j + 1]!)) j++;
      const x0 = xs[i]!, x1 = xs[j + 1]!, y = system.top - BRACKET_RISE_SP * sp;
      wash.appendChild(element('rect', { class: 'loop-wash', x: x0, y: y + 0.6 * sp, width: x1 - x0, height: system.bottom + sp - (y + 0.6 * sp) }));
      marks.appendChild(element('line', { class: 'loop-bracket', x1: x0, y1: y, x2: x1, y2: y, 'stroke-width': 0.25 * sp }));
      if (measures[i] === loop.start) {
        marks.appendChild(element('line', { class: 'loop-bracket', x1: x0, y1: y, x2: x0, y2: system.top, 'stroke-width': 0.25 * sp }));
        // The chip starts after the bar's number, which its lower half is level with.
        const number = numbers.find(box => box.x < x0 + sp && box.x + box.width > x0 - sp && box.y < system.top && box.y + box.height > y);
        const left = Math.max(x0 + 0.35 * sp, number ? number.x + number.width + 0.3 * sp : -Infinity);
        const chip = element('g', { class: 'loop-chip' });
        const text = element('text', { x: left + 0.5 * sp, y, 'font-size': 1.1 * sp, 'dominant-baseline': 'central' });
        text.textContent = loop.label;
        chip.append(element('rect', { x: left, y: y - CHIP_HEIGHT_SP / 2 * sp, width: (loop.label.length * 0.58 + 1) * sp, height: CHIP_HEIGHT_SP * sp, rx: 0.2 * sp }), text);
        marks.appendChild(chip);
      }
      if (measures[j] === loop.end)
        marks.appendChild(element('line', { class: 'loop-bracket', x1: x1, y1: y, x2: x1, y2: system.top, 'stroke-width': 0.25 * sp }));
      else if (j === measures.length - 1)
        marks.appendChild(element('path', { class: 'loop-continues', d: `M${x1 - 0.2 * sp} ${y - 0.7 * sp}L${x1 + 0.8 * sp} ${y}L${x1 - 0.2 * sp} ${y + 0.7 * sp}Z` }));
      i = j;
    }
  }
  if (wash.childElementCount) svg.insertBefore(wash, svg.firstChild);
  if (marks.childElementCount) svg.appendChild(marks);
  // The chip fits its words, measured once they are drawn.
  for (const chip of marks.querySelectorAll<SVGGElement>('.loop-chip')) {
    const width = chip.querySelector('text')?.getComputedTextLength?.() ?? 0;
    if (width > 0) chip.querySelector('rect')?.setAttribute('width', String(width + sp));
  }
}
