import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importGuitarProCleanRoom } from '../src/index.js';
import { importGuitarPro } from '../src/import/gp.js';
import type { MnxEvent } from '../src/common/types.js';
import { normalizeIds } from './helpers/normalize.js';

describe.each(['4.00', '4.06', '5.00', '5.10'])('GP%s harmonic variants', revision => {
  it('preserves octave harmonics with capo and their fingerboard position', () => {
    const bytes = readFileSync(resolve(__dirname, `fixtures/gp5/harmonics-${revision}.gp${revision[0]}`));
    const actual = normalizeIds(importGuitarProCleanRoom(bytes));
    const oracle = normalizeIds(importGuitarPro(bytes));
    const oracleNotes = oracle.parts[0].measures[0].sequences![0].content
      .map(event => (event as MnxEvent).notes![0]);
    if (revision.startsWith('5')) {
      // Authored A4 + octave + capo 2 = B5. A tap at fret 17 over
      // stopped fret 5 is likewise the octave node, not node 17.
      expect(oracleNotes[0].pitch).toEqual({ step: 'A', octave: 7 });
      expect(oracleNotes[1].pitch).toEqual({ step: 'B', octave: 7 });
      oracleNotes[0].pitch = { step: 'B', octave: 5 };
      oracleNotes[1].pitch = { step: 'B', octave: 5 };
    }
    expect(actual).toEqual(oracle);
    const notes = actual.parts[0].measures[0].sequences![0].content
      .map(event => (event as MnxEvent).notes![0]);
    expect(notes.map(note => note.pitch)).toEqual(Array(4).fill({ step: 'B', octave: 5 }));
    expect(notes.map(note => note._x?.mnxLab?.tab?.technique?.harmonic?.type))
      .toEqual(['artificial', 'tap', 'semi', 'pinch']);
    expect(notes.map(note => note._x?.mnxLab?.fret)).toEqual([5, 5, 5, 5]);
  });
});
