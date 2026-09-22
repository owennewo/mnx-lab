import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { importMusicXML } from '../src/import/musicxml.js';
const source = (id: string) => fs.readFileSync(new URL(`../../fixtures/musicxml-suite/xmlFiles/${id}.musicxml`, import.meta.url), 'utf8');

describe('unsupported import data is reported at its source location', () => {
  it('reports every fractional pitch and its integer fallback without changing that fallback', () => {
    const warnings: string[] = [];
    const xml = source('01d-Pitches-Microtones');
    const doc = importMusicXML(xml, { onWarning: w => warnings.push(w) });
    expect(doc).toEqual(importMusicXML(xml));
    expect(warnings.filter(w => w.includes('fractional pitch alteration'))).toHaveLength(8);
    for (const value of ['-1.5', '-0.5', '0.5', '1.5']) {
      expect(warnings.some(w => w.includes(`alteration ${value}`) && w.includes('part P1, measure') && w.includes('note') && w.includes('integer'))).toBe(true);
    }
  });
  it('reports staff-line counts and visibility, including mid-measure changes', () => {
    const warnings: string[] = [];
    importMusicXML(source('14a-StaffDetails-LineChanges'), { onWarning: w => warnings.push(w) });
    expect(warnings).toEqual(expect.arrayContaining([
      expect.stringMatching(/part P1, measure 1.*staff 1.*1 staff lines/),
      expect.stringMatching(/part P2, measure 2.*staff 1.*4 staff lines/),
      expect.stringMatching(/part P2, measure 3.*staff 1.*3 staff lines/),
      expect.stringMatching(/part P2, measure 4.*staff 1.*line-detail/)
    ]));
    expect(warnings.filter(w => w.includes('staff configuration'))).toHaveLength(4);
  });
  it('does not warn about ordinary piano pitches and five-line staves', () => {
    const warnings: string[] = [];
    importMusicXML(source('43a-PianoStaff'), { onWarning: w => warnings.push(w) });
    expect(warnings).toEqual([]);
  });
});
