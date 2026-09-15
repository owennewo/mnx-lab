/**
 * A render in two halves: the PLAN, which is pure and DOM-free (layout, fit,
 * crop — everything up to the markup), and the EMIT, which needs a document.
 *
 * Every renderer used to do both in one call and still can (`renderMnxToSvgX`
 * is `emitPlan(planX(opts))`). The seam exists for the zoom gesture: the plan
 * is where the time goes (~170ms of layout on a 61-bar score against ~25ms
 * of browser paint), it is DOM-free by the `engine/headless.ts` guarantee, so
 * it can run in a worker while the main thread keeps the finger and the
 * readout responsive — `src/elements/layout.worker.ts`. A plan crosses
 * `postMessage` by structured clone: plain data and a Map, nothing else.
 */
import type { Primitive, SourceLocation } from '../primitives.ts';
import { renderSvg } from './svg.ts';
import { projectionForSourceClass, type RenderedProjection } from './projection.ts';
import type { RenderOutcome } from './scale.ts';

export interface RenderPlan {
  primitives: Primitive[];
  widthSp: number;
  heightSp: number;
  pxPerSp: number;
  pxPerSpY: number;
  viewBoxSp?: { x: number; y: number; w: number; h: number };
  className: string;
  /** Where each source id sits, for the click that becomes a selection. */
  index: Map<string, SourceLocation>;
  /** The projection a click reports — fixed for a standalone view; in the
   *  `both` view read from the ink's own class. */
  projection: 'notation' | 'tab' | 'both';
  /** What the render reports back to its host. */
  outcome: RenderOutcome;
}

export type NoteClickHandler = (
  noteId: string,
  measureIdx: number,
  noteIdx: number,
  projection: RenderedProjection
) => void;

/** Draw a plan into `container` and wire the click; returns the outcome. */
export function emitPlan(
  plan: RenderPlan,
  container: HTMLElement,
  onNoteClick?: NoteClickHandler
): RenderOutcome {
  renderSvg({
    container,
    primitives: plan.primitives,
    widthSp: plan.widthSp,
    heightSp: plan.heightSp,
    pxPerSp: plan.pxPerSp,
    pxPerSpY: plan.pxPerSpY,
    viewBoxSp: plan.viewBoxSp,
    className: plan.className,
    onSourceActivate: onNoteClick
      ? (sourceId, event) => {
          const loc = plan.index.get(sourceId);
          if (!loc) return;
          if (plan.projection !== 'both') {
            onNoteClick(sourceId, loc.measureIndex, loc.eventIndex, plan.projection);
            return;
          }
          const target = event.target instanceof Element
            ? event.target.closest('[data-source-id]')
            : null;
          if (target) {
            onNoteClick(
              sourceId,
              loc.measureIndex,
              loc.eventIndex,
              projectionForSourceClass(target.getAttribute('class') ?? '')
            );
          }
        }
      : undefined
  });
  return plan.outcome;
}
