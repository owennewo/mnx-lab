// A rest is a thing you can select, so it carries a name — core-rung-insert.md.
//
// Before this, rests emitted no `sourceId`, so nothing in the rendered SVG
// said WHICH rest a selection meant. The enclosure fell back to interpolating
// a metric fraction across the bar, and drew its box on the wrong beat.
import { describe, it, expect } from 'vitest';
import { replayIntents } from '../../src/edit/session.ts';
import type { EditorIntent } from '../../src/edit/intents.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
import { syntheticEventKey } from '../../src/model/noteKeys.ts';
import { initSmufl, WIDTH_SP } from '../helpers/corpusPrimitives.ts';
import { layoutNotation } from '../../src/engine/layout/notation.ts';
import type { Primitive } from '../../src/engine/primitives.ts';

const draw = (doc: MnxStructure, selectedEventIds: string[] = []): Primitive[] => {
  initSmufl();
  return layoutNotation({ mnx: doc, widthSp: WIDTH_SP, selectedEventIds })
    .primitives as Primitive[];
};

const rests = (doc: MnxStructure, selectedEventIds: string[] = []): Primitive[] =>
  draw(doc, selectedEventIds).filter(
    p => typeof p.className === 'string' && /\brest\b/.test(p.className)
  );

/** Four quarters, then Delete on the second — a rest at beat 2. */
function barWithARestOnBeatTwo() {
  const intents: EditorIntent[] = [
    { type: 'addPart' }, { type: 'appendMeasure' },
    { type: 'setTimeSignature', count: 4, unit: 4 }
  ];
  const s = replayIntents({} as MnxStructure, intents);
  for (const line of [-6, -4, -2, 0]) {
    while (s.cursor.line !== line)
      s.handleIntent({ type: s.cursor.line < line ? 'lineUp' : 'lineDown' });
    s.handleIntent({ type: 'toggleNote' });
    s.handleIntent({ type: 'nextPosition' });
  }
  s.handleIntent({ type: 'goToMeasure', measureIndex: 0 });
  while (s.cursor.line !== -6)
    s.handleIntent({ type: s.cursor.line < -6 ? 'lineUp' : 'lineDown' });
  s.handleIntent({ type: 'insertAtRung', side: 'after' }); // cursor → the new note
  s.handleIntent({ type: 'delete' });                      // → a rest, event rung
  return s;
}

describe('a rest can be pointed at', () => {
  it('carries its event key as sourceId', () => {
    const s = barWithARestOnBeatTwo();
    const [rest, ...rest_] = rests(s.doc);
    expect(rest_).toHaveLength(0);
    expect(rest.sourceId).toBe(
      syntheticEventKey({ measureIndex: 0, voiceIndex: 0, eventIndex: 1 })
    );
  });

  it('the key names the RIGHT beat, not the first one', () => {
    // The whole bug: the enclosure used to place a rest-only moment by
    // interpolating its metric fraction across the bar. The x it should sit at
    // is the second column's — strictly right of the first note's.
    const s = barWithARestOnBeatTwo();
    const heads = draw(s.doc).filter(p => p.className === 'notehead');
    const restX = rests(s.doc)[0].x!;
    expect(restX, 'the rest is not right of the first note').toBeGreaterThan(heads[0].x!);
    expect(restX, 'the rest is not left of the second').toBeLessThan(heads[1].x!);
  });

  it('lights up when its key is in selectedEventIds, and only then', () => {
    const s = barWithARestOnBeatTwo();
    const key = syntheticEventKey({ measureIndex: 0, voiceIndex: 0, eventIndex: 1 });
    expect(rests(s.doc)[0].className).toBe('rest');
    expect(rests(s.doc, [key])[0].className).toBe('rest selected');
    expect(rests(s.doc, ['@m0.v0.e3'])[0].className, 'lit by another event’s key').toBe('rest');
  });

  it('an event with a real id uses it, as notes do', () => {
    const s = barWithARestOnBeatTwo();
    s.doc.parts![0].measures![0].sequences![0].content[1].id = 'ev42';
    expect(rests(s.doc)[0].sourceId).toBe('ev42');
    expect(rests(s.doc, ['ev42'])[0].className).toBe('rest selected');
  });
});


describe('the cursor ghost can find a rest-only column', () => {
  it('offers the rest\'s event key as an anchor', () => {
    const s = barWithARestOnBeatTwo();
    const context = s.cursorContext();
    // Nothing sounds at this beat, so before the rest had a name there was
    // NOTHING to anchor on and the ghost fell back to a metric fraction.
    expect(context.occupied).toBe(false);
    expect(context.anchorKeys).toContain(
      syntheticEventKey({ measureIndex: 0, voiceIndex: 0, eventIndex: 1 })
    );
  });

  it('still leads with note keys where the beat has ink', () => {
    // A column with a note anchors more precisely than a rest sharing it, so
    // notes come first and the ghost's first hit is still a notehead.
    const s = barWithARestOnBeatTwo();
    s.handleIntent({ type: 'goToMeasure', measureIndex: 0 });
    const context = s.cursorContext();
    expect(context.occupied).toBe(true);
    expect(context.anchorKeys[0]).toBe('@m0.v0.e0.n0');
  });

  it('a real event id is preferred, as it is for the sourceId', () => {
    const s = barWithARestOnBeatTwo();
    s.doc.parts![0].measures![0].sequences![0].content[1].id = 'ev42';
    expect(s.cursorContext().anchorKeys).toContain('ev42');
  });
});
