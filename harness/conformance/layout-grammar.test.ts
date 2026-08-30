// The layout popover's grammar (core-layout-authoring.md).
//
// The claim worth testing is not that the parser accepts strings — it is that
// the sentences can express the corpus. Every layout in every scenario that
// has one is written as a sentence here and must parse back to the committed
// JSON byte-for-byte, so a grammar that cannot say what the spec's own
// examples say fails rather than looking finished.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseLayoutSentence } from '../../src/edit/setupGrammar.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

const load = (id: string): MnxStructure =>
  JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../scenarios', id, 'document.mnx.json'), 'utf8')
  ) as MnxStructure;

/** scenario → the sentence for each of its layouts, in document order. */
const LAYOUT_SENTENCES: Record<string, string[]> = {
  'lab/60-layout/01-group-barline-individual': [
    'layout layout1: bracket individual [ vn1, vn2 ]'
  ],
  'spec/multimeasure-rests': [
    'layout PartAAlone: PartA',
    'layout PartBAlone: PartB'
  ],
  'spec/multiple-layouts': [
    'layout Choral4Staff: bracket individual [ @name: soprano, @name: alto, @name: tenor, @name: bass ]',
    'layout Choral2StaffStemSplit: bracket individual [ "SA": soprano/up alto/down, "TB": tenor/up bass/down ]',
    'layout Choral2StaffChorded: bracket individual [ "SA": soprano alto, "TB": tenor bass ]',
    'layout Choral2StaffMenSplit: bracket individual [ "SA": soprano alto, "TB": tenor/up bass/down ]'
  ],
  'spec/organ-layout': [
    'layout organ3Staff: brace [ organ.1, organ.2 ], organ.3',
    'layout organ3StaffSplitOber: group [ organ~Main/up organ~Oberwerk/down, organ~Hauptwerk ], organ.3'
  ],
  'spec/system-layouts': [
    'layout layout1: bracket unified [ brace "Flutes" [ fl1/up@shortName fl2/down@shortName, @shortName: fl3 ], "Oboes": ob1/up@shortName ob2/down@shortName ], brace "Piano" [ piano.1, piano.2 ]',
    'layout layout2: bracket unified [ brace "Fl." [ @shortName: fl1, @shortName: fl2, @shortName: fl3 ], "Ob.": ob1/up@shortName ob2/down@shortName ], brace "Piano" [ piano.1, piano.2 ]'
  ]
};

describe('the layout grammar says what the corpus says', () => {
  for (const [id, sentences] of Object.entries(LAYOUT_SENTENCES)) {
    it(`${id} — ${sentences.length} layout(s)`, () => {
      const layouts = load(id).layouts ?? [];
      expect(sentences.length, 'a sentence per committed layout').toBe(layouts.length);
      sentences.forEach((sentence, i) => {
        const parsed = parseLayoutSentence(sentence);
        expect(parsed, `unparsed: ${sentence}`).toBeTruthy();
        expect(parsed && 'layout' in parsed).toBe(true);
        const { id: parsedId, content } = (parsed as { layout: { id: string; content: unknown } })
          .layout;
        expect(parsedId).toBe(layouts[i].id);
        expect(content).toEqual(layouts[i].content);
      });
    });
  }
});

describe('the score and multimeasure-rest sentences', () => {
  it('a score naming its own layout', () => {
    expect(parseLayoutSentence('score "Part A": layout PartAAlone')).toEqual({
      score: { index: Number.NaN, value: { name: 'Part A', layout: 'PartAAlone' } }
    });
  });

  it('a comma is a system break', () => {
    const parsed = parseLayoutSentence('score "Full score": m1, m5') as {
      score: { value: MnxStructure['scores'] extends (infer S)[] | undefined ? S : never };
    };
    expect(parsed.score.value).toEqual({
      name: 'Full score',
      pages: [{ systems: [{ measure: 'm1' }, { measure: 'm5' }] }]
    });
  });

  it('a `>` is a layout change inside one system', () => {
    const parsed = parseLayoutSentence('score "X": m1 A > m2 B') as never as {
      score: { value: { pages: { systems: { layoutChanges?: unknown[] }[] }[] } };
    };
    expect(parsed.score.value.pages[0].systems[0].layoutChanges).toEqual([
      { layout: 'B', location: { measure: 'm2', position: { fraction: [0, 1] } } }
    ]);
  });

  it('multimeasure rests count bars, and default to the first score', () => {
    expect(parseLayoutSentence('mmrest m3 x2')).toEqual({
      multimeasureRest: { scoreIndex: 0, start: 'm3', duration: 2 }
    });
    expect(parseLayoutSentence('mmrest m1 x2 in 3')).toEqual({
      multimeasureRest: { scoreIndex: 2, start: 'm1', duration: 2 }
    });
  });

  it('the destruct half moved here whole', () => {
    expect(parseLayoutSentence('no layout 2')).toEqual({ removeDocument: 'layout', index: 1 });
    expect(parseLayoutSentence('no score 1')).toEqual({ removeDocument: 'score', index: 0 });
    expect(parseLayoutSentence('no mmrest 1')).toEqual({
      removeDocument: 'multimeasureRest',
      index: 0
    });
  });

  it('refuses what it cannot read, rather than guessing', () => {
    for (const bad of ['', 'layout', 'layout L1:', 'layout L1: bracket [ vn1', 'mmrest m3', 'score']) {
      expect(parseLayoutSentence(bad), `should refuse: ${bad}`).toBeNull();
    }
  });
});
