// The `barline-type` enum, and the defaulting rule around it.
//
// The rule is the spec's own prose on `measure-global.barline`, quoted because
// this test exists to keep us honest about the second half of it:
//
//   > The barline drawn at the END of this measure. If not provided, the
//   > barline should be interpreted as follows:
//   >   * If the measure is the last in the document, use {"type": "final"}.
//   >   * Otherwise, use {"type": "regular"}.
//
// "If not provided" is the whole point. Every layout used to draw
// thin-unless-last and read `barline` never, which is not an incomplete
// implementation of that rule but an inverted one: it applied the default when
// the document had spoken. Four mirrored spec scenarios disagreed with the
// CG's own reference engravings as a result, `hello-world` among them.
//
// Barlines are GLOBAL-measure furniture, so both staff kinds are asserted here
// against one emitter — the same argument `scoreText.ts` settles for labels.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { layoutTab } from '../../src/engine/layout/tab.ts';
import { layoutNotation } from '../../src/engine/layout/notation.ts';
import {
  emitEndBarline,
  resolveBarlineType,
  type BarlineMetrics,
  type BarlineType
} from '../../src/engine/layout/barlines.ts';
import { initSmufl, WIDTH_SP } from '../helpers/corpusPrimitives.ts';
// @ts-expect-error — plain .mjs module without type declarations
import { ROOT } from '../verify/check-scenarios.mjs';
import type { MnxStructure } from '../../src/model/mnx.ts';
import type { Primitive } from '../../src/engine/primitives.ts';

initSmufl();

/** Twelve bars, double barlines at 4 and 8, `final` declared at 12. */
const BLUES = 'lab/00-document/04-twelve-bar-blues';

const METRICS: BarlineMetrics = { thinSp: 0.16, thickSp: 0.5, gapSp: 0.3 };

const ALL_TYPES: BarlineType[] = [
  'regular', 'dotted', 'dashed', 'heavy', 'double', 'final',
  'heavyLight', 'heavyHeavy', 'tick', 'short', 'noBarline'
];

function load(id: string): MnxStructure {
  return JSON.parse(
    fs.readFileSync(path.join(ROOT, 'scenarios', id, 'score.mnx.json'), 'utf8')
  ) as MnxStructure;
}

function drawn(type: BarlineType): Primitive[] {
  const primitives: Primitive[] = [];
  emitEndBarline({ type, x: 10, top: 0, bottom: 4, metrics: METRICS, primitives });
  return primitives;
}

describe('the defaulting rule', () => {
  it('uses the spec default only when the document is silent', () => {
    expect(resolveBarlineType(undefined, false)).toBe('regular');
    expect(resolveBarlineType(undefined, true)).toBe('final');
  });

  it('lets an explicit type win — including `regular` on the last measure', () => {
    // The `hello-world` bug exactly: one measure, declared regular, engraved
    // by the CG with a plain barline, drawn by us as thin+thick.
    expect(resolveBarlineType({ type: 'regular' }, true)).toBe('regular');
    expect(resolveBarlineType({ type: 'double' }, false)).toBe('double');
    expect(resolveBarlineType({ type: 'final' }, false)).toBe('final');
  });
});

describe('every type in the enum draws something distinguishable', () => {
  it('covers the whole enum', () => {
    // Guards the switch against a schema that grows a case: if the enum in
    // `barlines.ts` and this list drift, one of them is stale.
    for (const type of ALL_TYPES) expect(() => drawn(type)).not.toThrow();
  });

  it('draws nothing at all for noBarline', () => {
    expect(drawn('noBarline')).toEqual([]);
  });

  it('gives every other type ink, all of it ending at the measure x', () => {
    for (const type of ALL_TYPES.filter(t => t !== 'noBarline')) {
      const ps = drawn(type);
      expect(ps.length, type).toBeGreaterThan(0);
      const right = Math.max(...ps.map(p => (p.kind === 'rect' ? p.x + p.w : (p as any).x1)));
      expect(right, type).toBeCloseTo(10, 6);
    }
  });

  it('makes each style structurally distinct from the others', () => {
    // Shape, not pixels: the count and kinds of primitives plus the dash and
    // vertical span, which is what separates e.g. `heavy` from `heavyHeavy`
    // and `tick` from `short`.
    const shape = (t: BarlineType) =>
      JSON.stringify(drawn(t).map(p => [
        p.kind,
        (p as any).dash ?? null,
        (p as any).y1 ?? (p as any).y,
        (p as any).y2 ?? ((p as any).y + (p as any).h)
      ]));
    const seen = new Map<string, BarlineType>();
    for (const t of ALL_TYPES) {
      const k = shape(t);
      expect(seen.get(k), `${t} draws the same as ${seen.get(k)}`).toBeUndefined();
      seen.set(k, t);
    }
  });

  it('reaches outside the staff for tick and stays inside it for short', () => {
    const tick = drawn('tick')[0] as any;
    expect(tick.y1).toBeLessThan(0);   // above the top line
    expect(tick.y2).toBeGreaterThan(0);
    const short = drawn('short')[0] as any;
    expect(short.y1).toBeGreaterThan(0);
    expect(short.y2).toBeLessThan(4);  // clear of the bottom line
  });
});

describe('both staff kinds honour it', () => {
  for (const view of ['notation', 'tab'] as const) {
    it(`${view}: draws the declared doubles, and only there`, () => {
      const mnx = load(BLUES);
      const layout =
        view === 'tab'
          ? layoutTab({ mnx, widthSp: WIDTH_SP })
          : layoutNotation({ mnx, widthSp: WIDTH_SP });

      const doubles = layout.primitives.filter(p => p.className === 'barline barline-double');
      // Two lines per double barline, per staff the layout draws.
      expect(doubles.length % 2).toBe(0);
      expect(doubles.length).toBeGreaterThanOrEqual(4);

      // Still exactly one final barline at the end, declared on bar 12.
      expect(
        layout.primitives.filter(p => p.className === 'barline barline-final-thick').length
      ).toBeGreaterThanOrEqual(1);
    });
  }
});
