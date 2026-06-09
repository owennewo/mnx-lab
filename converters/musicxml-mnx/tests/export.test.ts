import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { importMusicXML, exportMusicXML } from '../src/index.js';

describe('Bi-directional Roundtrip Pipeline', () => {
  it('should preserve score semantics and IDs on a full MusicXML -> MNX -> MusicXML -> MNX roundtrip', async () => {
    const xmlPath = path.resolve(__dirname, '../../../server/scores/House-of-the-Rising-Sun.xml');
    const originalXml = await fs.readFile(xmlPath, 'utf-8');

    // 1. Initial Import (MusicXML -> MNX)
    const mnx1 = importMusicXML(originalXml, { mergeNotationAndTab: true });
    expect(mnx1.parts.length).toBe(1);
    expect(mnx1.parts[0].staves).toBe(2);

    // 2. Export back to MusicXML (MNX -> MusicXML)
    const exportedXml = exportMusicXML(mnx1, { splitNotationAndTab: true, divisions: 8 });
    expect(exportedXml).toContain('<score-partwise');
    expect(exportedXml).toContain('Guitar (TAB)');

    // 3. Second Import (Exported MusicXML -> MNX)
    const mnx2 = importMusicXML(exportedXml, { mergeNotationAndTab: true });

    // 4. Assert Equivalence
    expect(mnx2.mnx.version).toBe(mnx1.mnx.version);
    expect(mnx2.global.measures.length).toBe(mnx1.global.measures.length);
    expect(mnx2.parts.length).toBe(1);

    const part1 = mnx1.parts[0];
    const part2 = mnx2.parts[0];
    expect(part2.name).toBe(part1.name);
    expect(part2.staves).toBe(part1.staves);
    expect(part2.measures.length).toBe(part1.measures.length);

    // Verify tuning was preserved in _x
    expect(part2._x?.guitar?.tuning?.strings).toBeDefined();
    expect(part2._x?.guitar?.tuning?.strings.length).toBe(6);
    expect(part2._x?.guitar?.tuning?.strings[0].step).toBe('E');
    expect(part2._x?.guitar?.tuning?.strings[0].octave).toBe(2); // E2 (string 6 in MusicXML, line 1 / bottom line)
    expect(part2._x?.guitar?.tuning?.strings[5].step).toBe('E');
    expect(part2._x?.guitar?.tuning?.strings[5].octave).toBe(4); // E4 (string 1 in MusicXML, line 6 / top line)

    // Deep verify notes in measure 2 (index 1)
    const m2_seqs1 = part1.measures[1].sequences;
    const m2_seqs2 = part2.measures[1].sequences;

    expect(m2_seqs2.length).toBe(m2_seqs1.length);

    const stdSeq1 = m2_seqs1.find(s => s.staff === 1 && s.voice === 'v1')!;
    const stdSeq2 = m2_seqs2.find(s => s.staff === 1 && s.voice === 'v1')!;
    const tabSeq1 = m2_seqs1.find(s => s.staff === 2 && s.voice === 'v1')!;
    const tabSeq2 = m2_seqs2.find(s => s.staff === 2 && s.voice === 'v1')!;

    // Check notes count
    expect(stdSeq2.content.length).toBe(stdSeq1.content.length);
    expect(tabSeq2.content.length).toBe(tabSeq1.content.length);

    // Verify pitches, frets, strings match
    const note1_1 = stdSeq1.content[0].notes?.[0]!;
    const note1_2 = stdSeq2.content[0].notes?.[0]!;
    expect(note1_2.pitch.step).toBe(note1_1.pitch.step);
    expect(note1_2.pitch.octave).toBe(note1_1.pitch.octave);

    const tabNote1_1 = tabSeq1.content[0].notes?.[0]!;
    const tabNote1_2 = tabSeq2.content[0].notes?.[0]!;
    expect(tabNote1_2._x?.guitar?.fret).toBe(tabNote1_1._x?.guitar?.fret);
    expect(tabNote1_2._x?.guitar?.string).toBe(tabNote1_1._x?.guitar?.string);

    // Verify IDs roundtripped perfectly (stripped back standard/tab suffixes)
    expect(note1_2.id).toBe(note1_1.id);
    expect(tabNote1_2.id).toBe(tabNote1_1.id);
  });
});
