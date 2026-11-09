// An instrumental pass before the first sung verse (Strolling Down the Highway:
// passes 1, 4 and 7 unsung, 2026-11-09). The lyric panel holds pass 1's place
// with a declared, empty row 1; the player has to count it, and a Guitar Pro
// save has to keep it. Before this, the player lit verse 2's words on pass 1,
// and a save dropped the empty row so the words moved to pass 1 for good —
// while the save check reported nothing.
import { describe, it, expect } from 'vitest';
import { lyricPlanOps, parseLyricText, planLyricEdits, serializeLyricText } from '../../src/edit/lyricText.ts';
import { applyOp, type EditOp } from '../../src/edit/ops.ts';
import { verseRows } from '../../src/model/lyricRows.ts';
import { checkStorage } from '../../src/importers/storageCheckCore.ts';
import { importGuitarProCleanRoom } from '../../converters/guitarpro-mnx/src/cleanRoom.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

const repeated = (): MnxStructure => ({
  mnx: { version: 1 },
  global: { measures: [{ time: { count: 4, unit: 4 }, repeatStart: {}, repeatEnd: { times: 4 } }] },
  parts: [{ id: 'g', name: 'Guitar', measures: [{ sequences: [{ content: [{ duration: { base: 'whole' }, notes: [{ pitch: { step: 'C', octave: 4 } }] }] }] }] }]
} as unknown as MnxStructure);

function typed(text: string): MnxStructure {
  let doc = repeated();
  for (const op of lyricPlanOps(planLyricEdits(doc, 0, parseLyricText(doc, 0, text)))) doc = applyOp(doc, op as EditOp);
  return doc;
}
const saved = (doc: MnxStructure) => {
  const result = checkStorage(doc);
  return { doc: importGuitarProCleanRoom(result.bytes) as unknown as MnxStructure, verdict: result.check.verdict };
};
/** What each of the four passes sings, as the player picks it. */
const sungPerPass = (doc: MnxStructure) => [1, 2, 3, 4].map(pass => {
  const row = verseRows(doc)[pass - 1];
  const lines = (doc.parts[0]!.measures[0]!.sequences![0]!.content[0] as { lyrics?: { lines?: Record<string, { text: string }> } }).lyrics?.lines ?? {};
  return row ? lines[row]?.text ?? '' : '';
});

describe('an unsung first pass', () => {
  const doc = typed('×1 | two | three | ×1 |');

  it('the player sings nothing on pass 1, as the panel says', () => {
    expect(sungPerPass(doc)).toEqual(['', 'two', 'three', '']);
  });

  it('survives Guitar Pro saves, and the check says nothing was lost', () => {
    const once = saved(doc), twice = saved(once.doc);
    expect(once.verdict).not.toBe('differs');
    expect(sungPerPass(once.doc)).toEqual(['', 'two', 'three', '']);
    expect(sungPerPass(twice.doc)).toEqual(['', 'two', 'three', '']);
    expect(serializeLyricText(twice.doc, 0)).toBe(serializeLyricText(doc, 0));
  });

  it('a gap between verses holds too: passes 1 and 3 unsung', () => {
    const gappy = typed('×1 | two | ×1 | four |');
    expect(sungPerPass(gappy)).toEqual(['', 'two', '', 'four']);
    expect(sungPerPass(saved(saved(gappy).doc).doc)).toEqual(['', 'two', '', 'four']);
  });
});
