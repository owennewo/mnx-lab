// src/model/libraryTags.ts, which needs no storage: moved out of
// piece-checkpoint.test.ts, where every test pays for a fresh D1/R2.
import { expect, it } from 'vitest';
import { buildNewDocument } from '../../src/edit/newDocument.ts';
import { parseTuning } from '../../src/edit/setupGrammar.ts';
import { derivedLibraryTags, fromWorkHeader } from '../../src/model/libraryTags.ts';

const blank = () => buildNewDocument({ title: 'Anji', artist: 'Davy Graham', tuning: parseTuning('standard')!, time: { count: 4, unit: 4 }, fifths: 0, bars: 4 });

/**
 * WHICH DERIVED VALUES A PERSON CAN TYPE. Studio's Edit piece panel shows the
 * score's header as fields and everything else read from the file as read-only
 * rows correctable only by an alias. `fromWorkHeader` is the line between the
 * two, and it must stay joined to the projection: a dimension the projection
 * reads out of `_x.mnxLab.work` and this call denies would appear twice in the
 * panel — an editable field and a read-only echo of it, the exact duplication
 * that merging the Details and Tags sheets removed.
 */
it('splits the projection into what the header holds and what the notes say', () => {
  const document = blank();
  const header = new Set(['title', 'artist', 'subtitle', 'album', 'copyright', 'source', 'notes']);
  for (const dimension of header) expect(fromWorkHeader(dimension)).toBe(true);
  for (const role of ['composer', 'lyricist', 'transcriber', 'arranger'])
    expect(fromWorkHeader(`creator.${role}`)).toBe(true);
  // Read off the notation: nothing to type, so the panel offers only an alias.
  for (const dimension of ['part', 'capo', 'tuning', 'tuning-name']) expect(fromWorkHeader(dimension)).toBe(false);
  // Nobody reads these from a file at all — they are the person's own.
  for (const dimension of ['genre', 'status', 'list', 'favourite']) expect(fromWorkHeader(dimension)).toBe(false);

  // Every dimension the projection actually produces is on one side or the
  // other, and the ones that are not the header's are exactly the notation's.
  const produced = new Set(derivedLibraryTags(document).map(t => t.dimension));
  expect(produced.size).toBeGreaterThan(0);
  expect([...produced].filter(d => !fromWorkHeader(d)).sort()).toEqual(['part', 'tuning', 'tuning-name']);
});
