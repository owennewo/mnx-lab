import type { Primitive } from '../primitives.ts';
import type { MeasurePlan } from './spacing.ts';

/** The same H-bar and count on notation and tab staves. */
export function emitMultirest(m: MeasurePlan, staffTops: readonly number[], primitives: Primitive[]): void {
  if (m.multiRest) {
      const x1 = m.contentStartX + 0.6;
      const x2 = m.x + m.width - 1.0;
      for (const top of staffTops) {
        primitives.push({
          kind: 'rect',
          x: x1, y: top + 1.5, w: x2 - x1, h: 1,
          // The bar spans the measure: its width is x2 − x1, so it has to
          // scale with x or it would stop meeting its own end caps.
          spanW: true,
          fill: 'currentColor',
          className: 'multirest-bar'
        });
        for (const xe of [x1, x2]) {
          primitives.push({
            kind: 'line',
            x1: xe, y1: top + 1, x2: xe, y2: top + 3,
            thickness: 0.25,
            className: 'multirest-cap'
          });
        }
        const digits = String(m.multiRest).split('');
        digits.forEach((d, di) => {
          primitives.push({
            kind: 'glyph',
            glyph: 'timeSig' + d,
            x: (x1 + x2) / 2 + (di - (digits.length - 1) / 2) * 1.9,
            y: top - 0.8,
            anchor: 'middle',
            className: 'multirest-count'
          });
        });
      }
    }
}
