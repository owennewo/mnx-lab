import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { linearizePasses, hasRepeatStructure } from '../../src/model/passes.ts';
import { resolveIteration, resolveOrdinal, resolveOccurrence, chooseOrdinal,
  initialPlaybackPosition, inspectIteration, followPlayback, withPlaybackOrdinal,
  nextInspectionIteration, activeIteration, verseForIteration } from '../../src/model/playback.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
// @ts-expect-error — corpus loader is plain JavaScript
import { loadCorpus } from '../verify/check-scenarios.mjs';
const corpus: { id: string; dir: string }[] = loadCorpus();
const read = (id: string): MnxStructure => JSON.parse(fs.readFileSync(path.join(corpus.find(s => s.id === id)!.dir,'document.mnx.json'),'utf8'));
const simple = () => linearizePasses(read('spec/repeats-alternate-endings-simple'));

// Independently stated query verdicts across the campaign's fourteen examples,
// plus the newly added partial-bar D.S. fixture. Indices/ordinals are zero-based.
const cases: [string,number,number,number[]][] = [
  ['spec/repeats',0,2,[1]], ['spec/repeats-implied-start-repeat',0,2,[1]],
  ['spec/repeats-more-once-repeated',0,4,[3]],
  ['spec/repeats-alternate-endings-simple',1,2,[]],
  ['spec/repeats-alternate-endings-advanced',1,2,[4]],
  ['spec/jumps-dal-segno',1,1,[1,5]], ['spec/jumps-ds-al-fine',2,1,[2,6]],
  ['spec/tie-targets',3,2,[5]],
  ['lab/navigation/jumps-and-signs',4,1,[4,8]],
  ['lab/navigation/repeats-and-marks-on-tab',1,3,[]],
  ['lab/navigation/numbered-bars',1,1,[1]],
  ['lab/score-text/labels-with-navigation',2,1,[2]],
  ['lab/score-text/labels-on-a-tab-staff',2,1,[2]],
  ['lab/layout/coloured-marks-and-clef-forms',0,1,[0]],
  ['lab/navigation/ds-final-ending',2,2,[3,6]]
];
describe('iteration queries over navigation scenarios', () => {
  for (const [id, measure, iteration, ordinals] of cases) it(id, () => {
    const model = linearizePasses(read(id));
    expect(resolveIteration(model,measure,iteration)).toEqual({performed:ordinals.length>0,ordinals});
    for (const entry of model.entries) {
      expect(resolveOrdinal(model,entry.ordinal)).toEqual(entry);
      expect(resolveOccurrence(model,entry.measureIndex,entry.occurrence)).toEqual(entry);
      expect(resolveIteration(model,entry.measureIndex,entry.iteration).ordinals).toContain(entry.ordinal);
    }
  });
});
it('keeps iteration 2 on a skipped first ending, including when playback is active', () => {
  const model = simple();
  const initial = withPlaybackOrdinal(initialPlaybackPosition(),model,1);
  const inspected = inspectIteration(initial,2);
  expect(inspected).toEqual({ordinal:1,playbackIteration:1,inspectionIteration:2,followPlayback:false});
  expect(resolveIteration(model,1,inspected.inspectionIteration)).toEqual({performed:false,ordinals:[]});
  expect(resolveIteration(model,2,inspected.inspectionIteration)).toEqual({performed:true,ordinals:[3]});
  expect(initial.inspectionIteration).toBe(1);
  expect(activeIteration(inspected)).toBe(2);
  expect(activeIteration(followPlayback(inspected))).toBe(1);
  expect(followPlayback(inspected).inspectionIteration).toBe(2);
});
it('playback progression and stopping never overwrite inspection', () => {
  const model = simple();
  const inspected = inspectIteration(initialPlaybackPosition(),2);
  const live = withPlaybackOrdinal(followPlayback(inspected),model,0);
  expect(live.inspectionIteration).toBe(2);
  const stopped = withPlaybackOrdinal(live,model,null);
  expect(stopped).toEqual({ordinal:null,playbackIteration:null,inspectionIteration:2,followPlayback:true});
  expect(activeIteration(stopped)).toBe(2);
  expect(withPlaybackOrdinal(live,model,999)).toEqual(stopped);
});
it('preserves same-iteration D.S. candidates and cycles only for an explicit seek', () => {
  const candidates = resolveIteration(linearizePasses(read('spec/jumps-dal-segno')),1,1).ordinals;
  expect(candidates).toEqual([1,5]);
  expect(chooseOrdinal(candidates,1)).toBe(1);
  expect(chooseOrdinal(candidates,2)).toBe(5);
  expect(chooseOrdinal(candidates,6)).toBeNull();
  expect(chooseOrdinal(candidates,6,{explicitSeek:true})).toBe(1);
  expect(chooseOrdinal(candidates,1,{explicitSeek:true,cycle:true})).toBe(5);
  expect(chooseOrdinal(candidates,5,{explicitSeek:true,cycle:true})).toBe(1);
  expect(chooseOrdinal(candidates,5,{cycle:true})).toBeNull();
  expect(chooseOrdinal(candidates,null)).toBe(1);
  expect(chooseOrdinal([],1,{explicitSeek:true})).toBeNull();
});
it('cycles the structural domain, including iterations on which a bar never sounds', () => {
  const model = linearizePasses(read('lab/navigation/repeats-and-marks-on-tab'));
  expect(nextInspectionIteration(model,1,1)).toBe(2);
  expect(nextInspectionIteration(model,1,2)).toBe(3);
  expect(nextInspectionIteration(model,1,3)).toBe(1);
  const state = inspectIteration(initialPlaybackPosition(),3);
  expect(resolveIteration(model,3,state.inspectionIteration).performed).toBe(false);
  expect(state.inspectionIteration).toBe(3);
  expect(nextInspectionIteration(model,3,state.inspectionIteration)).toBe(1); // explicit click only
});
it('clears an unavailable verse, falls back to inspection when stopped, and does not persist IDs', () => {
  const inspected = inspectIteration(initialPlaybackPosition(),2);
  expect(verseForIteration(['verse-a','verse-b'],inspected)).toBe('verse-b');
  expect(verseForIteration(['verse-a'],inspected)).toBeUndefined();
  const live = withPlaybackOrdinal(followPlayback(inspected),simple(),0);
  expect(verseForIteration(['verse-a','verse-b'],live)).toBe('verse-a');
  expect(verseForIteration([],live)).toBeUndefined();
});
it('has no repeat affordance for plain music and no invented entry for invalid addresses', () => {
  expect(hasRepeatStructure(read('spec/hello-world'))).toBe(false);
  const model = simple();
  expect(resolveOrdinal(model,-1)).toBeNull(); expect(resolveOrdinal(model,NaN)).toBeNull();
  expect(resolveOccurrence(model,0,99)).toBeNull();
  expect(resolveIteration(model,99,1)).toEqual({performed:false,ordinals:[]});
  expect(() => inspectIteration(initialPlaybackPosition(),0)).toThrow(RangeError);
});
