/**
 * The layout, off the main thread, for the length of a zoom gesture.
 *
 * `render/plan.ts` splits a render into a DOM-free plan and an emit. On a
 * 61-bar score the plan is ~170ms and the emit ~50ms, so with the plan here
 * the main thread spends a quarter of what it did on each step, and — the
 * part that matters on a slow tablet — never blocks: the finger, the readout
 * and the scroll keep responding while a plan is in flight, and the viewer
 * coalesces requests to latest-wins, so a plan that took too long is
 * followed by the one for where the fingers ARE, not by every step between.
 *
 * The document is posted once per gesture and referenced by every request
 * after it, which is what keeps its identity stable here so the square
 * layout memo (`render/layoutCache.ts`) can hit. A worker is never required:
 * the viewer falls back to painting on the main thread if this cannot be
 * constructed or throws, and every paint outside a gesture is on the main
 * thread as before.
 */
import { setSmuflData } from '../engine/smufl/smufl.ts';
import { planNotation, type PlanNotationOptions } from '../engine/notation/notationRenderer.ts';
import { planTab, type PlanTabOptions } from '../engine/tab/tabRenderer.ts';
import { planBoth, type PlanBothOptions } from '../engine/both/bothRenderer.ts';
import { engravingEntries } from '../engine/layout/unrolled.ts';
import { createLayoutCache } from '../engine/render/layoutCache.ts';
import type { RenderPlan } from '../engine/render/plan.ts';
import type { MnxPart, MnxStructure } from '../model/mnx.ts';
import type { PartTabSetups, TabSetup } from '../engine/tab/guitarPositions.ts';

/** The per-plan inputs that cross the boundary: everything a renderer takes
 *  except the document, the entries, the cache and the callbacks. */
export type PlanInputs = Omit<PlanBothOptions, 'mnx' | 'entries' | 'cache' | 'tabSetup'>;

export type LayoutRequest =
  | { type: 'smufl'; glyphnames: unknown; metadata: unknown }
  | { type: 'doc'; mnx: MnxStructure; originalIndex: readonly number[] }
  | {
      type: 'plan';
      seq: number;
      epoch: number;
      view: 'notation' | 'tab' | 'both';
      unrolled: boolean;
      inputs: PlanInputs;
      /** The tab setup, as data: the flat pair and the per-part table. The
       *  per-part resolver is a function in the viewer and is rebuilt here. */
      flatSetup: TabSetup | undefined;
      perPart: Record<string, TabSetup> | null | undefined;
    };

/** A plan request specifically — the one the viewer queues. */
export type PlanRequest = Extract<LayoutRequest, { type: 'plan' }>;

export type LayoutReply =
  | { type: 'plan'; seq: number; epoch: number; plan: RenderPlan }
  | { type: 'error'; seq: number; epoch: number; message: string };

let doc: { mnx: MnxStructure; originalIndex: readonly number[] } | null = null;
let entriesMemo: { unrolled: boolean; entries: ReturnType<typeof engravingEntries> } | null = null;
const cache = createLayoutCache();

function entriesFor(mnx: MnxStructure, unrolled: boolean) {
  if (entriesMemo && entriesMemo.unrolled === unrolled) return entriesMemo.entries;
  const entries = engravingEntries(mnx, unrolled);
  entriesMemo = { unrolled, entries };
  return entries;
}

/** The viewer's resolver, rebuilt from its data (DocumentViewer.ts, `tabSetup`). */
function tabSetupFor(
  mnx: MnxStructure,
  originalIndex: readonly number[],
  flatSetup: TabSetup | undefined,
  perPart: Record<string, TabSetup> | null | undefined
): PartTabSetups | undefined {
  if (!perPart) return flatSetup;
  return (part: MnxPart) => {
    const at = mnx.parts.indexOf(part);
    return (
      (part.id !== undefined ? perPart[part.id] : undefined) ??
      perPart[String(at < 0 ? at : originalIndex[at])] ??
      flatSetup
    );
  };
}

const post = (reply: LayoutReply) => (self as unknown as Worker).postMessage(reply);

self.onmessage = (event: MessageEvent<LayoutRequest>) => {
  const m = event.data;
  if (m.type === 'smufl') {
    setSmuflData(m.glyphnames, m.metadata);
    return;
  }
  if (m.type === 'doc') {
    doc = { mnx: m.mnx, originalIndex: m.originalIndex };
    entriesMemo = null;
    return;
  }
  try {
    if (!doc) throw new Error('layout worker: no document');
    const entries = entriesFor(doc.mnx, m.unrolled);
    const common = { ...m.inputs, mnx: doc.mnx, entries, cache };
    const tabSetup = tabSetupFor(doc.mnx, doc.originalIndex, m.flatSetup, m.perPart);
    const plan =
      m.view === 'tab'
        ? planTab({ ...common, tabSetup } satisfies PlanTabOptions)
        : m.view === 'notation'
          ? planNotation(common satisfies PlanNotationOptions)
          : planBoth({ ...common, tabSetup } satisfies PlanBothOptions);
    post({ type: 'plan', seq: m.seq, epoch: m.epoch, plan });
  } catch (err) {
    post({ type: 'error', seq: m.seq, epoch: m.epoch, message: (err as Error).message });
  }
};
