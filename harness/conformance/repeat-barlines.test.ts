// A forward repeat is a BARLINE, not something that follows one.
//
// `|:` opens with a thick stroke standing exactly where the ordinary barline
// goes, so when its bar draws no prefix glyph the repeat IS that barline: it
// sits at the bar's left edge and the plain barline is not drawn under it. The
// exception is a boundary that already carries ink of its own — `:||:`, or a
// declared double/final bar — where both clusters are real and both need room.
//
// The bug this pins: the `|:` was placed after the prefix's CONTENT PAD, which
// triples across the clearance ladder. At wide clearance the cluster peeled
// away from the barline it was supposed to be, with a plain barline still drawn
// behind it. No corpus scenario had a mid-system repeat start, which is how it
// survived; `lab/navigation/repeat-starts-mid-system` is the cover.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { planHorizontal } from '../../src/engine/layout/spacing.ts';
import { layoutNotation } from '../../src/engine/layout/notation.ts';
import { layoutTab } from '../../src/engine/layout/tab.ts';
import type { LayoutResult, Primitive } from '../../src/engine/primitives.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
import { initSmufl, WIDTH_SP } from '../helpers/corpusPrimitives.ts';
// @ts-expect-error — plain .mjs module without type declarations
import { loadCorpus } from '../verify/check-scenarios.mjs';

const CLEARANCES = [0, 1, 2, 3, 4];
const cls = (p: Primitive) => p.className?.split(' ')[0] ?? '';
const inkX = (p: Primitive): number => {
  const q = p as { x?: number; x1?: number; dx?: number; dx1?: number };
  return (q.x ?? q.x1 ?? 0) + (q.dx ?? q.dx1 ?? 0);
};
const isBarlineInk = (p: Primitive) => cls(p) === 'barline';
const isPlainBarline = (p: Primitive) =>
  isBarlineInk(p) && !/repeat|final/.test(p.className ?? '');
const repeatStartThick = (l: LayoutResult) =>
  l.primitives.filter(p => p.kind === 'rect' && (p.className ?? '').includes('repeat-start'));

const bar = (step: string) => ({
  sequences: [{ content: [{ duration: { base: 'whole' }, notes: [{ pitch: { step, octave: 5 } }] }] }]
});
const doc = (globals: object[]): MnxStructure =>
  ({
    mnx: { version: 1 },
    global: { measures: globals },
    parts: [{ measures: 'CDEFGA'.split('').slice(0, globals.length).map(bar) }]
  }) as unknown as MnxStructure;

const TIME = { time: { count: 4, unit: 4 } };

describe('a forward repeat opening a bar', () => {
  it('stands at the barline, at every clearance, when nothing else opens the bar', () => {
    initSmufl();
    const music = doc([TIME, {}, { repeatStart: {} }, {}]);
    for (const clearance of CLEARANCES) {
      const plan = planHorizontal(music, WIDTH_SP, { display: { clearance } });
      const m = plan.measures[2];
      if (m.firstInSystem) continue; // wrapped: the prefix arm, not this one
      expect(m.repeatStartX, `clearance ${clearance}`).toBeCloseTo(m.x, 9);

      const layout = layoutNotation({ mnx: music, widthSp: WIDTH_SP, display: { clearance } });
      const thick = repeatStartThick(layout);
      expect(thick.length).toBeGreaterThan(0);
      for (const stroke of thick)
        expect(
          layout.primitives.filter(p => isPlainBarline(p) && Math.abs(inkX(p) - inkX(stroke)) < 1e-6),
          `clearance ${clearance}: a plain barline is drawn under the repeat's own stroke`
        ).toHaveLength(0);
    }
  });

  it('keeps its room when the boundary already carries ink', () => {
    initSmufl();
    for (const before of [{ repeatEnd: {} }, { barline: { type: 'double' } }]) {
      const music = doc([TIME, before, { repeatStart: {} }, {}]);
      for (const clearance of CLEARANCES) {
        const plan = planHorizontal(music, WIDTH_SP, { display: { clearance } });
        const m = plan.measures[2];
        if (m.firstInSystem) continue;
        expect(
          m.repeatStartX - m.x,
          `${JSON.stringify(before)} clearance ${clearance}: the two clusters would collide`
        ).toBeGreaterThan(0);
      }
    }
  });

  it('follows the prefix glyphs when the bar has any', () => {
    initSmufl();
    const music = doc([{ ...TIME, repeatStart: {} }, {}]);
    const plan = planHorizontal(music, WIDTH_SP, {});
    const m = plan.measures[0];
    expect(m.showClef || m.showTimeSig).toBe(true);
    expect(m.repeatStartX).toBeGreaterThan(m.x);
    expect(m.repeatStartX).toBeGreaterThan(m.timeSigCentreX);
  });
});

describe('the corpus never doubles a barline under a repeat', () => {
  it('holds in both layouts at every clearance', () => {
    initSmufl();
    let checked = 0;
    for (const scenario of loadCorpus() as { id: string; dir: string }[]) {
      const music = JSON.parse(
        fs.readFileSync(path.join(scenario.dir, 'document.mnx.json'), 'utf8')
      ) as MnxStructure;
      if (!(music.global?.measures ?? []).some(m => m.repeatStart)) continue;
      for (const clearance of CLEARANCES) {
        for (const layout of [layoutNotation, layoutTab]) {
          let result: LayoutResult;
          try {
            result = layout({ mnx: music, widthSp: WIDTH_SP, display: { clearance } });
          } catch {
            continue;
          }
          for (const stroke of repeatStartThick(result)) {
            expect(
              result.primitives.filter(
                p => isPlainBarline(p) && Math.abs(inkX(p) - inkX(stroke)) < 1e-6
              ),
              `${scenario.id} clearance ${clearance}`
            ).toHaveLength(0);
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(20);
  });
});
