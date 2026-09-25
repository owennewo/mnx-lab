import { expect, it } from 'vitest';
import { checkAnchors, type Measure } from '../src/evidence/preflight.ts';
const measures: Measure[] = [
  { written: 1, occurrence: 1, startQuarter: 0, durationQuarters: 3, partial: false },
  { written: 1, occurrence: 2, startQuarter: 3, durationQuarters: 3, partial: false },
];
it('maps performed repeat occurrences and inner offsets without certifying the evidence', () => {
  const result = checkAnchors([[0, .2], [0, 1, 240], [1, 2], [2, 4]], measures, 5);
  expect(result.issues).toEqual([]);
  expect(result.anchors.map(a => [a.scoreQuarter, a.written, a.occurrence])).toEqual([[0, 1, 1], [1.5, 1, 1], [3, 1, 2], [6, null, null]]);
  expect(result.eligible).toBe(false);
});
it('holds anchors beyond the route or audio and rejects nonmonotonic and malformed tuples', () => {
  const result = checkAnchors([[0, 1], [0, .5], [3, 9], [1, 2, 481], 'bad'], measures, 8);
  expect(result.issues).toEqual(expect.arrayContaining([
    expect.stringContaining('time does not increase'), expect.stringContaining('position does not increase'),
    expect.stringContaining('outside performed route'), expect.stringContaining('beyond media duration'),
    expect.stringContaining('invalid bar'), expect.stringContaining('malformed tuple'),
  ]));
  expect(result.eligible).toBe(false);
});
it('does not interpolate a partial measure or mistake absent media and anchors for readiness', () => {
  expect(checkAnchors([[0, 1, 240]], [{ ...measures[0]!, partial: true }], null)).toMatchObject({
    anchors: [{ scoreQuarter: null }], issues: [expect.stringContaining('partial performed'), 'local media duration not established'], eligible: false,
  });
  expect(checkAnchors([], measures, 5)).toMatchObject({ issues: ['no anchors'], eligible: false });
});
