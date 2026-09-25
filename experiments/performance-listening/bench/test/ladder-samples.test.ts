import { describe, expect, it } from 'vitest';
import type { RenderedNote } from '../src/ladder/render.ts';
import { mixSamples, nearest, tonejsMidi, type LoadedSample } from '../src/ladder/samples.ts';

describe('sample-render@1', () => {
  it('reads tonejs-instruments file names as scientific pitch', () => {
    expect(['A4.wav', 'C4.wav', 'Cs3.wav', 'B1.wav', 'Fs5.wav'].map(tonejsMidi)).toEqual([69, 60, 49, 35, 78]);
    expect(() => tonejsMidi('A4.mp3')).toThrow();
  });

  it('chooses the nearest root, the lower one on a tie', () => {
    const roots = [40, 45, 50].map(root => ({ root, audio: new Float64Array(1), start: 0 }));
    expect([40, 42, 43, 47, 48, 60].map(m => nearest(roots, m).root)).toEqual([40, 40, 45, 45, 50, 50]);
  });

  it('resamples to the exact pitch, starts at the attack and ends with a release', () => {
    const hz = 261.6255653005986, audio = new Float64Array(96000);
    for (let i = 4800; i < audio.length; i++) audio[i] = Math.sin(2 * Math.PI * hz * (i - 4800) / 48000);
    const sample: LoadedSample = { root: 60, audio, start: 4800 };
    const note: RenderedNote = { fromSample: 1000, toSample: 1000 + 48000, midi: 64, hz: 0, scoreQuarter: 0, scoreDuration: { num: 1, den: 1 }, noteKey: null };
    const { pcm, shifts } = mixSamples([note], [sample], 50000, 0.5);
    expect(shifts).toEqual([4]);
    expect(pcm.slice(0, 1000).every(v => v === 0)).toBe(true);
    let crossings = 0;
    for (let i = 1001; i < 1000 + 47000; i++) if (pcm[i - 1]! < 0 && pcm[i]! >= 0) crossings++;
    expect(crossings / (46999 / 48000)).toBeCloseTo(hz * 2 ** (4 / 12), -1);
    expect(Math.abs(pcm[1000 + 48000 - 1]!)).toBeLessThan(50);
  });
});
