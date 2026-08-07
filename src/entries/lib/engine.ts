// mnx-lab/engine — the layout + SVG pipeline, importable from Node
// (no DOM at module top level; see src/engine/headless.ts).
export { layoutNotation } from '../../engine/layout/notation.ts';
export { layoutTab } from '../../engine/layout/tab.ts';
export { layoutBothSystem } from '../../engine/layout/bothSystem.ts';
export {
  ensureSmufl,
  computePrimitives,
  rounded,
  type RenderedSystem,
  type ScenarioPrimitives
} from '../../engine/headless.ts';
export { renderSvg, fitPxPerSp, type RenderSvgOptions } from '../../engine/render/svg.ts';
export { computeBoundsSp, type BoundsSp } from '../../engine/render/bounds.ts';
export { setSmuflData, loadSmufl, isSmuflLoaded } from '../../engine/smufl/smufl.ts';
export type { Primitive, LayoutResult } from '../../engine/primitives.ts';
