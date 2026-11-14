import { describe, it, expect } from 'vitest';
import { importGpifOracle } from './helpers/gpifOracle.js';
import { importGuitarProGpif, exportGuitarProGpif } from '../src/gpif/index.js';
import { extractScoreGpif } from '../src/gpif/container.js';
import { MnxStructure, MnxPitch } from '../src/common/types.js';

/**
 * Artificial (harp) harmonics through the `.gp` the library stores. MNX pitch
 * is what sounds; the stopped fret stays on the note; `touchingPitch` names the
 * node. Guitar Pro states the node as `HarmonicFret`, counted up from the
 * stopped fret — 12 is the octave — which is also how alphaTab pitches it, so
 * the production parser is the oracle for the sounding pitch.
 */

const STRINGS = [
  { string: 1, pitch: { step: 'E', octave: 4 } },
  { string: 2, pitch: { step: 'B', octave: 3 } },
  { string: 3, pitch: { step: 'G', octave: 3 } },
  { string: 4, pitch: { step: 'D', octave: 3 } },
  { string: 5, pitch: { step: 'A', octave: 2 } },
  { string: 6, pitch: { step: 'D', octave: 2 } }
] as const;

function harmonicNote(pitch: MnxPitch, string: number, fret: number, touchingPitch?: MnxPitch) {
  return {
    pitch,
    _x: { mnxLab: { string, fret, tab: { technique: { harmonic: { type: 'artificial' as const, ...(touchingPitch ? { touchingPitch } : {}) } } } } }
  };
}

/** Imagine's outro figure: held at the 7th fret (D string) and 9th (G string),
 *  touched 12 frets up; then a twelfth (node 7) with no touch pitch stated. */
function document(): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }] },
    parts: [{
      id: 'guitar',
      name: 'Guitar',
      _x: { mnxLab: { strings: STRINGS.map(s => ({ string: s.string, pitch: { ...s.pitch } })) } },
      measures: [{
        sequences: [{
          content: [
            { duration: { base: 'quarter' }, notes: [harmonicNote({ step: 'A', octave: 4 }, 4, 7, { step: 'A', octave: 4 })] },
            { duration: { base: 'quarter' }, notes: [harmonicNote({ step: 'E', octave: 5 }, 3, 9, { step: 'E', octave: 5 })] },
            { duration: { base: 'quarter' }, notes: [harmonicNote({ step: 'F', alter: 1, octave: 5 }, 2, 7, { step: 'F', alter: 1, octave: 5 })] },
            { duration: { base: 'quarter' }, notes: [harmonicNote({ step: 'E', octave: 5 }, 4, 7)] }
          ]
        }]
      }]
    }]
  } as unknown as MnxStructure;
}

const notesOf = (doc: MnxStructure) =>
  doc.parts[0].measures[0].sequences![0].content!.map(item => ('notes' in item ? item.notes![0] : null));

describe('artificial harmonics in .gp', () => {
  it('state the node counted from the stopped fret, not the fret played', () => {
    const xml = extractScoreGpif(exportGuitarProGpif(document()));
    const nodes = [...xml.matchAll(/<HFret>([^<]+)<\/HFret>/g)].map(m => Number(m[1]));
    // Three octave nodes, then the twelfth: E5 sounding over A3 stopped is 19
    // semitones, heard at node 7.
    expect(nodes).toEqual([12, 12, 12, 7]);
  });

  it('come back sounding, stopped and touched where they were written', () => {
    const back = notesOf(importGuitarProGpif(exportGuitarProGpif(document())));
    const written = notesOf(document());
    for (let i = 0; i < 3; i++) {
      expect(back[i]!.pitch).toEqual(written[i]!.pitch);
      expect(back[i]!._x!.mnxLab).toMatchObject(written[i]!._x!.mnxLab!);
    }
    // The node read back is stated even where the document left it implicit.
    expect(back[3]!.pitch).toEqual({ step: 'E', octave: 5 });
    expect(back[3]!._x!.mnxLab!.tab!.technique!.harmonic).toEqual({ type: 'artificial', touchingPitch: { step: 'E', octave: 4 } });
  });

  it('sound where alphaTab sounds them', () => {
    const bytes = exportGuitarProGpif(document());
    const ours = notesOf(importGuitarProGpif(bytes)).map(n => n!.pitch);
    const oracle = notesOf(importGpifOracle(bytes)).map(n => n!.pitch);
    expect(ours).toEqual(oracle);
  });
});
