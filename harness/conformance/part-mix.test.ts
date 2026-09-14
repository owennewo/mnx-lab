// Studio's Instruments sheet: hiding a part keeps every other note's key, and
// the per-part mix resolves levels, sounds and sample packs.
import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { computePrimitives, initSmufl } from '../helpers/corpusPrimitives.ts';
import { forEachNoteAddress, noteKeysOf } from '../../src/model/noteWalk.ts';
import { withHiddenParts } from '../../src/model/partVisibility.ts';
import { isKitPart, partBuses, partLevel, requiredPresets, voicePresetFor } from '../../src/audio/partMix.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
import type { Performance } from '../../src/audio/performanceTypes.ts';

const load = (id: string) =>
  JSON.parse(fs.readFileSync(`scenarios/lab/${id}/document.mnx.json`, 'utf8')) as MnxStructure;

/** The two-part blues with every note id stripped, so keys are positional. */
function idless(): MnxStructure {
  const doc = load('00-document/04-twelve-bar-blues');
  forEachNoteAddress(doc, ({ note }) => delete note.id);
  return doc;
}

describe('withHiddenParts', () => {
  beforeAll(() => initSmufl());

  it('keeps the whole-document keys of the parts left on the score', () => {
    const doc = idless();
    const partOneKeys: string[] = [];
    forEachNoteAddress(doc, ({ key, partIndex }) => partIndex === 1 && partOneKeys.push(key));
    expect(partOneKeys[0]).toMatch(/^@p1\./);

    const { mnx, originalIndex } = withHiddenParts(doc, [0]);
    expect(mnx.parts).toHaveLength(1);
    expect(originalIndex).toEqual([1]);
    expect(noteKeysOf(mnx)).toEqual(partOneKeys);
  });

  it('never mutates the document it was given', () => {
    const doc = idless();
    const before = JSON.stringify(doc);
    withHiddenParts(doc, [1]);
    expect(JSON.stringify(doc)).toBe(before);
  });

  it('returns the document itself when nothing, or everything, is hidden', () => {
    const doc = idless();
    expect(withHiddenParts(doc, []).mnx).toBe(doc);
    expect(withHiddenParts(doc, [7, -1, 0.5]).mnx).toBe(doc);
    expect(withHiddenParts(doc, [0, 1]).mnx).toBe(doc);
    expect(withHiddenParts(doc, [0, 1]).originalIndex).toEqual([0, 1]);
  });

  it('lays out with either part hidden, score layouts included', () => {
    for (const id of ['00-document/04-twelve-bar-blues', '60-layout/01-group-barline-individual', '31-score-text/06-directions-across-parts'])
      for (const hidden of [[0], [1]]) {
        const { mnx } = withHiddenParts(load(id), hidden);
        expect(computePrimitives(mnx).notation.primitives.length, `${id} hiding ${hidden}`).toBeGreaterThan(0);
      }
  });
});

describe('partMix', () => {
  const performance = {
    voices: [
      { id: 'a', partIndex: 0 },
      { id: 'b', partIndex: 0, string: 2 },
      { id: 'k', partIndex: 1, kit: true },
      { id: 'c', partIndex: 2 },
    ],
  } as unknown as Performance;

  it('routes each voice to its part', () => {
    expect(Object.fromEntries(partBuses(performance))).toEqual({ a: '0', b: '0', k: '1', c: '2' });
  });

  it('silences a muted part and clamps a level', () => {
    expect(partLevel(undefined)).toBe(1);
    expect(partLevel({ volume: 0.4 })).toBe(0.4);
    expect(partLevel({ volume: 0.4, muted: true })).toBe(0);
    expect(partLevel({ volume: 3 })).toBe(1);
    expect(partLevel({ volume: Number.NaN })).toBe(1);
  });

  it('keeps the single-preset path until parts disagree, and kits on the synth', () => {
    expect(voicePresetFor(performance, {}, 'synth')).toBe('synth');
    const mixed = voicePresetFor(performance, { 0: { sound: 'guitar' } }, 'synth');
    expect(typeof mixed).toBe('function');
    const pick = mixed as (voice: string) => string;
    expect([pick('a'), pick('b'), pick('k'), pick('c')]).toEqual(['guitar', 'guitar', 'synth', 'synth']);
    const allPiano = voicePresetFor(performance, {}, 'piano') as (voice: string) => string;
    expect(pick('k')).toBe('synth');
    expect(allPiano('k')).toBe('synth');
    expect(allPiano('c')).toBe('piano');
  });

  it('loads every pack the parts use, once', () => {
    expect(requiredPresets(performance, { 0: { sound: 'guitar' }, 2: { sound: 'piano' } }, 'synth')).toEqual(['guitar', 'piano']);
    expect(requiredPresets(performance, {}, 'piano')).toEqual(['piano']);
    expect(requiredPresets(performance, {}, 'synth')).toEqual([]);
  });

  it('knows a part that plays only kit voices', () => {
    expect(isKitPart(performance, 1)).toBe(true);
    expect(isKitPart(performance, 0)).toBe(false);
    expect(isKitPart(performance, 9)).toBe(false);
  });
});
