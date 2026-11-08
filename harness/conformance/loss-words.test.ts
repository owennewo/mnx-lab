// A storage loss in a musician's words. The owner, 2026-11-08, looking at
// "Saved · 4 items won't persist" with the detail as raw document paths at the
// foot of the Saving sheet: "surely the message should explain what is
// stopping the save". These are their four, as the save reported them.
import { describe, it, expect } from 'vitest';
import { describeLoss } from '../../src/importers/lossWords.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

const twoVoices = { sequences: [{ voice: 'v1', content: [] }, { voice: 'v2', content: [] }] };
const doc = {
  mnx: { version: 1 }, global: { measures: [] },
  parts: [{ id: 'g', name: 'Guitar', measures: Array.from({ length: 15 }, () => twoVoices) }]
} as unknown as MnxStructure;
const TRIPLET = '{"type":"tuplet","inner":{"multiple":3,"duration":{"base":"eighth"}},"outer":{"multiple":2,"duration":{"base":"eighth…';

describe('describeLoss', () => {
  it('names the bar, the voice and the thing: their four triplets', () => {
    expect(describeLoss({ path: 'parts/0/measures/14/sequences/1/content/-1', kind: 'lost', was: TRIPLET }, doc))
      .toEqual({ where: 'Bar 15, voice 2', what: 'a triplet (3:2)', how: 'dropped' });
    expect(describeLoss({ path: 'parts/0/measures/13/sequences/1/content/-1', kind: 'lost', was: TRIPLET }, doc).where).toBe('Bar 14, voice 2');
  });

  it('reads other tuplets, grace notes, chords, rests and fields', () => {
    const at = (was: string, path = 'parts/0/measures/2/sequences/0/content/3') => describeLoss({ path, kind: 'lost', was }, doc).what;
    expect(at('{"type":"tuplet","inner":{"multiple":5,"duration":{"base":"16th"}},"outer":{"multiple":4,')).toBe('a 5:4 tuplet');
    expect(at('{"type":"grace","content":[')).toBe('grace notes');
    expect(at('{"duration":{"base":"quarter"},"notes":[{"pitch":{"step":"C"}},{"pitch":{"step":"E"}}]}')).toBe('a chord');
    expect(at('{"duration":{"base":"quarter"},"rest":{}}')).toBe('a rest');
    expect(at('"index"', 'parts/0/measures/2/sequences/0/content/3/notes/0/_x/mnxLab/fingering')).toBe('the fingering');
    expect(at('{"lines":{}}', 'parts/0/measures/2/sequences/0/content/3/lyrics')).toBe('lyrics');
  });

  it('says changed for a change, and places part- and score-level losses', () => {
    expect(describeLoss({ path: 'parts/0/measures/0/sequences/0/content/0', kind: 'changed', was: '{"notes":[{"pitch":{}}]}' }, doc).how).toBe('changed');
    expect(describeLoss({ path: 'parts/0/_x/mnxLab/capo', kind: 'lost', was: '5' }, doc)).toEqual({ where: 'The part', what: 'the capo', how: 'dropped' });
    expect(describeLoss({ path: 'global/measures/3/tempos', kind: 'lost', was: '[]' }, doc).where).toBe('Bar 4');
  });

  it('without the document, the path’s own numbers are used', () => {
    expect(describeLoss({ path: 'parts/0/measures/14/sequences/1/content/-1', kind: 'lost', was: TRIPLET }).where).toBe('Bar 15, voice 2');
  });
});
