import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { initSmufl } from '../helpers/corpusPrimitives.ts';
import { layoutNotation } from '../../src/engine/layout/notation.ts';
import { layoutTab } from '../../src/engine/layout/tab.ts';
import { layoutBothSystem } from '../../src/engine/layout/bothSystem.ts';
import { planHorizontal } from '../../src/engine/layout/spacing.ts';
import { engravingEntries, performedKeys, isPartialEntry } from '../../src/engine/layout/unrolled.ts';
import { compilePerformance } from '../../src/audio/performance.ts';
import { findNoteAddress } from '../../src/model/noteWalk.ts';
import { parseOccurrenceKey, occurrenceKey } from '../../src/model/noteKeys.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
// @ts-expect-error plain mjs
import { loadCorpus } from '../verify/check-scenarios.mjs';
initSmufl();
const scenarios = loadCorpus().filter((s: { id: string }) =>
  /navigation|repeats|jumps|tie-targets/.test(s.id),
);
for (const scenario of scenarios)
  describe(scenario.id, () => {
    const doc: MnxStructure = JSON.parse(
      fs.readFileSync(path.join(scenario.dir, 'document.mnx.json'), 'utf8'),
    );
    const entries = engravingEntries(doc, true)!;
    const compiled = compilePerformance(doc);
    it('prices independent visits without mutating written content', () => {
      const before = JSON.stringify(doc);
      const plan = planHorizontal(doc, 80, { entries });
      expect(plan.measures.map((m) => m.entry)).toEqual(entries);
      expect(new Set(plan.measures).size).toBe(entries.length);
      expect(plan.measures.every((m) => !m.repeatStart && !m.repeatEnd)).toBe(true);
      expect(JSON.stringify(doc)).toBe(before);
    });
    for (const [view, layout] of Object.entries({
      notation: layoutNotation,
      tab: layoutTab,
      both: layoutBothSystem,
    }))
      it(`${view}: visible and performed identities agree`, () => {
        const rendered = layout({ mnx: doc, widthSp: 80, entries });
        const notes = rendered.primitives.filter(
          (p) => p.sourceId && /notehead|fret-number/.test(p.className ?? ''),
        );
        const visible = new Set<string>();
        const performed = new Set<string>();
        for (const p of notes) {
          const identity = parseOccurrenceKey(p.sourceId!);
          expect(identity, p.sourceId).not.toBeNull();
          if (!identity) continue;
          const address = findNoteAddress(doc, identity.noteKey);
          expect(address?.measureIndex).toBe(
            entries.find((e) => e.ordinal === identity.ordinal)?.measureIndex,
          );
          visible.add(p.sourceId!);
          if (!p.className?.includes('unperformed')) {
            performed.add(p.sourceId!);
            expect(rendered.index.has(p.sourceId!), `playable ${p.sourceId}`).toBe(true);
          } else expect(rendered.index.has(p.sourceId!), `unperformed ${p.sourceId}`).toBe(false);
        }
        expect(compiled.ok).toBe(true);
        if (compiled.ok) {
          const expected = new Set(
            compiled.performance.written.map((w) => occurrenceKey(w.noteKey, w.ordinal)),
          );
          expect([...performed].filter((key) => !expected.has(key))).toEqual([]);
          if (view === 'notation')
            expect([...expected].filter((key) => !performed.has(key))).toEqual([]);
          for (const entry of entries)
            expect(
              new Set(
                [...performedKeys(doc, entry)].map((key) => occurrenceKey(key, entry.ordinal)),
              ),
            ).toEqual(
              new Set(
                [...expected].filter((key) => parseOccurrenceKey(key)?.ordinal === entry.ordinal),
              ),
            );
        }
        expect(
          rendered.primitives
            .filter((p) => p.kind === 'text' && p.className === 'occurrence-label')
            .map((p) => (p.kind === 'text' ? p.text : '')),
        ).toEqual(entries.filter((e) => e.occurrence > 1).map((e) => `${e.occurrence}×`));
        expect(
          rendered.primitives.some((p) =>
            /repeat-dots|ending-bracket|navigation/.test(p.className ?? ''),
          ),
        ).toBe(false);
      });
  });

const seed = (): MnxStructure => ({
  mnx: { version: 1 },
  global: { measures: [{ time: { count: 4, unit: 4 }, repeatStart: {} }, { repeatEnd: {} }] },
  parts: [
    {
      measures: [
        {
          clefs: [{ clef: { sign: 'G', staffPosition: -2 } }],
          sequences: [
            {
              content: [
                {
                  id: 'a',
                  duration: { base: 'half' },
                  notes: [{ id: 'a1', pitch: { step: 'C', octave: 4 }, ties: [{ target: 'b1' }] }],
                  slurs: [{ target: 'b' }],
                },
                {
                  id: 'b',
                  duration: { base: 'half' },
                  notes: [{ id: 'b1', pitch: { step: 'C', octave: 4 } }],
                },
              ],
            },
          ],
        },
        {
          clefs: [{ clef: { sign: 'F', staffPosition: 2 } }],
          sequences: [
            {
              content: [
                {
                  duration: { base: 'whole' },
                  notes: [{ id: 'c1', pitch: { step: 'C', octave: 4 } }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});
it('restores inherited clef/key/meter at a jump target, independently of the preceding visit', () => {
  const doc = seed();
  doc.global.measures[0].key = { fifths: 2 };
  doc.global.measures[1].key = { fifths: -3 };
  doc.global.measures[1].time = { count: 3, unit: 4 };
  const entries = engravingEntries(doc, true)!;
  const plan = planHorizontal(doc, 300, { entries });
  expect(plan.measures.map((m) => m.clef.sign)).toEqual(['G', 'F', 'G', 'F']);
  expect(plan.measures.map((m) => m.keyFifths)).toEqual([2, -3, 2, -3]);
  expect(plan.measures.map((m) => m.timeSig.count)).toEqual([4, 3, 4, 3]);
  expect(plan.measures[2].showClef).toBe(true);
  expect(plan.measures[2].showKeySig).toBe(true);
  expect(plan.measures[2].cancelledKeyFifths).toBe(-3);
});
it('draws same-bar ties and slurs on each actual occurrence, never to the final copy', () => {
  const doc = seed();
  const layout = layoutNotation({ mnx: doc, widthSp: 300, entries: engravingEntries(doc, true) });
  for (const kind of ['tie', 'slur']) {
    const curves = layout.primitives.filter((p) => p.kind === 'curve' && p.className === kind);
    expect(curves).toHaveLength(2);
    const widths = curves.map((p) => (p.kind === 'curve' ? p.points.at(-1)!.x - p.points[0].x : 0));
    expect(widths[0]).toBeCloseTo(widths[1], 6);
  }
});
it('joins crossJump ties only on the actual adjacent jump pair', () => {
  const doc = seed();
  const end = doc.parts[0].measures[1].sequences[0]
    .content[0] as import('../../src/model/mnx.ts').MnxEvent;
  end.notes![0].ties = [{ target: 'a1', targetType: 'crossJump' }];
  const rendered = layoutNotation({ mnx: doc, widthSp: 300, entries: engravingEntries(doc, true) });
  expect(rendered.primitives.filter((p) => p.className === 'tie')).toHaveLength(3); // two local, one return
});
it('retains whole partial bars, marks excluded notes and clips crossing notes by half-open bounds', () => {
  const doc = seed();
  const entries = [
    {
      ordinal: 0,
      measureIndex: 0,
      occurrence: 1,
      iteration: 1,
      from: [1, 4] as [number, number],
      until: [1, 2] as [number, number],
    },
  ];
  const layout = layoutNotation({ mnx: doc, widthSp: 80, entries });
  expect(performedKeys(doc, entries[0])).toEqual(new Set(['a1'])); // a starts before from, but crosses it
  expect(layout.index.has('w0:a1')).toBe(true);
  expect(layout.index.has('w0:b1')).toBe(false);
  expect(layout.primitives.find((p) => p.sourceId === 'w0:b1')?.opacity).toBe(0.3);
  expect(layout.diagnostics.some((d) => d.message.includes('partial performed entry'))).toBe(true);
});
it('ignores collapse and forced breaks with diagnostics, keeping separate visits', () => {
  const doc = seed();
  const entries = engravingEntries(doc, true)!;
  const plan = planHorizontal(doc, 300, {
    entries,
    collapse: [{ startIndex: 0, count: 2 }],
    forcedBreaks: new Set([1]),
  });
  expect(plan.rowCount).toBe(1);
  expect(plan.measures.every((m) => !m.hidden && !m.multiRest)).toBe(true);
  expect(plan.measures[0].issues.join(' ')).toContain('multi-measure-rest');
  expect(plan.measures[0].issues.join(' ')).toContain('layout breaks');
});

it('uses the compiler half-open membership for all performance evidence, including containers and grace boundaries', () => {
  for (const scenario of loadCorpus()) {
    const meta = JSON.parse(fs.readFileSync(path.join(scenario.dir, 'meta.json'), 'utf8'));
    if (!meta.performance) continue;
    const doc = JSON.parse(fs.readFileSync(path.join(scenario.dir, 'document.mnx.json'), 'utf8'));
    const compiled = compilePerformance(doc);
    expect(compiled.ok, scenario.id).toBe(true);
    if (!compiled.ok) continue;
    const expected = new Set(
      compiled.performance.written.map((w) => occurrenceKey(w.noteKey, w.ordinal)),
    );
    const actual = new Set(
      engravingEntries(doc, true)!.flatMap((entry) =>
        [...performedKeys(doc, entry)].map((key) => occurrenceKey(key, entry.ordinal)),
      ),
    );
    expect(actual, scenario.id).toEqual(expected);
  }
});


it('excludes ID-less partial-bar tie sources and technique targets from span geometry', () => {
  const doc = seed();
  const a = doc.parts[0].measures[0].sequences[0].content[0] as import('../../src/model/mnx.ts').MnxEvent;
  delete a.id;
  delete a.notes![0].id;
  a.notes![0]._x = {mnxLab:{tab:{technique:{hammerPull:{target:'b1'}}}}};
  const entries = [{ordinal:0, measureIndex:0, occurrence:1, iteration:1, from:[1,2] as [number,number]}];
  const rendered = layoutNotation({mnx:doc,widthSp:80,entries});
  expect(rendered.primitives.some(p => p.className === 'tie' || p.className === 'slur' || p.className?.includes('technique-hammerPull'))).toBe(false);
  expect(rendered.primitives.find(p => p.sourceId === 'w0:@m0.v0.e0.n0')?.className).toContain('unperformed');
});

it('does not warn for Dal Segno boundaries at the start or end of a whole bar', () => {
  const doc: MnxStructure = JSON.parse(
    fs.readFileSync('scenarios/spec/jumps-dal-segno/document.mnx.json', 'utf8'),
  );
  const entries = engravingEntries(doc, true)!;
  expect(entries.some((e) => e.from)).toBe(true);
  expect(entries.some((e) => e.until)).toBe(true);
  for (const layout of [layoutNotation, layoutTab, layoutBothSystem]) {
    const rendered = layout({ mnx: doc, widthSp: 80, entries });
    expect(rendered.diagnostics.filter((d) => d.message.includes('partial performed entry')))
      .toEqual([]);
  }
});

it('compares slice bounds with actual content length, including pickups and empty bars', () => {
  const doc = seed();
  const entry = { ordinal: 0, measureIndex: 0, occurrence: 1, iteration: 1 };
  const partial = (from: [number, number], until: [number, number]) =>
    isPartialEntry(doc, { ...entry, from, until });
  expect(partial([0, 1], [2, 2])).toBe(false);
  expect(partial([1, 4], [1, 1])).toBe(true);
  expect(partial([0, 1], [3, 4])).toBe(true);
  doc.parts[0].measures[0].sequences![0].content.pop();
  expect(partial([0, 1], [1, 2])).toBe(false);
  expect(partial([0, 1], [1, 4])).toBe(true);
  // The longest part/voice determines extent, rather than the first sequence.
  doc.parts.push(structuredClone(seed().parts[0]));
  expect(partial([0, 1], [1, 2])).toBe(true);
  doc.parts = [];
  doc.global.measures[0].time = { count: 3, unit: 4 };
  expect(partial([0, 1], [3, 4])).toBe(false);
  expect(partial([0, 1], [1, 2])).toBe(true);
});
