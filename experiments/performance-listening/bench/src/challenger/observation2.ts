/** Pure seam-2 arithmetic. No model inference, listener or mutable timing state. */
const RATE = 22050, WINDOW = 43844;
function nonnegative(value: number) {
  if (!Number.isFinite(value) || value < 0) throw new Error('Expected finite nonnegative value');
}
function integer(value: number) {
  nonnegative(value);
  if (!Number.isSafeInteger(value)) throw new Error('Expected safe integer');
}
export function resampledLength(samples: number): number {
  integer(samples);
  return samples < 2 ? 0 : Math.ceil((samples - 1) * 147 / 320);
}
export function interpolation(samples: number, j: number) {
  integer(samples); integer(j);
  const p = j * 320 / 147, left = Math.floor(p), right = left + 1;
  return right < samples ? { exists: true, left, right, value: left * (1 - (p - left)) + right * (p - left) } : { exists: false };
}
export function completedAt(delivery: number, previous: number, elapsedSeconds: number): number {
  [delivery, previous, elapsedSeconds].forEach(nonnegative);
  return Math.max(delivery, previous) + elapsedSeconds;
}
export function selectedFrames(samples: number, edge: 0 | 15, last: number | null) {
  const start = resampledLength(samples) - WINDOW, indices: number[] = [], coordinates: number[] = [];
  if (edge !== 0 && edge !== 15) throw new Error('Unsupported edge policy');
  if (last !== null) integer(last);
  for (let j = 0; j < 172 - edge; j++) {
    const q = start + 256 * j;
    if (q < 0 || q <= (last ?? -Infinity) || q / RATE > samples / 48000) continue;
    indices.push(j); coordinates.push(q);
  }
  return { indices, coordinates };
}
export function batch(samples: number, edge: 0 | 15, last: number | null, previous: number, costMs: number) {
  const deliveryAt = samples / 48000, availableAt = completedAt(deliveryAt, previous, costMs / 1000);
  return { ...selectedFrames(samples, edge, last), deliveryAt, availableAt, madeAt: availableAt };
}
export function reducePitch(note: readonly number[]) {
  if (note.length !== 88 || note.some(x => !Number.isFinite(x) || x < 0 || x > 1)) throw new Error('Expected 88 unit activations');
  let bin = 0;
  for (let b = 1; b < 88; b++) if (note[b]! > note[bin]!) bin = b;
  const confidence = note[bin]!;
  return confidence >= .3 ? { midi: 21 + bin, confidence, kind: 'pitched' } : { midi: null, confidence, kind: 'unpitched' };
}
export function offlineTrim(length: number, windows: number) {
  integer(length); integer(windows);
  const retained = Math.floor(length * 86 / RATE), available = windows * 142;
  if (retained > available) throw new Error('Insufficient offline windows');
  return { retained, available, discardedTail: available - retained };
}
export function decoderTime(index: number) {
  integer(index);
  return index * 256 / RATE - Math.floor(index / 172) * (188 / RATE + .0018);
}
export function offlineFrame(index: number) {
  integer(index);
  const window = Math.floor(index / 142), raw = 15 + index % 142;
  const gridTime = (256 * index - 188 * window) / RATE, time = decoderTime(index);
  return { window, raw, gridTime, decoderTime: time, difference: time - gridTime };
}
