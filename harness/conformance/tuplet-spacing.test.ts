import { describe, expect, it } from 'vitest';
import type { MnxStructure } from '../../src/model/mnx.ts';
import { planHorizontal, spacePolicy, SPACE_DEFAULT_SP } from '../../src/engine/layout/spacing.ts';
import { initSmufl } from '../helpers/corpusPrimitives.ts';

// A tuplet's inner events are columns of their own in the plan, with springs
// for the time they really take (2026-10-17). They used to be one rigid
// column per tuplet, which left a row of all-triplet bars unable to reach the
// margin (Merrily Kissed the Quaker, row 4), squeezed triplets against the
// plain notes beside them, kept them out of Space's reach, and gave a bar that
// opens with one no lead-in.

const eighth = (step: string) => ({ duration: { base: 'eighth' }, notes: [{ pitch: { step, octave: 4 } }] });
const triplet = () => ({
  type: 'tuplet',
  inner: { multiple: 3, duration: { base: 'eighth' } },
  outer: { multiple: 2, duration: { base: 'eighth' } },
  content: [eighth('C'), eighth('D'), eighth('E')]
});

const doc = (bars: unknown[][]): MnxStructure => ({
  mnx: { version: 1 },
  global: { measures: bars.map((_, i) => (i === 0 ? { time: { count: 4, unit: 4 } } : {})) },
  parts: [{
    measures: bars.map((content, i) => ({
      ...(i === 0 ? { clefs: [{ clef: { sign: 'G', staffPosition: -2 } }] } : {}),
      sequences: [{ content }]
    }))
  }]
} as unknown as MnxStructure);

const allTriplets = () => doc(Array.from({ length: 12 }, () => [triplet(), triplet(), triplet(), triplet()]));

describe('tuplet spacing', () => {
  it('a row of bars made only of triplets still reaches the margin', () => {
    initSmufl();
    const widthSp = 60;
    const plan = planHorizontal(allTriplets(), widthSp);
    expect(plan.rowCount).toBeGreaterThan(2);
    const margin = spacePolicy(SPACE_DEFAULT_SP).horizontalMargin;
    for (let row = 0; row < plan.rowCount - 1; row++) {
      const last = plan.measures.filter(m => m.row === row).at(-1)!;
      expect(last.x + last.width).toBeCloseTo(widthSp - margin, 6);
    }
  });

  it('lists each inner event on the tuplet\'s slot, spaced by Space like any note', () => {
    initSmufl();
    const gap = (densityH: number) => {
      const slot = planHorizontal(allTriplets(), 400, { densityH, spacingMode: 'natural' }).measures[1].voices[0][0];
      expect(slot.inner).toHaveLength(3);
      expect(slot.x).toBe(slot.inner![0]);
      return slot.inner![1] - slot.inner![0];
    };
    expect(gap(0)).toBeLessThan(gap(SPACE_DEFAULT_SP));
    expect(gap(SPACE_DEFAULT_SP)).toBeLessThan(gap(2 * SPACE_DEFAULT_SP));
  });

  it('a triplet eighth takes a little less room than a plain eighth beside it', () => {
    initSmufl();
    const plan = planHorizontal(
      doc([[triplet(), triplet(), eighth('F'), eighth('G'), eighth('A'), eighth('B')]]),
      400,
      { spacingMode: 'natural' }
    );
    const slots = plan.measures[0].voices[0];
    const tripletGap = slots[0].inner![1] - slots[0].inner![0];
    const eighthGap = slots[3].x - slots[2].x;
    expect(tripletGap).toBeLessThan(eighthGap);
    expect(tripletGap).toBeGreaterThan(0.75 * eighthGap);
  });

  it('a bar that opens with a triplet gets the same kind of lead-in as one that opens with a note', () => {
    initSmufl();
    const plan = planHorizontal(allTriplets(), 400, { spacingMode: 'natural' });
    const m = plan.measures[1];
    const contentLeft = spacePolicy(SPACE_DEFAULT_SP).pad('contentLeft');
    // Past the barline's pad, a spring: half the first member's. It was
    // nothing while the tuplet was one rigid column with no spring of its own.
    expect(m.contentStartX - m.x - contentLeft).toBeGreaterThan(0.3);
  });
});
