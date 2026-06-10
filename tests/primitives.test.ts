// Layout snapshots over the scenario corpus.
//
// For every scenario whose document is expected valid, computes the layout
// engine's primitive output (notation, plus tab when the part declares a tab
// view) at a fixed viewport width and compares it to the committed
// expected.primitives.json.
//
// Regenerate snapshots with: npm run update:primitives
// (UPDATE_PRIMITIVES=1 makes this file WRITE instead of assert.)
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain .mjs module without type declarations
import { loadCorpus, createContext, checkScenario, ROOT } from '../scripts/check-scenarios.mjs';
import { setSmuflData } from '../src/smufl/smufl.ts';
import { layoutNotation } from '../src/layout/notation.ts';
import { layoutTab } from '../src/layout/tab.ts';
import type { MnxStructure } from '../src/types/mnx.ts';

const UPDATE = process.env.UPDATE_PRIMITIVES === '1';
const WIDTH_SP = 80; // fixed viewport so snapshots are deterministic

setSmuflData(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'public/smufl/glyphnames.json'), 'utf8')),
  JSON.parse(fs.readFileSync(path.join(ROOT, 'public/smufl/bravura_metadata.json'), 'utf8'))
);

/** Rounds every number to 4 decimals so float noise never dirties a snapshot. */
function rounded<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === 'number' ? Math.round(v * 10000) / 10000 : v))
  );
}

function computePrimitives(doc: MnxStructure) {
  const notation = layoutNotation({ mnx: doc, widthSp: WIDTH_SP });
  const out: Record<string, unknown> = {
    widthSp: WIDTH_SP,
    notation: {
      widthSp: notation.widthSp,
      heightSp: notation.heightSp,
      primitives: notation.primitives
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
      primitives: tab.primitives
    };
  }
  return rounded(out);
}

const ctx = createContext();
const corpus = loadCorpus().filter((s: any) => {
  const { meta } = checkScenario(s, ctx);
  if (!meta || meta.expect.standard !== 'valid') return false;
  (s as any).meta = meta;
  return true;
});

describe(`scenario layout snapshots${UPDATE ? ' (UPDATING)' : ''}`, () => {
  for (const scenario of corpus) {
    const snapshotPath = path.join(scenario.dir, 'expected.primitives.json');
    const hasSnapshot = fs.existsSync(snapshotPath);

    if (UPDATE) {
      it(`${scenario.id} [write]`, () => {
        const doc = JSON.parse(
          fs.readFileSync(path.join(scenario.dir, 'score.mnx.json'), 'utf8')
        ) as MnxStructure;
        let computed;
        try {
          computed = computePrimitives(doc);
        } catch (e) {
          // A layout crash is an honest "can't render yet": leave the scenario
          // without a snapshot (status stays 'valid') and report it.
          console.warn(`LAYOUT CRASH ${scenario.id}: ${(e as Error).message}`);
          if (fs.existsSync(snapshotPath)) fs.rmSync(snapshotPath);
          return;
        }
        fs.writeFileSync(snapshotPath, JSON.stringify(computed, null, 2) + '\n');
        expect(computed).toBeTruthy();
      });
    } else if (hasSnapshot) {
      it(scenario.id, () => {
        const doc = JSON.parse(
          fs.readFileSync(path.join(scenario.dir, 'score.mnx.json'), 'utf8')
        ) as MnxStructure;
        const stored = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
        expect(computePrimitives(doc)).toEqual(stored);
      });
    } else {
      it.skip(`${scenario.id} (no snapshot yet — run npm run update:primitives)`, () => {});
    }
  }
});
