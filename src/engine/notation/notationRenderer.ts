import { layoutNotation } from '../layout/notation.ts';
import { emitPlan, type RenderPlan } from '../render/plan.ts';
import { commonLayoutArgs, planLayout, type RenderOptions } from '../render/planLayout.ts';
import type { RenderOutcome } from '../render/scale.ts';

export interface RenderNotationOptions extends RenderOptions {
  /** Events lit by the selection — how a REST is highlighted. */
  selectedEventIds?: string[];
}

/** The DOM-free half — see `render/plan.ts`. */
export type PlanNotationOptions = Omit<RenderNotationOptions, 'container' | 'onNoteClick'>;

export function renderMnxToSvgNotation(opts: RenderNotationOptions): RenderOutcome {
  return emitPlan(planNotation(opts), opts.container, opts.onNoteClick);
}

export function planNotation(opts: PlanNotationOptions): RenderPlan {
  return planLayout(opts, {
    ...commonLayoutArgs(opts),
    selectedEventIds: opts.selectedEventIds,
  }, layoutNotation, 'notation');
}
