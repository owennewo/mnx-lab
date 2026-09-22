import { describe, expect, it } from 'vitest';
import { importMusicXML } from '../src/import/musicxml.js';
import { exportMusicXML } from '../src/export/mnx.js';
import { parseXML } from '../src/common/xml.js';
import type { MnxStructure } from '../src/common/types.js';
const xml = (sign: string, line?: number) => `<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Test</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><clef><sign>${sign}</sign>${line === undefined ? '' : `<line>${line}</line>`}</clef></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note></measure></part></score-partwise>`;
const score = (sign: string, staffPosition: number): MnxStructure => ({ mnx: { version: 1 }, global: { measures: [{}] }, parts: [{ id: 'P1', measures: [{ clefs: [{ clef: { sign, staffPosition } }], sequences: [{ content: [{ duration: { base: 'whole' }, notes: [{ pitch: { step: 'C', octave: 4 } }] }] }] }] }] });
// Independent coordinate examples: MusicXML counts lines from the bottom;
// MNX counts half-spaces from the middle line, positive upwards.
const clefs = [['G', 2, -2], ['F', 4, 2], ['C', 3, 0], ['C', 4, 2], ['G', 1, -4], ['G', 6, 6], ['F', 0, -6]] as const;
describe('clef coordinates', () => {
  it.each(clefs)('imports %s on MusicXML line %i at MNX position %i', (sign, line, position) => {
    expect(importMusicXML(xml(sign, line)).parts[0].measures[0].clefs?.[0].clef).toEqual({ sign, staffPosition: position });
  });
  it.each(clefs)('exports %s on line %i from MNX position %i', (sign, line, position) => {
    expect(parseXML(exportMusicXML(score(sign, position))).getElementsByTagName('clef')[0].getElementsByTagName('line')[0].textContent).toBe(String(line));
  });
  it.each([['G', -2], ['F', 2], ['C', 0]] as const)('uses the conventional %s line when omitted', (sign, position) => {
    expect(importMusicXML(xml(sign)).parts[0].measures[0].clefs?.[0].clef).toEqual({ sign, staffPosition: position });
  });
  it('diagnoses a space-positioned clef instead of emitting an invalid fractional line', () => {
    const warnings: string[] = [];
    const output = exportMusicXML(score('G', 1), { onWarning: w => warnings.push(w) });
    expect(parseXML(output).getElementsByTagName('line')[0].textContent).toBe('2');
    expect(warnings).toEqual([expect.stringContaining('clef staffPosition 1 has no integer MusicXML line equivalent')]);
  });
  it('exports a line change without a sign change', () => {
    const doc = score('C', 0);
    doc.global.measures.push({});
    doc.parts[0].measures.push({ ...structuredClone(doc.parts[0].measures[0]), clefs: [{ clef: { sign: 'C', staffPosition: 2 } }] });
    expect(parseXML(exportMusicXML(doc)).getElementsByTagName('clef').map(c => c.getElementsByTagName('line')[0].textContent)).toEqual(['3', '4']);
  });
});
