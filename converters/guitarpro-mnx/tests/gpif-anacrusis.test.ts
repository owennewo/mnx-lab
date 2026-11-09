// A pickup bar (roadmap/proposed/core-anacrusis.md). Guitar Pro marks one with
// `<Anacrusis />` in the master track and keeps the piece's signature on the
// bar, letting its notes set its length — a real Guitar Pro 7 file (alphaTab's
// test-data/guitarpro7/anacrusis.gp, revision 12024) has `<Time>4/4</Time>` on
// a bar of two quarters. The lab stores the pickup at its true length (2/4)
// and marks it `number: 0`, so reading shortens the signature and writing
// steals the next bar's back.
import { describe, it, expect } from 'vitest';
import { gpifToMnx, mnxToGpifXml, parseGpif } from '../src/gpif/index.js';
import type { MnxStructure } from '../src/common/types.js';

const q = (step = 'C') => ({ type: 'event', duration: { base: 'quarter' }, notes: [{ pitch: { step, octave: 4 } }] });
const bar = (n: number) => ({ sequences: [{ content: Array.from({ length: n }, () => q()) }] });

function doc(first: object, beats: number[]): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [first, { time: { count: 4, unit: 4 } }, ...beats.slice(2).map(() => ({}))] },
    parts: [{ id: 'g', name: 'Guitar', measures: beats.map(bar) }]
  } as unknown as MnxStructure;
}
const exportGuitarProGpif = (mnx: MnxStructure) => mnxToGpifXml(mnx);
const importGuitarProGpif = (xml: string) => gpifToMnx(parseGpif(xml));
const times = (xml: string) => [...xml.matchAll(/<Time>([^<]*)<\/Time>/g)].map(m => m[1]);

describe('a pickup bar through Guitar Pro', () => {
  it('writes the next bar\'s signature and <Anacrusis />, where Guitar Pro 7 puts it', () => {
    const xml = exportGuitarProGpif(doc({ number: 0, time: { count: 1, unit: 4 } }, [1, 4, 3]));
    expect(xml).toMatch(/<MasterTrack>\s*<Anacrusis \/>\s*<Tracks>/);
    expect(times(xml)).toEqual(['4/4', '4/4', '4/4']);
  });

  it('reads back at its true length, numbered 0 — and the bar after it states 4/4 again', () => {
    const back = importGuitarProGpif(exportGuitarProGpif(doc({ number: 0, time: { count: 2, unit: 4 } }, [2, 4]))) as MnxStructure;
    expect(back.global.measures[0]).toMatchObject({ number: 0, time: { count: 2, unit: 4 } });
    expect(back.global.measures[1]!.time).toEqual({ count: 4, unit: 4 });
    expect(back.parts[0]!.measures[0]!.sequences![0]!.content).toHaveLength(2);
  });

  it('a pickup that is not a whole number of beats takes a finer unit', () => {
    const dotted = { type: 'event', duration: { base: 'quarter', dots: 1 }, notes: [{ pitch: { step: 'C', octave: 4 } }] };
    const source = doc({ number: 0, time: { count: 3, unit: 8 } }, [1, 4]);
    source.parts[0]!.measures[0] = { sequences: [{ content: [dotted] }] } as never;
    const back = importGuitarProGpif(exportGuitarProGpif(source)) as MnxStructure;
    expect(back.global.measures[0]).toMatchObject({ number: 0, time: { count: 3, unit: 8 } });
  });

  it('a short first bar NOT numbered 0 keeps its own signature and writes no flag', () => {
    const xml = exportGuitarProGpif(doc({ time: { count: 1, unit: 4 } }, [1, 4]));
    expect(xml).not.toContain('Anacrusis');
    expect(times(xml)[0]).toBe('1/4');
    const back = importGuitarProGpif(xml) as MnxStructure;
    expect(back.global.measures[0]!.number).toBeUndefined();
  });

  it('a full-length first bar numbered 0 is only numbering: no flag', () => {
    expect(exportGuitarProGpif(doc({ number: 0, time: { count: 4, unit: 4 } }, [4, 4]))).not.toContain('Anacrusis');
  });
});
