/** Delivery at whatever the device gives. A listener that wants fixed internal delivery
 * (the legacy candidates want 48 kHz in 480-sample chunks) is wrapped so that any declared
 * rate and block size reaches it re-chunked and, where the rate differs, resampled. The
 * wrapped listener's clock is the time of the audio it has received, so its refersTo stays
 * on the original timeline; only availability is delayed, by RESAMPLER_TAPS input samples
 * when resampling and by the re-chunking wait. */
import type { Delivery, Emission, Listener } from './contract.ts';

/** Half-width of the windowed-sinc kernel, in input samples. */
export const RESAMPLER_TAPS = 16;

/** Causal band-limited resampling: an output sample is produced only once every input it
 * depends on has arrived. Same-rate input is passed through untouched. */
export class Resampler {
  private input: number[] = [];
  private dropped = 0;       // input samples discarded from the front of `input`
  private produced = 0;      // output samples emitted so far
  private received = 0;      // input samples received so far
  private readonly scale: number;
  constructor(readonly from: number, readonly to: number) {
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from <= 0 || to <= 0) throw new Error('Rates must be positive integers');
    this.scale = Math.min(1, to / from) * 0.95;
  }
  get delaySeconds() { return this.from === this.to ? 0 : RESAMPLER_TAPS / this.from; }
  private kernel(x: number) {
    if (x === 0) return this.scale;
    if (Math.abs(x) >= RESAMPLER_TAPS) return 0;
    const window = 0.42 + 0.5 * Math.cos(Math.PI * x / RESAMPLER_TAPS) + 0.08 * Math.cos(2 * Math.PI * x / RESAMPLER_TAPS);
    return Math.sin(Math.PI * this.scale * x) / (Math.PI * x) * window;
  }
  private at(index: number) { const i = index - this.dropped; return i >= 0 && i < this.input.length ? this.input[i]! : 0; }
  /** Outputs that can be computed from the input so far, up to `limit` if given. */
  private drain(available: number, limit = Infinity): number[] {
    const out: number[] = [];
    while (this.produced < limit) {
      const numerator = this.produced * this.from, base = Math.floor(numerator / this.to), frac = (numerator % this.to) / this.to;
      if (base + RESAMPLER_TAPS >= available) break;
      let sum = 0;
      for (let k = base - RESAMPLER_TAPS + 1; k <= base + RESAMPLER_TAPS; k++) sum += this.at(k) * this.kernel(base + frac - k);
      out.push(sum); this.produced++;
    }
    const keep = Math.floor(this.produced * this.from / this.to) - RESAMPLER_TAPS;
    if (keep > this.dropped) { this.input.splice(0, keep - this.dropped); this.dropped = keep; }
    return out;
  }
  push(chunk: Float32Array): Float32Array {
    if (this.from === this.to) { this.received += chunk.length; return chunk.slice(); }
    for (const x of chunk) this.input.push(x);
    this.received += chunk.length;
    return Float32Array.from(this.drain(this.received));
  }
  /** The input has ended: emit the remaining outputs up to the input's own duration. */
  flush(): Float32Array {
    if (this.from === this.to) return new Float32Array(0);
    return Float32Array.from(this.drain(Infinity, Math.floor(this.received * this.to / this.from)));
  }
}

/** Wraps a listener that wants `wants` so it accepts any delivery. */
export function deliverAs(factory: () => Listener, wants: Delivery): () => Listener & { delaySeconds: () => number } {
  return () => {
    const inner = factory();
    let resampler: Resampler | null = null, pending = new Float32Array(0), produced = 0;
    const deliver = (samples: Float32Array, final: boolean): Emission[] => {
      const joined = new Float32Array(pending.length + samples.length); joined.set(pending); joined.set(samples, pending.length);
      const out: Emission[] = [];
      let at = 0;
      while (joined.length - at >= wants.chunkSamples || (final && joined.length - at > 0)) {
        const size = Math.min(wants.chunkSamples, joined.length - at);
        produced += size;
        out.push(...inner.feed(joined.slice(at, at + size), produced / wants.sampleRate));
        at += size;
      }
      pending = joined.slice(at);
      return out;
    };
    return {
      delaySeconds: () => resampler?.delaySeconds ?? 0,
      start(score, handoff, delivery) {
        resampler = delivery.sampleRate === wants.sampleRate ? null : new Resampler(delivery.sampleRate, wants.sampleRate);
        pending = new Float32Array(0); produced = 0;
        return inner.start(score, handoff, { ...wants });
      },
      feed(chunk) { return deliver(resampler ? resampler.push(chunk) : chunk, false); },
      finish() { return [...deliver(resampler ? resampler.flush() : new Float32Array(0), true), ...inner.finish()]; },
    };
  };
}
