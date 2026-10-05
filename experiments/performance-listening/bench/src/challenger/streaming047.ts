/** 047 storage-only variant. A model window is borrowed until the next feed/reset. */
import { WINDOW3 } from './streaming3.ts';
import { selectedFrames, reducePitch } from './observation2.ts';
import type { Frame3 } from './streaming3.ts';
export class StreamingInput047 {
  samples = 0; generated = 0; nextSamples = 4800; watermark: number | null = null;
  private input = new Float32Array(482); private length = 0; private offset = 0;
  private ring = new Float32Array(WINDOW3);
  private modelWindow = new Float32Array(WINDOW3);
  readonly allocations = { rawArrays: 1, rawBytes: 482 * 4, ringArrays: 1, ringBytes: WINDOW3 * 4,
    windowArrays: 1, windowBytes: WINDOW3 * 4, growths: 0, maxRawCapacity: 482 };
  reset() {
    this.samples = 0; this.generated = 0; this.nextSamples = 4800; this.watermark = null;
    this.length = 0; this.offset = 0; this.ring.fill(0); this.modelWindow.fill(0);
  }
  get retainedInput() { return this.length; }
  get retainedModel() { return Math.min(this.generated, WINDOW3); }
  feed(chunk: Float32Array): { input: Float32Array; samples: number; generated: number } | null {
    for (const x of chunk) if (!Number.isFinite(x)) throw new Error('Nonfinite audio');
    const needed = this.length + chunk.length;
    if (needed > this.input.length) {
      const capacity = Math.max(needed, this.input.length * 2), grown = new Float32Array(capacity);
      for (let i = 0; i < this.length; i++) grown[i] = this.input[i]!;
      this.input = grown; this.allocations.rawArrays++; this.allocations.rawBytes += capacity * 4;
      this.allocations.growths++; this.allocations.maxRawCapacity = capacity;
    }
    this.input.set(chunk, this.length); this.length = needed; this.samples += chunk.length;
    for (;;) {
      // Frozen operation order: arithmetic remains double until ring float32 storage.
      const p = this.generated * 48000 / 22050, left = Math.floor(p), fraction = p - left;
      if (left + 1 >= this.samples) break;
      const index = left - this.offset;
      if (index < 0 || index + 1 >= this.length) throw new Error('Evicted interpolation neighbor');
      const a = this.input[index]!, b = this.input[index + 1]!;
      this.ring[this.generated % WINDOW3] = a * (1 - fraction) + b * fraction;
      this.generated++;
    }
    const keep = Math.min(this.samples, Math.floor(this.generated * 48000 / 22050));
    const dropped = keep - this.offset;
    this.input.copyWithin(0, dropped, this.length); this.length -= dropped; this.offset = keep;
    if (this.samples < this.nextSamples) return null;
    this.nextSamples = (Math.floor(this.samples / 4800) + 1) * 4800;
    return { input: this.window(), samples: this.samples, generated: this.generated };
  }
  window() {
    const count = Math.min(this.generated, WINDOW3), from = this.generated - count;
    this.modelWindow.fill(0, 0, WINDOW3 - count);
    for (let i = 0; i < count; i++) this.modelWindow[WINDOW3 - count + i] = this.ring[(from + i) % WINDOW3]!;
    return this.modelWindow;
  }
  frames(note: Float32Array, edge: 0 | 15 = 0): Frame3[] {
    if (note.length !== 172 * 88) throw new Error('Expected 172x88 note map');
    const selected = selectedFrames(this.samples, edge, this.watermark);
    const frames = selected.indices.map((j, i) => ({ q: selected.coordinates[i]!, audioTime: selected.coordinates[i]! / 22050,
      deliveryAt: this.samples / 48000, deliverySamples: this.samples,
      ...reducePitch(Array.from(note.subarray(j * 88, (j + 1) * 88))) }));
    if (frames.length) this.watermark = frames.at(-1)!.q;
    return frames;
  }
  finish() { return []; }
}
