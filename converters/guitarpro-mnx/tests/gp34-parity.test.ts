import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importGuitarProCleanRoom } from '../src/index.js';
import { importGuitarPro } from '../src/import/gp.js';
import { normalizeIds, withoutRootMetadata } from './helpers/normalize.js';
import type { MnxGrace } from '../src/common/types.js';

describe.each(['3.00', '4.00', '4.06'])('GP%s structural import', revision => {
  it('matches the independent oracle', () => {
    const bytes = readFileSync(resolve(__dirname, `fixtures/gp5/basic-${revision}.gp${revision[0]}`));
    expect(withoutRootMetadata(normalizeIds(importGuitarProCleanRoom(bytes)))).toEqual(
      withoutRootMetadata(normalizeIds(importGuitarPro(bytes)))
    );
  });
});

describe('inherited GP5 feature suite', () => {
  it('matches the oracle except its already-proven grace duration loss', () => {
    const bytes = readFileSync(resolve(__dirname, '../../fixtures/Binary-suite.gp5'));
    const actual = withoutRootMetadata(normalizeIds(importGuitarProCleanRoom(bytes)));
    const oracle = withoutRootMetadata(normalizeIds(importGuitarPro(bytes)));
    const grace = oracle.parts[0].measures[4].sequences![0].content[1] as MnxGrace;
    expect(grace).toMatchObject({ type: 'grace', content: [{ duration: { base: 'eighth' } }] });
    grace.content[0].duration.base = '32nd';
    expect(actual).toEqual(oracle);
  });
});

describe.each([3, 4])('inherited GP%s feature suite', major => {
  it('matches the independent oracle', () => {
    const bytes = readFileSync(resolve(__dirname, `../../fixtures/Binary-suite.gp${major}`));
    expect(withoutRootMetadata(normalizeIds(importGuitarProCleanRoom(bytes)))).toEqual(
      withoutRootMetadata(normalizeIds(importGuitarPro(bytes)))
    );
  });
});
