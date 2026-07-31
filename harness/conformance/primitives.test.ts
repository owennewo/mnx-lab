// Render snapshots over the scenario corpus — two goldens per scenario.
//
// For every scenario whose document is expected valid, computes the layout
// engine's primitive output (notation, plus tab when the part declares a tab
// view) at a fixed viewport width and compares it to the committed
// expected.primitives.json, then puts those primitives through the real SVG
// emitter and compares that to expected.svg (+ expected.tab.svg). The second
// golden covers what the first structurally cannot — glyph name → codepoint,
// the emit branches, sp→px — see harness/helpers/corpusSvg.ts.
//
// Regenerate snapshots with: npm run update:primitives
// (UPDATE_PRIMITIVES=1 makes this file WRITE instead of assert.)
//
// UPDATE mode also keeps meta.json `status` honest, because `verified` means
// "a human approved this exact output":
//   - snapshot created for a 'valid' scenario        → promoted to 'rendered'
//   - EITHER golden CHANGED for a 'verified' scenario → demoted to 'rendered'
//     (back into the approval queue — npm run verify:scenarios)
//   - layout crash removes the snapshots             → demoted to 'valid'
//
// A golden appearing for the FIRST time is never a change: that is how the
// existing approvals absorbed expected.svg without a mass demotion.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain .mjs module without type declarations
import { loadCorpus, createContext, checkScenario } from '../verify/check-scenarios.mjs';
import { computePrimitives } from '../helpers/corpusPrimitives.ts';
import { scenarioSvg, SVG_GOLDEN_FILES } from '../helpers/corpusSvg.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

const UPDATE = process.env.UPDATE_PRIMITIVES === '1';

/**
 * Writes a golden, reporting whether it *changed* — a first write is not a
 * change, so adding a new golden file never demotes an existing approval.
 */
function writeGolden(filePath: string, contents: string): boolean {
  const previous = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  fs.writeFileSync(filePath, contents);
  return previous !== null && previous !== contents;
}

const PRIMITIVES_FILE = 'expected.primitives.json';

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
    const snapshotPath = path.join(scenario.dir, PRIMITIVES_FILE);
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
          // without snapshots (status stays 'valid') and report it.
          console.warn(`LAYOUT CRASH ${scenario.id}: ${(e as Error).message}`);
          let had = false;
          for (const name of [PRIMITIVES_FILE, ...SVG_GOLDEN_FILES]) {
            const p = path.join(scenario.dir, name);
            if (fs.existsSync(p)) {
              fs.rmSync(p);
              had = true;
            }
          }
          if (had && (status === 'rendered' || status === 'verified')) {
            setStatus(scenario.dir, 'valid', 'layout no longer renders this scenario');
          }
          return;
        }
        const serialized = JSON.stringify(computed, null, 2) + '\n';
        const primitivesChanged = writeGolden(snapshotPath, serialized);

        const svg = scenarioSvg(computed);
        let svgChanged = false;
        for (const name of SVG_GOLDEN_FILES) {
          const filePath = path.join(scenario.dir, name);
          if (name in svg) {
            svgChanged = writeGolden(filePath, svg[name]) || svgChanged;
          } else if (fs.existsSync(filePath)) {
            // The scenario stopped producing this system (a tab view removed).
            fs.rmSync(filePath);
            svgChanged = true;
          }
        }

        if (status === 'valid') {
          // Promote on ANY successful snapshot write, not only the first —
          // a snapshot committed without its status bump would otherwise
          // stay 'valid' forever and read as "doesn't render".
          setStatus(scenario.dir, 'rendered', !hasSnapshot ? 'first snapshot generated' : 'snapshot exists — status was lagging');
        } else if (status === 'verified' && (primitivesChanged || svgChanged)) {
          const what = primitivesChanged && svgChanged
            ? 'primitives and SVG'
            : primitivesChanged
              ? 'primitives'
              : 'SVG output';
          setStatus(scenario.dir, 'rendered', `${what} changed since approval — re-verify`);
        }
        expect(computed).toBeTruthy();
      });
    } else if (hasSnapshot) {
      it(scenario.id, () => {
        const doc = JSON.parse(
          fs.readFileSync(path.join(scenario.dir, 'score.mnx.json'), 'utf8')
        ) as MnxStructure;
        const stored = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
        const computed = computePrimitives(doc);
        expect(computed).toEqual(stored);

        // Second golden: the emitter's own output. Skipped where it has not
        // been generated yet, so the suite stays green between adding the
        // golden and running update:primitives.
        const svg = scenarioSvg(computed);
        for (const name of SVG_GOLDEN_FILES) {
          const filePath = path.join(scenario.dir, name);
          const exists = fs.existsSync(filePath);
          if (name in svg) {
            if (exists) expect(fs.readFileSync(filePath, 'utf8'), name).toEqual(svg[name]);
          } else {
            expect(exists, `${name} is stale — this scenario no longer renders it`).toBe(false);
          }
        }
      });
    } else {
      it.skip(`${scenario.id} (no snapshot yet — run npm run update:primitives)`, () => {});
    }
  }
});
