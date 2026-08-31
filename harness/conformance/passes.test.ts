// The pass model (one-surface item 6, phase 3): the shared linearization of
// the repeat structure — player timeline, per-bar pass counts, and the
// strain iterations each bar sounds on.
import { describe, expect, it } from 'vitest';
import { hasRepeatStructure, linearizePasses } from '../../src/model/passes.ts';
import type { MnxGlobalMeasure, MnxStructure } from '../../src/model/mnx.ts';

const docOf = (measures: MnxGlobalMeasure[]): MnxStructure =>
  ({ mnx: { version: 1 }, global: { measures }, parts: [] }) as unknown as MnxStructure;

describe('linearizePasses', () => {
  it('plain music: one pass everywhere', () => {
    const model = linearizePasses(docOf([{}, {}, {}]));
    expect(model.order).toEqual([0, 1, 2]);
    expect(model.passCounts).toEqual([1, 1, 1]);
    expect(model.soundingPasses).toEqual([[1], [1], [1]]);
    expect(model.truncated).toBe(false);
    expect(hasRepeatStructure(docOf([{}, {}, {}]))).toBe(false);
  });

  it('a strain: |: :| defaults to twice, times says more', () => {
    const twice = linearizePasses(docOf([{}, { repeatStart: {} }, { repeatEnd: {} }, {}]));
    expect(twice.order).toEqual([0, 1, 2, 1, 2, 3]);
    expect(twice.passCounts).toEqual([1, 2, 2, 1]);
    expect(twice.soundingPasses).toEqual([[1], [1, 2], [1, 2], [1]]);

    const four = linearizePasses(docOf([{ repeatStart: {} }, { repeatEnd: { times: 4 } }]));
    expect(four.soundingPasses).toEqual([[1, 2, 3, 4], [1, 2, 3, 4]]);
  });

  it('an unmatched :| repeats from the start of the piece', () => {
    const model = linearizePasses(docOf([{}, { repeatEnd: {} }, {}]));
    expect(model.order).toEqual([0, 1, 0, 1, 2]);
    expect(model.soundingPasses[2]).toEqual([1]);
  });

  it('voltas: numbered endings are taken on their passes, and the exit resets', () => {
    // |: m0 m1 | m2 (1.) :| m3 (2.) | m4
    const model = linearizePasses(docOf([
      { repeatStart: {} },
      {},
      { ending: { numbers: [1], duration: 1 }, repeatEnd: {} },
      { ending: { numbers: [2], duration: 1 } },
      {}
    ]));
    expect(model.order).toEqual([0, 1, 2, 0, 1, 3, 4]);
    expect(model.passCounts).toEqual([2, 2, 1, 1, 1]);
    expect(model.soundingPasses).toEqual([[1, 2], [1, 2], [1], [2], [1]]);
  });

  it('D.S. al fine: to the segno, no repeats on the return, stop at fine', () => {
    // m0 · m1 segno · m2 fine · m3 D.S. al fine · m4 (never reached)
    const model = linearizePasses(docOf([
      {},
      { segno: { location: { fraction: [0, 1] } } },
      { fine: { location: { fraction: [1, 1] } } },
      { jump: { type: 'dsalfine', location: { fraction: [1, 1] } } },
      {}
    ]));
    expect(model.order).toEqual([0, 1, 2, 3, 1, 2]);
    expect(model.passCounts).toEqual([1, 2, 2, 1, 0]);
    expect(model.soundingPasses[4]).toEqual([]);
  });

  it('plain D.S.: to the segno, repeats not retaken, plays to the end', () => {
    const model = linearizePasses(docOf([
      { segno: { location: { fraction: [0, 1] } } },
      { repeatEnd: {} },
      { jump: { type: 'segno', location: { fraction: [1, 1] } } },
      {}
    ]));
    expect(model.order).toEqual([0, 1, 0, 1, 2, 0, 1, 2, 3]);
    expect(model.passCounts).toEqual([3, 3, 2, 1]);
  });

  it('a malformed graph truncates instead of spinning', () => {
    const model = linearizePasses(docOf([{ repeatStart: {} }, { repeatEnd: { times: 100000 } }]));
    expect(model.truncated).toBe(true);
    expect(model.order.length).toBeGreaterThan(0);
  });
});
