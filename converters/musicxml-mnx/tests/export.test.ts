import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { importMusicXML, exportMusicXML } from '../src/index.js';

describe('Bi-directional Roundtrip Pipeline', () => {
  it('should preserve score semantics and IDs on a full MusicXML -> MNX -> MusicXML -> MNX roundtrip', async () => {
    const xmlPath = path.resolve(__dirname, '../../fixtures/House-of-the-Rising-Sun.xml');
    const originalXml = await fs.readFile(xmlPath, 'utf-8');

    // 1. Initial Import (MusicXML -> single-source MNX)
    const mnx1 = importMusicXML(originalXml, { mergeNotationAndTab: true });
    expect(mnx1.parts.length).toBe(1);
    expect(mnx1.parts[0]._x?.mnxLab?.tab?.staffKind).toBe('both');

    // 2. Export back to MusicXML (MNX -> MusicXML). The notation+TAB staff
    // pair is synthesized at the MusicXML boundary from the single source.
    const exportedXml = exportMusicXML(mnx1, { splitNotationAndTab: true, divisions: 8 });
    expect(exportedXml).toContain('<score-partwise');
    expect(exportedXml).toContain('Guitar (TAB)');
    expect(exportedXml).toContain('<sign>TAB</sign>');

    // 3. Second Import (Exported MusicXML -> MNX)
    const mnx2 = importMusicXML(exportedXml, { mergeNotationAndTab: true });

    // 4. Assert Equivalence
    expect(mnx2.mnx.version).toBe(mnx1.mnx.version);
    expect(mnx2.global.measures.length).toBe(mnx1.global.measures.length);
    expect(mnx2.parts.length).toBe(1);

    const part1 = mnx1.parts[0];
    const part2 = mnx2.parts[0];
    expect(part2.name).toBe(part1.name);
    expect(part2.measures.length).toBe(part1.measures.length);
    expect(part2._x?.mnxLab?.tab?.staffKind).toBe('both');

    // Verify tuning roundtripped (explicit string numbers)
    const tuning2 = part2._x?.mnxLab?.strings;
    expect(tuning2).toBeDefined();
    expect(tuning2!.length).toBe(6);
    const byString = new Map(tuning2!.map(t => [t.string, t.pitch]));
    expect(byString.get(1)).toMatchObject({ step: 'E', octave: 4 });
    expect(byString.get(6)).toMatchObject({ step: 'E', octave: 2 });

    // No TAB clefs anywhere in either MNX document
    for (const part of [part1, part2]) {
      for (const measure of part.measures) {
        for (const c of measure.clefs ?? []) {
          expect(c.clef.sign).not.toBe('TAB');
        }
      }
    }

    // Deep verify notes in measure 2 (index 1)
    const m2_seqs1 = part1.measures[1].sequences;
    const m2_seqs2 = part2.measures[1].sequences;

    expect(m2_seqs2.length).toBe(m2_seqs1.length);

    const seq1 = m2_seqs1.find(s => s.voice === 'v1')!;
    const seq2 = m2_seqs2.find(s => s.voice === 'v1')!;

    expect(seq2.content.length).toBe(seq1.content.length);

    // Pitches and fingerboard positions match on the same (single) note
    const note1_1 = seq1.content[0].notes?.[0]!;
    const note1_2 = seq2.content[0].notes?.[0]!;
    expect(note1_2.pitch.step).toBe(note1_1.pitch.step);
    expect(note1_2.pitch.octave).toBe(note1_1.pitch.octave);
    expect(note1_2._x?.mnxLab?.fret).toBe(note1_1._x?.mnxLab?.fret);
    expect(note1_2._x?.mnxLab?.string).toBe(note1_1._x?.mnxLab?.string);

    // IDs roundtripped perfectly (regenerated deterministically; _std/_tab
    // suffixes only ever exist inside the exported MusicXML)
    expect(note1_2.id).toBe(note1_1.id);
  });
});
