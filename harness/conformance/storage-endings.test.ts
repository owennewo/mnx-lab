// Endings written bar by bar are one ending to the player and to Guitar Pro,
// which hands them back merged. Compared as written, a save reported "Bar 16 —
// duration, changed; Bar 17 — ending, dropped" for endings 2,3,4,6 written on
// bars 16 and 17 (Strolling Down the Highway, 2026-11-08).
import { describe, it, expect } from 'vitest';
import { checkStorage, mergeEndingRuns } from '../../src/importers/storageCheckCore.ts';
import { linearizePasses } from '../../src/model/passes.ts';
import { STANDARD_GUITAR_STRINGS, type MnxStructure } from '../../src/model/mnx.ts';

function piece(split: boolean): MnxStructure {
  const q = { duration: { base: 'quarter' }, notes: [{ pitch: { step: 'A', octave: 3 }, _x: { mnxLab: { string: 3, fret: 2 } } }] };
  const g: Record<string, unknown>[] = [{ time: { count: 4, unit: 4 }, repeatStart: {} }, {}, {}, {}, {}];
  g[1] = { ending: { numbers: [1], duration: 1 }, repeatEnd: { times: 3 } };
  if (split) {
    g[2] = { ending: { numbers: [2], duration: 1 } };
    g[3] = { ending: { numbers: [2], duration: 1 }, repeatEnd: { times: 3 } };
  } else {
    g[2] = { ending: { numbers: [2], duration: 2 } };
    g[3] = { repeatEnd: { times: 3 } };
  }
  g[4] = { ending: { numbers: [3], duration: 1 } };
  return {
    mnx: { version: 1 }, global: { measures: g },
    parts: [{ id: 'g', name: 'Guitar', _x: { mnxLab: { strings: STANDARD_GUITAR_STRINGS.map(s => ({ ...s, pitch: { ...s.pitch } })) } },
      measures: g.map(() => ({ sequences: [{ content: [q, q, q, q] }] })) }]
  } as unknown as MnxStructure;
}

describe('endings written bar by bar', () => {
  it('play exactly as the one ending they amount to', () => {
    const order = (doc: MnxStructure) => linearizePasses(doc).entries.map(e => e.measureIndex).join(' ');
    expect(order(piece(true))).toBe(order(piece(false)));
  });

  it('merge for the comparison, and leave the document as written', () => {
    const split = piece(true);
    const merged = mergeEndingRuns(split);
    expect(merged.global.measures[2]!.ending).toEqual({ numbers: [2], duration: 2 });
    expect(merged.global.measures[3]!.ending).toBeUndefined();
    expect(split.global.measures[3]!.ending).toEqual({ numbers: [2], duration: 1 });
  });

  it('are not reported as lost by a save', () => {
    const endingLosses = (doc: MnxStructure) => checkStorage(doc).losses.filter(l => l.path.includes('ending'));
    expect(endingLosses(piece(true))).toEqual([]);
    expect(endingLosses(piece(false))).toEqual([]);
  });
});
