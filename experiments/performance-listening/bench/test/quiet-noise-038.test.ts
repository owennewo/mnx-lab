import { expect, it } from 'vitest';
import { levels, normalizeNoise } from '../src/challenger/quietNoise.ts';
import { readWav } from '../src/generate/wav.ts';
it('sets centered PCM16 RMS to the fixed quiet level, preserving length without clipping', () => {
  const x = Float32Array.from({ length: 48000 }, (_, i) => .3 + .12 * Math.sin(i * .7) + .08 * Math.cos(i * .3));
  const y = readWav(normalizeNoise(x)), s = levels(y);
  expect(y.length).toBe(x.length); expect(Math.abs(s.rmsDbfs + 60)).toBeLessThan(.01);
  expect(Math.abs(s.mean)).toBeLessThan(1 / 32768); expect(s.peak).toBeLessThan(.01);
  expect(normalizeNoise(x)).toEqual(normalizeNoise(x));
});
it('refuses an empty or constant stream instead of inventing a silence control', () => {
  expect(() => normalizeNoise(new Float32Array())).toThrow();
  expect(() => normalizeNoise(new Float32Array(100).fill(.3))).toThrow();
});
