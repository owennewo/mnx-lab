// The destruct sweep's end state — a document dissolved to `{}` — is one the
// workbench must still render, and it threw: the lyric verse order read
// `global.lyrics` and the HUD read `global.measures` of a document with no
// global. The workbench-editor smoke renders it in a browser; these pin the
// two DOM-free pieces that threw.
import { expect, it } from 'vitest';
import type { MnxStructure } from '../../src/model/mnx.ts';
import { documentLyricLineIds, orderedLyricLineIds } from '../../src/engine/layout/lyricRuns.ts';
import { EditorSession } from '../../src/edit/session.ts';
import { buildHudRows } from '../../src/elements/hudRows.ts';

const empty = {} as MnxStructure;

it('orders no verses for a document with no global', () => {
  expect(documentLyricLineIds(empty)).toEqual([]);
  expect(orderedLyricLineIds(empty, new Set(['v1']))).toEqual(['v1']);
});

it('describes an empty document as the document rung alone', () => {
  const rows = buildHudRows('Swept', new EditorSession(empty, 'swept'), false);
  expect(rows.map(row => row.key)).toEqual(['document']);
  expect(rows[0].value).toBe('Swept · 0 bars · 0 parts');
});
