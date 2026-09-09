// Where a bar's heading marks start — the metronome mark, the swing marking,
// the section/rehearsal labels, the tab capo line. All of them share
// `measureHeadingX`, so this asserts the rule once, over the whole corpus, and
// under every combination of the two display switches that can empty a bar's
// prefix.
//
// The bug it pins: the rule used to lead `contentStartX`, which is the start of
// the STRETCHED leading spring, not the first ink. With a clef and a time
// signature that reads correctly, because the prefix glyphs sit between the two.
// With the prefix hidden — or simply absent, as in every mid-piece bar — the
// mark floated in the empty left of the bar, and where the spring was short it
// crossed the barline and read as belonging to the previous bar.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { planHorizontal, measureHeadingX } from '../../src/engine/layout/spacing.ts';
import type { DisplayOptions } from '../../src/engine/displayOptions.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
import { initSmufl, WIDTH_SP } from '../helpers/corpusPrimitives.ts';
// @ts-expect-error — plain .mjs module without type declarations
import { loadCorpus } from '../verify/check-scenarios.mjs';

const corpus: { id: string; dir: string }[] = loadCorpus();
const readDoc = (dir: string): MnxStructure =>
  JSON.parse(fs.readFileSync(path.join(dir, 'document.mnx.json'), 'utf8')) as MnxStructure;

/** Every combination of the two switches that can empty a bar's prefix. */
const DISPLAYS: (DisplayOptions | undefined)[] = [
  undefined,
  { clefs: 'hide' },
  { timeSignatures: 'hide' },
  { clefs: 'hide', timeSignatures: 'hide' }
];

const HEADING_LEAD_SP = 1.5;

function plans(doc: MnxStructure, display: DisplayOptions | undefined) {
  return planHorizontal(doc, WIDTH_SP, { display }).measures.filter(m => !m.hidden);
}

describe('heading-mark placement', () => {
  it('the corpus has bars to check', () => {
    expect(corpus.length).toBeGreaterThan(50);
  });

  it('never starts a heading mark before its own barline', () => {
    initSmufl();
    let checked = 0;
    for (const scenario of corpus) {
      const doc = readDoc(scenario.dir);
      for (const display of DISPLAYS) {
        let measures;
        try {
          measures = plans(doc, display);
        } catch {
          continue;
        }
        for (const m of measures) {
          expect(
            measureHeadingX(m),
            `${scenario.id} ${JSON.stringify(display ?? 'default')}: heading precedes its barline`
          ).toBeGreaterThanOrEqual(m.x - 1e-9);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('leads the bar’s opening ink: the prefix when it has one, else the first onset', () => {
    initSmufl();
    let withPrefix = 0;
    let bare = 0;
    for (const scenario of corpus) {
      const doc = readDoc(scenario.dir);
      for (const display of DISPLAYS) {
        let measures;
        try {
          measures = plans(doc, display);
        } catch {
          continue;
        }
        for (const m of measures) {
          if (m.repeatStart) continue; // the content anchor clears the `|:` cluster
          const heading = measureHeadingX(m);
          if (m.showTimeSig || m.showClef || m.showKeySig) {
            // Anchored to the prefix, which sits between the mark and the music.
            expect(heading).toBeLessThan(m.contentStartX);
            withPrefix++;
            continue;
          }
          const onsets = m.voices.map(voice => voice[0]?.x).filter((x): x is number => x !== undefined);
          if (!onsets.length) continue; // an empty bar draws no onset to lead
          const first = Math.min(...onsets);
          // A bare bar leads its FIRST NOTE, not the start of the spring that
          // reaches it — the whole point of the rule.
          expect(
            heading,
            `${scenario.id} ${JSON.stringify(display ?? 'default')}: bare bar does not lead its first onset`
          ).toBeCloseTo(Math.max(m.x, first - HEADING_LEAD_SP), 9);
          expect(heading).toBeLessThan(first);
          bare++;
        }
      }
    }
    // Both arms of the rule are exercised, or the assertion above proves nothing.
    expect(withPrefix).toBeGreaterThan(100);
    expect(bare).toBeGreaterThan(100);
  });
});
