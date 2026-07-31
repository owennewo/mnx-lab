// Node-safe entry to the proven layout pipeline: document → primitives,
// with SMuFL metrics injected directly instead of fetched. This is the
// guarantee that `engine/` stays importable outside a browser — the harness
// (goldens, previews, proposal engravings) and any future `mnx-lab/engine`
// consumer all come through here. No DOM at module top level.
import { setSmuflData } from './smufl/smufl.ts';
import { layoutNotation } from './layout/notation.ts';
import { layoutTab } from './layout/tab.ts';
import type { MnxStructure } from '../model/mnx.ts';
import type { Primitive } from './primitives.ts';

let smuflReady = false;

/** Injects SMuFL metadata once per process (layout needs glyph metrics). */
export function ensureSmufl(glyphnames: unknown, metadata: unknown): void {
  if (smuflReady) return;
  setSmuflData(glyphnames, metadata);
  smuflReady = true;
}

/** Rounds every number to 4 decimals so float noise never dirties a snapshot. */
export function rounded<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === 'number' ? Math.round(v * 10000) / 10000 : v))
  );
}

export interface RenderedSystem {
  widthSp: number;
  heightSp: number;
  primitives: Primitive[];
}

export interface ScenarioPrimitives {
  widthSp: number;
  notation: RenderedSystem;
  tab?: RenderedSystem;
}

/**
 * The corpus-goldens pipeline: notation layout always, tab layout when a part
 * opts into a tab view, every number rounded. `ensureSmufl` must have run.
 */
export function computePrimitives(doc: MnxStructure, widthSp: number): ScenarioPrimitives {
  const notation = layoutNotation({ mnx: doc, widthSp });
  const out: ScenarioPrimitives = {
    widthSp,
    notation: {
      widthSp: notation.widthSp,
      heightSp: notation.heightSp,
      primitives: notation.primitives as Primitive[]
    }
  };
  const wantsTab = (doc.parts ?? []).some(p => {
    const kind = p?._x?.mnxLab?.tab?.staffKind;
    return kind === 'tab' || kind === 'both';
  });
  if (wantsTab) {
    const tab = layoutTab({ mnx: doc, widthSp });
    out.tab = {
      widthSp: tab.widthSp,
      heightSp: tab.heightSp,
      primitives: tab.primitives as Primitive[]
    };
  }
  return rounded(out);
}
