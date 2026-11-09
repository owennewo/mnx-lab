// A pickup bar (roadmap/proposed/core-anacrusis.md). MusicXML marks one
// `<measure implicit="yes" number="0">` carrying the piece's signature and only
// the pickup's notes; the lab stores it at its true length, numbered 0.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { importMusicXML } from '../src/import/musicxml.js';
import { exportMusicXML } from '../src/export/mnx.js';
import type { MnxStructure } from '../src/common/types.js';

const source = fs.readFileSync(new URL('../../fixtures/musicxml-suite/xmlFiles/21e-Chords-PickupMeasures.musicxml', import.meta.url), 'utf8');
const q = () => ({ type: 'event', duration: { base: 'quarter' }, notes: [{ pitch: { step: 'C', octave: 4 } }] });
const doc = (first: object): MnxStructure => ({
  mnx: { version: 1 },
  global: { measures: [first, { time: { count: 4, unit: 4 } }, {}] },
  parts: [{ id: 'P1', name: 'Test', measures: [1, 4, 4].map(n => ({ sequences: [{ content: Array.from({ length: n }, q) }] })) }]
} as unknown as MnxStructure);

describe('a pickup through MusicXML', () => {
  it('an implicit quarter in 4/4 reads as a 1/4 bar numbered 0, and the next bar states 4/4', () => {
    // 21e with its meter declared: the pinned original declares none (below).
    const withMeter = source.replace('<divisions>1</divisions>', '<divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time>');
    const [first, second] = importMusicXML(withMeter).global.measures;
    expect(first).toMatchObject({ number: 0, time: { count: 1, unit: 4 } });
    expect(second!.time).toEqual({ count: 4, unit: 4 });
  });

  it('21e as pinned declares no meter, so there is nothing to shorten: it imports as before', () => {
    // Making it a pickup would DRAW a 4/4 the source never shows. Its
    // underfill badge stays with core-musicxml-chord-fidelity.
    const [first] = importMusicXML(source).global.measures;
    expect(first?.number).toBeUndefined();
    expect(first?.time).toBeUndefined();
  });

  it('writes measure 0 implicit, with the next bar\'s signature once, and numbers on from 1', () => {
    const xml = exportMusicXML(doc({ number: 0, time: { count: 1, unit: 4 } }));
    expect(xml).toMatch(/<measure number="0" implicit="yes">/);
    expect([...xml.matchAll(/<measure number="(\d+)"/g)].map(m => m[1])).toEqual(['0', '1', '2']);
    expect([...xml.matchAll(/<beats>(\d+)<\/beats>/g)].map(m => m[1])).toEqual(['4']);
    const back = importMusicXML(xml).global.measures;
    expect(back[0]).toMatchObject({ number: 0, time: { count: 1, unit: 4 } });
    expect(back[1]!.time).toEqual({ count: 4, unit: 4 });
  });

  it('a short first bar not numbered 0 is written as it is stored', () => {
    const xml = exportMusicXML(doc({ time: { count: 1, unit: 4 } }));
    expect(xml).not.toContain('implicit');
    expect([...xml.matchAll(/<beats>(\d+)<\/beats>/g)].map(m => m[1])).toEqual(['1', '4']);
  });
});
