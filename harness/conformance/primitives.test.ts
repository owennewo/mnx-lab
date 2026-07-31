// Layout snapshots over the scenario corpus.
//
// For every scenario whose document is expected valid, computes the layout
// engine's primitive output (notation, plus tab when the part declares a tab
// view) at a fixed viewport width and compares it to the committed
// expected.primitives.json.
//
// Regenerate snapshots with: npm run update:primitives
// (UPDATE_PRIMITIVES=1 makes this file WRITE instead of assert.)
//
// UPDATE mode also keeps meta.json `status` honest, because `verified` means
// "a human approved this exact output":
//   - snapshot created for a 'valid' scenario        → promoted to 'rendered'
//   - snapshot CHANGED for a 'verified' scenario     → demoted to 'rendered'
//     (back into the approval queue — npm run preview:scenarios)
//   - layout crash removes the snapshot              → demoted to 'valid'
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain .mjs module without type declarations
import { loadCorpus, createContext, checkScenario } from '../verify/check-scenarios.mjs';
import { computePrimitives } from '../helpers/corpusPrimitives.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

const UPDATE = process.env.UPDATE_PRIMITIVES === '1';

/** Rewrites meta.json `status`, preserving canonical formatting. */
function setStatus(dir: string, status: string, why: string) {
  const metaPath = path.join(dir, 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  console.warn(`STATUS ${path.basename(dir)}: ${meta.status} → ${status} (${why})`);
  meta.status = status;
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
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
        const status = (scenario as any).meta.status as string;
        let computed;
        try {
          computed = computePrimitives(doc);
        } catch (e) {
          // A layout crash is an honest "can't render yet": leave the scenario
          // without a snapshot (status stays 'valid') and report it.
          console.warn(`LAYOUT CRASH ${scenario.id}: ${(e as Error).message}`);
          if (fs.existsSync(snapshotPath)) {
            fs.rmSync(snapshotPath);
            if (status === 'rendered' || status === 'verified') {
              setStatus(scenario.dir, 'valid', 'layout no longer renders this scenario');
            }
          }
          return;
        }
        const serialized = JSON.stringify(computed, null, 2) + '\n';
        const previous = hasSnapshot ? fs.readFileSync(snapshotPath, 'utf8') : null;
        fs.writeFileSync(snapshotPath, serialized);
        if (status === 'valid') {
          // Promote on ANY successful snapshot write, not only the first —
          // a snapshot committed without its status bump would otherwise
          // stay 'valid' forever and read as "doesn't render".
          setStatus(scenario.dir, 'rendered', previous === null ? 'first snapshot generated' : 'snapshot exists — status was lagging');
        } else if (previous !== null && previous !== serialized && status === 'verified') {
          setStatus(scenario.dir, 'rendered', 'primitives changed since approval — re-verify');
        }
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
