// Studio's Instruments sheet: hiding a part keeps every other note's key, and
// the per-part mix knows its kit parts (levels and instruments: host-instruments.test.ts).
import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { computePrimitives, initSmufl } from '../helpers/corpusPrimitives.ts';
import { forEachNoteAddress, noteKeysOf } from '../../src/model/noteWalk.ts';
import { withHiddenParts } from '../../src/model/partVisibility.ts';
import { isKitPart } from '../../src/audio/partMix.ts';
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

  it('knows a part that plays only kit voices', () => {
    expect(isKitPart(performance, 1)).toBe(true);
    expect(isKitPart(performance, 0)).toBe(false);
    expect(isKitPart(performance, 9)).toBe(false);
  });
});
