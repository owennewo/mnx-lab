import { describe, expect, it } from 'vitest';
import type { Emission, Listener } from '../contract.ts';
import { deliverAs, Resampler, RESAMPLER_TAPS } from '../delivery.ts';

/** Records what reaches it, and emits one statement per chunk about its clock. */
function spy() {
  const chunks: Float32Array[] = [], clocks: number[] = [];
  const listener: Listener = {
    start: () => ({ ok: true }),
    feed(chunk, clock) { chunks.push(chunk); clocks.push(clock); return [{ id: `u${clocks.length}`, kind: 'unsupported', refersTo: clock } satisfies Emission]; },
    finish: () => [],
  };
  return { listener, chunks, clocks };
}
const deliverIn = (factory: () => Listener, audio: Float32Array, rate: number, block: number) => {
  const l = factory(); l.start({} as never, {} as never, { sampleRate: rate, chunkSamples: block });
  const out: Emission[] = [];
  for (let i = 0; i < audio.length; i += block) out.push(...l.feed(audio.slice(i, i + block), Math.min(i + block, audio.length) / rate));
  out.push(...l.finish());
  return out;
};
const wants = { sampleRate: 48000, chunkSamples: 480 };

describe('delivery at whatever the device gives', () => {
  it('re-chunks 48 kHz render blocks into exactly the 480-sample chunks a direct delivery would give', () => {
    const audio = Float32Array.from({ length: 48000 }, (_, i) => Math.sin(i / 7));
    const s = spy();
    deliverIn(deliverAs(() => s.listener, wants), audio, 48000, 128);
    expect(s.clocks).toEqual(Array.from({ length: 100 }, (_, k) => (k + 1) * 480 / 48000));
    const joined = new Float32Array(48000); let at = 0; for (const c of s.chunks) { joined.set(c, at); at += c.length; }
    expect(joined).toEqual(audio);
  });

  it('resamples 44.1 kHz to 48 kHz at the right pitch and level, with a fixed small delay', () => {
    const hz = 441, input = Float32Array.from({ length: 44100 }, (_, i) => 0.5 * Math.sin(2 * Math.PI * hz * i / 44100));
    const r = new Resampler(44100, 48000), out = [...r.push(input.slice(0, 20000)), ...r.push(input.slice(20000)), ...r.flush()];
    expect(out.length).toBe(48000);
    let crossings = 0; for (let i = 4801; i < 43200; i++) if (out[i - 1]! < 0 && out[i]! >= 0) crossings++;
    expect(crossings / ((43200 - 4801) / 48000)).toBeCloseTo(hz, -1);
    const middle = out.slice(20000, 30000), peak = Math.max(...middle.map(Math.abs));
    expect(peak).toBeGreaterThan(0.47); expect(peak).toBeLessThan(0.53);
    for (let i = 20000; i < 20100; i++) expect(out[i]!).toBeCloseTo(0.5 * Math.sin(2 * Math.PI * hz * i / 48000), 2);
    expect(r.delaySeconds).toBeCloseTo(RESAMPLER_TAPS / 44100, 12);
  });

  it('is causal: the same prefix with a different future gives the same statements up to it', () => {
    const a = Float32Array.from({ length: 22050 }, (_, i) => Math.sin(i / 5)), b = a.slice(); b.fill(0.3, 11025);
    const run = (audio: Float32Array) => { const s = spy(); deliverIn(deliverAs(() => s.listener, wants), audio, 44100, 128); return s; };
    const x = run(a), y = run(b), cut = 11025 / 44100 - RESAMPLER_TAPS / 44100 - 480 / 48000;
    const upTo = (s: ReturnType<typeof spy>) => s.chunks.filter((_, k) => s.clocks[k]! <= cut);
    expect(upTo(x).length).toBeGreaterThan(0);
    expect(upTo(y)).toEqual(upTo(x));
  });
});
