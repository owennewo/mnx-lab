// The amber badge for measure-level attributes the engine does not draw
// (roadmap/proposed/core-measure-attributes-gaps.md, item 1). The list in
// `measureLevelGaps` IS the census: this test holds it to the schema on one
// side and to the engine on the other.
import { describe, it, expect } from 'vitest';
import { measureLevelGaps } from '../../src/engine/layout/spacing.ts';
import type { MnxPartMeasure } from '../../src/model/mnx.ts';

describe('measureLevelGaps', () => {
  it('names each undrawn measure-level attribute once, and nothing for a plain bar', () => {
    expect(measureLevelGaps({ time: { count: 4, unit: 4 } }, [{ sequences: [] }])).toEqual([]);
    const pm = {
      sequences: [],
      measureRepeat: { number: 1 },
      arpeggios: [{ position: { fraction: [0, 1] } }],
      nonArpeggios: [{ position: { fraction: [0, 1] } }],
      dynamics: [
        { position: { fraction: [0, 1] }, type: 'gradual', wedgeType: 'increasing' },
        { position: { fraction: [1, 2] }, type: 'relative', relativeValue: 'softer' },
        { position: { fraction: [3, 4] }, type: 'immediate', value: 'mf' }
      ]
    } as unknown as MnxPartMeasure;
    const gm = {
      fermata: {},
      tempos: [{ bpm: 120, value: { base: 'quarter' } }, { bpm: 60, value: { base: 'half' } }],
      _x: { mnxLab: { harmonies: [{ location: { fraction: [0, 1] }, quality: 'major', root: { step: 'C' } }] } }
    } as never;
    expect(measureLevelGaps(gm, [pm])).toEqual([
      'fermata on the bar — not drawn',
      '2 tempo marks — only the first is drawn',
      'chord symbols (harmonies) — not drawn',
      'arpeggio — not drawn',
      'non-arpeggio bracket — not drawn',
      'hairpin (gradual dynamic) — not drawn',
      'relative dynamic (softer) — not drawn'
    ]);
  });
});
