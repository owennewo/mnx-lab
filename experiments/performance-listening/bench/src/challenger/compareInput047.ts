/** Exact legacy-kernel comparison; allocation counts name explicit source operations. */
import assert from 'node:assert/strict';
import { StreamingInput3, WINDOW3 } from './streaming3.ts';
import { StreamingInput047 } from './streaming047.ts';
import { selectedFrames } from './observation2.ts';
import { sha256 } from '../io.ts';
export function compareInput047(audio: Float32Array, deliveries: readonly number[] = [480]) {
  const old = new StreamingInput3(), fresh = new StreamingInput047(); old.reset(); fresh.reset();
  const digest: { samples: number; hash: string; indices: number[]; coordinates: number[] }[] = [];
  let from = 0, feeds = 0, rawSliceElements = 0, windows = 0, modelWindow: Float32Array | null = null;
  for (let d = 0; from < audio.length; d++) {
    const size = deliveries[d % deliveries.length]!; assert(Number.isSafeInteger(size) && size >= 0);
    const chunk = audio.subarray(from, Math.min(from + size, audio.length)); from += chunk.length;
    const a = old.feed(chunk), b = fresh.feed(chunk); feeds++; rawSliceElements += old.retainedInput;
    assert.equal(!!a, !!b, `Request mismatch at ${from}`);
    assert.deepEqual([fresh.samples, fresh.generated, fresh.nextSamples, fresh.watermark, fresh.retainedInput, fresh.retainedModel],
      [old.samples, old.generated, old.nextSamples, old.watermark, old.retainedInput, old.retainedModel]);
    if (a && b) {
      windows++; assert.equal(Buffer.compare(Buffer.from(a.input.buffer), Buffer.from(b.input.buffer)), 0, `Tensor at ${from}`);
      assert.equal(a.samples, b.samples); assert.equal(a.generated, b.generated);
      if (modelWindow) assert.equal(b.input, modelWindow, 'Borrowed window identity'); modelWindow = b.input;
      const x = selectedFrames(old.samples, 0, old.watermark), y = selectedFrames(fresh.samples, 0, fresh.watermark); assert.deepEqual(x, y);
      if (x.coordinates.length) old.watermark = fresh.watermark = x.coordinates.at(-1)!;
      digest.push({ samples: from, hash: sha256(Buffer.from(b.input.buffer)), ...x });
    }
  }
  const before = [fresh.samples, fresh.generated, fresh.nextSamples, fresh.watermark, fresh.retainedInput];
  assert.deepEqual(fresh.finish(), old.finish()); assert.deepEqual(before, [fresh.samples, fresh.generated, fresh.nextSamples, fresh.watermark, fresh.retainedInput]);
  return { feeds, requests: windows, digest, baseline: { rawSliceArrays: feeds, rawSliceElements, windowArrays: windows,
    windowBytes: windows * WINDOW3 * 4, ringArrays: 1, ringBytes: WINDOW3 * 4 }, candidate: { ...fresh.allocations }, parity: true };
}
export function synthetic047() {
  const cases = [ { name: 'empty', length: 0, delivery: [480] }, { name: 'singleton', length: 1, delivery: [1] },
    { name: 'two-neighbors', length: 2, delivery: [0, 1] }, { name: 'cadence-tail', length: 4801, delivery: [480] },
    { name: 'irregular-wrapping', length: 310007, delivery: [0, 1, 479, 483, 2, 31, 997] },
    { name: 'oversized', length: 310007, delivery: [120001, 0, 40003, 1] } ];
  const rows = cases.map(c => { const x = Float32Array.from({ length: c.length }, (_, i) => i % 101 === 0 ? -0 : (i % 127 - 63) / 64);
    return { name: c.name, ...compareInput047(x, c.delivery) }; });
  const old = new StreamingInput3(), fresh = new StreamingInput047();
  const long = Float32Array.from({ length: 100003 }, (_, i) => (i % 17 - 8) / 16); old.feed(long); fresh.feed(long);
  const borrowed = fresh.window(), snapshot = borrowed.slice(); assert.deepEqual(borrowed, old.window());
  old.feed(new Float32Array(4800)); fresh.feed(new Float32Array(4800));
  assert.equal(fresh.window(), borrowed); assert.notDeepEqual(borrowed, snapshot);
  old.reset(); fresh.reset(); assert.deepEqual(fresh.window(), old.window()); assert.equal(fresh.window(), borrowed);
  const a = old.feed(Float32Array.of(-0, 1, -.5)), b = fresh.feed(Float32Array.of(-0, 1, -.5)); assert.equal(a, b);
  assert.deepEqual(fresh.window(), old.window());
  for (const bad of [NaN, Infinity, -Infinity]) {
    const before = [fresh.samples, fresh.generated, fresh.retainedInput, sha256(Buffer.from(fresh.window().buffer))];
    assert.throws(() => fresh.feed(Float32Array.of(.25, bad)), /Nonfinite/); assert.throws(() => old.feed(Float32Array.of(.25, bad)), /Nonfinite/);
    assert.deepEqual(before, [fresh.samples, fresh.generated, fresh.retainedInput, sha256(Buffer.from(fresh.window().buffer))]);
  }
  return { cases: rows, resetIsolation: true, borrowedLifecycle: true, invalidInputs: 3, invalidBeforeMutation: true };
}
