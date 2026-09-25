import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';
import Ajv from 'ajv';
import { evaluate } from '../src/evaluate/index.ts';
import type { Decision, Golden } from '../src/types.ts';
const oracle = new URL('../oracle/', import.meta.url);
const read = (url: URL) => JSON.parse(readFileSync(url, 'utf8'));
const cases = readdirSync(oracle, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
const ajv = new Ajv({ strict: true });
const validGolden = ajv.compile(read(new URL('../../contracts/golden.schema.json', import.meta.url)));
const validRecord = ajv.compile(read(new URL('../../contracts/decisions.schema.json', import.meta.url)));
export function load(id: string): { golden: Golden; record: Decision[]; expected: any } {
  return { golden: read(new URL(`${id}/golden.json`, oracle)), record: read(new URL(`${id}/decisions.json`, oracle)), expected: read(new URL(`${id}/expected.json`, oracle)) };
}
for (const id of cases) it(id + ' agrees with independent hand arithmetic', () => {
  const { golden, record, expected } = load(id);
  expect(validGolden(golden), JSON.stringify(validGolden.errors)).toBe(true);
  expect(validRecord(record), JSON.stringify(validRecord.errors)).toBe(true);
  const result = evaluate(golden, record);
  expect(result.asDecided.counts).toEqual(expected.asDecided);
  expect(result.hindsight.counts).toEqual(expected.hindsight);
  expect(result.timeliness.missed).toBe(expected.missedDeadlines);
  expect(result.exposure).toEqual({ totalSeconds: expected.exposureSeconds, longestSeconds: expected.longestExposureSeconds });
  expect(result.asDecided.losses).toEqual(expected.liveLosses);
  expect({ mean: result.timeliness.mean, p95: result.timeliness.p95, max: result.timeliness.max }).toEqual(expected.latency);
  for (const view of [result.asDecided, result.hindsight]) {
    const c = view.counts;
    expect(view.denominators).toEqual({ supported: c.correct + c.wrong + c.overAmbiguous + c.lost + c.abstained + (golden.labels.following[0]!.state === 'supported' ? c.uncovered : 0), unsupported: c.falseFollowing + c.correctRejection, pending: c.pending, answerable: Object.entries(c).filter(([k]) => k !== 'pending' && k !== 'confidentPending').reduce((n, [, v]) => n + v, 0) });
    expect(view.coverage).toEqual({ uncovered: c.uncovered, denominator: view.denominators.answerable });
    expect(view.abstention).toEqual({ count: c.abstained + c.lost, denominator: view.denominators.supported });
    expect(view.confidence.slice(0, 4).every(bin => bin.claims === 0)).toBe(true);
    expect(view.confidence[4]).toMatchObject({ correct: c.correct, pending: c.confidentPending, answerable: c.correct + c.wrong + c.overAmbiguous + c.falseFollowing });
  }
  expect(result.asDecided.falseFollowingSeconds).toBe(id === 'o5-false-follow' ? 8.35 : 0);
  expect(record).toEqual(load(id).record); // revisions are never destructive
});
it('measures wrong quarter errors and route errors separately', () => {
  const { golden, record } = load('o2-late');
  const errors = evaluate(golden, record).asDecided.errors;
  expect(errors.values).toEqual(Array(154).fill(.3));
  expect(errors).toMatchObject({ mean: .3, p95: .3, max: .3, routeMismatches: 0 });
  const p = load('o1-perfect');
  for (const d of p.record) if (d.kind === 'position') d.candidates[0]!.position.route = 2;
  expect(evaluate(p.golden, p.record).asDecided.errors).toMatchObject({ values: [], routeMismatches: 158, max: null });
});
it('credits admissible ambiguity and keeps all five confidence bins', () => {
  const { golden, record } = load('o6-ambiguous');
  const label = golden.labels.following[0]!;
  if (label.state !== 'supported') throw new Error('fixture');
  label.admissible.push({ ...label.truth, atStart: { num: 1, den: 1 } });
  record.forEach((d, i) => { if (d.kind === 'position') d.confidence = [0, .2, .4, .6, 1][i % 5]!; });
  const result = evaluate(golden, record);
  expect(result.asDecided.counts.correct).toBe(158);
  expect(result.asDecided.confidence.map(bin => bin.claims)).toEqual([32, 32, 32, 32, 32]);
});
it('does not let reserved notes displace live following or golden.expected supply an answer', () => {
  const { golden, record } = load('o1-perfect');
  const before = evaluate(golden, record);
  golden.expected.exposureSeconds = 999;
  record.push({ id: 'note', kind: 'note', refersTo: 8, madeAt: 8, verdict: 'extra', noteId: null, observedOnset: 8, observedPitch: 60 });
  expect(evaluate(golden, record)).toEqual(before);
});
it('rejects impossible records and labels before counting', () => {
  const { golden, record } = load('o1-perfect');
  record[0]!.madeAt = 0;
  expect(() => evaluate(golden, record)).toThrow('clock');
  const again = load('o1-perfect'); again.record[1]!.id = again.record[0]!.id;
  expect(() => evaluate(again.golden, again.record)).toThrow('id');
  golden.labels.following[0]!.end = 7;
  expect(() => evaluate(golden, [])).toThrow('cover');
});
