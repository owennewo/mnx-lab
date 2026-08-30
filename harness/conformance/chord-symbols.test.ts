// Chord symbols (core-chord-symbols.md, the rendering half): the model's
// spelling, the bar attribute that writes `_x.mnxLab.harmonies`, the words.
// `lab/score-text/chord-symbols` pins the ink.
import { describe, it, expect } from 'vitest';
import { chordSymbolDisplay, parseChordSymbol, renderChordSymbol } from '../../src/model/harmony.ts';
import { applyOp, readMeasureAttributes } from '../../src/edit/ops.ts';
import { parseBarAttribute } from '../../src/edit/setupGrammar.ts';
import { attributeText, measurePills, parseInspectorLine } from '../../src/edit/inspector.ts';
import { walkElements } from '../../src/edit/elementWalk.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

const bare = (): MnxStructure => ({ mnx: { version: 1 }, global: { measures: [{}] }, parts: [] });

describe('spelling', () => {
  it('renders from the structure, honours the text override, and engraves real accidentals', () => {
    expect(renderChordSymbol({ root: { step: 'A' }, quality: 'dominantSeventh', bass: { step: 'C', alter: 1 } })).toBe('A7/C#');
    expect(chordSymbolDisplay({ root: { step: 'A' }, quality: 'dominantSeventh', bass: { step: 'C', alter: 1 } })).toBe('A7/C♯');
    expect(chordSymbolDisplay({ root: { step: 'B' }, quality: 'halfDiminished' })).toBe('Bm7b5');
    expect(chordSymbolDisplay({ root: { step: 'E', alter: -1 }, quality: 'majorSeventh', text: 'E♭Δ7' })).toBe('E♭Δ7');
    expect(chordSymbolDisplay({ quality: 'none' })).toBe('N.C.');
    expect(parseChordSymbol('F#m7b5/A')).toEqual({ root: { step: 'F', alter: 1 }, quality: 'halfDiminished', bass: { step: 'A' } });
    expect(parseChordSymbol('E♭Δ7')).toEqual({ root: { step: 'E', alter: -1 }, quality: 'majorSeventh', text: 'E♭Δ7' });
  });
});

describe('the chord attribute', () => {
  it('parses, writes structured into the vendor block, reads back as text, and removes by index', () => {
    expect(parseBarAttribute('chord Am7')).toEqual({ set: { kind: 'harmony', text: 'Am7' } });
    expect(parseBarAttribute('chord D/F# at 1/2')).toEqual({ set: { kind: 'harmony', text: 'D/F#', at: [1, 2] } });
    expect(parseBarAttribute('harmony N.C. at end')).toEqual({ set: { kind: 'harmony', text: 'N.C.', at: 'end' } });
    expect(parseBarAttribute('chord')).toBeNull();
    expect(parseBarAttribute('no chord')).toEqual({ remove: 'harmony' });
    let d = bare();
    d = applyOp(d, { type: 'setMeasureAttribute', measureIndex: 0, attribute: { kind: 'harmony', text: 'Am7' } });
    d = applyOp(d, { type: 'setMeasureAttribute', measureIndex: 0, index: 1, attribute: { kind: 'harmony', text: 'D/F#', at: [1, 2] } });
    expect(d.global.measures[0]._x?.mnxLab?.harmonies).toEqual([
      { location: { fraction: [0, 1] }, root: { step: 'A' }, quality: 'minorSeventh' },
      { location: { fraction: [1, 2] }, root: { step: 'D' }, quality: 'major', bass: { step: 'F', alter: 1 } }
    ]);
    expect(readMeasureAttributes(d.global.measures[0])).toEqual([
      { kind: 'harmony', text: 'Am7' },
      { kind: 'harmony', text: 'D/F#', at: [1, 2] }
    ]);
    expect(attributeText({ kind: 'harmony', text: 'D/F#', at: [1, 2] })).toBe('chord D/F# at 1/2');
    expect(measurePills(d, 0).filter(p => p.key.startsWith('harmony#')).map(p => [p.key, p.word, p.value])).toEqual([
      ['harmony#0', 'chord', 'Am7'],
      ['harmony#1', 'chord', 'D/F# at 1/2']
    ]);
    expect(parseInspectorLine('measure', null, 'chord G', { harmonyCount: 2 })).toEqual({
      intent: { type: 'setMeasureAttribute', attribute: { kind: 'harmony', text: 'G' }, index: 2 }
    });
    expect(parseInspectorLine('measure', 'chord', 'G7', { key: 'harmony#1' })).toEqual({
      intent: { type: 'setMeasureAttribute', attribute: { kind: 'harmony', text: 'G7' }, index: 1 }
    });
    expect(walkElements(d).filter(e => e.kind === 'harmony')).toHaveLength(2);
    // An amend replaces its entry in place.
    d = applyOp(d, { type: 'setMeasureAttribute', measureIndex: 0, index: 0, attribute: { kind: 'harmony', text: 'Am' } });
    expect(readMeasureAttributes(d.global.measures[0])[0]).toEqual({ kind: 'harmony', text: 'Am' });
    d = applyOp(d, { type: 'removeMeasureAttribute', measureIndex: 0, kind: 'harmony', index: 1 });
    d = applyOp(d, { type: 'removeMeasureAttribute', measureIndex: 0, kind: 'harmony', index: 0 });
    // No tombstone: the emptied vendor block goes too.
    expect(d.global.measures[0]).toEqual({});
  });
});
