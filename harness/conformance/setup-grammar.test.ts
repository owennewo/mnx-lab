// The setup popovers' typed grammar (src/edit/setupGrammar.ts): text → setup
// intent payloads. Pure parsers, so they test without any popover chrome.
import { describe, it, expect } from 'vitest';
import { parseTimeSignature, parseTuning } from '../../src/edit/setupGrammar.ts';
import { STANDARD_TUNING } from '../../src/edit/tabStrings.ts';

describe('time signature grammar', () => {
  it('parses the common forms', () => {
    expect(parseTimeSignature('4/4')).toEqual({ count: 4, unit: 4 });
    expect(parseTimeSignature(' 6 / 8 ')).toEqual({ count: 6, unit: 8 });
    expect(parseTimeSignature('12/8')).toEqual({ count: 12, unit: 8 });
    expect(parseTimeSignature('2/2')).toEqual({ count: 2, unit: 2 });
  });

  it('rejects meaningless meters', () => {
    expect(parseTimeSignature('4/5')).toBeNull(); // unit must be a power of two
    expect(parseTimeSignature('0/4')).toBeNull();
    expect(parseTimeSignature('4-4')).toBeNull();
    expect(parseTimeSignature('waltz')).toBeNull();
    expect(parseTimeSignature('')).toBeNull();
  });
});

describe('tuning grammar', () => {
  it('knows the standard preset, matching tabStrings', () => {
    // Array order carries no meaning in the model — compare per string.
    const byString = (t: { string: number }[]) => [...t].sort((a, b) => a.string - b.string);
    expect(byString(parseTuning('standard')!)).toEqual(byString(STANDARD_TUNING));
  });

  it('parses drop-d: only string 6 differs from standard', () => {
    const dropD = parseTuning('drop-d')!;
    expect(dropD.find(t => t.string === 6)!.pitch).toEqual({ step: 'D', octave: 2 });
    expect(dropD.find(t => t.string === 1)!.pitch).toEqual({ step: 'E', octave: 4 });
  });

  it('parses an explicit pitch list, low string first', () => {
    const dadgad = parseTuning('D2 A2 D3 G3 A3 D4')!;
    expect(dadgad).toHaveLength(6);
    // First token is the LOWEST string (highest string number).
    expect(dadgad[0]).toEqual({ string: 6, pitch: { step: 'D', octave: 2 } });
    expect(dadgad[5]).toEqual({ string: 1, pitch: { step: 'D', octave: 4 } });
    expect(parseTuning('dadgad')).toEqual(dadgad);
  });

  it('handles accidentals and odd string counts', () => {
    const seven = parseTuning('B1 E2 A2 D3 G3 B3 E4')!;
    expect(seven).toHaveLength(7);
    expect(seven[0]).toEqual({ string: 7, pitch: { step: 'B', octave: 1 } });
    expect(parseTuning('F#1 B1 E2 A2 D3 G3 B3 E4')![0].pitch).toEqual({
      step: 'F',
      octave: 1,
      alter: 1
    });
    expect(parseTuning('Eb2 Ab2 Db3 Gb3 Bb3 Eb4')![0].pitch).toEqual({
      step: 'E',
      octave: 2,
      alter: -1
    });
  });

  it('rejects garbage', () => {
    expect(parseTuning('')).toBeNull();
    expect(parseTuning('H2 A2 D3')).toBeNull();
    expect(parseTuning('E2 A2')).toBeNull(); // too few strings
    expect(parseTuning('open-q')).toBeNull();
  });
});
