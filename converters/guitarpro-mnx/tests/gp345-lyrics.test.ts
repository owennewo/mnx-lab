import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importGuitarProCleanRoom } from '../src/index.js';
import { importGuitarPro } from '../src/import/gp.js';
import { normalizeIds } from './helpers/normalize.js';
import { splitBinaryLyrics } from '../src/gp345/lyrics.js';
import type { MnxEvent } from '../src/common/types.js';

it('tokenizes legacy syllables, joined words, comments and skipped-note slots', () => {
  expect(splitBinaryLyrics('Hel-lo two+words [comment]  end'))
    .toEqual(['Hel-', 'lo', 'two+words', '', '', 'end']);
  expect(splitBinaryLyrics('Shin- ing')).toEqual(['Shin-', 'ing']);
  expect(splitBinaryLyrics('  start')).toEqual(['', '', 'start']);
});

describe.each(['4.00', '4.06', '5.00', '5.10'])('GP%s lyric controls', revision => {
  it('matches the oracle including empty-note slots across a barline', () => {
    const bytes = readFileSync(resolve(__dirname, `fixtures/gp5/lyric-controls-${revision}.gp${revision[0]}`));
    const actual = normalizeIds(importGuitarProCleanRoom(bytes));
    expect(actual).toEqual(normalizeIds(importGuitarPro(bytes)));
    const lyrics = actual.parts[0].measures.flatMap(measure => measure.sequences![0].content
      .map(event => (event as MnxEvent).lyrics?.lines['1']?.text ?? null));
    expect(lyrics).toEqual(['Hel', 'lo', 'two words', null, null, 'end', null, null]);
  });
});
