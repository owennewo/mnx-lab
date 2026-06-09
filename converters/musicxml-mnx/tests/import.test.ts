import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { importMusicXML } from '../src/index.js';

describe('MusicXML -> MNX Import Pipeline', () => {
  it('should parse House-of-the-Rising-Sun.xml and merge notation & TAB staves', async () => {
    const xmlPath = path.resolve(__dirname, '../../../server/scores/House-of-the-Rising-Sun.xml');
    const xmlContent = await fs.readFile(xmlPath, 'utf-8');

    const mnx = importMusicXML(xmlContent, { mergeNotationAndTab: true });

    // Assert overall structure
    expect(mnx.mnx.version).toBe(1);
    expect(mnx.global.measures.length).toBeGreaterThan(0);
    expect(mnx.parts.length).toBe(1);

    const guitarPart = mnx.parts[0];
    expect(guitarPart.name).toBe('Guitar');
    expect(guitarPart.staves).toBe(2);

    // Verify global key and time signature inherit correctly
    expect(mnx.global.measures[0].key?.fifths).toBe(0);
    expect(mnx.global.measures[1].time?.count).toBe(4);
    expect(mnx.global.measures[1].time?.unit).toBe(4);

    // Verify first measure clefs
    const firstMeasure = guitarPart.measures[0];
    expect(firstMeasure.clefs).toBeDefined();
    expect(firstMeasure.clefs!.length).toBe(2);
    expect(firstMeasure.clefs![0].clef.sign).toBe('G');
    expect(firstMeasure.clefs![1].clef.sign).toBe('TAB');

    // Verify note ID alignment and transposition in measure 2 (index 1)
    const secondMeasure = guitarPart.measures[1];
    expect(secondMeasure.sequences.length).toBe(4); // 2 staves * 2 voices = 4 sequences

    const trebleVoice1 = secondMeasure.sequences.find(s => s.staff === 1 && s.voice === 'v1');
    const tabVoice1 = secondMeasure.sequences.find(s => s.staff === 2 && s.voice === 'v1');

    expect(trebleVoice1).toBeDefined();
    expect(tabVoice1).toBeDefined();

    // Treble voice 1 note 1 should be A2 (sounding pitch of written A3 transposed down by 12 semitones)
    const trebleNote1 = trebleVoice1!.content[0].notes?.[0];
    expect(trebleNote1).toBeDefined();
    expect(trebleNote1!.pitch.step).toBe('A');
    expect(trebleNote1!.pitch.octave).toBe(2); // sounding pitch (originally octave 3 in standard written notation)

    // TAB voice 1 note 1 should have fret 0 and string 5
    const tabNote1 = tabVoice1!.content[0].notes?.[0];
    expect(tabNote1).toBeDefined();
    expect(tabNote1!._x?.guitar?.fret).toBe(0);
    expect(tabNote1!._x?.guitar?.string).toBe(5);

    // They should share the exact same ID
    expect(trebleNote1!.id).toBe(tabNote1!.id);
  });
});
