// The pass model (one-surface item 6, phase 3): the shared linearization of
// the repeat structure — player timeline, per-bar pass counts, and the
// strain iterations each bar sounds on.
import { describe, expect, it } from 'vitest';
import { hasRepeatStructure, linearizePasses } from '../../src/model/passes.ts';
import type { MnxGlobalMeasure, MnxLabNavigation, MnxStructure } from '../../src/model/mnx.ts';
import { MNX_JUMP_TYPES, MNX_LAB_JUMP_TYPES } from '../../src/model/mnx.ts';

const docOf = (measures: MnxGlobalMeasure[]): MnxStructure =>
  ({ mnx: { version: 1 }, global: { measures }, parts: [] }) as unknown as MnxStructure;

describe('linearizePasses', () => {
  it('keeps the published and lab jump vocabularies disjoint', () => {
    expect(MNX_JUMP_TYPES.filter(value => (MNX_LAB_JUMP_TYPES as readonly string[]).includes(value))).toEqual([]);
  });

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

  it('a lone later ending: passes it is not for still repeat while the strain has passes left', () => {
    // m0 · |: m1 · m2 | m3 (2.) :|x3 · m4 — Sun Did Glide's Interlude: A, A + Interlude, A, then on
    const model = linearizePasses(docOf([
      {},
      { repeatStart: {} },
      {},
      { ending: { numbers: [2], duration: 1 }, repeatEnd: { times: 3 } },
      {}
    ]));
    expect(model.order).toEqual([0, 1, 2, 1, 2, 3, 1, 2, 4]);
    expect(model.soundingPasses).toEqual([[1], [1, 2, 3], [1, 2, 3], [2], [1]]);
    expect(model.entries.at(-1)!.iteration).toBe(1);
    expect(model.diagnostics).toEqual([]);

    // The same with a multi-bar ending and the default two passes: pass 1 skips it and repeats.
    const twice = linearizePasses(docOf([
      { repeatStart: {} },
      { ending: { numbers: [2], duration: 2 } },
      { repeatEnd: {} },
      {}
    ]));
    expect(twice.order).toEqual([0, 0, 1, 2, 3]);
  });

  it('a strain spent through an earlier ending is left, not looped, when its later ending is skipped', () => {
    // m0 · |: m1 · m2 (1.3.) :| · m3 m4 (2.) :|x3 · m5 — the same shape written with standard voltas.
    // Pass 3 spends the strain at m2; skipping the "2." after it must leave (MuseScore agrees).
    const expected = [0, 1, 2, 1, 3, 4, 1, 2, 5];
    for (const first of [{}, { times: 3 }]) {
      const model = linearizePasses(docOf([
        {},
        { repeatStart: {} },
        { ending: { numbers: [1, 3], duration: 1 }, repeatEnd: first },
        { ending: { numbers: [2], duration: 2 } },
        { repeatEnd: { times: 3 } },
        {}
      ]));
      expect(model.truncated).toBe(false);
      expect(model.order).toEqual(expected);
    }
  });

  it('chained voltas inside one strain: an inner exit does not reset the pass', () => {
    // |: m0 (1.4.) | m1 (1.3.4.) | m2 (1.–4.) :|x4 | m3 — Guitar Pro's shape
    const model = linearizePasses(docOf([
      { repeatStart: {}, ending: { numbers: [1, 4], duration: 1 } },
      { ending: { numbers: [1, 3, 4], duration: 1 } },
      { ending: { numbers: [1, 2, 3, 4], duration: 1 }, repeatEnd: { times: 4 } },
      {}
    ]));
    expect(model.truncated).toBe(false);
    expect(model.order).toEqual([0, 1, 2, 2, 1, 2, 0, 1, 2, 3]);
    expect(model.passCounts).toEqual([2, 3, 4, 1]);
    expect(model.soundingPasses).toEqual([[1, 4], [1, 3, 4], [1, 2, 3, 4], [1]]);
  });

  it('D.S. al fine: to the segno, stop at fine', () => {
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

  it('plain D.S.: to the segno, repeats taken again, plays to the end', () => {
    const model = linearizePasses(docOf([
      { segno: { location: { fraction: [0, 1] } } },
      { repeatEnd: {} },
      { jump: { type: 'segno', location: { fraction: [1, 1] } } },
      {}
    ]));
    expect(model.order).toEqual([0, 1, 0, 1, 2, 0, 1, 0, 1, 2, 3]);
    expect(model.passCounts).toEqual([4, 4, 2, 1]);
  });

  it('a D.S. landing mid-strain repeats from that strain\'s start', () => {
    // |: m0 · m1 segno · m2 :| · m3 D.S.
    const model = linearizePasses(docOf([
      { repeatStart: {} },
      { segno: { location: { fraction: [0, 1] } } },
      { repeatEnd: {} },
      { jump: { type: 'segno', location: { fraction: [1, 1] } } }
    ]));
    expect(model.order).toEqual([0, 1, 2, 0, 1, 2, 3, 1, 2, 0, 1, 2, 3]);
  });

  it('a repeat closing on a jump\'s bar is finished before the jump', () => {
    // m0 segno · |: m1 · m2 :| D.S. · m3 — One Of These Things First, bars 41–44
    const model = linearizePasses(docOf([
      { segno: { location: { fraction: [0, 1] } } },
      { repeatStart: {} },
      { repeatEnd: {}, jump: { type: 'segno', location: { fraction: [1, 1] } } },
      {}
    ]));
    expect(model.order).toEqual([0, 1, 2, 1, 2, 0, 1, 2, 1, 2, 3]);
    expect(model.entries[4]!.until).toEqual([1, 1]);
    expect(model.entries[2]!.until).toBeUndefined();
  });

  it('a jump in a numbered ending fires on that ending\'s pass', () => {
    // |: m0 · m1 (1.) :| D.S. · m2 (2.) — the first ending's D.S. fires on pass 1
    const model = linearizePasses(docOf([
      { repeatStart: {}, segno: { location: { fraction: [0, 1] } } },
      { ending: { numbers: [1], duration: 1 }, repeatEnd: {}, jump: { type: 'segno', location: { fraction: [1, 1] } } },
      { ending: { numbers: [2], duration: 1 } }
    ]));
    expect(model.order).toEqual([0, 1, 0, 1, 0, 2]);
    expect(model.entries[1]!.until).toEqual([1, 1]);
  });

  it('D.S. al Coda: the return and the coda both take their repeats', () => {
    // m0 segno · |: m1 :|x3 To Coda · m2 D.S. al Coda · |: m3 coda · m4 :|
    const measures: MnxGlobalMeasure[] = [
      { segno: { id: 'segno', location: { fraction: [0, 1] } } },
      { repeatStart: {}, repeatEnd: { times: 3 }, _x: { mnxLab: { navigation: { jumps: [
        { type: 'toCoda', target: 'coda', location: { fraction: [1, 1] } }] } } } },
      { _x: { mnxLab: { navigation: { jumps: [
        { type: 'dalSegnoAlCoda', target: 'segno', resumeAt: 'coda', location: { fraction: [1, 1] } }] } } } },
      { repeatStart: {}, _x: { mnxLab: { navigation: { marks: [{ id: 'coda', kind: 'coda', location: { fraction: [0, 1] } }] } } } },
      { repeatEnd: {} }
    ];
    const model = linearizePasses(docOf(measures));
    expect(model.order).toEqual([0, 1, 1, 1, 2, 0, 1, 1, 1, 3, 4, 3, 4]);
    expect(model.entries.filter(e => e.via === 'jump').map(e => e.measureIndex)).toEqual([0, 3]);
    expect(model.diagnostics).toEqual([]);
  });

  it('performs the two-stage coda route distilled from Blackbird', () => {
    const measures: MnxGlobalMeasure[] = Array.from({ length: 34 }, () => ({}));
    const nav = (at: number): MnxLabNavigation => (measures[at]!._x = { mnxLab: { navigation: {} } }).mnxLab.navigation;
    nav(2).marks = [{ id: 'double-segno', kind: 'segno', count: 2, location: { fraction: [0, 1] } }];
    nav(8).jumps = [{ type: 'toCoda', target: 'double-coda', text: 'To Double Coda', location: { fraction: [1, 1] } }];
    measures[13]!.segno = { id: 'segno', location: { fraction: [0, 1] } };
    nav(17).jumps = [{ type: 'toCoda', target: 'coda', text: 'To Coda', location: { fraction: [1, 1] } }];
    nav(25).jumps = [{ type: 'dalSegnoAlCoda', target: 'segno', resumeAt: 'coda', location: { fraction: [1, 1] } }];
    nav(26).marks = [{ id: 'coda', kind: 'coda', location: { fraction: [0, 1] } }];
    nav(32).jumps = [{ type: 'dalSegnoAlCoda', target: 'double-segno', resumeAt: 'double-coda', location: { fraction: [1, 1] } }];
    nav(33).marks = [{ id: 'double-coda', kind: 'coda', count: 2, location: { fraction: [0, 1] } }];

    const model = linearizePasses(docOf(measures));
    expect(model.order).toEqual([
      ...Array.from({ length: 26 }, (_, i) => i),
      13, 14, 15, 16, 17,
      26, 27, 28, 29, 30, 31, 32,
      2, 3, 4, 5, 6, 7, 8,
      33
    ]);
    expect(model.truncated).toBe(false);
    expect(model.diagnostics).toEqual([]);
  });

  it('diagnoses missing and duplicate explicit targets deterministically', () => {
    const missing = linearizePasses(docOf([
      {}, { _x: { mnxLab: { navigation: { jumps: [{
        type: 'dalSegno', target: 'absent', location: { fraction: [1, 1] }
      }] } } } }
    ]));
    expect(missing.diagnostics.map(diagnostic => diagnostic.code)).toContain('jump-without-target');
    expect(missing.truncated).toBe(false);

    const duplicate = linearizePasses(docOf([
      { _x: { mnxLab: { navigation: { marks: [{ id: 'coda', kind: 'coda', location: { fraction: [0, 1] } }] } } } },
      { _x: { mnxLab: { navigation: { marks: [{ id: 'coda', kind: 'coda', location: { fraction: [0, 1] } }] } } } }
    ]));
    expect(duplicate.diagnostics.map(diagnostic => diagnostic.code)).toEqual(['duplicate-target']);
  });

  it('a malformed graph truncates instead of spinning', () => {
    const model = linearizePasses(docOf([{ repeatStart: {} }, { repeatEnd: { times: 100000 } }]));
    expect(model.truncated).toBe(true);
    expect(model.order.length).toBeGreaterThan(0);
  });
});
