// Guitar Pro stamps num:den on every beat of a tuplet and stores no groups, so
// the reader re-derives them. It used to close a group at `num` × the FIRST
// beat's value — and a triplet of eighths that opens with two sixteenths
// (16th 16th 8th 8th: the hammered flick in Strolling Down the Highway, bars
// 14–15, 2026-11-08) closed a beat early and fell out of its tuplet, a third
// of a beat too long. Every save of that piece read back half a beat over, and
// the original import showed the same bars "overfull".
import { describe, it, expect } from 'vitest';
import { importGuitarProGpif, exportGuitarProGpif } from '../src/gpif/index.js';
import type { MnxStructure } from '../src/common/types.js';

type Base = 'half' | 'quarter' | 'eighth' | '16th';
const ev = (base: Base, step = 'C') => ({ duration: { base }, notes: [{ pitch: { step, octave: 4 } }] });
const tuplet = (num: number, den: number, unit: Base, content: ReturnType<typeof ev>[]) =>
  ({ type: 'tuplet', inner: { multiple: num, duration: { base: unit } }, outer: { multiple: den, duration: { base: unit } }, content });

function roundTrip(content: unknown[]): string {
  const doc = {
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }] },
    parts: [{ id: 'g', name: 'Guitar', measures: [{ sequences: [{ content }] }] }]
  } as unknown as MnxStructure;
  const back = importGuitarProGpif(exportGuitarProGpif(doc)) as MnxStructure;
  const short: Record<string, string> = { half: 'h', quarter: 'q', eighth: 'e', '16th': 's' };
  const shape = (items: readonly unknown[]): string => items.map(item => {
    const i = item as { type?: string; inner?: { multiple: number; duration: { base: string } }; content?: unknown[]; duration?: { base: string } };
    return i.type === 'tuplet' ? `${i.inner!.multiple}:${short[i.inner!.duration.base]}[${shape(i.content!)}]` : short[i.duration!.base]!;
  }).join(' ');
  return shape(back.parts![0]!.measures![0]!.sequences![0]!.content);
}

describe('tuplet groups read back from Guitar Pro', () => {
  it('a triplet of eighths that opens with sixteenths stays one triplet', () => {
    const flick = () => tuplet(3, 2, 'eighth', [ev('16th'), ev('16th', 'D'), ev('eighth'), ev('eighth', 'E')]);
    expect(roundTrip([flick(), flick(), flick(), ev('quarter')])).toBe('3:e[s s e e] 3:e[s s e e] 3:e[s s e e] q');
  });

  it('a long-short triplet (quarter, eighth) stays one triplet of eighths — at the end of a bar or not', () => {
    expect(roundTrip([ev('quarter'), ev('quarter'), ev('quarter'), tuplet(3, 2, 'eighth', [ev('quarter'), ev('eighth')])]))
      .toBe('q q q 3:e[q e]');
    // The same piece, bar 16: followed straight away by the sixteenth flick, it
    // used to keep that triplet's beats and read back as one six-note group.
    const flick = () => tuplet(3, 2, 'eighth', [ev('16th'), ev('16th', 'D'), ev('eighth'), ev('eighth', 'E')]);
    expect(roundTrip([tuplet(3, 2, 'eighth', [ev('eighth'), ev('eighth'), ev('eighth')]), ev('eighth'), ev('eighth'),
      tuplet(3, 2, 'eighth', [ev('quarter'), ev('eighth')]), flick()]))
      .toBe('3:e[e e e] e e 3:e[q e] 3:e[s s e e]');
  });

  it('a triplet of quarters, and a 5:4 of sixteenths, close where they are whole', () => {
    expect(roundTrip([tuplet(3, 2, 'quarter', [ev('quarter'), ev('quarter'), ev('quarter')]), ev('half')])).toBe('3:q[q q q] h');
    expect(roundTrip([tuplet(5, 4, '16th', [ev('16th'), ev('16th'), ev('16th'), ev('16th'), ev('16th')]), ev('quarter'), ev('half')]))
      .toBe('5:s[s s s s s] q h');
  });

  it('six flagged eighths are still two triplets, and a sixteenth triplet still closes at three', () => {
    const three = (unit: Base) => tuplet(3, 2, unit, [ev(unit), ev(unit), ev(unit)]);
    expect(roundTrip([three('eighth'), three('eighth'), three('16th'), three('16th'), ev('quarter')]))
      .toBe('3:e[e e e] 3:e[e e e] 3:s[s s s] 3:s[s s s] q');
  });
});
