// A technique has to be attached to the note it describes.
//
// Bends were not, on the notation staff. `emitNotationTechnique` raised them
// from the LANE rather than from the note, on the reasoning that a notation
// staff has no string to watch the pitch climb. The cost was a gesture
// attached to nothing: a shallow arc several spaces above the staff, with no
// way for a reader to tell which note it belonged to.
//
// Where that lands is what made it a bug report rather than a quibble. Above
// the first system's staff is page margin, so it reads as a stray mark under
// the title. Above every later system's staff is the GAP between systems, so
// it reads as floating in the void — and widening Clearance widens the void
// around it. On a real transcription every bend in the score was affected:
// one of each pair of copies, 22 of 44.
//
// The tab copy was always right, rising from its fret. This pins that both
// copies now leave from the note, on every staff and at every clearance.
import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { initSmufl } from '../helpers/corpusPrimitives.ts';
import { layoutBothSystem } from '../../src/engine/layout/bothSystem.ts';
import { layoutNotation } from '../../src/engine/layout/notation.ts';
import { normalizeDisplayOptions } from '../../src/engine/displayOptions.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
import type { Primitive } from '../../src/engine/primitives.ts';

initSmufl();

const load = (id: string): MnxStructure =>
  JSON.parse(fs.readFileSync(`scenarios/${id}/document.mnx.json`, 'utf8'));

/** Rising bend arcs only: a release ends at the note, a pre-bend is vertical. */
function risingBends(primitives: readonly Primitive[]) {
  return primitives.filter(
    p =>
      p.kind === 'curve' &&
      /technique-bend/.test(String(p.className ?? '')) &&
      !/release|prebend|hold/.test(String(p.className ?? ''))
  ) as Extract<Primitive, { kind: 'curve' }>[];
}

/** Fret digits and noteheads — whichever staff the gesture is drawn on. */
function noteAnchors(primitives: readonly Primitive[]) {
  return primitives.filter(p =>
    /fret-number|notehead/.test(String(p.className ?? ''))
  ) as Extract<Primitive, { kind: 'glyph' | 'text' }>[];
}

describe('bends start at the note they describe', () => {
  const levels = [0, 1, 2, 3, 4];

  for (const [name, layout] of [['both', layoutBothSystem], ['notation', layoutNotation]] as const) {
    it(`${name}: every rising bend leaves from its own note, at every clearance`, () => {
      const doc = load('lab/25-tab-techniques/01-bend-and-release');
      let checked = 0;
      for (const clearance of levels) {
        const out = layout({ mnx: doc, widthSp: 80, display: normalizeDisplayOptions({ clearance }) });
        const anchors = noteAnchors(out.primitives);
        for (const curve of risingBends(out.primitives)) {
          const start = curve.points[0];
          // The gesture starts just right of its note's ink, so look left.
          const own = anchors.filter(a => a.x < start.x && start.x - a.x < 2.5);
          expect(own.length, `${name} @ ${clearance}: no note left of the bend`).toBeGreaterThan(0);
          const offset = Math.min(...own.map(a => Math.abs(a.y - start.y)));
          expect(offset, `${name} @ clearance ${clearance}: bend starts ${offset.toFixed(2)}sp from its note`)
            .toBeLessThan(0.5);
          checked++;
        }
      }
      expect(checked, 'the scenario stopped carrying bends').toBeGreaterThan(0);
    });
  }
});
