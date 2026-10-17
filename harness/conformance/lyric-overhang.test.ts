// A syllable hangs over neighbours that carry none — the Soundslice rule
// (measured on its "Suzanne", 2026-10-16: eighths stay 28.2px apart under any
// word, and only two words that would touch push their notes apart, to half
// an em of white). Before, every syllable priced its whole width into its own
// note's column, so a long word over a short note spread the rhythm unevenly.
import { describe, it, expect } from 'vitest';
import { layoutTab } from '../../src/engine/layout/tab.ts';
import { layoutNotation } from '../../src/engine/layout/notation.ts';
import { computeBoundsSp } from '../../src/engine/render/bounds.ts';
import { initSmufl, WIDTH_SP } from '../helpers/corpusPrimitives.ts';
import type { LayoutResult, Primitive } from '../../src/engine/primitives.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

type Words = (null | string | { text: string; type: string })[];

/** One 4/4 bar of eighths on a guitar part; `verses[k][i]` is the syllable
 *  verse k hangs on eighth i (null: none). */
function bar(...verses: Words[]): MnxStructure {
  return bars(1, ...verses);
}

/** `count` identical bars of `bar`'s eighths. */
function bars(count: number, ...verses: Words[]): MnxStructure {
  const lineIds = verses.map((_, k) => String(k + 1));
  return {
    mnx: { version: 1 },
    global: { lyrics: { lineOrder: lineIds }, measures: Array.from({ length: count }, (_, i) => (i === 0 ? { time: { count: 4, unit: 4 } } : {})) },
    parts: [{
      name: 'Guitar',
      _x: { mnxLab: {
        strings: (['E4', 'B3', 'G3', 'D3', 'A2', 'E2'] as const).map((p, i) => ({ string: i + 1, pitch: { step: p[0], octave: Number(p[1]) } })),
        tab: { staffKind: 'both' }
      } },
      measures: Array.from({ length: count }, (_, m) => ({
        ...(m === 0 ? { clefs: [{ clef: { sign: 'G', staffPosition: -2 } }] } : {}),
        sequences: [{
          content: Array.from({ length: 8 }, (_, i) => {
            const lines: Record<string, { text: string; type: string }> = {};
            verses.forEach((words, k) => {
              const w = words[i];
              if (w) lines[lineIds[k]] = typeof w === 'string' ? { text: w, type: 'whole' } : w;
            });
            return {
              duration: { base: 'eighth' },
              notes: [{ pitch: { step: 'G', octave: 3 } }],
              ...(Object.keys(lines).length ? { lyrics: { lines } } : {})
            };
          })
        }]
      }))
    }]
  } as MnxStructure;
}

const ofClass = (layout: LayoutResult, cls: string) =>
  layout.primitives.filter((p): p is Extract<Primitive, { kind: 'text' }> => p.kind === 'text' && p.className === cls);
const digitXs = (layout: LayoutResult) => ofClass(layout, 'fret-number').map(p => p.x);
const box = (p: Primitive) => computeBoundsSp([p])!;
const bare = Array<null>(8).fill(null);

describe('a syllable hangs over neighbours that carry none', () => {
  it('a long word over bare neighbours leaves the rhythm as it was', () => {
    initSmufl();
    const without = layoutTab({ mnx: bar(bare), widthSp: WIDTH_SP });
    const words: Words = [...bare];
    words[3] = 'beautifully';
    const withWord = layoutTab({ mnx: bar(words), widthSp: WIDTH_SP });
    expect(digitXs(withWord)).toEqual(digitXs(without));
    // ...and the word really is wider than its note's share of the bar.
    const [word] = ofClass(withWord, 'lyric');
    const xs = digitXs(withWord);
    expect(box(word).w).toBeGreaterThan(xs[4] - xs[3]);
  });

  it('only words that would touch push their notes apart, by the word gap', () => {
    initSmufl();
    for (const layout of [layoutTab, layoutNotation]) {
      const words: Words = ['extraordinarily', 'long', null, null, 'and', 'so', 'on', null];
      const result = layout({ mnx: bar(words), widthSp: WIDTH_SP });
      const texts = ofClass(result, 'lyric').sort((a, b) => a.x - b.x);
      for (let i = 1; i < texts.length; i++) {
        expect(box(texts[i - 1]).x + box(texts[i - 1]).w, `"${texts[i - 1].text}" runs into "${texts[i].text}"`)
          .toBeLessThanOrEqual(box(texts[i]).x + 1e-6);
      }
    }
  });

  it('two words keep a word space between them even at Space 0', () => {
    // The gap's air follows Space down to zero; a word space of it does not
    // — "Once upon", never "Onceupon" (a phone at Space 0, 2026-10-17).
    initSmufl();
    for (const layout of [layoutTab, layoutNotation]) {
      for (const densityH of [0, 1, undefined]) {
        const words: Words = ['Once', 'upon', 'a', 'time', 'you', 'dressed', 'so', 'fine'];
        const result = layout({ mnx: bars(2, words), widthSp: WIDTH_SP, densityH });
        const rows = new Map<number, Extract<Primitive, { kind: 'text' }>[]>();
        for (const t of ofClass(result, 'lyric')) rows.set(t.y, [...(rows.get(t.y) ?? []), t]);
        for (const texts of rows.values()) {
          texts.sort((a, b) => a.x - b.x);
          for (let i = 1; i < texts.length; i++) {
            const gap = box(texts[i]).x - (box(texts[i - 1]).x + box(texts[i - 1]).w);
            expect(gap, `Space ${densityH}: "${texts[i - 1].text}" ${gap.toFixed(2)}sp from "${texts[i].text}"`)
              .toBeGreaterThanOrEqual(0.3);
          }
        }
      }
    }
  });

  it('words stay inside their bar', () => {
    initSmufl();
    const words: Words = ['Sing', null, null, null, null, null, null, 'everywhere'];
    const result = layoutTab({ mnx: bar(words), widthSp: WIDTH_SP });
    const barlines = result.primitives.filter(p => p.kind === 'line' && /barline/.test(p.className ?? ''))
      .map(p => (p as Extract<Primitive, { kind: 'line' }>).x1);
    const right = Math.max(...barlines);
    for (const text of ofClass(result, 'lyric')) {
      expect(box(text).x + box(text).w, `"${text.text}" crosses the barline`).toBeLessThanOrEqual(right);
    }
  });

  it('a hyphen gets room between the syllables it joins', () => {
    initSmufl();
    const words: Words = [{ text: 'won', type: 'start' }, { text: 'der', type: 'middle' }, { text: 'ful', type: 'end' }, null, null, null, null, null];
    const result = layoutTab({ mnx: bar(words), widthSp: WIDTH_SP });
    const texts = ofClass(result, 'lyric').sort((a, b) => a.x - b.x);
    const hyphens = ofClass(result, 'lyric-hyphen');
    expect(hyphens).toHaveLength(2);
    for (const hyphen of hyphens) {
      const h = box(hyphen);
      const before = texts.filter(t => t.x < hyphen.x).at(-1)!;
      const after = texts.find(t => t.x > hyphen.x)!;
      expect(h.x - (box(before).x + box(before).w)).toBeGreaterThan(0.2);
      expect(box(after).x - (h.x + h.w)).toBeGreaterThan(0.2);
    }
  });

  it('verse lines do not push each other: a long word in one verse leaves the other alone', () => {
    initSmufl();
    const one: Words = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const long: Words = [...bare];
    long[3] = 'beautifully';
    const single = layoutTab({ mnx: bar(one, bare), widthSp: WIDTH_SP });
    const both = layoutTab({ mnx: bar(one, long), widthSp: WIDTH_SP });
    expect(digitXs(both)).toEqual(digitXs(single));
  });

  it('a bar whose words bind at rest still spreads its notes across its width', () => {
    // At low stretch a row of words can be the bar's longest path while the
    // notes under it have room to grow; the stretch solver once stopped short
    // and left the notes crammed at the start of a justified bar. The word
    // pattern is Suzanne's bar 11 (three verses), with neutral words.
    initSmufl();
    const one: Words = ['spend', null, 'the', null, 'night', null, null, 'beside'];
    const two: Words = ['lonely', null, null, null, 'wooden', null, null, null];
    const three: Words = [null, 'Salvation', null, null, 'Army', null, null, null];
    for (const widthSp of [WIDTH_SP, WIDTH_SP * 1.5, WIDTH_SP * 2]) {
      const result = layoutTab({ mnx: bars(12, one, two, three), widthSp });
      const row = result.rows[0];
      const barXs = [...new Set(result.primitives
        .filter(p => p.kind === 'line' && /barline/.test(p.className ?? '') && p.y1 >= row.staffTop - 1e-6 && p.y1 <= row.staffBottom)
        .map(p => (p as Extract<Primitive, { kind: 'line' }>).x1))].sort((a, b) => a - b);
      const xs = digitXs(result);
      expect(barXs.length).toBeGreaterThan(2);
      for (let b = 1; b + 1 < barXs.length; b++) {
        const inBar = xs.filter(x => x > barXs[b] && x < barXs[b + 1]);
        if (inBar.length < 8) continue;
        const span = barXs[b + 1] - barXs[b];
        expect(barXs[b + 1] - Math.max(...inBar), `width ${widthSp}, bar ${b}: notes crammed to the left`).toBeLessThan(0.25 * span);
      }
    }
  });
});
