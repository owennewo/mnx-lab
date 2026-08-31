// Wide syllables must not occlude their neighbours — the lyric column split.
//
// A syllable is centred on its note, but a column's anchor sits a fixed
// half-core from the column start; lyric width priced only into `core` lands
// entirely to the right of the anchor, so a wide word's left half reached
// back over the previous word (found on "extraordinarily"). spacing.ts now
// splits the requirement around the anchor. This test measures the drawn
// text with the same font metrics the viewport crop uses, on both layouts.
import { describe, it, expect } from 'vitest';
import { layoutNotation } from '../../src/engine/layout/notation.ts';
import { layoutTab } from '../../src/engine/layout/tab.ts';
import { computeBoundsSp } from '../../src/engine/render/bounds.ts';
import { initSmufl, WIDTH_SP } from '../helpers/corpusPrimitives.ts';
import type { LayoutResult, Primitive } from '../../src/engine/primitives.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

function songDoc(): MnxStructure {
  const words = ['this', 'is', 'extraordinarily', 'long'];
  return {
    mnx: { version: 1 },
    global: {
      lyrics: { lineOrder: ['1'] },
      measures: [{ time: { count: 4, unit: 4 } }]
    },
    parts: [{
      name: 'Guitar',
      _x: { mnxLab: {
        strings: [
          { string: 1, pitch: { step: 'E', octave: 4 } },
          { string: 2, pitch: { step: 'B', octave: 3 } },
          { string: 3, pitch: { step: 'G', octave: 3 } },
          { string: 4, pitch: { step: 'D', octave: 3 } },
          { string: 5, pitch: { step: 'A', octave: 2 } },
          { string: 6, pitch: { step: 'E', octave: 2 } }
        ],
        tab: { staffKind: 'both' }
      } },
      measures: [{
        clefs: [{ clef: { sign: 'G', staffPosition: -2 } }],
        sequences: [{
          content: words.map(word => ({
            duration: { base: 'quarter' },
            notes: [{ pitch: { step: 'G', octave: 3 } }],
            lyrics: { lines: { '1': { text: word, type: 'whole' } } }
          }))
        }]
      }]
    }]
  } as MnxStructure;
}

/** Adjacent same-row lyric texts, measured with real font metrics, must not
 *  overlap (the hyphen row is exempt — it sits BETWEEN two texts on purpose). */
function expectNoLyricOverlap(layout: LayoutResult) {
  const texts = layout.primitives
    .filter((p): p is Extract<Primitive, { kind: 'text' }> =>
      p.kind === 'text' && p.className === 'lyric')
    .sort((a, b) => (a.y - b.y) || (a.x - b.x));
  expect(texts.length).toBeGreaterThan(0);
  for (let i = 0; i + 1 < texts.length; i++) {
    const a = texts[i]!;
    const b = texts[i + 1]!;
    if (a.y !== b.y) continue;
    const aBox = computeBoundsSp([a])!;
    const bBox = computeBoundsSp([b])!;
    expect(aBox.x + aBox.w, `"${a.text}" runs into "${b.text}"`).toBeLessThanOrEqual(bBox.x + 1e-6);
  }
}

describe('lyric column split — wide words clear their neighbours', () => {
  it('on the notation layout', () => {
    initSmufl();
    expectNoLyricOverlap(layoutNotation({ mnx: songDoc(), widthSp: WIDTH_SP }));
  });

  it('on the standalone tab layout', () => {
    initSmufl();
    expectNoLyricOverlap(layoutTab({ mnx: songDoc(), widthSp: WIDTH_SP }));
  });
});
