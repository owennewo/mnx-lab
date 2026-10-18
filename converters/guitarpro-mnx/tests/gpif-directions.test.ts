import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  importGuitarProGpif, exportGuitarProGpif, gpifToMnx, mnxToGpifXml, parseGpif
} from '../src/gpif/index.js';
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

describe('Guitar Pro master-bar navigation', () => {
  const targetTokens = ['Fine', 'Segno', 'SegnoSegno', 'Coda', 'DoubleCoda'];
  const jumpTokens = [
    'DaCapo', 'DaCapoAlCoda', 'DaCapoAlDoubleCoda', 'DaCapoAlFine',
    'DaSegno', 'DaSegnoAlCoda', 'DaSegnoAlDoubleCoda', 'DaSegnoAlFine',
    'DaSegnoSegno', 'DaSegnoSegnoAlCoda', 'DaSegnoSegnoAlDoubleCoda',
    'DaSegnoSegnoAlFine', 'DaCoda', 'DaDoubleCoda'
  ];

  it('maps the complete 19-token GPIF vocabulary and writes every token back exactly', async () => {
    const base: MnxStructure = JSON.parse(await fs.readFile(path.join(SCORES, 'Vestapol.mnx.json'), 'utf-8'));
    const count = targetTokens.length + jumpTokens.length;
    while (base.global.measures.length < count) base.global.measures.push({});
    while (base.parts[0].measures.length < count) base.parts[0].measures.push({ sequences: [] });
    let xml = mnxToGpifXml(base);
    let ordinal = 0;
    xml = xml.replace(/<MasterBar>([\s\S]*?)<\/MasterBar>/g, (whole, body) => {
      const token = ordinal < targetTokens.length
        ? `<Target>${targetTokens[ordinal]}</Target>`
        : `<Jump>${jumpTokens[ordinal - targetTokens.length]}</Jump>`;
      ordinal += 1;
      return ordinal <= count ? `<MasterBar><Directions>${token}</Directions>${body}</MasterBar>` : whole;
    });
    const warnings: string[] = [];
    const mnx = gpifToMnx(parseGpif(xml), { onWarning: warning => warnings.push(warning) });
    expect(warnings.filter(warning => warning.includes('direction'))).toEqual([]);

    expect(mnx.global.measures[2]._x?.mnxLab?.navigation?.marks?.[0])
      .toMatchObject({ kind: 'segno', count: 2 });
    expect(mnx.global.measures[6]._x?.mnxLab?.navigation?.jumps?.[0])
      .toMatchObject({ type: 'daCapoAlCoda', resumeAt: 'coda' });
    expect(mnx.global.measures[7]._x?.mnxLab?.navigation?.jumps?.[0])
      .toMatchObject({ type: 'daCapoAlCoda', resumeAt: 'double-coda' });

    const written = mnxToGpifXml(mnx);
    for (const token of targetTokens) expect(written).toContain(`<Target>${token}</Target>`);
    for (const token of jumpTokens) expect(written).toContain(`<Jump>${token}</Jump>`);
  });
});

describe('Guitar Pro end-of-bar directions', () => {
  // "At the end of the bar" is the bar's own length, not a whole note: at [1, 1] a D.S. in
  // 3/8 lies past its bar, and the performance compiler could not reach it.
  it('places Fine and every jump at the end of a 3/8 bar, not a whole note in', async () => {
    const base: MnxStructure = JSON.parse(await fs.readFile(path.join(SCORES, 'Vestapol.mnx.json'), 'utf-8'));
    let xml = mnxToGpifXml(base).replace(/<Time>[^<]*<\/Time>/g, '<Time>3/8</Time>');
    expect(xml).toContain('<Time>3/8</Time>');
    const directions = ['<Target>Fine</Target>', '<Jump>DaSegno</Jump>', '<Jump>DaCoda</Jump>'];
    let ordinal = 0;
    xml = xml.replace(/<MasterBar>/g, whole => {
      const token = directions[ordinal++];
      return token ? `<MasterBar><Directions>${token}</Directions>` : whole;
    });
    const mnx = gpifToMnx(parseGpif(xml));

    expect(mnx.global.measures[0].fine?.location).toEqual({ fraction: [3, 8] });
    expect(mnx.global.measures[1].jump?.location).toEqual({ fraction: [3, 8] });
    expect(mnx.global.measures[2]._x?.mnxLab?.navigation?.jumps?.[0]?.location).toEqual({ fraction: [3, 8] });
  });
});
