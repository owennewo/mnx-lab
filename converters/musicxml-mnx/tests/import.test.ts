import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { importMusicXML } from '../src/index.js';

/**
 * MusicXML -> MNX import shape.
 *
 * The `.xml` fixtures are DERIVED: the corpus is authored as Guitar Pro (`.gpx`)
 * and MusicXML is generated from the MNX. So these assert the invariants of the
 * import pipeline — single-source part, no TAB clef, tab data on the notes —
 * rather than counts that move whenever a fixture is re-exported.
 */
describe('MusicXML -> MNX Import Pipeline', () => {
  it('parses a two-staff MusicXML file into a single-source part with _x.mnxLab.tab annotations', async () => {
    const xmlPath = path.resolve(__dirname, '../../../server/scores/House-of-the-Rising-Sun.xml');
    const xmlContent = await fs.readFile(xmlPath, 'utf-8');

    const mnx = importMusicXML(xmlContent, { mergeNotationAndTab: true });

    expect(mnx.mnx.version).toBe(1);
    expect(mnx.global.measures.length).toBeGreaterThan(0);

    // The notation + TAB staff pair collapses to ONE part.
    expect(mnx.parts.length).toBe(1);
    const guitarPart = mnx.parts[0];
    expect(guitarPart.name).toBe('Guitar');
    // The `-std` suffix belongs to the split MusicXML, never to the MNX.
    expect(guitarPart.id).not.toMatch(/-(std|tab)$/);

    // Key and time reach global.measures.
    expect(mnx.global.measures[0].key?.fifths).toBe(0);
    expect(mnx.global.measures.some(m => m.time)).toBe(true);

    // Single-source: real clefs only, and never a TAB clef (invalid MNX — tab
    // is a part-level view declaration).
    expect(guitarPart.measures[0].clefs?.[0].clef.sign).toBe('G');
    for (const measure of guitarPart.measures) {
      for (const c of measure.clefs ?? []) expect(c.clef.sign).not.toBe('TAB');
    }
    expect(guitarPart._x?.mnxLab?.tab?.staffKind).toBe('both');

    // Part-level tuning: explicit string numbers, standard guitar tuning.
    const tuning = guitarPart._x?.mnxLab?.tab?.tuning;
    expect(tuning).toBeDefined();
    expect(tuning!.length).toBe(6);
    const byString = new Map(tuning!.map(t => [t.string, t.pitch]));
    expect(byString.get(1)).toMatchObject({ step: 'E', octave: 4 }); // 1 = highest
    expect(byString.get(6)).toMatchObject({ step: 'E', octave: 2 }); // 6 = lowest

    // Every pitched note carries its fingerboard position on the SAME note.
    let notes = 0;
    let positioned = 0;
    for (const measure of guitarPart.measures)
      for (const sequence of measure.sequences)
        for (const event of sequence.content)
          for (const note of event.notes ?? []) {
            notes++;
            if (note._x?.mnxLab?.tab?.position) positioned++;
          }
    expect(notes).toBeGreaterThan(0);
    expect(positioned).toBe(notes);
  });

  it('keeps the notation and TAB parts separate when merging is disabled', async () => {
    const xmlPath = path.resolve(__dirname, '../../../server/scores/House-of-the-Rising-Sun.xml');
    const xmlContent = await fs.readFile(xmlPath, 'utf-8');

    const mnx = importMusicXML(xmlContent, { mergeNotationAndTab: false });
    expect(mnx.parts.length).toBe(2);
    // Exactly one of them declares itself the tab staff.
    expect(mnx.parts.filter(p => p._x?.mnxLab?.tab?.staffKind === 'tab').length).toBe(1);
  });
});
