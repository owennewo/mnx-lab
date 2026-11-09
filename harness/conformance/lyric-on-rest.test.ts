// A sung syllable may sit on a REST in the voice that carries the words — the
// guitar rests while the singer goes on (Strolling Down the Highway, bars 9 and
// 11: "can you", "I", "stroll"). A rest has no note, so a syllable op that could
// only name a note left those syllables unreachable: they could not be moved to
// another verse or cleared. Lyric ops name the event's address as well.
import { describe, it, expect } from 'vitest';
import { applyOp } from '../../src/edit/ops.ts';
import { lyricPlanOps } from '../../src/edit/lyricText.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

const doc = (): MnxStructure => ({
  mnx: { version: 1 },
  global: { measures: [{ time: { count: 2, unit: 4 } }] },
  parts: [{ id: 'g', measures: [{ sequences: [{ content: [
    { type: 'rest', duration: { base: 'quarter' }, lyrics: { lines: { '1': { text: 'can you' } } } } as never,
    { duration: { base: 'quarter' }, notes: [{ pitch: { step: 'C', octave: 4 } }] }
  ] }] }] }]
} as unknown as MnxStructure);
const rest = { partIndex: 0, staffIndex: 1, measureIndex: 0, voiceIndex: 0, eventIndex: 0 };
const lines = (d: MnxStructure) => (d.parts[0]!.measures[0]!.sequences![0]!.content[0] as { lyrics?: { lines: object } }).lyrics?.lines;

describe('a syllable on a rest', () => {
  it('is set and removed by the event\'s address', () => {
    const moved = applyOp(applyOp(doc(), { type: 'setSyllable', event: rest, line: '2', text: 'can you' }),
      { type: 'removeSyllable', event: rest, line: '1' });
    expect(lines(moved)).toEqual({ '2': { text: 'can you' } });
    expect(lines(applyOp(moved, { type: 'removeSyllable', event: rest, line: '2' }))).toBeUndefined();
  });

  it('a lyric plan carries the address through', () => {
    const ops = lyricPlanOps([{ op: 'setSyllable', event: rest, line: '2', text: 'I' }, { op: 'removeSyllable', event: rest, line: '1' }]);
    const after = ops.reduce((d, op) => applyOp(d, op), doc());
    expect(lines(after)).toEqual({ '2': { text: 'I' } });
  });
});
