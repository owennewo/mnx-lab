// The destruct sweep's end state — a document dissolved to `{}` — is one the
// workbench must still render, and it threw: the lyric verse order read
// `global.lyrics` and the HUD read `global.measures` of a document with no
// global. This pins the engine half; the HUD lives in src/elements/, which the
// harness may not import (harness-not-into-shells), so the workbench-editor
// smoke renders the swept `{}` in a browser and asks whether the update threw.
import { expect, it } from 'vitest';
import type { MnxStructure } from '../../src/model/mnx.ts';
import { documentLyricLineIds, orderedLyricLineIds } from '../../src/engine/layout/lyricRuns.ts';

const empty = {} as MnxStructure;

it('orders no verses for a document with no global', () => {
  expect(documentLyricLineIds(empty)).toEqual([]);
  expect(orderedLyricLineIds(empty, new Set(['v1']))).toEqual(['v1']);
});
