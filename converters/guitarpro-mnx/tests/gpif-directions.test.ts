import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { importGuitarProGpif, exportGuitarProGpif } from '../src/gpif/index.js';
import { MnxStructure } from '../src/common/types.js';

/**
 * A beat's free text: a chord symbol when it spells one, text over the staff
 * when it does not. Soundslice's "Outer text" and Guitar Pro 4's beat text
 * ("Intro", "Verse 1-4") used to be read only as a chord attempt and dropped.
 */

const SCORES = path.resolve(__dirname, '../../fixtures');

async function withText(): Promise<MnxStructure> {
  const mnx: MnxStructure = JSON.parse(await fs.readFile(path.join(SCORES, 'Vestapol.mnx.json'), 'utf-8'));
  mnx.parts[0].measures[0].directions = [{ position: { fraction: [0, 1] }, text: 'Verse 1-4', orient: 'above' }];
  return mnx;
}

describe('Guitar Pro free text', () => {
  it('reads text that is not a chord back as a direction above the staff', async () => {
    const warnings: string[] = [];
    const back = importGuitarProGpif(exportGuitarProGpif(await withText(), { onWarning: m => warnings.push(m) }));
    expect(back.parts[0].measures[0].directions).toEqual([
      { position: { fraction: [0, 1] }, text: 'Verse 1-4', orient: 'above' }
    ]);
    expect(warnings).toEqual([]);
  });

  it.each([
    'got a kind',
    'hearted woman',
    "do anything'n this world for me",
    'A-ain\'t but the one thing',
    'Makes mister Johnson drink',
    "Worried 'bout how you treat"
  ])('does not mistake lyric-like prose for a chord: %s', async text => {
    const mnx = await withText();
    mnx.parts[0].measures[0].directions = [{ position: { fraction: [0, 1] }, text, orient: 'above' }];

    const back = importGuitarProGpif(exportGuitarProGpif(mnx));

    expect(back.global.measures[0]._x?.mnxLab?.harmonies ?? []).toEqual([]);
    expect(back.parts[0].measures[0].directions).toEqual([
      { position: { fraction: [0, 1] }, text, orient: 'above' }
    ]);
  });

  it('still reads a chord spelled as free text as a chord, not a direction', async () => {
    const source: MnxStructure = JSON.parse(await fs.readFile(path.join(SCORES, 'Vestapol.mnx.json'), 'utf-8'));
    const back = importGuitarProGpif(exportGuitarProGpif(source));
    expect(back.parts.flatMap(p => p.measures.flatMap(m => m.directions ?? []))).toEqual([]);
    expect(back.global.measures.flatMap(m => m._x?.mnxLab?.harmonies ?? []).length).toBeGreaterThan(0);
  });

  it('says out loud what a beat cannot carry', async () => {
    const mnx = await withText();
    mnx.parts[0].measures[0].directions!.push({ position: { fraction: [0, 1] }, text: 'let ring', orient: 'below' });
    const warnings: string[] = [];
    exportGuitarProGpif(mnx, { onWarning: m => warnings.push(m) });
    expect(warnings.some(w => w.includes('orient'))).toBe(true);
    expect(warnings.some(w => w.includes('one text per beat'))).toBe(true);
  });
});
