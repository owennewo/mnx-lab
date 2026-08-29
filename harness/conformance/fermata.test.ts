// Fermatas (core-measure-attributes-gaps.md, item 7): the event form and the
// bar form share one word grammar, one glyph table and one element kind; the
// scenario `lab/articulations/fermatas-on-bars-and-rests` pins the ink.
import { describe, it, expect } from 'vitest';
import { EditorSession } from '../../src/edit/session.ts';
import { applyOp, readMeasureAttributes } from '../../src/edit/ops.ts';
import { fermataText, parseAdornment, parseBarAttribute, parseFermataWords } from '../../src/edit/setupGrammar.ts';
import { attributeText, eventPills, parseInspectorLine } from '../../src/edit/inspector.ts';
import { walkElements } from '../../src/edit/elementWalk.ts';
import { emitMeasureFermata, fermataBelow, fermataGlyph } from '../../src/engine/layout/fermata.ts';
import { measureLevelGaps } from '../../src/engine/layout/spacing.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
import type { Primitive } from '../../src/engine/primitives.ts';

function doc(): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }] },
    parts: [
      {
        name: 'Music',
        measures: [
          {
            sequences: [
              {
                content: [
                  { duration: { base: 'half' }, notes: [{ id: 'n1', pitch: { step: 'C', octave: 5 } }] },
                  { duration: { base: 'half' }, rest: {} }
                ]
              }
            ]
          }
        ]
      }
    ]
  };
}

describe('the fermata words', () => {
  it('take any of symbol, duration and side in any order; `normal` is the symbol', () => {
    expect(parseFermataWords([])).toEqual({});
    expect(parseFermataWords(['square', 'long', 'below'])).toEqual({ symbol: 'square', duration: 'long', orient: 'below' });
    expect(parseFermataWords(['below', 'Long', 'angled'])).toEqual({ symbol: 'angled', duration: 'long', orient: 'below' });
    expect(parseFermataWords(['normal', 'normal'])).toEqual({ symbol: 'normal', duration: 'normal' });
    expect(parseFermataWords(['sideways'])).toBeNull();
    expect(parseFermataWords(['square', 'curlew'])).toBeNull();
  });

  it('round-trip through the text form', () => {
    for (const words of [[], ['square'], ['long'], ['below'], ['curlew', 'veryLong', 'above']]) {
      const parsed = parseFermataWords(words)!;
      expect(parseFermataWords(fermataText(parsed).split(' ').filter(Boolean))).toEqual(parsed);
    }
  });

  it('reach the event through the adornment grammar and the bar through the bar grammar', () => {
    expect(parseAdornment('fermata')).toEqual({ fermata: {} });
    expect(parseAdornment('fermata angled short')).toEqual({ fermata: { symbol: 'angled', duration: 'short' } });
    expect(parseAdornment('no fermata')).toEqual({ removeFermata: true });
    expect(parseBarAttribute('fermata')).toEqual({ set: { kind: 'fermata' } });
    expect(parseBarAttribute('fermata square below')).toEqual({ set: { kind: 'fermata', symbol: 'square', orient: 'below' } });
    expect(parseBarAttribute('no fermata')).toEqual({ remove: 'fermata' });
    expect(parseBarAttribute('fermata sideways')).toBeNull();
  });
});

describe('the fermata ops', () => {
  it('set is an upsert on the event, remove deletes the key, and the walk names it', () => {
    let d = doc();
    const event = { partIndex: 0, staffIndex: 1, measureIndex: 0, voiceIndex: 0, eventIndex: 1 };
    d = applyOp(d, { type: 'setFermata', noteKey: 'n1', fermata: { symbol: 'square' } });
    d = applyOp(d, { type: 'setFermata', event, fermata: {} });
    expect(d.parts![0].measures![0].sequences![0].content[0]).toMatchObject({ fermata: { symbol: 'square' } });
    expect(d.parts![0].measures![0].sequences![0].content[1]).toMatchObject({ fermata: {} });
    expect(walkElements(d).filter(e => e.kind === 'fermata').map(e => e.path)).toHaveLength(2);
    d = applyOp(d, { type: 'setFermata', noteKey: 'n1', fermata: { orient: 'below' } });
    expect(d.parts![0].measures![0].sequences![0].content[0]).toMatchObject({ fermata: { orient: 'below' } });
    d = applyOp(d, { type: 'removeFermata', noteKey: 'n1' });
    d = applyOp(d, { type: 'removeFermata', event });
    expect(JSON.stringify(d)).not.toContain('fermata');
  });

  it('the bar form is a measure attribute: written, read back and spelt', () => {
    let d = doc();
    d = applyOp(d, { type: 'setMeasureAttribute', measureIndex: 0, attribute: { kind: 'fermata', symbol: 'square', orient: 'below' } });
    expect(d.global.measures[0].fermata).toEqual({ symbol: 'square', orient: 'below' });
    const read = readMeasureAttributes(d.global.measures[0]);
    expect(read).toContainEqual({ kind: 'fermata', symbol: 'square', orient: 'below' });
    expect(attributeText({ kind: 'fermata', symbol: 'square', orient: 'below' })).toBe('fermata square below');
    expect(attributeText({ kind: 'fermata' })).toBe('fermata');
    expect(parseInspectorLine('measure', null, 'fermata square below')).toEqual({
      intent: { type: 'setMeasureAttribute', attribute: { kind: 'fermata', symbol: 'square', orient: 'below' } }
    });
    expect(walkElements(d).filter(e => e.kind === 'fermata')).toHaveLength(1);
    d = applyOp(d, { type: 'removeMeasureAttribute', measureIndex: 0, kind: 'fermata' });
    expect(d.global.measures[0].fermata).toBeUndefined();
    // Drawn now, so no longer a gap.
    expect(measureLevelGaps({ fermata: {} }, [])).toEqual([]);
  });

  it('the session fans the intent over the selected events and the pill reads it back', () => {
    const session = new EditorSession(doc());
    expect(session.handleIntent({ type: 'setFermata', fermata: { duration: 'long' } })).toBe(true);
    const member = { kind: 'event' as const, partIndex: 0, staffIndex: 1, measureIndex: 0, voiceIndex: 0, eventIndex: 0, onset: { num: 0, den: 1 } };
    const pill = eventPills(session.doc, member as never).find(p => p.key === 'fermata');
    expect(pill).toMatchObject({ word: 'fermata', value: 'long', remove: { type: 'removeFermata' } });
    expect(parseInspectorLine('event', 'fermata', 'square')).toEqual({ intent: { type: 'setFermata', fermata: { symbol: 'square' } } });
    expect(session.handleIntent({ type: 'removeFermata' })).toBe(true);
    expect(JSON.stringify(session.doc)).not.toContain('fermata');
  });
});

describe('the fermata ink', () => {
  it('picks the sign by symbol and the side by orient, then pointing', () => {
    expect(fermataGlyph({}, false)).toBe('fermataAbove');
    expect(fermataGlyph({ symbol: 'square' }, true)).toBe('fermataLongBelow');
    expect(fermataGlyph({ symbol: 'doubleDot' }, false)).toBe('fermataAbove');
    expect(fermataGlyph({ symbol: 'curlew' }, true)).toBe('curlewSign');
    expect(fermataBelow({})).toBe(false);
    expect(fermataBelow({ orient: 'below' })).toBe(true);
    expect(fermataBelow({ pointing: 'down' })).toBe(true);
    expect(fermataBelow({ pointing: 'down', orient: 'above' })).toBe(false);
  });

  it('the bar form sits over (or under) the closing barline', () => {
    const primitives: Primitive[] = [];
    emitMeasureFermata({ gm: { fermata: {} }, m: { x: 10, width: 20 }, staffTop: 8, staffHeight: 4, primitives });
    emitMeasureFermata({ gm: { fermata: { orient: 'below' } }, m: { x: 10, width: 20 }, staffTop: 8, staffHeight: 4, primitives });
    emitMeasureFermata({ gm: {}, m: { x: 10, width: 20 }, staffTop: 8, staffHeight: 4, primitives });
    expect(primitives).toEqual([
      { kind: 'glyph', glyph: 'fermataAbove', x: 30, y: 5.5, anchor: 'middle', className: 'fermata fermata-measure' },
      { kind: 'glyph', glyph: 'fermataBelow', x: 30, y: 14.5, anchor: 'middle', className: 'fermata fermata-measure' }
    ]);
  });
});
