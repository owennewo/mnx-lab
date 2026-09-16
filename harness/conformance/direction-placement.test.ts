// Above-staff prose uses the lowest collision-free lane. In particular, an
// overlap chain must not become a staircase: if A overlaps B and B overlaps C
// but A does not overlap C, C can return to A's lane.
import { describe, expect, it } from 'vitest';
import { emitDirections } from '../../src/engine/layout/notation.ts';
import { COHESION_CLEAR_SP } from '../../src/engine/layout/scoreText.ts';
import { computeBoundsSp } from '../../src/engine/render/bounds.ts';
import type { MnxPartMeasure, MnxSequence } from '../../src/model/mnx.ts';
import type { Primitive } from '../../src/engine/primitives.ts';

describe('above-staff direction placement', () => {
  it('reuses a lower lane after a local overlap chain clears', () => {
    const quarter = { base: 'quarter' as const };
    const sequence: MnxSequence = {
      content: [0, 1, 2].map(() => ({ duration: quarter, notes: [{ pitch: { step: 'C', octave: 4 } }] }))
    };
    const partMeasure: MnxPartMeasure = {
      directions: [0, 1, 2].map(n => ({
        position: { fraction: [n, 4] },
        text: 'AAAAAA',
        orient: 'above'
      })),
      sequences: [sequence]
    };
    const primitives: Primitive[] = [];

    emitDirections({
      partMeasure,
      m: { x: 0, width: 16, staves: [[[{ x: 3 }, { x: 7 }, { x: 11 }]]] },
      sequencesByStaff: [[sequence]],
      staffTops: [10],
      staffBottoms: [14],
      primitives,
      scan: []
    });

    const directions = primitives.filter(
      (p): p is Extract<Primitive, { kind: 'text' }> => p.kind === 'text' && p.className === 'direction'
    );
    expect(directions).toHaveLength(3);
    expect(directions[1].y).toBeLessThan(directions[0].y);
    expect(directions[2].y).toBeCloseTo(directions[0].y, 9);

    const first = computeBoundsSp([directions[0]])!;
    const second = computeBoundsSp([directions[1]])!;
    expect(first.y - (second.y + second.h)).toBeCloseTo(COHESION_CLEAR_SP, 9);
  });
});
