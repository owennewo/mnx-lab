// The amber badge for measure-level attributes the engine does not draw
// (core-measure-attributes-gaps.md, item 1). The list in `measureLevelGaps`
// IS the census — and since chord symbols landed (core-chord-symbols.md) it
// is empty: every attribute the census named is drawn. The seam stays; this
// holds it empty until something is declared undrawn again.
import { describe, it, expect } from 'vitest';
import { measureLevelGaps } from '../../src/engine/layout/spacing.ts';
import type { MnxPartMeasure } from '../../src/model/mnx.ts';

describe('measureLevelGaps', () => {
  it('names nothing: every measure-level attribute the census listed is drawn', () => {
    expect(measureLevelGaps({ time: { count: 4, unit: 4 } }, [{ sequences: [] }])).toEqual([]);
    const pm = {
      sequences: [],
      measureRepeat: { number: 1 },
      arpeggios: [{ position: { fraction: [0, 1] }, span: { start: 'a', end: 'b' } }],
      nonArpeggios: [{ position: { fraction: [0, 1] }, span: { start: 'a', end: 'b' } }],
      dynamics: [{ position: { fraction: [0, 1] }, type: 'gradual', wedgeType: 'increasing' }]
    } as unknown as MnxPartMeasure;
    const gm = {
      fermata: {},
      number: 3,
      tempos: [{ bpm: 120, value: { base: 'quarter' } }, { bpm: 60, value: { base: 'half' } }],
      _x: { mnxLab: { harmonies: [{ location: { fraction: [0, 1] }, quality: 'major', root: { step: 'C' } }] } }
    } as never;
    expect(measureLevelGaps(gm, [pm])).toEqual([]);
  });
});
