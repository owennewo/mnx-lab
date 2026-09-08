import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importGuitarProCleanRoom } from '../src/index.js';
import { importGuitarPro } from '../src/import/gp.js';
import { normalizeIds } from './helpers/normalize.js';
import type { MnxGrace } from '../src/common/types.js';
import { parseGuitarProBinary } from '../src/gp345/index.js';
import { gpifToMnx } from '../src/gpif/toMnx.js';

describe('mixed grace placement normalization', () => {
  it('does not collapse adjacent before/on-beat groups to the first placement', () => {
    const doc = parseGuitarProBinary(readFileSync(resolve(__dirname, 'fixtures/gp5/graces-5.10.gp5')));
    const voice = doc.voices.get(doc.bars.get(doc.masterBars[0].barIds[0])!.voiceIds[0])!;
    // Remove the principal between the first two graces to exercise a mixed run.
    voice.beatIds.splice(1, 1);
    const content = gpifToMnx(doc).parts[0].measures[0].sequences![0].content;
    expect(content[0]).toMatchObject({ type: 'grace', graceType: 'stealPrevious' });
    expect(content[1]).toMatchObject({ type: 'grace', graceType: 'stealFollowing' });
  });
});

describe.each(['3.00', '4.00', '4.06', '5.00', '5.10'])('GP%s grace chord', revision => {
  it('links each explicitly authored grace hammer to its own principal string', () => {
    const bytes = readFileSync(resolve(__dirname, `fixtures/gp5/grace-hammer-${revision}.gp${revision[0]}`));
    const warnings: string[] = [];
    const actual = normalizeIds(importGuitarProCleanRoom(bytes, { onWarning: message => warnings.push(message) }));
    const content = actual.parts[0].measures[0].sequences![0].content;
    expect(content).toHaveLength(2);
    expect(content[0]).toMatchObject({ type: 'grace', content: [{ duration: { base: '32nd' }, notes: [
      { id: 'n0', _x: { mnxLab: { string: 1, tab: { technique: { hammerPull: { target: 'n2' } } } } } },
      { id: 'n1', _x: { mnxLab: { string: 2, tab: { technique: { hammerPull: { target: 'n3' } } } } } }
    ] }] });
    expect(content[1]).toMatchObject({ notes: [
      { id: 'n2', _x: { mnxLab: { string: 1, fret: 4 } } },
      { id: 'n3', _x: { mnxLab: { string: 2, fret: 4 } } }
    ] });
    expect(warnings.filter(message => /grace/.test(message))).toEqual([]);
  });

  it('groups simultaneous grace notes and resolves each hammer to its principal', () => {
    const bytes = readFileSync(resolve(__dirname, `fixtures/gp5/grace-chord-${revision}.gp${revision[0]}`));
    const actual = normalizeIds(importGuitarProCleanRoom(bytes));
    const oracle = normalizeIds(importGuitarPro(bytes));
    const oracleGrace = oracle.parts[0].measures[0].sequences![0].content[0] as MnxGrace;
    expect(oracleGrace).toMatchObject({ type: 'grace', content: [
      { duration: { base: '16th' } }, { duration: { base: '16th' } }
    ] });
    // The oracle turns the per-note grace records into a sequential run.
    // GP3/4's writer round-trips its own 32nd/hammer model but the stored
    // bytes decode as 16th/bend in TuxGuitar and the published field order.
    // Honor the file semantics, not the fixture writer's inconsistent model.
    const modern = revision.startsWith('5');
    oracleGrace.content = [{ duration: { base: modern ? '32nd' : '16th' }, notes: oracleGrace.content.flatMap(event => event.notes ?? []) }];
    expect(actual).toEqual(oracle);
    const grace = actual.parts[0].measures[0].sequences![0].content[0] as MnxGrace;
    expect(grace.content).toHaveLength(1);
    expect(grace.content[0].notes).toHaveLength(2);
    expect(grace.content[0].notes!.map(note => note._x?.mnxLab?.tab?.technique?.hammerPull?.target))
      .toEqual(modern ? ['n2', 'n3'] : [undefined, undefined]);
  });
});

describe.each(['5.00', '5.10'])('GP%s grace placement', revision => {
  it('preserves authored placement and duration; all other fields match the oracle', () => {
    const bytes = readFileSync(resolve(__dirname, `fixtures/gp5/graces-${revision}.gp5`));
    const actual = normalizeIds(importGuitarProCleanRoom(bytes));
    const oracle = normalizeIds(importGuitarPro(bytes));
    // Prove the oracle loss before masking it: legacy grace duration and
    // on-beat placement are both discarded by AlphaTab's current path.
    const expectedBases = ['32nd', '16th', '16th', '32nd'] as const;
    const expectedKinds = ['stealPrevious', 'stealFollowing', 'stealPrevious', 'stealFollowing'] as const;
    const oracleContent = oracle.parts[0].measures[0].sequences![0].content;
    for (let index = 0; index < 4; index++) {
      const grace = oracleContent[index * 2];
      expect(grace).toMatchObject({
        type: 'grace', graceType: 'stealPrevious',
        content: [{ duration: { base: 'eighth' } }]
      });
      if (!('type' in grace) || grace.type !== 'grace') throw new Error('missing grace');
      grace.graceType = expectedKinds[index];
      grace.content[0].duration.base = expectedBases[index];
    }
    expect(actual).toEqual(oracle);
    const content = actual.parts[0].measures[0].sequences![0].content;
    expect(content).toHaveLength(8);
    expect(content[0]).toMatchObject({ type: 'grace', graceType: 'stealPrevious' });
    expect(content[2]).toMatchObject({ type: 'grace', graceType: 'stealFollowing' });
  });
});
