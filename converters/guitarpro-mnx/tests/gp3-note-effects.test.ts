import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importGuitarProCleanRoom } from '../src/index.js';
import { importGuitarPro } from '../src/import/gp.js';
import type { MnxEvent } from '../src/common/types.js';
import { normalizeIds } from './helpers/normalize.js';

it('GP3 beat-level vibrato and harmonics apply to every note, not later beats', () => {
  const bytes = readFileSync(resolve(__dirname, 'fixtures/gp5/legacy-note-effects-3.00.gp3'));
  const actual = normalizeIds(importGuitarProCleanRoom(bytes));
  const oracle = normalizeIds(importGuitarPro(bytes));
  const oracleBeat = oracle.parts[0].measures[0].sequences![0].content[0] as MnxEvent;
  for (const note of oracleBeat.notes!) {
    // GP3 stores this flag on the beat; the current oracle loses it.
    expect(note._x?.mnxLab?.tab).toBeUndefined();
    note._x!.mnxLab!.tab = { technique: { vibrato: true } };
  }
  expect(actual).toEqual(oracle);
  const beats = actual.parts[0].measures[0].sequences![0].content as MnxEvent[];
  expect(beats.map(beat => beat.notes!.length)).toEqual([2, 2, 2, 2]);
  expect(beats[0].notes!.map(note => note._x?.mnxLab?.tab?.technique?.vibrato)).toEqual([true, true]);
  expect(beats[1].notes!.map(note => note._x?.mnxLab?.tab?.technique?.harmonic?.type))
    .toEqual(['natural', 'natural']);
  expect(beats[2].notes!.map(note => note._x?.mnxLab?.tab?.technique?.harmonic?.type))
    .toEqual(['artificial', 'artificial']);
  expect(beats[3].notes!.map(note => note._x?.mnxLab?.tab)).toEqual([undefined, undefined]);
});
