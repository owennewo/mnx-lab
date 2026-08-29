// Arpeggios, non-arpeggio brackets and declared measure numbers
// (core-measure-attributes-gaps.md, item 8). The corpus pins the ink
// (`lab/articulations/arpeggiated-chords`, `lab/navigation/numbered-bars`);
// this holds the writers, the readers and the words.
import { describe, it, expect } from 'vitest';
import { EditorSession } from '../../src/edit/session.ts';
import { applyOp, readMeasureAttributes, readPositionedAttributes } from '../../src/edit/ops.ts';
import { parseAdornment, parseBarAttribute } from '../../src/edit/setupGrammar.ts';
import { attributeText, eventPills, parseInspectorLine, positionedText } from '../../src/edit/inspector.ts';
import { walkElements } from '../../src/edit/elementWalk.ts';
import { collectSpanMarks, emitMeasureNumber, emitSpanMarks } from '../../src/engine/layout/arpeggio.ts';
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
                  {
                    duration: { base: 'half' },
                    notes: [
                      { id: 'top', pitch: { step: 'G', octave: 4 } },
                      { pitch: { step: 'C', octave: 4 } },
                      { pitch: { step: 'E', octave: 4 } }
                    ]
                  },
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

describe('arpeggio words', () => {
  it('parse with direction and arrow in any order; the bracket is one word', () => {
    expect(parseAdornment('arpeggio')).toEqual({ positioned: { kind: 'arpeggio' } });
    expect(parseAdornment('arpeggio down arrow')).toEqual({ positioned: { kind: 'arpeggio', direction: 'down', arrow: true } });
    expect(parseAdornment('arpeggio arrow up')).toEqual({ positioned: { kind: 'arpeggio', direction: 'up', arrow: true } });
    expect(parseAdornment('arpeggio sideways')).toBeNull();
    expect(parseAdornment('non-arpeggio')).toEqual({ positioned: { kind: 'nonArpeggio' } });
    expect(parseAdornment('no arpeggio')).toEqual({ removePositioned: 'arpeggio' });
    expect(parseAdornment('no non-arpeggio')).toEqual({ removePositioned: 'nonArpeggio' });
    expect(positionedText({ kind: 'arpeggio', direction: 'down', arrow: true })).toEqual({ word: 'arpeggio', value: 'down arrow' });
    expect(positionedText({ kind: 'nonArpeggio' })).toEqual({ word: 'non-arpeggio', value: '' });
  });
});

describe('the arpeggio op', () => {
  it('spans the chord under the cursor bottom to top, minting the ids it needs; a rest refuses', () => {
    let d = doc();
    d = applyOp(d, { type: 'setPositioned', measureIndex: 0, onset: [0, 1], attribute: { kind: 'arpeggio', direction: 'up', arrow: true } });
    const chord = d.parts![0].measures![0].sequences![0].content[0] as { notes: { id?: string; pitch: { step: string } }[] };
    const bottom = chord.notes.find(n => n.pitch.step === 'C')!;
    expect(bottom.id).toBeDefined();
    expect(d.parts![0].measures![0].arpeggios).toEqual([
      { position: { fraction: [0, 1] }, span: { start: bottom.id, end: 'top' }, direction: 'up', arrow: true }
    ]);
    // The middle note stays id-less: only the span's ends are named.
    expect(chord.notes.find(n => n.pitch.step === 'E')!.id).toBeUndefined();
    d = applyOp(d, { type: 'setPositioned', measureIndex: 0, onset: [0, 1], attribute: { kind: 'nonArpeggio' } });
    expect(d.parts![0].measures![0].nonArpeggios).toEqual([{ position: { fraction: [0, 1] }, span: { start: bottom.id, end: 'top' } }]);
    const before = JSON.stringify(d);
    d = applyOp(d, { type: 'setPositioned', measureIndex: 0, onset: [1, 2], attribute: { kind: 'arpeggio' } });
    expect(JSON.stringify(d)).toBe(before);

    const read = readPositionedAttributes(d, { partIndex: 0, staffIndex: 1, measureIndex: 0 }, [0, 1]);
    expect(read.map(r => r.attribute)).toEqual([{ kind: 'arpeggio', direction: 'up', arrow: true }, { kind: 'nonArpeggio' }]);
    expect(walkElements(d).filter(e => e.kind === 'arpeggio' || e.kind === 'non-arpeggio')).toHaveLength(2);
    expect(collectSpanMarks(d.parts!).get(bottom.id!)).toMatchObject({ arpeggio: { direction: 'up' }, nonArpeggio: {} });

    d = applyOp(d, { type: 'removePositioned', measureIndex: 0, kind: 'arpeggio', index: 0 });
    d = applyOp(d, { type: 'removePositioned', measureIndex: 0, kind: 'nonArpeggio', index: 0 });
    expect(d.parts![0].measures![0].arpeggios).toBeUndefined();
    expect(d.parts![0].measures![0].nonArpeggios).toBeUndefined();
  });

  it('reaches the session as a pill with its removal', () => {
    const session = new EditorSession(doc());
    expect(session.handleIntent({ type: 'setPositioned', attribute: { kind: 'arpeggio', arrow: true } })).toBe(true);
    const member = { kind: 'event' as const, partIndex: 0, staffIndex: 1, measureIndex: 0, voiceIndex: 0, eventIndex: 0, onset: { num: 0, den: 1 } };
    const pill = eventPills(session.doc, member as never).find(p => p.key === 'positioned:arpeggio');
    expect(pill).toMatchObject({ word: 'arpeggio', value: 'arrow', remove: { type: 'removePositioned', kind: 'arpeggio' } });
    expect(parseInspectorLine('event', 'arpeggio', 'down')).toEqual({ intent: { type: 'setPositioned', attribute: { kind: 'arpeggio', direction: 'down' } } });
    expect(session.handleIntent({ type: 'removePositioned', kind: 'arpeggio' })).toBe(true);
    expect(session.doc.parts![0].measures![0].arpeggios).toBeUndefined();
    expect(measureLevelGaps(undefined, [{ sequences: [], arpeggios: [{ position: { fraction: [0, 1] }, span: { start: 'a', end: 'b' } }] }])).toEqual([]);
  });

  it('draws the wave beside the leftmost ink, the arrowhead at the pointed end, the bracket as three lines', () => {
    const primitives: Primitive[] = [];
    emitSpanMarks({
      leftInkX: 10, yTop: 4, yBottom: 6,
      marks: { arpeggio: { position: { fraction: [0, 1] }, span: { start: 'a', end: 'b' }, arrow: true } },
      primitives
    });
    const curves = primitives.filter(p => p.kind === 'curve');
    const heads = primitives.filter(p => p.className?.includes('arrowhead'));
    expect(curves.length).toBeGreaterThanOrEqual(2);
    expect(curves.every(c => c.kind === 'curve' && c.points[0].x === 9.4)).toBe(true);
    expect(heads).toHaveLength(2);
    expect(heads.every(h => h.kind === 'line' && h.y2 === 3.5)).toBe(true);
    const bracket: Primitive[] = [];
    emitSpanMarks({ leftInkX: 10, yTop: 4, yBottom: 6, marks: { nonArpeggio: { position: { fraction: [0, 1] }, span: { start: 'a', end: 'b' } } }, primitives: bracket });
    expect(bracket.map(p => p.className)).toEqual(['non-arpeggio', 'non-arpeggio', 'non-arpeggio']);
  });
});

describe('measure numbers', () => {
  it('are a bar attribute: written, read, spelt, walked — and drawn only when declared', () => {
    expect(parseBarAttribute('number 12')).toEqual({ set: { kind: 'number', value: 12 } });
    expect(parseBarAttribute('number twelve')).toBeNull();
    expect(parseBarAttribute('no number')).toEqual({ remove: 'number' });
    expect(attributeText({ kind: 'number', value: 12 })).toBe('number 12');
    expect(parseInspectorLine('measure', 'number', '7')).toEqual({ intent: { type: 'setMeasureAttribute', attribute: { kind: 'number', value: 7 } } });
    let d = doc();
    d = applyOp(d, { type: 'setMeasureAttribute', measureIndex: 0, attribute: { kind: 'number', value: 12 } });
    expect(d.global.measures[0].number).toBe(12);
    expect(readMeasureAttributes(d.global.measures[0])).toContainEqual({ kind: 'number', value: 12 });
    expect(walkElements(d).filter(e => e.kind === 'measure-number')).toHaveLength(1);
    const primitives: Primitive[] = [];
    emitMeasureNumber(d.global.measures[0], { x: 20 }, 8, primitives);
    emitMeasureNumber({}, { x: 20 }, 8, primitives);
    expect(primitives).toEqual([
      { kind: 'text', text: '12', x: 20.2, y: 7.1, font: 'body', size: 1.3, anchor: 'start', className: 'measure-number' }
    ]);
    d = applyOp(d, { type: 'removeMeasureAttribute', measureIndex: 0, kind: 'number' });
    expect(d.global.measures[0].number).toBeUndefined();
  });
});
