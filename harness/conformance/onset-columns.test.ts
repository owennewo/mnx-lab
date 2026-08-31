// Onset-aligned columns across voices — the cross-voice spacing invariant:
// x order must agree with onset order, and same-onset events share an x,
// whatever any single voice's rigid demands (a wide syllable, an
// accidental) do to its own chain. Before the merge each voice was spaced
// independently, and a wide word in one voice drew an earlier note AFTER a
// later one in the other voice.
import { describe, expect, it } from 'vitest';
import { planHorizontal } from '../../src/engine/layout/spacing.ts';
import { WIDTH_SP } from '../helpers/corpusPrimitives.ts';
import { isTimedEvent } from '../../src/model/mnx.ts';
import { durationValue } from '../../src/model/durations.ts';
import type { MnxSequenceItem, MnxStructure } from '../../src/model/mnx.ts';

const quarter = { base: 'quarter' as const };
const eighth = { base: 'eighth' as const };

function docOf(voices: MnxSequenceItem[][]): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }] },
    parts: [{
      measures: [{ sequences: voices.map(content => ({ content })) }]
    }]
  } as MnxStructure;
}

/** (onset, x) pairs for every timed slot of every voice in bar 0. */
function timedSlots(doc: MnxStructure): { voice: number; onset: number; x: number }[] {
  const plan = planHorizontal(doc, WIDTH_SP);
  const out: { voice: number; onset: number; x: number }[] = [];
  const sequences = doc.parts![0]!.measures![0]!.sequences!;
  sequences.forEach((seq, v) => {
    let onset = 0;
    (seq.content as MnxSequenceItem[]).forEach((item, k) => {
      if (!isTimedEvent(item)) return;
      out.push({ voice: v, onset, x: plan.measures[0]!.staves[0]![v]![k]!.x });
      onset += durationValue((item as { duration: { base: 'quarter' } }).duration);
    });
  });
  return out;
}

function note(step: string, octave: number, extra: object = {}) {
  return { pitch: { step, octave }, ...extra };
}

describe('onset-aligned columns across voices', () => {
  it('a wide syllable cannot draw an earlier note after a later one', () => {
    const doc = docOf([
      [
        { duration: quarter, notes: [note('C', 4)], lyrics: { lines: { '1': { text: 'a' } } } },
        { duration: quarter, notes: [note('D', 4)], lyrics: { lines: { '1': { text: 'superduperextraordinarily' } } } },
        { duration: { base: 'half' }, notes: [note('E', 4)] }
      ],
      Array.from({ length: 8 }, () => ({ duration: eighth, notes: [note('E', 3)] }))
    ]);
    const slots = timedSlots(doc);
    for (const a of slots) {
      for (const b of slots) {
        if (a.onset < b.onset - 1e-6) {
          expect(a.x, `onset ${a.onset} (v${a.voice}) vs ${b.onset} (v${b.voice})`).toBeLessThan(b.x);
        }
      }
    }
  });

  it('same-onset events across voices share one anchor; an accidental in one aligns both', () => {
    const doc = docOf([
      [
        { duration: quarter, notes: [note('C', 4)] },
        { duration: quarter, notes: [note('D', 4)] },
        { duration: quarter, notes: [note('E', 4)] },
        { duration: quarter, notes: [note('F', 4)] }
      ],
      [
        { duration: quarter, notes: [note('E', 3)] },
        { duration: quarter, notes: [note('F', 3, { pitch: { step: 'F', octave: 3, alter: 1 } })] },
        { duration: quarter, notes: [note('G', 3)] },
        { duration: quarter, notes: [note('A', 3)] }
      ]
    ]);
    const slots = timedSlots(doc);
    const byOnset = new Map<number, number[]>();
    for (const slot of slots) {
      const key = Math.round(slot.onset * 1e6);
      byOnset.set(key, [...(byOnset.get(key) ?? []), slot.x]);
    }
    for (const [key, xs] of byOnset) {
      expect(xs.length, `onset ${key / 1e6}`).toBe(2);
      expect(xs[0], `onset ${key / 1e6} anchors diverge`).toBeCloseTo(xs[1]!, 6);
    }
  });
});
