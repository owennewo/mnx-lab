import { layoutTab } from '../layout/tab.ts';
import { emitPlan, type RenderPlan } from '../render/plan.ts';
import { commonLayoutArgs, planLayout, type RenderOptions } from '../render/planLayout.ts';
import type { RenderOutcome } from '../render/scale.ts';
import type { PartTabSetups } from '../tab/guitarPositions.ts';

export interface RenderTabOptions extends RenderOptions {
  /** Viewer-supplied instrument; never written back to the document. */
  tabSetup?: PartTabSetups;
}

/** The DOM-free half — see `render/plan.ts`. */
export type PlanTabOptions = Omit<RenderTabOptions, 'container' | 'onNoteClick'>;

export function renderMnxToSvgTab(opts: RenderTabOptions): RenderOutcome {
  return emitPlan(planTab(opts), opts.container, opts.onNoteClick);
}

export function planTab(opts: PlanTabOptions): RenderPlan {
  return planLayout(opts, {
    ...commonLayoutArgs(opts),
    tabSetup: opts.tabSetup,
  }, layoutTab, 'tab');
}
