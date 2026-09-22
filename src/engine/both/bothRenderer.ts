import { layoutBothSystem } from '../layout/bothSystem.ts';
import { emitPlan, type RenderPlan } from '../render/plan.ts';
import { commonLayoutArgs, planLayout, type RenderOptions } from '../render/planLayout.ts';
import type { RenderOutcome } from '../render/scale.ts';
import type { PartTabSetups } from '../tab/guitarPositions.ts';

export interface RenderBothOptions extends RenderOptions {
  /** Events lit by the selection — how a REST is highlighted. */
  selectedEventIds?: string[];
  /** Viewer-supplied instrument; never written back to the document. */
  tabSetup?: PartTabSetups;
}

/** The DOM-free half — see `render/plan.ts`. */
export type PlanBothOptions = Omit<RenderBothOptions, 'container' | 'onNoteClick'>;

export function renderMnxToSvgBoth(opts: RenderBothOptions): RenderOutcome {
  return emitPlan(planBoth(opts), opts.container, opts.onNoteClick);
}

export function planBoth(opts: PlanBothOptions): RenderPlan {
  return planLayout(opts, {
    ...commonLayoutArgs(opts),
    selectedEventIds: opts.selectedEventIds,
    tabSetup: opts.tabSetup,
  }, layoutBothSystem, 'both');
}
