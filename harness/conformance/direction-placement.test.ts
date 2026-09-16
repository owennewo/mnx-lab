// Above-staff prose uses the lowest collision-free lane. In particular, an
// overlap chain must not become a staircase: if A overlaps B and B overlaps C
// but A does not overlap C, C can return to A's lane.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { emitDirections } from '../../src/engine/layout/notation.ts';
import { layoutTab } from '../../src/engine/layout/tab.ts';
import { COHESION_CLEAR_SP } from '../../src/engine/layout/scoreText.ts';
import { computeBoundsSp } from '../../src/engine/render/bounds.ts';
import type { MnxPartMeasure, MnxSequence, MnxStructure } from '../../src/model/mnx.ts';
import type { Primitive } from '../../src/engine/primitives.ts';
import { initSmufl } from '../helpers/corpusPrimitives.ts';

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

describe('below-staff direction placement', () => {
  it('stays with its emitting TAB row when tight clearance closes the system gap', () => {
    initSmufl();
    const mnx = JSON.parse(fs.readFileSync(new URL(
      '../../scenarios/lab/31-score-text/04-directions/document.mnx.json', import.meta.url
    ), 'utf8')) as MnxStructure;
    mnx.parts[0].measures[0].directions = ['one', 'two', 'three', 'deep'].map(text => ({
      position: { fraction: [1, 2] }, text, orient: 'below'
    }));
    const result = layoutTab({ mnx, widthSp: 20, display: { clearance: 0 } });
    expect(result.rows).toHaveLength(2);

    const direction = result.primitives.find(
      (p): p is Extract<Primitive, { kind: 'text' }> =>
        p.kind === 'text' && p.className === 'direction' && p.text === 'deep'
    );
    expect(direction).toBeDefined();
    const ink = computeBoundsSp([direction!])!;
    expect(ink.y).toBeGreaterThan(result.rows![0].staffBottom);
    expect(ink.y + ink.h).toBeLessThan(result.rows![1].staffTop);
  });
});
