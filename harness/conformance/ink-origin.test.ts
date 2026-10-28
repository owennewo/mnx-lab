// Every primitive says what it was drawn for (roadmap/inprogress/core-ink-provenance.md).
// The engine and the overlays read `origin` instead of working it back out from where
// the ink landed, so a primitive without it is a mark something will file with the
// wrong system. This lays the corpus out in every projection it pins — and the ones
// the viewer draws (explicit display, element targets, playback spans, tight
// clearance, narrow pages) — and names every class that arrives unstamped.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { initSmufl } from '../helpers/corpusPrimitives.ts';
import { layoutNotation } from '../../src/engine/layout/notation.ts';
import { layoutTab } from '../../src/engine/layout/tab.ts';
import { layoutBothSystem } from '../../src/engine/layout/bothSystem.ts';
import { engravingEntries } from '../../src/engine/layout/unrolled.ts';
import { wantsTabView, type MnxStructure } from '../../src/model/mnx.ts';
import type { LayoutResult } from '../../src/engine/primitives.ts';
// @ts-expect-error — plain .mjs module without type declarations
import { loadCorpus } from '../verify/check-scenarios.mjs';

interface Scenario { id: string; dir: string }
const corpus = (loadCorpus() as Scenario[]).filter(s => fs.existsSync(path.join(s.dir, 'expected.primitives.json')));

type Layout = (doc: MnxStructure) => LayoutResult;
const viewer = { elementTargets: true, durationSpans: true, display: {} };
const projections: [string, Layout, (doc: MnxStructure) => boolean][] = [
  ['notation', doc => layoutNotation({ mnx: doc, widthSp: 80 }), () => true],
  ['tab', doc => layoutTab({ mnx: doc, widthSp: 80 }), wantsTabView],
  ['both', doc => layoutBothSystem({ mnx: doc, widthSp: 80 }), wantsTabView],
  ['unrolled', doc => layoutNotation({ mnx: doc, widthSp: 80, entries: engravingEntries(doc, true) }), () => true],
  ['unrolled tab', doc => layoutTab({ mnx: doc, widthSp: 80, entries: engravingEntries(doc, true) }), wantsTabView],
  ['viewer notation, narrow, tight', doc => layoutNotation({ mnx: doc, widthSp: 40, densityPad: 0.2, ...viewer }), () => true],
  ['viewer notation + tab staves', doc => layoutNotation({ mnx: doc, widthSp: 50, includeTabStaves: true, ...viewer }), wantsTabView],
  ['viewer tab, narrow, tight', doc => layoutTab({ mnx: doc, widthSp: 40, densityPad: 0.2, ...viewer }), wantsTabView],
  ['viewer tab, roomy', doc => layoutTab({ mnx: doc, widthSp: 60, ...viewer, display: { clearance: 4 } }), wantsTabView]
];

describe('every primitive carries the row it was drawn for', () => {
  for (const [name, layout, applies] of projections) {
    it(name, () => {
      initSmufl();
      const missing = new Map<string, Set<string>>();
      for (const scenario of corpus) {
        const doc = JSON.parse(fs.readFileSync(path.join(scenario.dir, 'document.mnx.json'), 'utf8')) as MnxStructure;
        if (!applies(doc)) continue;
        let result: LayoutResult;
        try { result = layout(doc); } catch { continue; } // a layout crash is the snapshot test's to report
        for (const p of result.primitives) {
          const row = p.origin?.row;
          if (row !== undefined && Number.isInteger(row) && row >= 0 && row < result.rows.length) continue;
          const key = `${(p.className ?? p.kind).split(' ')[0]}${row === undefined ? '' : ` (row ${row} of ${result.rows.length})`}`;
          (missing.get(key) ?? missing.set(key, new Set()).get(key)!).add(scenario.id);
        }
      }
      const report = [...missing].map(([key, ids]) => `${key}: ${ids.size} scenario(s), e.g. ${[...ids].slice(0, 3).join(', ')}`);
      expect(report).toEqual([]);
    });
  }
});
