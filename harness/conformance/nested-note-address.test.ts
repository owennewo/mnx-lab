import { it, expect } from 'vitest';
import { noteKeysOf, findNoteAddress } from '../../src/model/noteWalk.ts';
import { buildJsonView } from '../../src/model/jsonView.ts';
import { buildGrid } from '../../src/edit/cursor.ts';
import { eventAtAddress } from '../../src/edit/ops.ts';
import { walkElements } from '../../src/edit/elementWalk.ts';
import { computePrimitives } from '../helpers/corpusPrimitives.ts';
import type { MnxStructure, MnxTuplet, MnxEvent } from '../../src/model/mnx.ts';
const note = (): MnxEvent => ({
  duration: { base: 'eighth' },
  notes: [{ pitch: { step: 'C', octave: 4 } }],
});
const tuplet = (content: MnxTuplet['content']): MnxTuplet => ({
  type: 'tuplet',
  inner: { multiple: 3, duration: { base: 'eighth' } },
  outer: { multiple: 2, duration: { base: 'eighth' } },
  content,
});
export const nestedDocument = (): MnxStructure => ({
  global: { measures: [{ time: { count: 4, unit: 4 } }] },
  parts: [
    {
      measures: [
        { sequences: [{ content: [tuplet([note(), tuplet([note(), note(), note()]), note()])] }] },
      ],
    },
  ],
});
it('preserves shallow keys and resolves deep notes consistently in edit, JSON and references', () => {
  const doc = nestedDocument();
  const keys = noteKeysOf(doc);
  expect(keys).toEqual([
    '@m0.v0.e0.c0.n0',
    '@m0.v0.e0.c1.c0.n0',
    '@m0.v0.e0.c1.c1.n0',
    '@m0.v0.e0.c1.c2.n0',
    '@m0.v0.e0.c2.n0',
  ]);
  const address = findNoteAddress(doc, keys[2])!;
  expect(address.containerIndex).toEqual([1, 1]);
  expect(eventAtAddress(doc, address)).toBe(address.event);
  expect(buildJsonView(doc).noteLineByKey.has(keys[2])).toBe(true);
  expect(JSON.stringify(buildGrid(doc))).toContain(keys[2]);
  expect(walkElements(doc).some((ref) => ref.noteKey === keys[2])).toBe(true);
  const rendered = JSON.stringify(computePrimitives(doc));
  expect(rendered).toContain('nested tuplet content');
  expect(rendered).not.toContain(keys[2]); // no invented geometry
});
