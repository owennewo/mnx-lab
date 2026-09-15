// The SVG goldens: the real emitter's markup (src/engine/render/svg.ts), as a
// standalone document. The emitter builds text, so there is nothing to fake —
// this used to shim the DOM slice a node-building emitter touched and serialise
// the result, and the emitter now IS that serialisation, byte for byte.
import { renderSvgMarkup } from '../../src/engine/render/svg.ts';
import type { Primitive } from '../../src/engine/primitives.ts';

export interface SvgStringOptions {
  primitives: readonly Primitive[];
  widthSp: number;
  heightSp: number;
  pxPerSp: number;
  /** Vertical scale; defaults to `pxPerSp` (square), as the goldens are. */
  pxPerSpY?: number;
  viewBoxSp?: { x: number; y: number; w: number; h: number };
}

export function renderSvgToString(opts: SvgStringOptions): string {
  return renderSvgMarkup({ ...opts, xmlns: true });
}
