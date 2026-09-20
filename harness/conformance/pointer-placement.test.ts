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
import type { MnxStructure } from '../../src/model/mnx.ts';
// @ts-expect-error — plain .mjs module without type declarations
import { loadCorpus } from '../verify/check-scenarios.mjs';

interface Scenario { id: string; dir: string }
const corpus = (loadCorpus() as Scenario[]).slice().sort((a, b) => a.id.localeCompare(b.id));

function documentOf(dir: string): MnxStructure {
  return JSON.parse(fs.readFileSync(path.join(dir, 'document.mnx.json'), 'utf8')) as MnxStructure;
}

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
