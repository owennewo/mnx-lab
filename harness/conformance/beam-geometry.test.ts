import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { computePrimitives, initSmufl } from '../helpers/corpusPrimitives.ts';
import { layoutNotation } from '../../src/engine/layout/notation.ts';
import { layoutBothSystem } from '../../src/engine/layout/bothSystem.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
import type { Primitive } from '../../src/engine/primitives.ts';

// The beamed-group geometry rule (roadmap/complete/core-beam-geometry.md, as
// amended): the stem that would come out shortest lands on the minimum, the
// beam is flat under the engraver's three conditions and otherwise slants a
// quarter space per staff step (capped), it then settles on a staff line, and
// the flat house style is a display option. Pinned on the lab scenario
// written for it.

beforeAll(initSmufl);

const SCENARIO = 'scenarios/lab/11-rhythm/04-beamed-stem-lengths/document.mnx.json';
const doc = (): MnxStructure => JSON.parse(fs.readFileSync(SCENARIO, 'utf8'));

type Line = Extract<Primitive, { kind: 'line' }>;
const lines = (prims: readonly Primitive[], cls: string): Line[] =>
  prims.filter((p): p is Line => p.kind === 'line' && (p.className ?? '').split(' ').includes(cls));

/** Top line of the staff row a y coordinate belongs to. */
function staffTops(prims: readonly Primitive[]): number[] {
  const ys = [...new Set(lines(prims, 'staff-line').map(l => l.y1))].sort((a, b) => a - b);
  return ys.filter((y, i) => i === 0 || y - ys[i - 1] > 1.5);
}
/** The staff whose band [top, top + 4] a y coordinate is nearest to. */
const rowOf = (tops: number[], y: number) => {
  let best = 0;
  let bestDist = Infinity;
  tops.forEach((t, i) => { const d = y < t ? t - y : y > t + 4 ? y - t - 4 : 0; if (d < bestDist) { bestDist = d; best = i; } });
  return best;
};

/** The stem's notehead anchor sits 0.168sp inside the head centre, so a stem
 *  drawn L long from the centre measures L - 0.168 between its endpoints. */
const ANCHOR_OFFSET_SP = 0.168;

/** Beamed groups in document order: each group's primary-span beams and the
 *  stems standing under them. Secondary beams over a sub-run are dropped;
 *  a full-span secondary shares its primary's geometry and is kept. */
function groups(prims: readonly Primitive[]) {
  const tops = staffTops(prims);
  const beams = lines(prims, 'beam');
  const outer = beams.filter(b => !beams.some(o => o !== b && rowOf(tops, o.y1) === rowOf(tops, b.y1) &&
    o.x1 <= b.x1 + 1e-6 && o.x2 >= b.x2 - 1e-6 && (o.x2 - o.x1) > (b.x2 - b.x1) + 1e-6));
  const keys = [...new Set(outer.map(b => `${rowOf(tops, b.y1)}:${b.x1.toFixed(3)}:${b.x2.toFixed(3)}`))]
    .sort((a, b) => { const [ra, xa] = a.split(':').map(Number); const [rb, xb] = b.split(':').map(Number); return ra - rb || xa - xb; });
  return keys.map(key => {
    const [row, x1, x2] = key.split(':').map(Number);
    return {
      beams: outer.filter(b => rowOf(tops, b.y1) === row && Math.abs(b.x1 - x1) < 1e-3 && Math.abs(b.x2 - x2) < 1e-3),
      stems: lines(prims, 'stem').filter(s => rowOf(tops, s.y1) === row && s.x1 >= x1 - 0.1 && s.x1 <= x2 + 0.1)
    };
  });
}

/** Expected beam rise per group (y grows downward: negative rises), document order. */
const EXPECTED_SLANT = [
  0, 0,             // bar 1: alternating patterns
  0, 0,             // bar 2: alternating octaves, up- and down-stem
  0, 0, 0, 0,       // bar 3: patterns
  0, 0,             // bar 4: patterns
  -0.75, 0, 0.75, 0.25, // bar 5: rising fifth (capped), inner extreme, falling fourth, falling step
  -0.75, 0,         // bar 6: rising fourth, inner head level with the nearer outer one
  0.25              // bar 7: falling step
];

describe('beamed stem lengths', () => {
  it('lands the shortest stem of every group on the 2.5-space minimum, plus at most the snap', () => {
    const prims = computePrimitives(doc()).notation.primitives;
    const all = groups(prims);
    expect(all).toHaveLength(EXPECTED_SLANT.length);
    const snapMax = 1 - 2 * (0.5 / 2 + 0.13 / 2);
    const shortest = all.map(g => Math.min(...g.stems.map(s => Math.abs(s.y2 - s.y1))));
    for (const len of shortest) {
      expect(len).toBeGreaterThanOrEqual(2.5 - ANCHOR_OFFSET_SP - 1e-3);
      expect(len).toBeLessThanOrEqual(2.5 - ANCHOR_OFFSET_SP + snapMax + 1e-3);
    }
    // The octave groups need no snap: exactly the minimum, at one, two and three beams.
    for (const i of [2, 6, 9]) expect(shortest[i]).toBeCloseTo(2.5 - ANCHOR_OFFSET_SP, 3);
  });

  it('beams flat for matching outer heads, repeating patterns and inner extremes, else a quarter space per step', () => {
    const prims = computePrimitives(doc()).notation.primitives;
    const all = groups(prims);
    all.forEach((g, i) => {
      for (const beam of g.beams) expect(beam.y2 - beam.y1, `group ${i}`).toBeCloseTo(EXPECTED_SLANT[i], 6);
    });
  });

  it('settles every primary beam on a staff line at its anchor stem, or leaves it clear of the staff', () => {
    const prims = computePrimitives(doc()).notation.primitives;
    const tops = staffTops(prims);
    const edge = 0.5 / 2 + 0.13 / 2; // beam and staff-line half-thicknesses
    const settled = (y: number): boolean => {
      const r = y - tops[rowOf(tops, y)];
      if (r < -edge || r > 4 + edge) return true;
      const frac = r - Math.floor(r);
      return frac <= edge + 1e-6 || frac >= 1 - edge - 1e-6;
    };
    // Every stem ends on its beam's centre line; a run is settled when at
    // least one of its stems ends at a sit / straddle / hang position.
    const beams = lines(prims, 'beam');
    expect(beams.length).toBeGreaterThan(0);
    const primary = beams.filter(b => !beams.some(o => o !== b && o.x1 <= b.x1 + 1e-6 && o.x2 >= b.x2 - 1e-6 && (o.x2 - o.x1) > (b.x2 - b.x1) + 1e-6));
    for (const beam of primary) {
      const stems = lines(prims, 'stem').filter(s => s.x1 >= beam.x1 - 0.1 && s.x1 <= beam.x2 + 0.1 && rowOf(tops, s.y1) === rowOf(tops, beam.y1));
      expect(stems.length).toBeGreaterThanOrEqual(2);
      expect(stems.some(s => settled(s.y2))).toBe(true);
    }
  });
});

describe('flat beams', () => {
  it('draws every beam horizontal under display.beams = flat, and byte-identically otherwise', () => {
    const mnx = doc();
    const before = JSON.stringify(mnx);
    const slanted = layoutNotation({ mnx, widthSp: 500 });
    const explicit = layoutNotation({ mnx, widthSp: 500, display: { beams: 'slanted' } });
    const flat = layoutNotation({ mnx, widthSp: 500, display: { beams: 'flat' } });
    expect(explicit.primitives).toEqual(slanted.primitives);
    expect(lines(slanted.primitives, 'beam').some(b => b.y1 !== b.y2)).toBe(true);
    expect(lines(flat.primitives, 'beam').length).toBe(lines(slanted.primitives, 'beam').length);
    for (const beam of lines(flat.primitives, 'beam')) expect(beam.y2).toBeCloseTo(beam.y1, 9);
    expect(JSON.stringify(mnx)).toBe(before);
  });

  it('reaches grace and tuplet beams and the Both system', () => {
    for (const path of ['scenarios/spec/grace-notes-beamed', 'scenarios/spec/tuplets', 'scenarios/lab/26-tab-rhythm/02-grace-on-tab']) {
      const mnx: MnxStructure = JSON.parse(fs.readFileSync(`${path}/document.mnx.json`, 'utf8'));
      const flat = layoutNotation({ mnx, widthSp: 500, display: { beams: 'flat' } });
      expect(lines(flat.primitives, 'beam').length).toBeGreaterThan(0);
      for (const beam of lines(flat.primitives, 'beam')) expect(beam.y2).toBeCloseTo(beam.y1, 9);
    }
    // Both is the same system walk with the tab staves inside it; a document
    // that knows its strings gets the same flat beams there.
    const tabbed: MnxStructure = JSON.parse(fs.readFileSync('scenarios/lab/26-tab-rhythm/02-grace-on-tab/document.mnx.json', 'utf8'));
    const both = layoutBothSystem({ mnx: tabbed, widthSp: 500, display: { beams: 'flat' } });
    expect(lines(both.primitives, 'beam').length).toBeGreaterThan(0);
    for (const beam of lines(both.primitives, 'beam')) expect(beam.y2).toBeCloseTo(beam.y1, 9);
  });
});
