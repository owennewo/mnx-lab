import { describe, it, expect } from 'vitest';
import { importGpifOracle } from './helpers/gpifOracle.js';
import { importGuitarProGpif, exportGuitarProGpif } from '../src/gpif/index.js';
import { MnxStructure, MnxPitch } from '../src/common/types.js';

/**
 * Natural harmonics away from the 12th fret through the `.gp` the library
 * stores. A natural harmonic's fret is the node touched, counted from the nut;
 * MNX pitch is what sounds there — the twelfth at 7 and 19, two octaves at 5 —
 * not the fret's own pitch. Before this was read, a harmonic at 7 came back a
 * twelfth low and studio's storage check refused the version.
 */

const STRINGS = [
  { string: 1, pitch: { step: 'D', octave: 4 } },
  { string: 2, pitch: { step: 'A', octave: 3 } },
  { string: 3, pitch: { step: 'F', alter: 1, octave: 3 } },
  { string: 4, pitch: { step: 'D', octave: 3 } },
  { string: 5, pitch: { step: 'A', octave: 2 } },
  { string: 6, pitch: { step: 'D', octave: 2 } }
] as const;

function natural(pitch: MnxPitch, string: number, fret: number) {
  return { pitch, _x: { mnxLab: { string, fret, tab: { technique: { harmonic: { type: 'natural' as const } } } } } };
}

/** Open D (DADF♯AD), as the piece that found this is tuned. */
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
            { duration: { base: 'quarter' }, notes: [natural({ step: 'C', alter: 1, octave: 5 }, 3, 7)] },
            { duration: { base: 'quarter' }, notes: [natural({ step: 'D', octave: 5 }, 1, 12)] },
            { duration: { base: 'quarter' }, notes: [natural({ step: 'D', octave: 5 }, 4, 5)] },
            { duration: { base: 'quarter' }, notes: [natural({ step: 'A', octave: 3 }, 6, 19)] }
          ]
        }]
      }]
    }]
  } as unknown as MnxStructure;
}

const notesOf = (doc: MnxStructure) =>
  doc.parts[0].measures[0].sequences![0].content!.map(item => ('notes' in item ? item.notes![0] : null));

describe('natural harmonics in .gp', () => {
  it('come back sounding at the node, touched at the fret they were written at', () => {
    const back = notesOf(importGuitarProGpif(exportGuitarProGpif(document())));
    const written = notesOf(document());
    for (let i = 0; i < written.length; i++) {
      expect(back[i]!.pitch).toEqual(written[i]!.pitch);
      expect(back[i]!._x!.mnxLab).toMatchObject(written[i]!._x!.mnxLab!);
    }
  });

  it('with no fret stored, are touched at the node on their own string', () => {
    const doc = document();
    const content = doc.parts[0].measures[0].sequences![0].content!;
    const bare = (pitch: MnxPitch, string: number) =>
      ({ pitch, _x: { mnxLab: { string, tab: { technique: { harmonic: { type: 'natural' as const } } } } } });
    content.splice(0, 4, ...([
      { duration: { base: 'half' }, notes: [bare({ step: 'D', octave: 3 }, 6)] },
      { duration: { base: 'half' }, notes: [bare({ step: 'A', octave: 3 }, 6)] }
    ] as never[]));
    const back = notesOf(importGuitarProGpif(exportGuitarProGpif(doc)));
    expect(back.map(n => [n!.pitch, n!._x!.mnxLab!.string, n!._x!.mnxLab!.fret])).toEqual([
      [{ step: 'D', octave: 3 }, 6, 12],
      [{ step: 'A', octave: 3 }, 6, 7]
    ]);
  });

  it('sound where alphaTab sounds them', () => {
    const bytes = exportGuitarProGpif(document());
    const ours = notesOf(importGuitarProGpif(bytes)).map(n => n!.pitch);
    const oracle = notesOf(importGpifOracle(bytes)).map(n => n!.pitch);
    expect(ours).toEqual(oracle);
  });
});
