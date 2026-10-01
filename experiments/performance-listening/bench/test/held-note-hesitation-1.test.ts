import { describe, expect, it } from 'vitest';
import { holdPreceding } from '../src/stages/heldNoteHesitation1.ts';
import { mixSines, type RenderedNote } from '../src/ladder/render.ts';
const note = (fromSample: number, toSample: number, midi: number): RenderedNote => ({ fromSample, toSample, midi,
  hz: 440 * 2 ** ((midi - 69) / 12), scoreQuarter: fromSample / 48000, scoreDuration: { num: 1, den: 1 }, noteKey: String(midi) });
describe('held-note hesitation stimulus', () => {
  it('extends only the preceding note, preserves every attack and avoids overlap', () => {
    const paused = [note(0, 48000, 60), note(48000, 96000, 62), note(144000, 192000, 64)];
    const held = holdPreceding(paused, 2);
    expect(held.map(n => n.fromSample)).toEqual([0, 48000, 144000]);
    expect(held.map(n => n.toSample)).toEqual([48000, 144000, 192000]);
    expect(paused[1]!.toSample).toBe(96000);
    const a = mixSines(paused, 192000, -12, 480, 48000), b = mixSines(held, 192000, -12, 480, 48000);
    expect(b.slice(0, 95520)).toEqual(a.slice(0, 95520));
    expect(b.slice(144000)).toEqual(a.slice(144000));
    expect(b.slice(100000, 110000).some(x => x !== 0)).toBe(true);
    expect(a.slice(100000, 110000).every(x => x === 0)).toBe(true);
  });
  it('refuses a predecessor that already overlaps resumption', () => {
    expect(() => holdPreceding([note(0, 60000, 60), note(48000, 96000, 62)], 1)).toThrow();
    expect(() => holdPreceding([note(0, 48000, 60)], 0)).toThrow();
  });
});
