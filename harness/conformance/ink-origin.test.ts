// Every primitive says what it was drawn for (roadmap/complete/core-ink-provenance.md).
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
import { SPACE_DEFAULT_SP, packedRowMeasures } from '../../src/engine/layout/spacing.ts';
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

/** Lay the corpus out in one projection; `check` returns what is wrong with one layout. */
function census(layout: Layout, applies: (doc: MnxStructure) => boolean, check: (result: LayoutResult) => string[]): string[] {
  initSmufl();
  const missing = new Map<string, Set<string>>();
  for (const scenario of corpus) {
    const doc = JSON.parse(fs.readFileSync(path.join(scenario.dir, 'document.mnx.json'), 'utf8')) as MnxStructure;
    if (!applies(doc)) continue;
    let result: LayoutResult;
    try { result = layout(doc); } catch { continue; } // a layout crash is the snapshot test's to report
    for (const key of check(result)) (missing.get(key) ?? missing.set(key, new Set()).get(key)!).add(scenario.id);
  }
  return [...missing].map(([key, ids]) => `${key}: ${ids.size} scenario(s), e.g. ${[...ids].slice(0, 3).join(', ')}`);
}

const cls = (className: string | undefined) => (className ?? '').split(' ')[0]!;
/** Ink that is always some one staff's. */
const STAFF_INK = /^(staff-line|clef|key-sig|time-sig|time-sig-num|time-sig-den|notehead|fret-number|stem|accidental|ledger-line|rest)$/;

describe('every staff-bound primitive names its staff, and the layout says which staff each is and where its bars are', () => {
  for (const [name, layout, applies] of projections) {
    it(name, () => {
      expect(census(layout, applies, result => {
        const wrong: string[] = [];
        result.staves?.forEach((row, r) => { if (row.length !== result.displays?.[r]?.length) wrong.push(`staves row ${r} has ${row.length} of ${result.displays?.[r]?.length} displays`); });
        if (!result.staves) wrong.push('no staves');
        for (const p of result.primitives) {
          const c = cls(p.className), d = p.origin?.display, row = p.origin?.row ?? -1;
          if ((STAFF_INK.test(c) || p.sourceId !== undefined) && d === undefined) wrong.push(`${c} without a staff`);
          if (d === undefined) continue;
          const band = result.displays?.[row]?.[d];
          if (!band) { wrong.push(`${c} on staff ${d} of a row with ${result.displays?.[row]?.length}`); continue; }
          if (c === 'staff-line' && p.kind === 'line' && (p.y1 < band.staffTop - 1e-6 || p.y1 > band.staffBottom + 1e-6)) wrong.push('staff-line outside its staff');
        }
        // The bars, row by row, are the packing's own rows (a layout with no bars has a
        // row for its empty frame and nothing packed).
        const byRow: number[][] = result.rows.map(() => []);
        for (const bar of result.bars ?? []) byRow[bar.row]?.push(bar.index);
        const packed = packedRowMeasures(result.packings ?? [], SPACE_DEFAULT_SP);
        if (JSON.stringify(byRow.filter(row => row.length)) !== JSON.stringify(packed)) wrong.push('bars are not the packed rows');
        return wrong;
      })).toEqual([]);
    });
  }
});

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

/** What each role is, by the classes the stylesheet knows it as. */
const ROLE_OF: Record<string, 'frame' | 'lyric' | 'event' | 'direction'> = {
  'staff-line': 'frame', barline: 'frame', brace: 'frame', bracket: 'frame', 'group-label': 'frame',
  lyric: 'lyric', 'lyric-hyphen': 'lyric', 'lyric-gap': 'lyric',
  notehead: 'event', 'fret-number': 'event', rest: 'event', direction: 'direction'
};

describe('every primitive says what it is, and only those do', () => {
  for (const [name, layout, applies] of projections) {
    it(name, () => {
      expect(census(layout, applies, result => result.primitives.flatMap(p => {
        const c = cls(p.className);
        const role = (p.className ?? '').split(' ').includes('direction-between') ? 'between' : ROLE_OF[c];
        return role === p.role ? [] : [`${c} has role ${p.role}, not ${role}`];
      }))).toEqual([]);
    });
  }
});
