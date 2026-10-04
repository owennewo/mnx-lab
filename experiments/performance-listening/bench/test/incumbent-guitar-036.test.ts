import { describe, expect, it } from 'vitest';
import { frontEnd } from '../src/stages/run036.ts';

const tone = (hz: number, seconds: number, partials: number[] = [1]) => Float32Array.from({ length: Math.round(seconds * 48000) },
  (_, i) => 0.25 * partials.reduce((s, a, k) => s + a * Math.sin(2 * Math.PI * hz * (k + 1) * i / 48000), 0));

describe('036 front-end diagnostic', () => {
  it('classifies a sine note as exact and acquires it at the second whole window', () => {
    const d = frontEnd(tone(261.6256, 0.5), [{ midi: 60, onset: 0, end: 0.5 }]);
    expect(d.counts.exact).toBe(d.notes[0]!.windows);
    expect(d.notes[0]!.acquiredAfter).toBeCloseTo(0.03, 9);
  });
  it('counts only windows wholly inside a note, and silence as silent', () => {
    const audio = new Float32Array(48000); audio.set(tone(261.6256, 0.2), 24000);
    const d = frontEnd(audio, [{ midi: 60, onset: 0, end: 0.4 }]);
    expect(d.counts.silent).toBeGreaterThan(0);
    expect(d.notes[0]!.windows).toBe(39);
  });
  it('withholds or misreads a strongly harmonic tone rather than calling it exact', () => {
    const d = frontEnd(tone(261.6256, 0.5, [0.3, 1, 0.8]), [{ midi: 60, onset: 0, end: 0.5 }]);
    expect(d.counts.exact).toBe(0);
  });
});
