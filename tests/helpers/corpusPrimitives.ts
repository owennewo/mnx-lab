// Shared corpus→primitives pipeline, used by the layout snapshot test
// (tests/primitives.test.ts) and the preview contact-sheet generator
// (tests/preview.test.ts). Keeping it in one place guarantees the preview
// shows exactly what the snapshots pin.
import fs from 'node:fs';
import path from 'node:path';
// @ts-expect-error — plain .mjs module without type declarations
import { ROOT } from '../../scripts/check-scenarios.mjs';
import { setSmuflData } from '../../src/smufl/smufl.ts';
import { layoutNotation } from '../../src/layout/notation.ts';
import { layoutTab } from '../../src/layout/tab.ts';
import type { MnxStructure } from '../../src/types/mnx.ts';
import type { Primitive } from '../../src/primitives.ts';

export const WIDTH_SP = 80; // fixed viewport so snapshots are deterministic

let smuflReady = false;

/** Loads SMuFL metadata once per process (layout needs glyph metrics). */
export function initSmufl(): void {
  if (smuflReady) return;
  setSmuflData(
    JSON.parse(fs.readFileSync(path.join(ROOT, 'public/smufl/glyphnames.json'), 'utf8')),
    JSON.parse(fs.readFileSync(path.join(ROOT, 'public/smufl/bravura_metadata.json'), 'utf8'))
  );
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

export function computePrimitives(doc: MnxStructure): ScenarioPrimitives {
  initSmufl();
  const notation = layoutNotation({ mnx: doc, widthSp: WIDTH_SP });
  const out: ScenarioPrimitives = {
    widthSp: WIDTH_SP,
    notation: {
      widthSp: notation.widthSp,
      heightSp: notation.heightSp,
      primitives: notation.primitives as Primitive[]
    }
  };
  const wantsTab = (doc.parts ?? []).some(p => {
    const kind = p?._x?.tab?.staffKind;
    return kind === 'tab' || kind === 'both';
  });
  if (wantsTab) {
    const tab = layoutTab({ mnx: doc, widthSp: WIDTH_SP });
    out.tab = {
      widthSp: tab.widthSp,
      heightSp: tab.heightSp,
      primitives: tab.primitives as Primitive[]
    };
  }
  return rounded(out);
}
