// Pointer placement: the grid is what a click resolves against.
// roadmap/complete/core-editor-pointer-placement.md (studio authoring item 9).
//
// The viewer measures geometry; only the grid knows where a cursor may STAND.
// So the contract this file holds is the resolver's, over the whole corpus:
//
//  - every stop is reachable by the fraction its own onset produces — the
//    forward map (`measurePositionX`) and the inverse the viewer uses
//    (`measurePositionAt`) compose to identity, and the nearest-stop snap then
//    picks the stop we started from;
//  - a clicked note lands on its own stop, its own line and its own voice;
//  - a bar with no ink at all — the empty 28-bar skeleton the item was opened
//    on — is still reachable at any fraction, which is the whole point;
//  - nothing ever lands outside the bar that was clicked.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildGrid,
  measureSpans,
  moveToPointer,
  type EditorCursor,
  type Projection
} from '../../src/edit/cursor.ts';
import {
  measurePositionX,
  measurePositionAt
} from '../../src/engine/render/selectionGeometry.ts';
import { isNavigationIntent } from '../../src/edit/intents.ts';
import { layoutBothSystem } from '../../src/engine/layout/bothSystem.ts';
import { layoutTab } from '../../src/engine/layout/tab.ts';
import { restSpansOf } from '../../src/model/restSpans.ts';
import { syntheticEventKey } from '../../src/model/noteKeys.ts';
import { eventPills } from '../../src/edit/inspector.ts';
import { initSmufl } from '../helpers/corpusPrimitives.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
import type { GlyphPrim, LinePrim, RectPrim } from '../../src/engine/primitives.ts';
// @ts-expect-error — plain .mjs module without type declarations
import { loadCorpus } from '../verify/check-scenarios.mjs';

interface Scenario { id: string; dir: string }
const corpus = (loadCorpus() as Scenario[]).slice().sort((a, b) => a.id.localeCompare(b.id));

function documentOf(dir: string): MnxStructure {
  return JSON.parse(fs.readFileSync(path.join(dir, 'document.mnx.json'), 'utf8')) as MnxStructure;
}

/** Standard tuning, for the engraved-geometry case at the end. */
const STRINGS = [
  { string: 1, pitch: { step: 'E', octave: 4 } }, { string: 2, pitch: { step: 'B', octave: 3 } },
  { string: 3, pitch: { step: 'G', octave: 3 } }, { string: 4, pitch: { step: 'D', octave: 3 } },
  { string: 5, pitch: { step: 'A', octave: 2 } }, { string: 6, pitch: { step: 'E', octave: 2 } }
];

/** A cursor that addresses nothing in particular — every test moves it. */
function start(partIndex = 0, staffIndex = 1): EditorCursor {
  return { measureIndex: 0, onset: { num: 0, den: 1 }, line: 1, partIndex, staffIndex };
}

describe('measurePositionAt', () => {
  // The inset is a clamp, so only positions inside [0,1] round-trip; the
  // clamped ends are checked separately below.
  it('inverts measurePositionX across the inset', () => {
    for (const [left, right, sp] of [[0, 100, 8], [40, 52, 8], [-30, 90, 3.2]]) {
      for (const position of [0, 0.125, 0.25, 1 / 3, 0.5, 0.75, 0.999, 1]) {
        const x = measurePositionX(left, right, position, sp);
        expect(measurePositionAt(left, right, x, sp)).toBeCloseTo(position, 9);
      }
    }
  });

  it('reads the header and the barline as the nearest end of the bar', () => {
    expect(measurePositionAt(0, 100, -20, 8)).toBe(0);
    expect(measurePositionAt(0, 100, 999, 8)).toBe(1);
  });

  // Only a cell of no width at all is degenerate. A NARROW one still has a
  // usable span, because the inset is a fraction of the width before it is a
  // multiple of the staff space — so a sliver reads as a bar, not as one place.
  it('calls a cell of no width one place', () => {
    expect(measurePositionAt(10, 10, 10, 8)).toBe(0);
    expect(measurePositionAt(10, 12, 11, 8)).toBeCloseTo(0.5, 9);
  });
});

describe('moveToPointer over the corpus', () => {
  for (const scenario of corpus) {
    const doc = documentOf(scenario.dir);
    const parts = doc.parts ?? [];
    if (parts.length === 0) continue;

    it(`${scenario.id}: every stop is reachable by its own fraction`, () => {
      const spans = measureSpans(doc);
      for (let partIndex = 0; partIndex < parts.length; partIndex++) {
        const staves = parts[partIndex]?.staves ?? 1;
        for (let staffIndex = 1; staffIndex <= staves; staffIndex++) {
          const grid = buildGrid(doc, partIndex, staffIndex);
          const projection: Projection = grid.mode === 'string' ? 'tab' : 'notation';
          for (const position of grid.positions) {
            const span = spans[position.measureIndex] ?? { num: 1, den: 1 };
            const raw =
              position.onset.num / position.onset.den /
              Math.max(Number.EPSILON, span.num / span.den);
            // Through the geometry the viewer actually uses, not the raw
            // fraction: this is the pixel round trip a real click makes.
            const fraction = measurePositionAt(
              0,
              100,
              measurePositionX(0, 100, Math.max(0, Math.min(1, raw)), 8),
              8
            );
            const landed = moveToPointer(
              grid,
              start(partIndex, staffIndex),
              { measureIndex: position.measureIndex, line: 1, fraction },
              span,
              projection
            );
            expect(landed.measureIndex).toBe(position.measureIndex);
            // Ties go to the earlier stop, so a stop sharing an onset with the
            // one we aimed at is the same place by the only measure that counts.
            expect(landed.onset.num / landed.onset.den).toBeCloseTo(
              position.onset.num / position.onset.den,
              9
            );
          }
        }
      }
    });

    it(`${scenario.id}: a clicked note lands on its own stop, line and voice`, () => {
      const spans = measureSpans(doc);
      for (let partIndex = 0; partIndex < parts.length; partIndex++) {
        const staves = parts[partIndex]?.staves ?? 1;
        for (let staffIndex = 1; staffIndex <= staves; staffIndex++) {
          const grid = buildGrid(doc, partIndex, staffIndex);
          const projection: Projection = grid.mode === 'string' ? 'tab' : 'notation';
          for (const position of grid.positions) {
            const span = spans[position.measureIndex] ?? { num: 1, den: 1 };
            for (const slot of position.slots) {
              const landed = moveToPointer(
                grid,
                start(partIndex, staffIndex),
                {
                  measureIndex: position.measureIndex,
                  // A line deliberately NOT the note's: the key must win.
                  line: projection === 'tab' ? grid.lineCount : 0,
                  noteKey: slot.noteKey,
                  fraction: 0.5
                },
                span,
                projection
              );
              expect(landed.measureIndex).toBe(position.measureIndex);
              expect(landed.onset).toEqual(position.onset);
              expect(landed.line).toBe(
                projection === 'tab' ? slot.line : slot.staffPosition
              );
              expect(landed.voiceIndex ?? 0).toBe(slot.voiceIndex);
            }
          }
        }
      }
    });

    it(`${scenario.id}: any fraction lands inside the bar that was clicked`, () => {
      const spans = measureSpans(doc);
      const grid = buildGrid(doc, 0, 1);
      const projection: Projection = grid.mode === 'string' ? 'tab' : 'notation';
      const measures = [...new Set(grid.positions.map(p => p.measureIndex))];
      for (const measureIndex of measures) {
        const span = spans[measureIndex] ?? { num: 1, den: 1 };
        for (const fraction of [-1, 0, 0.17, 0.5, 0.83, 1, 2]) {
          const landed = moveToPointer(
            grid,
            start(),
            { measureIndex, line: 1, fraction },
            span,
            projection
          );
          expect(landed.measureIndex).toBe(measureIndex);
          // Never past the bar's own span: the ghost remainder is the last
          // place the cursor may stand, and it is still inside this bar.
          const at = landed.onset.num / landed.onset.den;
          expect(at).toBeGreaterThanOrEqual(0);
          expect(at).toBeLessThanOrEqual(span.num / span.den + 1e-9);
        }
      }
    });
  }
});

describe('moveToPointer on a bar with no ink', () => {
  // The item's opening case: a skeleton of whole-bar rests, synced, with the
  // chorus at bar 9 and no way to click there.
  const skeleton: MnxStructure = {
    mnx: { version: 1 },
    global: { measures: Array.from({ length: 28 }, () => ({})) },
    parts: [
      {
        id: 'P1',
        _x: {
          mnxLab: { strings: [{ number: 1, tuning: { step: 'E', octave: 4 } }] }
        },
        measures: Array.from({ length: 28 }, () => ({
          sequences: [{ content: [{ type: 'event', duration: { base: 'whole' }, rests: [{}] }] }]
        }))
      }
    ]
  } as unknown as MnxStructure;

  it('lands in bar 9 from any fraction, on the string that was clicked', () => {
    const grid = buildGrid(skeleton, 0, 1);
    const span = measureSpans(skeleton)[8] ?? { num: 1, den: 1 };
    for (const fraction of [0, 0.3, 0.5, 0.9, 1]) {
      const landed = moveToPointer(
        grid,
        start(),
        { measureIndex: 8, line: 1, fraction },
        span,
        grid.mode === 'string' ? 'tab' : 'notation'
      );
      expect(landed.measureIndex).toBe(8);
      expect(landed.line).toBe(1);
    }
  });

  // Placing the cursor is NAVIGATION, so it must survive a read-only binding
  // exactly as the arrows do. The mount decides this from one set, and the
  // session's own predicate is the other half of the same rule; a `goToPointer`
  // missing from either leaves a score whose arrows move and whose taps do not.
  it('is navigation, so a read-only host may still place the cursor', () => {
    expect(isNavigationIntent({
      type: 'goToPointer',
      measureIndex: 0, partIndex: 0, staffIndex: 1,
      line: 1, projection: 'tab', fraction: 0.5
    })).toBe(true);
  });

  it('refuses a bar the grid does not cover, by identity', () => {
    const grid = buildGrid(skeleton, 0, 1);
    const cursor = start();
    expect(
      moveToPointer(grid, cursor, { measureIndex: 999, line: 1, fraction: 0.5 }, { num: 1, den: 1 }, 'notation')
    ).toBe(cursor);
  });
});

/**
 * THE ESTIMATE VS THE ENGRAVING.
 *
 * Everything above proves the pointer model self-consistent: the forward map
 * and its inverse compose, and a fraction an onset produced snaps back to that
 * onset. Both halves are linear in the bar's width — and so the pair agreed
 * with each other while disagreeing with the page, which is why a click on the
 * first rest of a bar of rests landed on the second.
 *
 * Music is not spaced linearly. A bar carrying a clef and a time signature
 * starts its ink a quarter of the way in, and the columns after it are spread
 * by springs and rods rather than by their share of the meter. So this asks
 * the question the other way round: from where a rest is actually DRAWN, does
 * a click on it reach that rest?
 */
describe('a click on drawn ink reaches the ink it was on', () => {
  initSmufl();
  const quarters = () => [0, 1, 2, 3].map(() => ({ duration: { base: 'quarter' }, rest: {} }));
  const doc = {
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }, {}] },
    parts: [{
      id: 'g',
      _x: { mnxLab: { strings: STRINGS, tab: { staffKind: 'both' } } },
      measures: [
        { clefs: [{ clef: { sign: 'G', staffPosition: -2, octave: -1 } }],
          sequences: [{ content: quarters() }] },
        { sequences: [{ content: quarters() }] }
      ]
    }]
  } as unknown as MnxStructure;

  /** Where each rest is engraved, and the bar it belongs to. */
  const engraved = () => {
    const layout = layoutBothSystem({ mnx: doc, widthSp: 120, durationSpans: true });
    const bars = layout.primitives
      .filter((p): p is LinePrim => p.kind === 'line' && /barline/.test(p.className ?? ''))
      .map(p => p.x1)
      .sort((a, b) => a - b);
    const rests = layout.primitives
      .filter((p): p is GlyphPrim & { sourceId: string } =>
        p.kind === 'glyph' && /\brest\b/.test(p.className ?? '') && typeof p.sourceId === 'string')
      .map(p => ({ key: p.sourceId, x: p.x }));
    return { bars, rests };
  };

  const grid = () => buildGrid(doc, 0, 1);
  const span = measureSpans(doc)[0];

  it('lands on the very rest that was clicked, in every bar', () => {
    const { bars, rests } = engraved();
    expect(rests.length).toBe(8);
    for (const rest of rests) {
      const measureIndex = rest.key.startsWith('@m0') ? 0 : 1;
      const left = bars[measureIndex], right = bars[measureIndex + 1];
      const placed = moveToPointer(
        grid(),
        start(),
        {
          measureIndex,
          line: 3,
          columnKey: rest.key,
          // The estimate travels with it and must not be consulted.
          fraction: measurePositionAt(left, right, rest.x, 1)
        },
        span,
        'tab' as Projection
      );
      // `@m0.v0.e2` is the third quarter: onset 2/4.
      const wanted = Number(rest.key.slice(rest.key.lastIndexOf('e') + 1));
      expect(
        placed.onset.num / placed.onset.den,
        `a click on ${rest.key} landed on beat ${placed.onset.num}/${placed.onset.den}`
      ).toBeCloseTo(wanted / 4, 9);
      // The clicked LINE is kept: a rest has no string of its own, and the
      // reader pointed at one.
      expect(placed.line).toBe(3);
    }
  });

  it('is why the column is measured: the linear estimate alone misses', () => {
    const { bars, rests } = engraved();
    const missed = rests.filter(rest => {
      const measureIndex = rest.key.startsWith('@m0') ? 0 : 1;
      const left = bars[measureIndex], right = bars[measureIndex + 1];
      const placed = moveToPointer(
        grid(), start(),
        { measureIndex, line: 3, fraction: measurePositionAt(left, right, rest.x, 1) },
        span, 'tab' as Projection
      );
      const wanted = Number(rest.key.slice(rest.key.lastIndexOf('e') + 1)) / 4;
      return Math.abs(placed.onset.num / placed.onset.den - wanted) > 1e-9;
    });
    // Five of the eight, when this was written — every rest of the bar that
    // carries the clef, and one of the bar that does not. If engraving ever
    // becomes linear enough that this is empty, the measured column has stopped
    // earning its keep and this test should be the one that says so.
    expect(missed.length).toBeGreaterThan(0);
  });
});


// core-tab-rest-targets: the tab draws no rest, but in the viewer each rest has an
// invisible target where its digit would stand, named like everything selectable —
// so the cursor anchors on it, a press finds it and the playhead names it. In a
// tuplet each rest is its own (bar 2 of a Bert Jansch piece: a triplet of a chord
// and two rests, whose rests the cursor drew a column to the LEFT of the chord).
describe('a rest in tab is a place you can stand on and click', () => {
  initSmufl();
  const eighth = (rest: boolean) => rest
    ? { duration: { base: 'eighth' }, rest: {} }
    : { duration: { base: 'eighth' }, notes: [{ pitch: { step: 'D', octave: 4 }, _x: { mnxLab: { string: 2, fret: 3 } } }] };
  const doc = {
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }] },
    parts: [{
      id: 'g',
      _x: { mnxLab: { strings: STRINGS, tab: { staffKind: 'tab' } } },
      measures: [{ sequences: [{ content: [
        { duration: { base: 'quarter' }, notes: [{ pitch: { step: 'E', octave: 4 }, _x: { mnxLab: { string: 1, fret: 0 } } }] },
        { type: 'tuplet', inner: { duration: { base: 'eighth' }, multiple: 3 }, outer: { duration: { base: 'eighth' }, multiple: 2 },
          content: [eighth(false), eighth(true), eighth(true)] },
        { duration: { base: 'half' }, rest: {} }
      ] }] }]
    }]
  } as unknown as MnxStructure;
  const key = (eventIndex: number, containerIndex?: number) =>
    syntheticEventKey({ measureIndex: 0, voiceIndex: 0, eventIndex, ...(containerIndex === undefined ? {} : { containerIndex }) });
  const rests = [{ key: key(1, 1), onset: 1 / 3 }, { key: key(1, 2), onset: 5 / 12 }, { key: key(2), onset: 1 / 2 }];
  const layout = () => layoutTab({ mnx: doc, widthSp: 120, durationSpans: true });
  const targets = () => new Map(layout().primitives
    .filter((p): p is RectPrim & { sourceId: string } => p.kind === 'rect' && /\btab-rest\b/.test(p.className ?? '') && typeof p.sourceId === 'string')
    .map(p => [p.sourceId, p.x + p.w / 2]));

  it('names every rest — each of a triplet’s its own — with a target in onset order, right of the chord before it', () => {
    const found = targets();
    expect([...found.keys()].sort()).toEqual(rests.map(r => r.key).sort());
    const chord = layout().primitives.find(p => p.kind === 'text' && p.text === '3') as { x: number } | undefined;
    expect(chord).toBeDefined();
    const xs = [chord!.x, ...rests.map(r => found.get(r.key)!)];
    for (let i = 1; i < xs.length; i++) expect(xs[i], `rest ${i} drawn left of what precedes it`).toBeGreaterThan(xs[i - 1]!);
    // Nothing for the goldens: without the viewer's flag there is no target.
    expect(layoutTab({ mnx: doc, widthSp: 120 }).primitives.some(p => /\btab-rest\b/.test(p.className ?? ''))).toBe(false);
  });

  it('is the column the cursor’s grid names, and a press on it lands on that rest', () => {
    const grid = buildGrid(doc, 0, 1);
    const named = new Set(grid.positions.flatMap(p => p.events.map(e => e.key)));
    for (const rest of rests) expect(named.has(rest.key), rest.key).toBe(true);
    const span = measureSpans(doc)[0];
    for (const rest of rests) {
      const placed = moveToPointer(grid, start(), { measureIndex: 0, line: 3, columnKey: rest.key, fraction: 0 }, span, 'tab' as Projection);
      expect(placed.onset.num / placed.onset.den, rest.key).toBeCloseTo(rest.onset, 9);
    }
  });

  it('is a rest the playhead can stand in, at its played time', () => {
    const spans = restSpansOf(doc);
    expect(spans.map(s => s.key)).toEqual(rests.map(r => r.key));
    expect(spans.map(s => Number(s.start.num) / Number(s.start.den))).toEqual(rests.map(r => r.onset).map(x => expect.closeTo(x, 9)));
    expect(Number(spans[0]!.duration.num) / Number(spans[0]!.duration.den)).toBeCloseTo(1 / 12, 9);
  });

  it('reads its time in the inspector as played: a triplet eighth ends a twelfth later', () => {
    const at = (eventIndex: number, containerIndex: number | undefined, onset: { num: number; den: number }) =>
      eventPills(doc, { kind: 'event', partIndex: 0, staffIndex: 1, measureIndex: 0, voiceIndex: 0, eventIndex, onset,
        ...(containerIndex === undefined ? {} : { containerIndex }) }).find(p => p.key === 'at')?.value;
    expect(at(1, 0, { num: 1, den: 4 })).toBe('1/4 → 1/3');
    expect(at(1, 2, { num: 5, den: 12 })).toBe('5/12 → 1/2');
    expect(at(0, undefined, { num: 0, den: 1 })).toBe('0 → 1/4');
  });
});
