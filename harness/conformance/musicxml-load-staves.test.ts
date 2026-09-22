import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { importMusicXML } from '../../converters/musicxml-mnx/src/import/musicxml.ts';
import { upgradeTabExtension } from '../../src/model/upgradeTabExtension.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

const read = (name: string) => importMusicXML(fs.readFileSync(new URL(
  `../../converters/fixtures/musicxml-suite/xmlFiles/${name}.musicxml`, import.meta.url
), 'utf8')) as unknown as MnxStructure;

const legacy = () => ({
  id: 'legacy',
  measures: [{
    clefs: [{ staff: 1, clef: { sign: 'G', staffPosition: -2 } }, { staff: 2, clef: { sign: 'TAB' } }],
    sequences: [
      { staff: 1, content: [{ duration: { base: 'whole' }, notes: [{ id: 'old', pitch: { step: 'E', octave: 4 } }] }] },
      { staff: 2, content: [{ duration: { base: 'whole' }, notes: [{ id: 'old', pitch: { step: 'E', octave: 4 }, _x: { guitar: { string: 1, fret: 0 } } }] }] }
    ]
  }]
});

describe('MusicXML load-time migration preserves independent staves', () => {
  it.each(['43a-PianoStaff', '11b-TimeSignatures-NoTime'])('leaves modern %s unchanged', id => {
    const doc = read(id);
    const before = structuredClone(doc);
    const loaded = upgradeTabExtension(doc);
    expect(loaded).toEqual(before);
    expect(loaded).toBe(doc);
    expect(loaded.parts[0]._x?.mnxLab?.strings).toBeUndefined();
  });

  it('retains both source piano pitches on their original staves', () => {
    const loaded = upgradeTabExtension(read('43a-PianoStaff'));
    expect(loaded.parts[0].measures[0].sequences.map(s => ({
      staff: s.staff, notes: (s.content[0] as any).notes.map((n: any) => n.pitch)
    }))).toEqual([
      { staff: 1, notes: [{ step: 'F', octave: 4 }] },
      { staff: 2, notes: [{ step: 'B', octave: 2 }] }
    ]);
  });

  it('upgrades legacy tab within a mixed document without rewriting its modern piano part', () => {
    const doc = read('43a-PianoStaff');
    const piano = structuredClone(doc.parts[0]);
    doc.parts.push(legacy() as any);
    const loaded = upgradeTabExtension(doc);
    expect(loaded.parts[0]).toEqual(piano);
    const guitar = loaded.parts[1];
    expect(guitar.measures[0].sequences).toHaveLength(1);
    expect((guitar.measures[0].sequences[0].content[0] as any).notes[0]._x.mnxLab).toEqual({ string: 1, fret: 0 });
    expect(guitar._x?.mnxLab?.tab?.staffKind).toBe('both');
    expect(guitar._x?.mnxLab?.strings).toHaveLength(6);
    expect(upgradeTabExtension(loaded)).toBe(loaded);
    expect(doc.parts[0]).toEqual(piano);
    expect(doc.parts[1].measures[0].sequences).toHaveLength(2);
  });
});
