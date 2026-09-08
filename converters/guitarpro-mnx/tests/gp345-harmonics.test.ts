import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importGuitarProCleanRoom } from '../src/index.js';
import { importGuitarPro } from '../src/import/gp.js';
import type { MnxEvent } from '../src/common/types.js';
import { normalizeIds } from './helpers/normalize.js';
import { pitchToMidi, midiToPitch } from '../src/common/tuning.js';

describe.each(['3.00', '4.00', '4.06', '5.00', '5.10'])('GP%s harmonic nodes', revision => {
  it('uses the node interval rather than stopped-fret arithmetic, including capo', () => {
    const bytes = readFileSync(resolve(__dirname, `fixtures/gp5/harmonic-nodes-${revision}.gp${revision[0]}`));
    const warnings: string[] = [];
    const actual = importGuitarProCleanRoom(bytes, { onWarning: message => warnings.push(message) });
    const nodes = [12, 7, 5, 4, 9, 3, 2];
    const intervals = [12, 19, 24, 28, 28, 31, 36];
    actual.parts[0].measures.forEach((measure, index) => {
      const natural = (measure.sequences![0].content[0] as MnxEvent).notes![0];
      expect(pitchToMidi(natural.pitch!)).toBe(64 + 2 + intervals[index]);
      expect(natural._x?.mnxLab?.fret).toBe(nodes[index]);
      if (revision.startsWith('5')) {
        const tap = (measure.sequences![1].content[0] as MnxEvent).notes![0];
        expect(pitchToMidi(tap.pitch!)).toBe(64 + 3 + 2 + intervals[index]);
        expect(tap._x?.mnxLab?.fret).toBe(3);
        expect(tap._x?.mnxLab?.tab?.technique?.harmonic?.type).toBe('tap');
      }
    });
    expect(warnings.filter(message => /harmonic/.test(message))).toEqual([]);
    const oracle = normalizeIds(importGuitarPro(bytes));
    if (revision.startsWith('5')) {
      const taps = oracle.parts[0].measures.map(measure => (measure.sequences![1].content[0] as MnxEvent).notes![0]);
      expect(taps.map(note => pitchToMidi(note.pitch!))).toEqual([103, 103, 105, 88, 81, 81, 93]);
      taps.forEach((note, index) => { note.pitch = midiToPitch(69 + intervals[index]); });
    }
    expect(normalizeIds(actual)).toEqual(oracle);
  });
});

describe.each(['4.00', '4.06', '5.00', '5.10'])('GP%s harmonic variants', revision => {
  it('decodes artificial harmonic register and accidental fields with capo', () => {
    const bytes = readFileSync(resolve(__dirname, `fixtures/gp5/harmonic-register-${revision}.gp${revision[0]}`));
    const actual = normalizeIds(importGuitarProCleanRoom(bytes));
    const oracle = normalizeIds(importGuitarPro(bytes));
    const notes = actual.parts[0].measures.map(measure => (measure.sequences![0].content[0] as MnxEvent).notes![0]);
    const oracleNotes = oracle.parts[0].measures.map(measure => (measure.sequences![0].content[0] as MnxEvent).notes![0]);
    // GP4's writer chooses different discriminators than its requested
    // pitch/octave model; both independent readers agree on these file pitches.
    const expectedMidi = revision.startsWith('4') ? [90, 95, 83]
      : [95, 90, 83, 86, 92, 71, 59, 47];
    if (revision.startsWith('5')) {
      // Assert the oracle loss before correcting only sounding pitch. GP5's
      // explicit register is relative to the stopped pitch's octave; capo is
      // added once after resolving the specified pitch class and octave shift.
      expect(oracleNotes.map(note => pitchToMidi(note.pitch!))).toEqual([107, 95, 105, 83, 90, 105, 83, 83]);
      for (let index = 0; index < oracleNotes.length; index++) oracleNotes[index].pitch = midiToPitch(expectedMidi[index]);
    }
    expect(actual).toEqual(oracle);
    expect(notes.map(note => pitchToMidi(note.pitch!))).toEqual(expectedMidi);
    expect(notes.every(note => note._x?.mnxLab?.fret === 5 && note._x.mnxLab.string === 1)).toBe(true);
  });

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
