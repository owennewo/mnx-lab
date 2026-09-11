import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { importGuitarPro, exportGuitarPro, extractScoreGpif } from '../src/index.js';
import { gpTranspositionToMnx, mnxTranspositionToGp } from '../src/common/transposition.js';
import type { MnxStructure } from '../src/common/types.js';

/**
 * The guitar octave. Guitar notation is written an octave above where it
 * sounds; MNX pitch is SOUNDING, and `part.transposition` says how the part is
 * written. Every Guitar Pro format states the octave — GP7 as `<Transpose>`,
 * GP6 as `<PartSounding>`, GP3–5 through the MIDI program — and the importer
 * once dropped all three, so an imported guitar rendered an octave low unless
 * its part happened to be NAMED guitar.
 */

const SCORES = path.resolve(__dirname, '../../fixtures');
const GUITAR = { interval: { halfSteps: 12, staffDistance: 7 }, prefersWrittenPitches: true };

async function imported(name: string): Promise<MnxStructure> {
  return importGuitarPro(new Uint8Array(await fs.readFile(path.join(SCORES, name))));
}

describe('the guitar octave arrives from every Guitar Pro format', () => {
  it.each([
    ['Sun-did-glide.gp', 'GP7 <Transpose>'],
    ['Triplets-and-graces.gp', 'GP7 <Transpose>'],
    ['House-of-the-Rising-Sun.gpx', 'GP6 <PartSounding>'],
    ['Vestapol.gpx', 'GP6 <PartSounding>'],
    ['Binary-suite.gp3', 'GP3 program'],
    ['Binary-suite.gp4', 'GP4 program'],
    ['Binary-suite.gp5', 'GP5 program']
  ])('%s (%s)', async name => {
    const mnx = await imported(name);
    for (const part of mnx.parts) expect(part.transposition).toEqual(GUITAR);
  });

  it('reads the octave from the file, not the part name', async () => {
    const bytes = new Uint8Array(await fs.readFile(path.join(SCORES, 'Sun-did-glide.gp')));
    expect(extractScoreGpif(bytes)).toContain('<Octave>-1</Octave>');
    const mnx = importGuitarPro(bytes);
    mnx.parts[0].name = 'Piste 1';
    const back = importGuitarPro(exportGuitarPro(mnx));
    expect(back.parts[0].name).toBe('Piste 1');
    expect(back.parts[0].transposition).toEqual(GUITAR);
  });
});

describe('the writer states the part transposition', () => {
  it('round-trips a non-guitar transposition', async () => {
    const mnx = await imported('Sun-did-glide.gp');
    mnx.parts[0].transposition = { interval: { halfSteps: 2, staffDistance: 1 } };
    const gpif = extractScoreGpif(exportGuitarPro(mnx));
    expect(gpif).toContain('<Transpose><Chromatic>-2</Chromatic><Octave>0</Octave></Transpose>');
    expect(importGuitarPro(exportGuitarPro(mnx)).parts[0].transposition).toEqual({
      interval: { halfSteps: 2, staffDistance: 1 }
    });
  });

  it('writes the guitar octave for a part that states none', async () => {
    const mnx = await imported('Sun-did-glide.gp');
    delete mnx.parts[0].transposition;
    expect(extractScoreGpif(exportGuitarPro(mnx))).toContain(
      '<Transpose><Chromatic>0</Chromatic><Octave>-1</Octave></Transpose>'
    );
  });
});

describe('GP semitones ↔ MNX interval', () => {
  it('flips the direction and spells the staff distance', () => {
    expect(gpTranspositionToMnx(0)).toBeUndefined();
    expect(gpTranspositionToMnx(-12)).toEqual(GUITAR);
    expect(gpTranspositionToMnx(-24)).toEqual({
      interval: { halfSteps: 24, staffDistance: 14 },
      prefersWrittenPitches: true
    });
    // A B-flat instrument: written a major second above sounding.
    expect(gpTranspositionToMnx(-2)).toEqual({ interval: { halfSteps: 2, staffDistance: 1 } });
    expect(gpTranspositionToMnx(-14)).toEqual({ interval: { halfSteps: 14, staffDistance: 8 } });
    expect(mnxTranspositionToGp(GUITAR)).toBe(-12);
    expect(mnxTranspositionToGp(undefined)).toBe(-12);
  });
});
