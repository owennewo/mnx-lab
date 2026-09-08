import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importGuitarProCleanRoom } from '../src/index.js';
import { importGuitarPro } from '../src/import/gp.js';
import { normalizeIds } from './helpers/normalize.js';
import type { MnxEvent } from '../src/common/types.js';
import { parseGuitarProBinary } from '../src/gp345/index.js';
import { gpifToMnx } from '../src/gpif/toMnx.js';

describe.each(['3.00', '4.00', '4.06', '5.00', '5.10'])('GP%s ties/dead notes', revision => {
  it('warns and preserves the stored note for an orphan tie', () => {
    const bytes = readFileSync(resolve(__dirname, `fixtures/gp5/orphan-tie-${revision}.gp${revision[0]}`));
    const warnings: string[] = [];
    const actual = normalizeIds(importGuitarProCleanRoom(bytes, { onWarning: message => warnings.push(message) }));
    expect(actual).toEqual(normalizeIds(importGuitarPro(bytes)));
    expect(warnings).toContainEqual(expect.stringContaining('stored fret retained without a tie link'));
    const note = (actual.parts[0].measures[0].sequences![0].content[0] as MnxEvent).notes![0];
    expect(note.pitch).toEqual({ step: 'E', octave: 4 });
    expect(note.ties).toBeUndefined();
  });
  it('retains the resolved source when normalization inserts a same-string grace', () => {
    const bytes = readFileSync(resolve(__dirname, `fixtures/gp5/ties-${revision}.gp${revision[0]}`));
    const doc = parseGuitarProBinary(bytes);
    const voice = doc.voices.get(doc.bars.get(doc.masterBars[0].barIds[0])!.voiceIds[0])!;
    const sourceBeat = doc.beats.get(voice.beatIds[0])!;
    const sourceId = sourceBeat.noteIds![0];
    const targetId = doc.beats.get(voice.beatIds[1])!.noteIds![0];
    expect(doc.notes.get(targetId)!.tieOrigin).toBe(sourceId);
    const graceId = Math.max(...doc.notes.keys()) + 1;
    doc.notes.set(graceId, { ...doc.notes.get(sourceId)!, fret: 2 });
    const graceBeatId = Math.max(...doc.beats.keys()) + 1;
    doc.beats.set(graceBeatId, {
      ...sourceBeat, noteIds: [graceId], graceKind: 'BeforeBeat'
    });
    voice.beatIds.splice(1, 0, graceBeatId);
    const mnx = normalizeIds(gpifToMnx(doc));
    const content = mnx.parts[0].measures[0].sequences![0].content;
    expect(content[0]).toMatchObject({ notes: [{ id: 'n0', ties: [{ target: 'n2' }] }] });
    expect(content[1]).toMatchObject({ type: 'grace', content: [{ notes: [{ id: 'n1' }] }] });
    if (!('type' in content[1]) || content[1].type !== 'grace') throw new Error('missing grace');
    expect(content[1].content[0].notes![0].ties).toBeUndefined();
    expect(content[2]).toMatchObject({ notes: [{ id: 'n2', ties: [{ target: 'n3' }] }] });
  });

  it('resolves tied pitches and retains tie targets across measures', () => {
    const bytes = readFileSync(resolve(__dirname, `fixtures/gp5/ties-${revision}.gp${revision[0]}`));
    const actual = normalizeIds(importGuitarProCleanRoom(bytes));
    const oracle = normalizeIds(importGuitarPro(bytes));
    const oracleNotes = oracle.parts[0].measures.flatMap(measure =>
      measure.sequences![0].content.flatMap(event => (event as MnxEvent).notes ?? []));
    // The existing AlphaTab-backed mapper resolves tied pitches but drops links.
    // Prove that loss before correcting only the authored two-link chain.
    expect(oracleNotes.map(note => note.ties)).toEqual([undefined, undefined, undefined, undefined]);
    oracleNotes[0].ties = [{ target: 'n1' }];
    oracleNotes[1].ties = [{ target: 'n2' }];
    expect(actual).toEqual(oracle);
    const notes = actual.parts[0].measures.flatMap(measure =>
      measure.sequences![0].content.flatMap(event => (event as MnxEvent).notes ?? []));
    expect(notes.slice(0, 3)).toMatchObject([
      { id: 'n0', pitch: { step: 'E', octave: 4 }, ties: [{ target: 'n1' }] },
      { id: 'n1', pitch: { step: 'E', octave: 4 }, ties: [{ target: 'n2' }] },
      { id: 'n2', pitch: { step: 'E', octave: 4 } }
    ]);
  });
});
