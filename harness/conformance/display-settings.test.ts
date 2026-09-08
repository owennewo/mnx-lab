import { mnxToAudioEvents } from '../../src/audio/mnxToAudio.ts';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MnxStructure } from '../../src/model/mnx.ts';
import { displayedMeasureNumbers, normalizeDisplayOptions } from '../../src/engine/displayOptions.ts';
import { selectedLyricLineIds } from '../../src/engine/layout/lyricRuns.ts';
import { layoutNotation } from '../../src/engine/layout/notation.ts';
import { layoutTab } from '../../src/engine/layout/tab.ts';
import { layoutBothSystem } from '../../src/engine/layout/bothSystem.ts';
import { planHorizontal } from '../../src/engine/layout/spacing.ts';
import { initSmufl } from '../helpers/corpusPrimitives.ts';

const fixture = (path: string): MnxStructure => JSON.parse(readFileSync(`scenarios/${path}/document.mnx.json`, 'utf8'));
function verses(): MnxStructure {
  const doc = fixture('lab/50-lyrics/01-verse-labels');
  doc.global.lyrics = { lineOrder: ['refrain', 'opening'] };
  let first = true;
  for (const part of doc.parts) for (const measure of part.measures) for (const seq of measure.sequences) {
    for (const item of seq.content) if ('lyrics' in item) {
      item.lyrics = { lines: {
        opening: { text: 'A considerably wider alternate verse' },
        ...(first ? { refrain: { text: 'Sing' } } : {})
      } };
      first = false;
    }
  }
  return doc;
}

describe('score display settings', () => {
  it('validates options and lets explicit hide override lyrics', () => {
    expect(normalizeDisplayOptions(null)).toEqual(normalizeDisplayOptions());
    expect(normalizeDisplayOptions({ lyrics: 'bogus', clefs: false, selectedVerse: 2 })).toEqual(normalizeDisplayOptions());
    expect(normalizeDisplayOptions({ lyrics: 'current', selectedVerse: 'refrain' }, ['lyrics'])).toMatchObject({ lyrics: 'hide', selectedVerse: 'refrain' });
  });

  it('resolves one global nonnumeric verse, without per-bar substitution', () => {
    const doc = verses();
    expect(selectedLyricLineIds(doc, { lyrics: 'current' })).toEqual(['refrain']);
    expect(selectedLyricLineIds(doc, { lyrics: 'current', selectedVerse: 'opening' })).toEqual(['opening']);
    expect(selectedLyricLineIds(doc, { lyrics: 'current', selectedVerse: 'missing' })).toEqual([]);
  });

  for (const [name, layout] of Object.entries({ notation: layoutNotation, tab: layoutTab, both: layoutBothSystem })) {
    it(`${name}: filters verse ink and row geometry without mutating MNX`, () => {
      initSmufl();
      const mnx = verses();
      const before = JSON.stringify(mnx);
      const all = layout({ mnx, widthSp: 500 });
      const current = layout({ mnx, widthSp: 500, display: { lyrics: 'current' } });
      const hidden = layout({ mnx, widthSp: 500, display: { lyrics: 'hide' } });
      const lyrics = (result: typeof all) => result.primitives.filter(p => p.className === 'lyric');
      expect(lyrics(current)).toHaveLength(1);
      expect(lyrics(current)[0]).toMatchObject({ text: 'Sing' });
      expect(lyrics(hidden)).toHaveLength(0);
      expect(hidden.heightSp).toBeLessThan(all.heightSp);
      expect(current.heightSp).toBeLessThan(all.heightSp);
      expect(JSON.stringify(mnx)).toBe(before);
    });
  }

  it('filters lyric widths before packing', () => {
    initSmufl();
    const mnx = verses();
    const width = (lyrics: 'all' | 'current' | 'hide') => planHorizontal(mnx, 1000, { display: { lyrics } }).usedWidthSp;
    expect(width('current')).toBeLessThan(width('all'));
    expect(width('hide')).toBeLessThanOrEqual(width('current'));
  });

  it('hides changed clefs while preserving the effective pitch timeline', () => {
    initSmufl();
    const mnx = fixture('spec/clef-changes');
    const shown = planHorizontal(mnx, 500);
    const hidden = planHorizontal(mnx, 500, { display: { clefs: 'hide', timeSignatures: 'hide' } });
    expect(hidden.usedWidthSp).toBeLessThan(shown.usedWidthSp);
    expect(hidden.measures.map(m => m.clefTimelines)).toEqual(shown.measures.map(m => m.clefTimelines));
    expect(hidden.measures.every(m => !m.showClef && !m.showTimeSig && m.clefChanges.length === 0)).toBe(true);
    const rendered = layoutNotation({ mnx, widthSp: 500, display: { clefs: 'hide', timeSignatures: 'hide' } });
    expect(rendered.primitives.filter(p => p.className?.includes('clef'))).toHaveLength(0);
  });
});


describe('displayed measure and instrument labels', () => {
  const score = () => {
    const doc = fixture('lab/50-lyrics/01-verse-labels');
    doc.parts[0].name = 'Voice';
    doc.global.measures = Array.from({ length: 12 }, (_, i) => ({ ...doc.global.measures[0], ...(i === 0 ? { number: 0 } : i === 4 ? { number: 20 } : {}) }));
    doc.parts[0].measures = Array.from({ length: 12 }, () => structuredClone(doc.parts[0].measures[0]));
    return doc;
  };
  const text = (result: ReturnType<typeof layoutNotation>, className: string) => result.primitives.filter(p => p.kind === 'text' && p.className === className);
  it('continues declared numbering including pickups and resets', () => {
    expect(displayedMeasureNumbers(score())).toEqual([0, 1, 2, 3, 20, 21, 22, 23, 24, 25, 26, 27]);
  });
  for (const [name, layout] of Object.entries({ notation: layoutNotation, tab: layoutTab, both: layoutBothSystem })) {
    it(`${name}: bar labels and instrument names follow system breaks`, () => {
      initSmufl();
      const mnx = score();
      for (const widthSp of [45, 90]) {
        const every = layout({ mnx, widthSp, display: { barNumbers: 'every-bar', instrumentNames: 'every-system' } });
        expect(text(every, 'measure-number')).toHaveLength(12);
        expect(text(every, 'staff-label')).toHaveLength(every.rows!.length);
        const first = layout({ mnx, widthSp, display: { barNumbers: 'every-system', instrumentNames: 'first-system' } });
        expect(text(first, 'measure-number')).toHaveLength(first.rows!.length);
        expect(text(first, 'staff-label')).toHaveLength(1);
        const hidden = layout({ mnx, widthSp, display: { barNumbers: 'hide', instrumentNames: 'hide' } });
        expect(text(hidden, 'measure-number')).toHaveLength(0);
        expect(text(hidden, 'staff-label')).toHaveLength(0);
      }
    });
    it(`${name}: unnamed parts remain unlabeled`, () => {
      initSmufl();
      const mnx = score();
      delete mnx.parts[0].name;
      expect(text(layout({ mnx, widthSp: 60, display: { instrumentNames: 'every-system' } }), 'staff-label')).toHaveLength(0);
    });
  }
});


describe('multi-part display systems and score blocks', () => {
  const ensemble = (): MnxStructure => {
    const doc = fixture('lab/50-lyrics/01-verse-labels');
    const strings = [{ step: 'E', octave: 4 }, { step: 'B', octave: 3 }, { step: 'G', octave: 3 }, { step: 'D', octave: 3 }, { step: 'A', octave: 2 }, { step: 'E', octave: 2 }].map((pitch, i) => ({ string: i + 1, pitch }));
    doc.global.measures = Array.from({ length: 8 }, (_, i) => ({ id: `bar${i}`, ...(i === 0 ? { time: { count: 4, unit: 4 }, number: 0 } : {}) }));
    doc.parts[0].id = 'one';
    doc.parts[0].name = 'First instrument';
    doc.parts[0]._x = { mnxLab: { strings, tab: { staffKind: 'both' } } };
    doc.parts[0].measures = Array.from({ length: 8 }, () => structuredClone(doc.parts[0].measures[0]));
    for (const measure of doc.parts[0].measures) for (const seq of measure.sequences) for (const item of seq.content) {
      if ('notes' in item) for (const note of item.notes ?? []) delete note.id;
    }
    const second = structuredClone(doc.parts[0]);
    second.id = 'two';
    second.name = 'Second instrument';
    second.staves = 2;
    for (const measure of second.measures) {
      measure.sequences.push(...structuredClone(measure.sequences).map(seq => ({ ...seq, staff: 2 })));
    }
    doc.parts.push(second);
    return doc;
  };
  const texts = (result: ReturnType<typeof layoutNotation>, className: string) => result.primitives.filter(p => p.kind === 'text' && p.className === className);
  for (const [name, layout] of Object.entries({ notation: layoutNotation, tab: layoutTab, both: layoutBothSystem })) {
    it(`${name}: names each part once per system, including a grand staff`, () => {
      initSmufl();
      const mnx = ensemble();
      const before = JSON.stringify(mnx);
      const every = layout({ mnx, widthSp: 80, display: { instrumentNames: 'every-system', barNumbers: 'every-system', lyrics: 'current' } });
      expect(every.rows!.length).toBeGreaterThan(1);
      expect(texts(every, 'staff-label')).toHaveLength(every.rows!.length * 2);
      expect(texts(every, 'measure-number')).toHaveLength(every.rows!.length);
      const first = layout({ mnx, widthSp: 80, display: { instrumentNames: 'first-system', lyrics: 'current' } });
      expect(texts(first, 'staff-label')).toHaveLength(2);
      expect([...first.index.keys()].some(key => key.startsWith('@p1.'))).toBe(true);
      expect([...first.index.keys()].some(key => key.includes('.s2.'))).toBe(true);
      expect(JSON.stringify(mnx)).toBe(before);
    });
    it(`${name}: first-system names restart in each score block and titles hide`, () => {
      initSmufl();
      const mnx = ensemble();
      mnx.scores = [{ name: 'First score' }, { name: 'Second score' }];
      const shown = layout({ mnx, widthSp: 85, display: { instrumentNames: 'first-system' } });
      expect(texts(shown, 'staff-label')).toHaveLength(4);
      expect(texts(shown, 'score-title')).toHaveLength(2);
      const hidden = layout({ mnx, widthSp: 85, display: { instrumentNames: 'first-system', title: 'hide' } });
      expect(texts(hidden, 'score-title')).toHaveLength(0);
      expect(hidden.heightSp).toBeLessThan(shown.heightSp);
    });
    it(`${name}: collapsed measures get one label per displayed position`, () => {
      initSmufl();
      const mnx = ensemble();
      mnx.scores = [{ multimeasureRests: [{ start: 'bar1', duration: 3 }] }];
      const result = layout({ mnx, widthSp: 100, display: { barNumbers: 'every-bar' } });
      expect(texts(result, 'measure-number').map(p => p.kind === 'text' ? p.text : '')).toEqual(['0', '1', '4', '5', '6', '7']);
      expect(result.primitives.some(p => p.className === 'multirest-bar')).toBe(true);
    });
    it(`${name}: display choices preserve audio timing and selection inputs`, () => {
      initSmufl();
      const mnx = ensemble();
      const audio = mnxToAudioEvents(mnx);
      const activeNoteIds = Object.freeze(['@p1.m0.v0.e0.n0']);
      const selectedNoteIds = Object.freeze(['@m0.v0.e0.n0']);
      const result = layout({ mnx, widthSp: 100, activeNoteIds, selectedNoteIds,
        display: { lyrics: 'hide', clefs: 'hide', timeSignatures: 'hide', instrumentNames: 'hide', title: 'hide', barNumbers: 'hide' } });
      expect(mnxToAudioEvents(mnx)).toEqual(audio);
      expect(activeNoteIds).toEqual(['@p1.m0.v0.e0.n0']);
      expect(selectedNoteIds).toEqual(['@m0.v0.e0.n0']);
      expect(result.primitives.some(p => /(?:clef|time-sig)/.test(p.className ?? ''))).toBe(false);
      expect(result.index.has(selectedNoteIds[0])).toBe(true);
      expect(result.primitives.some(p => p.className === 'staff-line' || p.className === 'tab-staff-line')).toBe(true);
    });
    it(`${name}: empty lyric objects claim no band in any mode`, () => {
      initSmufl();
      const mnx = ensemble();
      for (const part of mnx.parts) for (const measure of part.measures) for (const seq of measure.sequences) for (const item of seq.content) {
        if ('lyrics' in item) item.lyrics = { lines: { empty: { text: ' ' } } };
      }
      const all = layout({ mnx, widthSp: 80, display: { lyrics: 'all' } });
      const current = layout({ mnx, widthSp: 80, display: { lyrics: 'current' } });
      const hidden = layout({ mnx, widthSp: 80, display: { lyrics: 'hide' } });
      expect(texts(all, 'lyric')).toHaveLength(0);
      expect(all.heightSp).toBe(hidden.heightSp);
      expect(current.heightSp).toBe(hidden.heightSp);
    });
  }
});
