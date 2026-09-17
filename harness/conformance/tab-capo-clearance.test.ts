import { describe, expect, it } from 'vitest';
import source from '../../scenarios/lab/25-tab-techniques/03-hammer-pull-chain/document.mnx.json';
import type { MnxStructure, MnxEvent } from '../../src/model/mnx.ts';
import { layoutTab } from '../../src/engine/layout/tab.ts';
import { layoutBothSystem } from '../../src/engine/layout/bothSystem.ts';
import { inkEdgesSp } from '../../src/engine/render/bounds.ts';
import { renderSvgMarkup } from '../../src/engine/render/svg.ts';
import { initSmufl } from '../helpers/corpusPrimitives.ts';

function score(string = 1): MnxStructure {
  const mnx = structuredClone(source) as unknown as MnxStructure;
  mnx.parts[0]._x!.mnxLab!.capo = 3;
  mnx.global.measures[0].tempos = [{ bpm: 180, value: { base: 'quarter' } }];
  for (const [i, event] of mnx.parts[0].measures[0].sequences[0].content.entries()) {
    const note = (event as MnxEvent).notes![0];
    note._x!.mnxLab!.string = string;
    note.pitch = string === 1 ? { step: i % 2 ? 'A' : 'G', octave: 4 } : { step: i % 2 ? 'C' : 'B', octave: 3, ...(i % 2 ? {} : { alter: -1 }) };
  }
  return mnx;
}

initSmufl();
describe('capo clearance over opening hammer-ons', () => {
  for (const [view, layout] of [['tab', layoutTab], ['both', layoutBothSystem]] as const) {
    for (const inkRatio of [0.6, 1, 2, 6.4]) {
      it(`${view} clears top-string hammer-ons at ink ratio ${inkRatio}`, () => {
        const result = layout({ mnx: score(), widthSp: 80, inkRatio, display: { clefs: 'hide', timeSignatures: 'hide' } });
        const capo = result.primitives.find(p => p.className === 'tab-capo')!;
        expect(capo).toBeDefined();
        const box = inkEdgesSp(capo);
        const arcs = result.primitives.filter(p => p.className?.includes('technique-hammerPull'));
        expect(arcs.length).toBeGreaterThan(0);
        // The first arc sits under the opening label. It must remain below it,
        // including at the non-square scales the corpus goldens cannot cover.
        expect(inkEdgesSp(arcs[0]).top - box.bottom).toBeGreaterThanOrEqual(0.99);
        if (view === 'tab') {
          const tempo = result.primitives.filter(p => p.className === 'tempo');
          expect(tempo.length).toBeGreaterThan(0);
          expect(Math.max(...tempo.map(p => inkEdgesSp(p).bottom))).toBeLessThan(box.top);
        }
      });
    }
  }
  it('keeps the capo close when the hammer-on is on a lower string', () => {
    const mnx = score(3);
    const withArc = layoutTab({ mnx, widthSp: 80 });
    for (const event of mnx.parts[0].measures[0].sequences[0].content as MnxEvent[]) {
      delete event.notes![0]._x!.mnxLab!.tab;
    }
    const withoutArc = layoutTab({ mnx, widthSp: 80 });
    const capoY = (primitives: typeof withArc.primitives) => {
      const capo = primitives.find(p => p.kind === 'text' && p.className === 'tab-capo')!;
      const staff = primitives.find(p => p.kind === 'line' && p.className === 'staff-line')!;
      return inkEdgesSp(capo).top - inkEdgesSp(staff).top;
    };
    expect(capoY(withArc.primitives)).toBeCloseTo(capoY(withoutArc.primitives));
  });

  it('prints a non-standard tuning once, before the capo and clear of pre-roll', () => {
    const mnx = score();
    mnx.parts[0]._x!.mnxLab!.strings = [
      { string: 1, pitch: { step: 'D', octave: 4 } },
      { string: 2, pitch: { step: 'A', octave: 3 } },
      { string: 3, pitch: { step: 'G', octave: 3 } },
      { string: 4, pitch: { step: 'D', octave: 3 } },
      { string: 5, pitch: { step: 'A', octave: 2 } },
      { string: 6, pitch: { step: 'D', octave: 2 } }
    ];
    for (const inkRatio of [0.6, 1, 4]) {
      for (const layout of [layoutTab, layoutBothSystem]) {
        const result = layout({
          mnx,
          widthSp: 80,
          inkRatio,
          systemBookends: { leading: { label: '0:01' } }
        });
        const tuning = result.primitives.find(p => p.kind === 'text' && p.className === 'tab-tuning-letter');
        const capo = result.primitives.find(p => p.kind === 'text' && p.className === 'tab-capo');
        const preRoll = result.primitives.find(p => p.kind === 'rect' && p.className?.includes('recording-bookend-leading'));
        expect(tuning?.kind).toBe('text');
        expect(capo?.kind).toBe('text');
        expect(preRoll?.kind).toBe('rect');
        if (tuning?.kind !== 'text' || capo?.kind !== 'text' || preRoll?.kind !== 'rect') continue;
        expect(tuning.text).toBe('DADGAD');
        expect(capo.text).toBe('\u00a0Capo 3');
        expect(renderSvgMarkup({
          primitives: result.primitives,
          widthSp: result.widthSp,
          heightSp: result.heightSp,
          pxPerSp: 16,
          pxPerSpY: 16 * inkRatio
        })).toContain('>\u00a0Capo 3</text>');
        expect(tuning.y).toBe(capo.y);
        const tuningBox = inkEdgesSp(tuning);
        const capoBox = inkEdgesSp(capo);
        const tuningLeft = tuning.x + (tuningBox.left - tuning.x) * inkRatio;
        const tuningRight = tuning.x + (tuningBox.right - tuning.x) * inkRatio;
        const capoLeft = capo.x + (capoBox.left - capo.x) * inkRatio;
        const preRollRight = preRoll.x + (preRoll.dx ?? 0) * inkRatio + preRoll.w * inkRatio;
        expect(preRollRight).toBeLessThan(tuningLeft);
        expect(tuningRight).toBeLessThan(capoLeft);
      }
    }
  });
});
