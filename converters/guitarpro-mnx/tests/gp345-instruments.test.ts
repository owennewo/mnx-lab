import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importGuitarProCleanRoom } from '../src/index.js';
import { importGuitarPro } from '../src/import/gp.js';
import { normalizeIds } from './helpers/normalize.js';
import { parseGuitarProBinary } from '../src/gp345/index.js';
import type { MnxGrace } from '../src/common/types.js';

describe.each(['3.00', '4.00', '4.06', '5.00', '5.10'])('GP%s instruments', revision => {
  it('preserves a percussion grace as MIDI pitch without inventing a fret or losing the note', () => {
    const bytes = readFileSync(resolve(__dirname, `fixtures/gp5/percussion-grace-${revision}.gp${revision[0]}`));
    const parsed = parseGuitarProBinary(bytes);
    const drumBar = parsed.bars.get(parsed.masterBars[0].barIds[1])!;
    const voice = parsed.voices.get(drumBar.voiceIds[0])!;
    const grace = parsed.beats.get(voice.beatIds[0])!;
    expect(parsed.notes.get(grace.noteIds![0])).toMatchObject({ string: null, fret: null, midi: 36 });
    const actual = importGuitarProCleanRoom(bytes);
    expect(actual.parts[1]._x).toBeUndefined();
    expect(actual.parts[1].measures[0].sequences![0].content).toMatchObject([
      { type: 'grace', content: [{ notes: [{ pitch: { step: 'C', octave: 2 } }] }] },
      { notes: [{ pitch: { step: 'D', octave: 2 } }] }
    ]);
    const oracle = normalizeIds(importGuitarPro(bytes));
    const oracleGrace = oracle.parts[1].measures[0].sequences![0].content[0] as MnxGrace;
    expect(oracleGrace.content[0]).toMatchObject({ duration: { base: 'eighth' },
      notes: [{ _x: { mnxLab: { string: -5, fret: 36 } } }] });
    // The historical grace mapper manufactures an invalid drum string.
    delete oracleGrace.content[0].notes![0]._x;
    oracleGrace.content[0].duration.base = '32nd';
    expect(normalizeIds(actual)).toEqual(oracle);
  });

  it('keeps bass tuning/clef and percussion MIDI pitch without invented tab strings', () => {
    const bytes = readFileSync(resolve(__dirname, `fixtures/gp5/instruments-${revision}.gp${revision[0]}`));
    const actual = normalizeIds(importGuitarProCleanRoom(bytes));
    expect(actual).toEqual(normalizeIds(importGuitarPro(bytes)));
    expect(actual.parts[0].measures[0].clefs).toEqual([{ clef: { sign: 'F', staffPosition: -4 } }]);
    expect(actual.parts[1]._x).toBeUndefined();
    expect(actual.parts[1].measures[0].sequences![0].content[0]).toMatchObject({
      notes: [{ pitch: { step: 'D', octave: 2 } }]
    });
  });
});
