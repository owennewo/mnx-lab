import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { layoutNotation } from '../../src/engine/layout/notation.ts';
import { layoutTab } from '../../src/engine/layout/tab.ts';
import { layoutBothSystem } from '../../src/engine/layout/bothSystem.ts';
import type { LayoutResult, Primitive } from '../../src/engine/primitives.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
import { initSmufl } from '../helpers/corpusPrimitives.ts';

const scenario = path.resolve(__dirname, '../../scenarios/lab/21-tab-positions/01-open-strings-chord/document.mnx.json');
const doc = JSON.parse(fs.readFileSync(scenario, 'utf8')) as MnxStructure;
const longScenario = path.resolve(__dirname, '../../scenarios/lab/00-document/04-twelve-bar-blues/document.mnx.json');
const longDoc = JSON.parse(fs.readFileSync(longScenario, 'utf8')) as MnxStructure;
const systemBookends = {
  leading: { label: '0:01', title: 'Pre-roll: 0:01' },
  trailing: { label: '0:06', title: 'Post-roll: 0:06' }
};
const tokens = (p: Primitive) => (p.className ?? '').split(' ');

const drawnX = (p: { x: number; dx?: number }, inkRatio: number) => p.x + (p.dx ?? 0) * inkRatio;

function assertBookends(layout: LayoutResult, inkRatio = 1) {
  const marks = layout.primitives.filter(p => tokens(p).includes('recording-bookend'));
  expect(marks).toHaveLength(4);
  expect(marks.filter(p => p.kind === 'text').map(p => p.kind === 'text' ? p.text : '')).toEqual(['0:01', '0:06']);

  const leading = marks.find(p => p.kind === 'rect' && tokens(p).includes('recording-bookend-leading'));
  const trailing = marks.find(p => p.kind === 'rect' && tokens(p).includes('recording-bookend-trailing'));
  const leadingLabel = marks.find(p => p.kind === 'text' && tokens(p).includes('recording-bookend-leading'));
  const trailingLabel = marks.find(p => p.kind === 'text' && tokens(p).includes('recording-bookend-trailing'));
  expect(leading?.kind).toBe('rect'); expect(trailing?.kind).toBe('rect');
  const first = layout.displays?.[0];
  const last = layout.displays?.at(-1);
  expect(first?.length).toBeGreaterThan(0); expect(last?.length).toBeGreaterThan(0);
  if (leading?.kind === 'rect' && trailing?.kind === 'rect' && leadingLabel?.kind === 'text' && trailingLabel?.kind === 'text' && first && last) {
    expect(leading.h).toBeCloseTo(first.at(-1)!.staffBottom - first[0].staffTop);
    expect(trailing.h).toBeCloseTo(last.at(-1)!.staffBottom - last[0].staffTop);
    const leadingLeft = drawnX(leading, inkRatio);
    const trailingLeft = drawnX(trailing, inkRatio);
    expect(drawnX(leadingLabel, inkRatio)).toBeCloseTo(leadingLeft + leading.w * inkRatio / 2);
    expect(drawnX(trailingLabel, inkRatio)).toBeCloseTo(trailingLeft + trailing.w * inkRatio / 2);
    expect(trailingLeft + trailing.w * inkRatio).toBeLessThanOrEqual(layout.usedWidthSp + 0.001);
    for (const label of layout.primitives.filter(p => p.kind === 'text' && tokens(p).includes('staff-label'))) {
      if (label.kind === 'text') expect(drawnX(label, inkRatio)).toBeLessThan(leadingLeft);
    }
  }
  expect(layout.packings?.[0].lastLineRightInsetSp).toBeGreaterThan(0);
}

describe('system bookends', () => {
  it('are opt-in, duration-labelled, and span every displayed staff', () => {
    initSmufl();
    const projections = [
      layoutNotation({ mnx: doc, widthSp: 80, display: { instrumentNames: 'every-system' }, systemBookends }),
      layoutTab({ mnx: doc, widthSp: 80, display: { instrumentNames: 'every-system' }, systemBookends }),
      layoutBothSystem({ mnx: doc, widthSp: 80, display: { instrumentNames: 'every-system' }, systemBookends })
    ];
    for (const layout of projections) assertBookends(layout);
    expect(layoutNotation({ mnx: doc, widthSp: 80 }).primitives.some(p => tokens(p).includes('recording-bookend'))).toBe(false);
  });

  it('keeps block width, gap and label centring in staff-space ink at non-square scales', () => {
    initSmufl();
    for (const inkRatio of [0.4, 4]) {
      const projections = [
        layoutNotation({ mnx: doc, widthSp: 80, inkRatio, display: { instrumentNames: 'every-system' }, systemBookends }),
        layoutTab({ mnx: doc, widthSp: 80, inkRatio, display: { instrumentNames: 'every-system' }, systemBookends }),
        layoutBothSystem({ mnx: doc, widthSp: 80, inkRatio, display: { instrumentNames: 'every-system' }, systemBookends })
      ];
      for (const layout of projections) assertBookends(layout, inkRatio);
    }
  });

  it('does not add the last system inset to full earlier systems at Space 0', () => {
    initSmufl();
    const layout = layoutNotation({ mnx: longDoc, widthSp: 40, densityH: 0, systemBookends });
    expect(layout.displays?.length).toBeGreaterThan(1);
    const staffRight = Math.max(...layout.primitives.flatMap(p =>
      p.kind === 'line' && p.className === 'staff-line' ? [p.x1, p.x2] : []));
    expect(staffRight).toBeCloseTo(layout.usedWidthSp);
  });
});
