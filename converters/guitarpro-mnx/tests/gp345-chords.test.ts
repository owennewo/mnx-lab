import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importGuitarProCleanRoom } from '../src/index.js';
import { importGuitarPro } from '../src/import/gp.js';
import { normalizeIds } from './helpers/normalize.js';

describe.each(['3.00', '4.00', '4.06', '5.00', '5.10'])('GP%s chord diagrams', revision => {
  it('consumes both diagram layouts and retains harmony names', () => {
    const bytes = readFileSync(resolve(__dirname, `fixtures/gp5/chords-${revision}.gp${revision[0]}`));
    expect(normalizeIds(importGuitarProCleanRoom(bytes))).toEqual(normalizeIds(importGuitarPro(bytes)));
  });
});
