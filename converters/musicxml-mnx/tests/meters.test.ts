import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { importMusicXML } from '../src/import/musicxml.js';
import { exportMusicXML } from '../src/export/mnx.js';
import { parseXML } from '../src/common/xml.js';
import type { MnxStructure } from '../src/common/types.js';
const source = (id: string) => fs.readFileSync(new URL(`../../fixtures/musicxml-suite/xmlFiles/${id}.musicxml`, import.meta.url), 'utf8');
const times = (id: string) => importMusicXML(source(id)).global.measures.map(m => m.time);
const wrap = (time: string) => `<score-partwise><part-list><score-part id="P1"><part-name>Test</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions>${time}</attributes><note><rest/><duration>4</duration><type>whole</type></note></measure></part></score-partwise>`;
const fraction = (n: string, d: string) => `<beats>${n}</beats><beat-type>${d}</beat-type>`;

describe('exact MusicXML meters', () => {
  it.each(['11c-TimeSignatures-Complex', '11c-TimeSignatures-CompoundSimple'])('sums additive numerators in %s', id => {
    expect(times(id)).toEqual([{ count: 5, unit: 8 }, { count: 9, unit: 4 }]);
  });
  it.each(['11d-TimeSignatures-ComplexMultiple', '11d-TimeSignatures-CompoundMultiple'])('sums all fractions in %s', id => {
    expect(times(id)).toEqual([{ count: 11, unit: 8 }, { count: 21, unit: 8 }]);
  });
  it.each(['11e-TimeSignatures-ComplexMixed', '11e-TimeSignatures-CompoundMixed'])('combines additive and multi-fraction values in %s', id => {
    expect(times(id)).toEqual([{ count: 11, unit: 8 }]);
  });
  it('retains common time but prioritizes numeric duration over an incompatible symbol', () => {
    const warnings: string[] = [];
    const doc = importMusicXML(source('11a-TimeSignatures'), { onWarning: w => warnings.push(w) });
    expect(doc.global.measures[0].time).toEqual({ count: 2, unit: 2 });
    expect(doc.global.measures[1].time).toEqual({ count: 4, unit: 4, display: 'common' });
    expect(warnings.some(w => /part P1, measure 1.*incompatible.*common/.test(w))).toBe(true);
    expect(importMusicXML(wrap(`<time symbol="cut">${fraction('2', '2')}</time>`)).global.measures[0].time).toEqual({ count: 2, unit: 2, display: 'cut' });
  });
  it('preserves exact duration while reporting single-number display and grouping losses', () => {
    const warnings: string[] = [];
    const doc = importMusicXML(source('11g-TimeSignatures-SingleNumber'), { onWarning: w => warnings.push(w) });
    expect(doc.global.measures.map(m => m.time)).toEqual([{ count: 3, unit: 8 }, { count: 5, unit: 8 }]);
    expect(warnings.filter(w => w.includes('single-number'))).toHaveLength(2);
    expect(warnings.some(w => w.includes('grouping'))).toBe(true);
    expect(times('11f-TimeSignatures-SymbolMeaning')).toEqual([{ count: 3, unit: 8 }, { count: 5, unit: 8 }]);
  });
  it.each([
    ['11b-TimeSignatures-NoTime', ['print-object', 'staff-local']],
    ['11h-TimeSignatures-SenzaMisura', ['unmetered']],
    ['11i-TimeSignatures-Alternate', ['interchangeable']]
  ])('diagnoses unrepresented meter information in %s', (id, losses) => {
    const warnings: string[] = [];
    importMusicXML(source(id as string), { onWarning: w => warnings.push(w) });
    for (const loss of losses) expect(warnings.some(w => w.includes(loss) && w.includes('part ') && w.includes('measure '))).toBe(true);
  });
  it('uses rational arithmetic without reducing ordinary numeric meter spelling', () => {
    expect(importMusicXML(wrap(`<time>${fraction('6', '8')}</time>`)).global.measures[0].time).toEqual({ count: 6, unit: 8 });
    expect(importMusicXML(wrap(`<time>${fraction('1', '3')}${fraction('2', '3')}</time>`)).global.measures[0].time).toEqual({ count: 1, unit: 1 });
  });
  it.each([fraction('3oops', '4'), fraction('0', '4'), fraction('3', '0'), fraction('1', '3'), fraction('9007199254740993', '1'), '<beats>3</beats>'])('never invents a partial or unsafe meter from %s', body => {
    const warnings: string[] = [];
    expect(importMusicXML(wrap(`<time>${body}</time>`), { onWarning: w => warnings.push(w) }).global.measures[0].time).toBeUndefined();
    expect(warnings.some(w => w.includes('meter retained'))).toBe(true);
  });
  it('preserves a previous meter when an unmetered or malformed declaration cannot be represented', () => {
    const xml = wrap(`<time>${fraction('3', '4')}</time>`).replace('</part>', `<measure number="2"><attributes><time><senza-misura>X</senza-misura></time></attributes></measure><measure number="3"><attributes><time>${fraction('3oops', '4')}</time></attributes></measure></part>`);
    const warnings: string[] = [];
    expect(importMusicXML(xml, { onWarning: w => warnings.push(w) }).global.measures.map(m => m.time)).toEqual([{ count: 3, unit: 4 }, undefined, undefined]);
    expect(warnings.filter(w => w.includes('meter retained'))).toHaveLength(2);
  });
  it('diagnoses ignored mid-measure and additional local declarations', () => {
    const xml = wrap(`<time>${fraction('3', '4')}</time><time number="2">${fraction('5', '8')}</time>`).replace('</measure>', `<attributes><time>${fraction('7', '8')}</time></attributes></measure>`);
    const warnings: string[] = [];
    expect(importMusicXML(xml, { onWarning: w => warnings.push(w) }).global.measures[0].time).toEqual({ count: 3, unit: 4 });
    expect(warnings.some(w => w.includes('additional local'))).toBe(true);
    expect(warnings.some(w => w.includes('mid-measure'))).toBe(true);
  });
  it('reports conflicting part-local meters and retains the first global declaration', () => {
    const xml = wrap(`<time>${fraction('3', '4')}</time>`).replace('</score-partwise>', `<part id="P2"><measure number="1"><attributes><time>${fraction('5', '8')}</time></attributes></measure></part></score-partwise>`);
    const warnings: string[] = [];
    expect(importMusicXML(xml, { onWarning: w => warnings.push(w) }).global.measures[0].time).toEqual({ count: 3, unit: 4 });
    expect(warnings.some(w => w.includes('part P2, measure 1: conflicting part-local time'))).toBe(true);
  });
  it('imports display-only changes at the same numeric meter', () => {
    const xml = wrap(`<time>${fraction('4', '4')}</time>`).replace('</part>', `<measure number="2"><attributes><time symbol="common">${fraction('4', '4')}</time></attributes></measure><measure number="3"><attributes><time>${fraction('4', '4')}</time></attributes></measure></part>`);
    expect(importMusicXML(xml).global.measures.map(m => m.time)).toEqual([{ count: 4, unit: 4 }, { count: 4, unit: 4, display: 'common' }, { count: 4, unit: 4 }]);
  });
  it('exports common/cut display and display-only changes explicitly', () => {
    const doc: MnxStructure = { mnx: { version: 1 }, global: { measures: [
      { time: { count: 4, unit: 4 } }, { time: { count: 4, unit: 4, display: 'common' } },
      { time: { count: 4, unit: 4 } }, { time: { count: 2, unit: 2, display: 'cut' } }
    ] }, parts: [{ id: 'P1', measures: Array.from({ length: 4 }, () => ({ sequences: [{ content: [{ duration: { base: 'whole' }, rest: {} }] }] })) }] };
    const emitted = parseXML(exportMusicXML(doc)).getElementsByTagName('time');
    expect(emitted.map(t => t.getAttribute('symbol'))).toEqual([null, 'common', null, 'cut']);
  });
});
