import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { linearizePasses, type PerformedEntry } from '../../src/model/passes.ts';
import type { MnxGlobalMeasure, MnxStructure } from '../../src/model/mnx.ts';
// @ts-expect-error — repository corpus loader is plain JavaScript
import { loadCorpus } from '../verify/check-scenarios.mjs';

const corpus: { id: string; dir: string }[] = loadCorpus();
const read = (dir: string): MnxStructure => JSON.parse(fs.readFileSync(path.join(dir, 'document.mnx.json'), 'utf8'));
const docOf = (measures: MnxGlobalMeasure[]): MnxStructure =>
  ({ mnx: { version: 1 }, global: { measures }, parts: [] }) as unknown as MnxStructure;

// Hand-read bar orders and strain iterations, NEVER generated from the walker.
// Tuples are [written measure index, iteration, arrival/termination, from, until].
type Stated = [number, number, PerformedEntry['via']?, [number, number]?, [number, number]?];
const stated: Record<string, Stated[]> = {
  'spec/repeats': [[0,1], [0,2,'loop']],
  'spec/repeats-implied-start-repeat': [[0,1], [0,2,'loop']],
  'spec/repeats-more-once-repeated': [[0,1], [0,2,'loop'], [0,3,'loop'], [0,4,'loop']],
  // The mirrored examples declare the default TWO iterations, despite ending 3.
  // Do not silently infer a repeat count from an ending label.
  'spec/repeats-alternate-endings-advanced': [[0,1], [1,1], [2,1], [0,2,'loop'], [1,2], [2,2], [5,1,'ending']],
  'spec/repeats-alternate-endings-simple': [[0,1], [1,1], [0,2,'loop'], [2,2,'ending']],
  'spec/jumps-dal-segno': [[0,1], [1,1], [2,1], [3,1], [4,1,undefined,undefined,[1,1]], [1,1,'jump',[0,1]], [2,1], [3,1], [4,1]],
  'spec/jumps-ds-al-fine': [[0,1], [1,1], [2,1], [3,1], [4,1,undefined,undefined,[1,1]], [1,1,'jump',[0,1]], [2,1,'fine',undefined,[1,1]]],
  'spec/tie-targets': [[0,1], [1,1], [2,1], [0,2,'loop'], [1,2], [3,2,'ending'], [4,1]],
  'lab/navigation/jumps-and-signs': [[0,1], [1,1], [2,1], [3,1], [4,1,undefined,undefined,[1,1]], [1,1,'jump',[0,1]], [2,1], [3,1], [4,1], [5,1]],
  // Ending 2 exits before a third encounter with the repeat end: preserve the
  // existing traversal; the inspection domain still offers iteration 3.
  'lab/navigation/repeats-and-marks-on-tab': [[0,1], [1,1], [0,2,'loop'], [2,2,'ending'], [3,1]],
  'lab/navigation/numbered-bars': [[0,1], [1,1], [2,1], [3,1]],
  'lab/navigation/tempo-change-mid-bar': [[0,1], [1,1]],
  'lab/score-text/labels-with-navigation': [[0,1], [1,1], [2,1], [3,1]],
  'lab/score-text/labels-on-a-tab-staff': [[0,1], [1,1], [2,1], [3,1]],
  'lab/layout/coloured-marks-and-clef-forms': [[0,1], [1,1]],
  'lab/navigation/ds-final-ending': [[0,1], [1,1], [0,2,'loop'], [2,2,'ending'], [3,1,undefined,undefined,[1,2]], [0,2,'jump',[1,4]], [2,2,'fine',undefined,[3,4]]]
};
function entries(rows: Stated[]): PerformedEntry[] {
  const counts = new Map<number, number>();
  return rows.map(([measureIndex, iteration, via, from, until], ordinal) => {
    const occurrence = (counts.get(measureIndex) ?? 0) + 1;
    counts.set(measureIndex, occurrence);
    return { ordinal, measureIndex, occurrence, iteration,
      ...(via ? { via } : {}), ...(from ? { from } : {}), ...(until ? { until } : {}) };
  });
}

describe('hand-stated navigation entries', () => {
  for (const [id, rows] of Object.entries(stated)) it(id, () => {
    const scenario = corpus.find(s => s.id === id);
    expect(scenario, 'hand-stated scenario must exist').toBeDefined();
    expect(linearizePasses(read(scenario!.dir)).entries).toEqual(entries(rows));
  });
});

it('pins traversal evidence for EVERY corpus document, including invalid probes', () => {
  const report = Object.fromEntries(corpus.map(s => {
    const model = linearizePasses(read(s.dir));
    expect(model.entries.map(e => e.measureIndex)).toEqual(model.order);
    expect(model.entries.map(e => e.ordinal)).toEqual(model.order.map((_, k) => k));
    expect(model.entries.every(e => model.availableIterations[e.measureIndex]!.includes(e.iteration))).toBe(true);
    return [s.id, model];
  }));
  const file = new URL('../reports/traversal.json', import.meta.url);
  const serialized = JSON.stringify(report, null, 2) + '\n';
  if (process.env.UPDATE_TRAVERSAL === '1') fs.writeFileSync(file, serialized);
  expect(serialized).toBe(fs.readFileSync(file, 'utf8'));
});

it('offers skipped iterations from the strain, including never-sounded bars', () => {
  const model = linearizePasses(docOf([
    { repeatStart: {} }, { ending: { numbers: [1,2] }, repeatEnd: { times: 3 } },
    { ending: { numbers: [3], duration: 2 } }, {}, {}
  ]));
  expect(model.availableIterations).toEqual([[1,2,3],[1,2,3],[1,2,3],[1,2,3],[1]]);
  expect(model.soundingPasses).toEqual([[1,2,3],[1,2],[3],[3],[1]]);
});

it('keeps duplicate D.S. candidates on the same iteration', () => {
  const model = linearizePasses(docOf([
    { segno: { location: { fraction: [0,1] } } }, { repeatEnd: {} },
    { jump: { type: 'segno', location: { fraction: [1,1] } } }, {}
  ]));
  expect(model.entries.filter(e => e.measureIndex === 2)).toEqual([
    { ordinal: 4, measureIndex: 2, occurrence: 1, iteration: 1, until: [1,1] },
    { ordinal: 7, measureIndex: 2, occurrence: 2, iteration: 1 }
  ]);
});

it('ignores Fine before the mid-bar segno on return; bounds are owned copies', () => {
  const doc = docOf([
    { segno: { location: { fraction: [1,2] } }, fine: { location: { fraction: [1,4] } } },
    { jump: { type: 'dsalfine', location: { fraction: [3,4] } } },
    { fine: { location: { fraction: [1,2] } } }
  ]);
  const model = linearizePasses(doc);
  expect(model.entries).toEqual(entries([[0,1],[1,1,undefined,undefined,[3,4]],[0,1,'jump',[1,2]],[1,1],[2,1,'fine',undefined,[1,2]]]));
  model.entries[2]!.from![0] = 99;
  expect(doc.global.measures[0]!.segno!.location.fraction).toEqual([1,2]);
});

it('reports malformed navigation without losing the surviving order', () => {
  const model = linearizePasses(docOf([
    { repeatStart: {} }, { repeatStart: {} },
    { ending: { numbers: [1,3] }, repeatEnd: {} },
    { jump: { type: 'segno', location: { fraction: [1,1] } } }
  ]));
  expect(model.diagnostics.map(d => d.code)).toEqual(['replaced-repeat-start','unmatched-ending','jump-without-segno']);
  expect(model.truncated).toBe(false);
  expect(linearizePasses(docOf([{ ending: { numbers: [2] } }])).diagnostics[0]!.code).toBe('unmatched-ending');
  const capped = linearizePasses(docOf([{ repeatStart: {} }, { repeatEnd: { times: 100000 } }]));
  expect(capped.truncated).toBe(true);
  expect(capped.diagnostics.some(d => d.code === 'cap')).toBe(true);
  expect(capped.availableIterations[0]!.length).toBeLessThan(100000);
});


it('a jump into the interior of a first ending skips the rest of that span', () => {
  const model = linearizePasses(docOf([
    { repeatStart: {} }, { ending: { numbers: [1], duration: 2 } },
    { repeatEnd: {}, segno: { location: { fraction: [1,2] } } },
    { ending: { numbers: [2] } },
    { jump: { type: 'segno', location: { fraction: [1,1] } } }
  ]));
  expect(model.entries).toEqual(entries([
    [0,1],[1,1],[2,1],[0,2,'loop'],[3,2,'ending'],
    [4,1,undefined,undefined,[1,1]],[3,2,'ending'],[4,1]
  ]));
});

it('retains iteration through a multi-bar final ending on a D.S. return', () => {
  const model = linearizePasses(docOf([
    { repeatStart: {}, segno: { location: { fraction: [1,4] } } },
    { ending: { numbers: [1] }, repeatEnd: {} },
    { ending: { numbers: [2], duration: 2 } }, {},
    { jump: { type: 'segno', location: { fraction: [1,1] } } }
  ]));
  expect(model.entries).toEqual(entries([
    [0,1],[1,1],[0,2,'loop'],[2,2,'ending'],[3,2],[4,1,undefined,undefined,[1,1]],
    [0,2,'jump',[1,4]],[2,2,'ending'],[3,2],[4,1]
  ]));
  expect(model.availableIterations).toEqual([[1,2],[1,2],[1,2],[1,2],[1]]);
});

it('allows a one-iteration strain without diagnosing an orphan ending', () => {
  expect(linearizePasses(docOf([
    { repeatStart: {} }, { ending: { numbers: [1] }, repeatEnd: { times: 1 } }
  ])).diagnostics).toEqual([]);
});

it('has empty evidence for an empty document and uses part length when globals are shorter', () => {
  expect(linearizePasses(docOf([]))).toEqual({ order: [], entries: [], passCounts: [], soundingPasses: [], availableIterations: [], diagnostics: [], truncated: false });
  const doc = docOf([{}]);
  doc.parts = [{ measures: [{}, {}, {}] }] as MnxStructure['parts'];
  expect(linearizePasses(doc).entries).toEqual(entries([[0,1],[1,1],[2,1]]));
});
