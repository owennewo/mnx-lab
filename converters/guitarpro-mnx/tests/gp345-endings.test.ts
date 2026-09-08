import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importGuitarProCleanRoom } from '../src/index.js';
import { importGuitarPro } from '../src/import/gp.js';
import { parseGuitarProBinary } from '../src/gp345/index.js';
import { normalizeIds } from './helpers/normalize.js';

describe.each(['3.00', '4.00', '4.06', '5.00', '5.10'])('GP%s repeat endings', revision => {
  it('retains grouped and multi-bar endings and resets at a new repeat', () => {
    const bytes = readFileSync(resolve(__dirname, `fixtures/gp5/ending-groups-${revision}.gp${revision[0]}`));
    expect(parseGuitarProBinary(bytes).masterBars.map(bar => bar.alternateEndingsMask))
      .toEqual([0, 3, 4, 0, 1, 1, 2]);
    const actual = normalizeIds(importGuitarProCleanRoom(bytes));
    const oracle = normalizeIds(importGuitarPro(bytes));
    if (!revision.startsWith('5')) {
      expect(oracle.global.measures[4].ending).toEqual({ numbers: [1] });
      oracle.global.measures[4].ending = { numbers: [1], duration: 2 };
    }
    expect(actual.global.measures[4].ending).toEqual({ numbers: [1], duration: 2 });
    expect(actual).toEqual(oracle);
  });
  it('normalizes consecutive first, second and third endings', () => {
    const bytes = readFileSync(resolve(__dirname, `fixtures/gp5/endings-${revision}.gp${revision[0]}`));
    expect(parseGuitarProBinary(bytes).masterBars.map(bar => bar.alternateEndingsMask))
      .toEqual([0, 1, 2, 4]);
    const actual = normalizeIds(importGuitarProCleanRoom(bytes));
    const oracle = normalizeIds(importGuitarPro(bytes));
    if (!revision.startsWith('5')) {
      expect(oracle.global.measures[3].ending).toEqual({ numbers: [1, 3] });
      oracle.global.measures[3].ending = { numbers: [3] };
    }
    expect(actual.global.measures[3].ending).toEqual({ numbers: [3] });
    expect(actual).toEqual(oracle);
  });
});
