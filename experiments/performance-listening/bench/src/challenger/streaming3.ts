/** Seam3 state kernel. No score, labels, decoder, or neural-cache substitution. */
import { completedAt, reducePitch, selectedFrames } from './observation2.ts';
export const WINDOW3 = 43844;
const valid = (x: number) => { if (!Number.isFinite(x) || x < 0) throw new Error('Expected finite nonnegative time'); };
export type TimedPayload = { refersTo: number; madeAt?: number; [key: string]: unknown };
export class SerialLane3 {
  completion = 0;
  work = 0;
  history: TimedPayload[] = [];
  calls: { delivery: number; elapsed: number; completion: number; emissions: number }[] = [];
  start(cost: number, emissions: TimedPayload[] = []) {
    this.completion = 0; this.work = 0; this.history = []; this.calls = [];
    return this.call(0, cost, emissions);
  }
  call(delivery: number, elapsed: number, emissions: TimedPayload[] = []) {
    valid(delivery); valid(elapsed);
    for (const e of emissions) { valid(e.refersTo); if (e.refersTo > delivery) throw new Error('Future refersTo'); }
    const completion = completedAt(delivery, this.completion, elapsed);
    const stamped = emissions.map(e => ({ ...structuredClone(e), madeAt: completion }));
    this.completion = completion; this.work += elapsed;
    this.history.push(...structuredClone(stamped));
    this.calls.push({ delivery, elapsed, completion, emissions: emissions.length });
    return stamped;
  }
  cost(duration: number, sharedLoad = 0) {
    valid(duration); valid(sharedLoad); if (!duration) throw new Error('No ratio for zero audio');
    return { work: this.work, ratio: this.work / duration, pass: this.work / duration <= .25, sharedLoad };
  }
  /** Actual monotonic service measurement; injected costs are only oracle inputs. */
  measure(delivery: number, produce: () => TimedPayload[]) {
    const before = performance.now(), emissions = produce(), elapsed = (performance.now() - before) / 1000;
    return this.call(delivery, elapsed, emissions);
  }
}
export function prefixEqual3(a: readonly Record<string, unknown>[], b: readonly Record<string, unknown>[], cutoff: number) {
  const prefix = (rows: readonly Record<string, unknown>[]) => rows.filter(r => (r.deliverySamples as number) <= cutoff).map(r => {
    const { madeAt: _made, availableAt: _available, elapsed: _elapsed, completion: _completion, ...payload } = r;
    return payload;
  });
  // Compare structural payloads independently of object key insertion order.
  const stable = (x: unknown): unknown => Array.isArray(x) ? x.map(stable) : x && typeof x === 'object'
    ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)])) : x;
  return JSON.stringify(stable(prefix(a))) === JSON.stringify(stable(prefix(b)));
}
export type Frame3 = { q: number; audioTime: number; deliveryAt: number; deliverySamples: number; midi: number | null; confidence: number; kind: string };
export class StreamingInput3 {
  samples = 0; generated = 0; nextSamples = 4800; watermark: number | null = null;
  private input: number[] = []; private offset = 0;
  private ring = new Float32Array(WINDOW3);
  reset() { this.samples = 0; this.generated = 0; this.nextSamples = 4800; this.watermark = null; this.input = []; this.offset = 0; this.ring.fill(0); }
  get retainedInput() { return this.input.length; }
  get retainedModel() { return Math.min(this.generated, WINDOW3); }
  feed(chunk: Float32Array): { input: Float32Array; samples: number; generated: number } | null {
    for (const x of chunk) { if (!Number.isFinite(x)) throw new Error('Nonfinite audio'); }
    for (const x of chunk) this.input.push(x);
    this.samples += chunk.length;
    for (;;) {
      // Match frozen native.ts operation order before float32 tensor serialization.
      const p = this.generated * 48000 / 22050, left = Math.floor(p), fraction = p - left;
      if (left + 1 >= this.samples) break;
      const a = this.input[left - this.offset], b = this.input[left + 1 - this.offset];
      if (a === undefined || b === undefined) throw new Error('Evicted interpolation neighbor');
      this.ring[this.generated % WINDOW3] = a * (1 - fraction) + b * fraction;
      this.generated++;
    }
    const keep = Math.min(this.samples, Math.floor(this.generated * 48000 / 22050));
    this.input = this.input.slice(keep - this.offset); this.offset = keep;
    if (this.samples < this.nextSamples) return null;
    this.nextSamples = (Math.floor(this.samples / 4800) + 1) * 4800;
    return { input: this.window(), samples: this.samples, generated: this.generated };
  }
  window() {
    const result = new Float32Array(WINDOW3), count = Math.min(this.generated, WINDOW3), from = this.generated - count;
    for (let i = 0; i < count; i++) result[WINDOW3 - count + i] = this.ring[(from + i) % WINDOW3]!;
    return result;
  }
  /** Injected backend maps only. Every unpitched frame advances the watermark. */
  frames(note: Float32Array, edge: 0 | 15 = 0): Frame3[] {
    if (note.length !== 172 * 88) throw new Error('Expected 172x88 note map');
    const selected = selectedFrames(this.samples, edge, this.watermark);
    const frames = selected.indices.map((j, i) => ({ q: selected.coordinates[i]!, audioTime: selected.coordinates[i]! / 22050,
      deliveryAt: this.samples / 48000, deliverySamples: this.samples, ...reducePitch(Array.from(note.subarray(j * 88, (j + 1) * 88))) }));
    if (frames.length) this.watermark = frames.at(-1)!.q;
    return frames;
  }
  finish() { return []; } // No resampling or inference flush, no mutation of live history.
}
export function offlineLength3(length: number) {
  if (!Number.isSafeInteger(length) || length < 0) throw new Error('Invalid length');
  return { windows: Math.ceil((length + 3840) / 36164), retained: Math.floor(length * 86 / 22050),
    firstWindowTail: Math.max(0, WINDOW3 - (length + 3840)) };
}
export function normalizeLogPower3(values: number[]) {
  if (!values.length || values.some(x => !Number.isFinite(x))) throw new Error('Invalid log-power');
  const min = Math.min(...values), max = Math.max(...values) - min;
  return values.map(x => max ? (x - min) / max : 0);
}
