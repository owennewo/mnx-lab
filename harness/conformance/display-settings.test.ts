import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MnxStructure } from '../../src/model/mnx.ts';
import { normalizeDisplayOptions } from '../../src/engine/displayOptions.ts';
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
