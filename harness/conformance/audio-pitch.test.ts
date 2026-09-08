import fs from 'node:fs';
import { expect, it } from 'vitest';
import { midiOf } from '../../src/audio/pitch.ts';
import { forEachNoteAddress } from '../../src/model/noteWalk.ts';
import type { MnxNote, MnxStructure } from '../../src/model/mnx.ts';

const read = (name: string): MnxStructure => JSON.parse(fs.readFileSync(new URL(`../../scenarios/${name}/document.mnx.json`, import.meta.url), 'utf8'));
for (const [title, scenario, expected] of [
  ['transposing part','lab/22-tab-derivation/07-transposition-display-only',[48,52]],
  ['capo','lab/22-tab-derivation/06-capo',[42,47,52,57]],
  ['ottava span','spec/ottavas-8va',[72,76,96,100,96,84]],
  ['guitar octave clef and natural harmonics','lab/25-tab-techniques/05-natural-harmonics',[52,57]]
] as const) it(`${title}: pitch is already sounded`, () => {
  const pitches: number[] = [];
  forEachNoteAddress(read(scenario), ({ note }) => pitches.push(midiOf(note.pitch)));
  expect(pitches).toEqual(expected);
});
it('natural and artificial touching pitches never replace the sounded harmonic pitch', () => {
  const notes: MnxNote[] = [
    { pitch:{step:'E',octave:3},_x:{mnxLab:{string:6,tab:{technique:{harmonic:{type:'natural',touchingPitch:{step:'E',octave:3}}}}}} },
    { pitch:{step:'A',octave:4},_x:{mnxLab:{string:3,tab:{technique:{harmonic:{type:'artificial',touchingPitch:{step:'A',octave:3}}}}}} },
    { pitch:{step:'A',octave:4},_x:{mnxLab:{tab:{technique:{harmonic:{type:'artificial'}}}}} }
  ];
  expect(notes.map(note => midiOf(note.pitch))).toEqual([52,69,69]);
});
it('retains accidentals, microtones, and out-of-export-range pitches without clamping', () => {
  expect(midiOf({step:'C',octave:4,alter:2})).toBe(62);
  expect(midiOf({step:'D',octave:4,alter:-2})).toBe(60);
  expect(midiOf({step:'C',octave:4,alter:0.5})).toBe(60.5);
  expect(midiOf({step:'C',octave:-2})).toBe(-12);
  expect(midiOf({step:'C',octave:10})).toBe(132);
});

it('rejects nonfinite or unsafe pitch inputs instead of silently rounding', () => {
  expect(() => midiOf({step:'C',octave:4,alter:Infinity})).toThrow(RangeError);
  expect(() => midiOf({step:'C',octave:Number.MAX_SAFE_INTEGER})).toThrow(RangeError);
});
