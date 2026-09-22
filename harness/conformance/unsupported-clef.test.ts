import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { importMusicXML } from '../../converters/musicxml-mnx/src/import/musicxml.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
import { planNotation } from '../../src/engine/notation/notationRenderer.ts';
import { planBoth } from '../../src/engine/both/bothRenderer.ts';
import { initSmufl } from '../helpers/corpusPrimitives.ts';
initSmufl();

const source = (id: string) => importMusicXML(fs.readFileSync(new URL(`../../converters/fixtures/musicxml-suite/xmlFiles/${id}.musicxml`, import.meta.url), 'utf8')) as unknown as MnxStructure;
const note = (id: string) => ({ duration: { base: 'quarter' }, notes: [{ id, pitch: { step: 'C', octave: 4 } }] });
const mixed = (): MnxStructure => ({ mnx: { version: 1 }, global: { measures: [{}, {}, {}] }, parts: [
  { id: 'valid', measures: [0, 1, 2].map(i => ({ sequences: [{ content: [note(`good${i}`)] }] })) },
  { id: 'unsupported', measures: [
    { clefs: [{ clef: { sign: 'percussion' } }], sequences: [{ content: [note('bad0')] }] },
    { sequences: [{ content: [note('bad1')] }] },
    { clefs: [{ clef: { sign: 'G', staffPosition: -2 } }], sequences: [{ content: [note('recovered')] }] }
  ] }
] } as unknown as MnxStructure);

for (const [name, plan] of [['notation', planNotation], ['both', planBoth]] as const) {
  describe(`${name}: unsupported clef containment`, () => {
    it.each(['12a-Clefs', '34c-Font-Size', '41c-StaffGroups', '73a-Percussion'])('does not blank original %s', id => {
      const result = plan({ mnx: source(id), width: 1000 });
      expect(result.primitives.some(p => p.className?.includes('unsupported-clef'))).toBe(true);
      expect(result.primitives.some(p => p.title?.includes('unsupported clef'))).toBe(true);
      const finite = (value: unknown): void => {
        if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
        else if (value && typeof value === 'object') Object.values(value).forEach(finite);
      };
      finite(result.primitives);
    });
    it('preserves valid staves and recovers after a supported clef, without mutating input', () => {
      const doc = mixed(); const before = structuredClone(doc);
      const result = plan({ mnx: doc, width: 1000 });
      const heads = result.primitives.filter(p => p.kind === 'glyph' && p.glyph.startsWith('notehead')).map(p => p.sourceId);
      expect(heads).toEqual(expect.arrayContaining(['good0', 'good1', 'good2', 'recovered']));
      expect(heads).not.toContain('bad0'); expect(heads).not.toContain('bad1');
      expect(result.primitives.filter(p => p.className === 'unsupported-clef-event')).toHaveLength(2);
      expect(doc).toEqual(before);
    });
    it('limits a mid-measure unsupported clef to its active interval even when clefs are hidden', () => {
      const doc = mixed(); doc.global.measures = [{}]; doc.parts = [doc.parts[0]];
      doc.parts[0].measures = [{
        clefs: [
          { position: { fraction: [1, 4] }, clef: { sign: 'percussion' } },
          { position: { fraction: [1, 2] }, clef: { sign: 'G', staffPosition: -2 } }
        ], sequences: [{ content: [note('before'), note('during'), note('after')] }]
      }] as any;
      const result = plan({ mnx: doc, width: 1000, display: { clefs: 'hide' } });
      const heads = result.primitives.filter(p => p.kind === 'glyph' && p.glyph.startsWith('notehead')).map(p => p.sourceId);
      expect(heads).toEqual(expect.arrayContaining(['before', 'after']));
      expect(heads).not.toContain('during');
      expect(result.primitives.filter(p => p.className === 'unsupported-clef-event')).toHaveLength(1);
    });
  });
}
