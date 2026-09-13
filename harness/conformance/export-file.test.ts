import { describe, expect, it } from 'vitest';
import fixture from '../../scenarios/lab/20-tab-part/01-standard-tuning-both/document.mnx.json';
import type { MnxStructure } from '../../src/model/mnx.ts';
import { exportDocument } from '../../src/importers/exportFile.ts';
import { importGuitarProCleanRoom } from '../../converters/guitarpro-mnx/src/cleanRoom.ts';
import { importMusicXML } from '../../converters/musicxml-mnx/src/import/musicxml.ts';

const document = fixture as unknown as MnxStructure;
describe('browser file exports', () => {
  it('writes MNX with writer provenance without mutating the source', async () => {
    const before = JSON.stringify(document);
    const result = await exportDocument(document, 'mnx');
    const exported = JSON.parse(await result.blob.text());
    expect(exported.parts).toEqual(document.parts);
    expect(exported._x.mnxLab.encoding).toEqual({ software: 'MNX Studio' });
    expect(JSON.stringify(document)).toBe(before);
    expect(result.extension).toBe('.mnx.json');
  });
  it('writes a readable GP7 container with its guitar tuning', async () => {
    const result = await exportDocument(document, 'gp7');
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    expect(Array.from(bytes.slice(0, 2))).toEqual([80, 75]);
    const imported = importGuitarProCleanRoom(bytes);
    expect(imported.parts[0]._x?.mnxLab?.strings).toEqual(document.parts[0]._x?.mnxLab?.strings);
    expect(result.extension).toBe('.gp');
  });
  it('writes readable MusicXML', async () => {
    const result = await exportDocument(document, 'musicxml');
    const xml = await result.blob.text();
    expect(xml).toContain('<score-partwise');
    expect(importMusicXML(xml).parts.length).toBeGreaterThan(0);
    expect(result.extension).toBe('.musicxml');
  });
});
