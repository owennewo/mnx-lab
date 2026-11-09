// A word hyphenated across a note its verse does not sing ("Strol- · lin'",
// Strolling Down the Highway, 2026-11-09). Guitar Pro writes a blank line on
// that beat whenever ANOTHER verse sings there; the reader took the blank as
// the end of the word, so "lin'" read back as a whole word and every save of
// a multi-verse song reported the hyphens as changed.
import { describe, it, expect } from 'vitest';
import { gpifToMnx, mnxToGpifXml, parseGpif } from '../src/gpif/index.js';
import type { MnxStructure } from '../src/common/types.js';

const ev = (lines: Record<string, { text: string; type?: string }>) =>
  ({ duration: { base: 'quarter' }, notes: [{ pitch: { step: 'C', octave: 4 } }], ...(Object.keys(lines).length ? { lyrics: { lines } } : {}) });

describe('a hyphenated word across a beat its verse skips', () => {
  it('stays one word when another verse sings on the skipped beat', () => {
    const doc = {
      mnx: { version: 1 },
      global: { measures: [{ time: { count: 3, unit: 4 } }] },
      parts: [{ id: 'g', name: 'Guitar', measures: [{ sequences: [{ content: [
        ev({ '1': { text: 'Strol', type: 'start' }, '2': { text: 'Peo', type: 'start' } }),
        ev({ '2': { text: 'ple', type: 'end' } }),
        ev({ '1': { text: "lin'", type: 'end' } })
      ] }] }] }]
    } as unknown as MnxStructure;
    const back = gpifToMnx(parseGpif(mnxToGpifXml(doc)));
    const content = back.parts[0]!.measures[0]!.sequences![0]!.content as { lyrics?: { lines: Record<string, { type?: string }> } }[];
    expect(content[2]!.lyrics!.lines['1']!.type).toBe('end');
    expect(content[1]!.lyrics!.lines['2']!.type).toBe('end');
  });
});
