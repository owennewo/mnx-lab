import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importGuitarProCleanRoom, parseGuitarPro5 } from '../src/index.js';
import { importGuitarPro } from '../src/import/gp.js';
import { normalizeIds } from './helpers/normalize.js';

describe.each(['5.00', '5.10'])('GP%s bend curves', revision => {
  const bytes = readFileSync(resolve(__dirname, `fixtures/gp5/bends-${revision}.gp5`));

  it('retains full curves with exact oracle parity', () => {
    expect(normalizeIds(importGuitarProCleanRoom(bytes))).toEqual(normalizeIds(importGuitarPro(bytes)));
    const notes = [...parseGuitarPro5(bytes).notes.values()];
    expect(notes[0].bend?.points).toEqual([{ position: 0, alter: 0 }, { position: 1, alter: 2 }]);
    expect(notes[1].bend?.points).toEqual([
      { position: 0, alter: 0 },
      { position: 0.25, alter: 2 },
      { position: 0.5, alter: 1 },
      { position: 0.75, alter: 2 },
      { position: 1, alter: 0 }
    ]);
  });
});
