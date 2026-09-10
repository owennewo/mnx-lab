import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { importMusicXML, exportMusicXML } from '../src/index.js';
import type { MnxStructure, MnxEvent, MnxSequenceItem } from '../src/common/types.js';

/**
 * The notation+TAB split renames every note (`n12` → `n12_std` / `n12_tab`),
 * and every reference to a note has to be renamed with it. Tie targets were
 * not: each tie on a tab-bearing part pointed at an id that no longer existed,
 * so every Guitar Pro import exported to MusicXML without a single tie —
 * Vestapol's 38 among them — and nothing said so.
 */

const events = (items: MnxSequenceItem[]): MnxEvent[] =>
  items.flatMap(item => ('type' in item && (item.type === 'grace' || item.type === 'tuplet')
    ? (item as { content: MnxEvent[] }).content
    : [item as MnxEvent]));

const tieCount = (mnx: MnxStructure) =>
  mnx.parts.flatMap(part => part.measures.flatMap(measure =>
    (measure.sequences ?? []).flatMap(sequence => events(sequence.content ?? []))))
    .flatMap(event => event.notes ?? [])
    .filter(note => note.ties?.some(tie => tie.target)).length;

describe('references across the notation+TAB split', () => {
  it('writes every tie of a tab-bearing part, on both staves', async () => {
    const doc: MnxStructure = JSON.parse(
      await fs.readFile(path.resolve(__dirname, '../../fixtures/Vestapol.mnx.json'), 'utf-8')
    );
    expect(doc.parts[0]._x?.mnxLab?.tab?.staffKind).toBe('both');
    expect(tieCount(doc)).toBe(38);

    const xml = exportMusicXML(doc);
    expect(xml.match(/<tie type="start"\/>/g)).toHaveLength(2 * 38);
    expect(xml.match(/<tie type="stop"\/>/g)).toHaveLength(2 * 38);
  });

  it('brings the ties back on re-import', async () => {
    const doc: MnxStructure = JSON.parse(
      await fs.readFile(path.resolve(__dirname, '../../fixtures/Vestapol.mnx.json'), 'utf-8')
    );
    const back = importMusicXML(exportMusicXML(doc), { mergeNotationAndTab: true });
    expect(tieCount(back)).toBe(38);
  });
});
