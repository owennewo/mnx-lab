import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importGuitarProCleanRoom } from '../src/index.js';
import { importGuitarPro } from '../src/import/gp.js';
import { normalizeIds } from './helpers/normalize.js';

describe.each(['3.00', '4.00', '4.06', '5.00', '5.10'])('GP%s mix changes', revision => {
  it('preserves tempo changes and warns for mixer controls', () => {
    const bytes = readFileSync(resolve(__dirname, `fixtures/gp5/mix-${revision}.gp${revision[0]}`));
    const warnings: string[] = [];
    const actual = importGuitarProCleanRoom(bytes, { onWarning: message => warnings.push(message) });
    expect(normalizeIds(actual)).toEqual(normalizeIds(importGuitarPro(bytes)));
    expect(actual.global.measures[1].tempos).toMatchObject([{ bpm: 132 }]);
    expect(warnings.some(message => message.includes('volume'))).toBe(true);
  });
});
