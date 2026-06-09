import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { importMusicXML } from '../src/index.js';

describe('MusicXML -> MNX Import Pipeline', () => {
  it('should parse House-of-the-Rising-Sun.xml into a single-source part with _x.tab annotations', async () => {
    const xmlPath = path.resolve(__dirname, '../../../server/scores/House-of-the-Rising-Sun.xml');
    const xmlContent = await fs.readFile(xmlPath, 'utf-8');

    const mnx = importMusicXML(xmlContent, { mergeNotationAndTab: true });

    // Assert overall structure
    expect(mnx.mnx.version).toBe(1);
    expect(mnx.global.measures.length).toBeGreaterThan(0);
    expect(mnx.parts.length).toBe(1);

    const guitarPart = mnx.parts[0];
    expect(guitarPart.name).toBe('Guitar');

    // Verify global key and time signature inherit correctly
    expect(mnx.global.measures[0].key?.fifths).toBe(0);
    expect(mnx.global.measures[1].time?.count).toBe(4);
    expect(mnx.global.measures[1].time?.unit).toBe(4);

    // Single-source: ONE staff, ONE clef (treble), and never a TAB clef —
    // tab-ness is the part-level view declaration.
    const firstMeasure = guitarPart.measures[0];
    expect(firstMeasure.clefs).toBeDefined();
    expect(firstMeasure.clefs!.length).toBe(1);
    expect(firstMeasure.clefs![0].clef.sign).toBe('G');
    for (const measure of guitarPart.measures) {
      for (const c of measure.clefs ?? []) {
        expect(c.clef.sign).not.toBe('TAB');
      }
    }
    expect(guitarPart._x?.tab?.staffKind).toBe('both');

    // Part-level tuning: explicit string numbers, standard guitar tuning
    const tuning = guitarPart._x?.tab?.tuning;
    expect(tuning).toBeDefined();
    expect(tuning!.length).toBe(6);
    const byString = new Map(tuning!.map(t => [t.string, t.pitch]));
    expect(byString.get(1)).toMatchObject({ step: 'E', octave: 4 }); // string 1 = highest
    expect(byString.get(6)).toMatchObject({ step: 'E', octave: 2 }); // string 6 = lowest

    // Verify measure 2 (index 1): one staff, two voices
    const secondMeasure = guitarPart.measures[1];
    expect(secondMeasure.sequences.length).toBe(2); // 2 voices, single staff

    const voice1 = secondMeasure.sequences.find(s => s.voice === 'v1');
    expect(voice1).toBeDefined();

    // Voice 1 note 1: sounding pitch A2 (written A3 transposed down an octave)
    // carrying its fingerboard position on the SAME note.
    const note1 = voice1!.content[0].notes?.[0];
    expect(note1).toBeDefined();
    expect(note1!.pitch.step).toBe('A');
    expect(note1!.pitch.octave).toBe(2);
    expect(note1!._x?.tab?.position?.fret).toBe(0);
    expect(note1!._x?.tab?.position?.string).toBe(5);
    expect(note1!.id).toBeDefined();
  });
});
