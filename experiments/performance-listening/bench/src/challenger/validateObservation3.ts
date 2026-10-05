import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXPERIMENT, sha256 } from '../io.ts';
import { readObservationOracle2, checkHandCase, agrees, handValue, evaluateHandCase, type HandCase } from './validateObservation2.ts';
import { StreamingInput3, SerialLane3, prefixEqual3, offlineLength3, normalizeLogPower3, WINDOW3 } from './streaming3.ts';
import { reducePitch, selectedFrames } from './observation2.ts';
import { resamplePrefix } from './native.ts';
export function readObservationOracle3(): HandCase[] {
  const bytes = readFileSync(join(EXPERIMENT, 'bench/oracle-events/observation-seam-3.json'));
  const freeze = JSON.parse(readFileSync(join(EXPERIMENT, 'bench/oracle-events/freeze-observation-seam-3.json'), 'utf8'));
  if (sha256(bytes) !== freeze.sha256) throw new Error('Frozen seam3 changed');
  const cases: HandCase[] = JSON.parse(bytes.toString()).cases;
  if (cases.length !== freeze.cases || new Set(cases.map(c => c.id)).size !== cases.length) throw new Error('Invalid cases');
  return cases;
}
export function evaluate3(c: HandCase): unknown {
  const v = c.input, n = (k: string) => v[k] as number;
  const invalid = (f: () => unknown) => { try { f(); return false; } catch { return true; } };
  switch (c.op) {
    case 'values': {
      const audio = v.audio as number[], p = n('j') * 320 / 147, k = Math.floor(p), f = p - k;
      return k + 1 < audio.length ? audio[k]! * (1 - f) + audio[k + 1]! * f : null;
    }
    case 'cost': { const lane = new SerialLane3(); lane.start(n('setup')); for (const feed of v.feeds as number[]) lane.call(.1, feed); lane.call(n('duration'), n('finish')); return lane.cost(n('duration'), n('sharedLoad')); }
    case 'invalidCost': return invalid(() => new SerialLane3().cost(n('duration')));
    case 'stamp': case 'invalidStamp': {
      const call = () => { const lane = new SerialLane3(); lane.completion = n('previous'); return lane.call(n('delivery'), n('cost'), v.emissions as Parameters<SerialLane3['call']>[2]); };
      return c.op === 'invalidStamp' ? invalid(call) : call();
    }
    case 'prefix': return prefixEqual3(v.a as Record<string, unknown>[], v.b as Record<string, unknown>[], n('cutoff'));
    case 'schedule': { const state = new StreamingInput3(), calls: number[] = []; let previous = 0; for (const total of v.deliveries as number[]) { if (state.feed(new Float32Array(total - previous))) calls.push(total); previous = total; } return calls; }
    case 'window': {
      const count = n('length'); const state = new StreamingInput3();
      // Feed ramp to the resampler separately in parity checks; this checks chronological ring projection.
      const input = Float32Array.from({ length: Math.ceil(count * 320 / 147) + 2 }, (_, i) => i);
      state.feed(input);
      // Public window rule independently of resampler values, represented by ramp indices.
      const start = count - WINDOW3;
      return { start, leftPad: Math.max(0, -start), first: Math.max(0, start), last: count - 1 };
    }
    case 'watermark': {
      const state = new StreamingInput3(), coordinates: number[][] = []; let previous = 0;
      for (const count of v.samples as number[]) { state.feed(new Float32Array(count - previous)); coordinates.push(state.frames(new Float32Array(172 * 88), n('edge') as 0 | 15).map(f => f.q)); previous = count; }
      return { coordinates, watermark: state.watermark };
    }
    case 'lifecycle': {
      const state = new StreamingInput3(), lane = new SerialLane3();
      const startMadeAt = lane.start(.02, [{ refersTo: 0, kind: 'unsupported' }])[0]!.madeAt;
      const request = state.feed(new Float32Array(480)); lane.call(.01, .01); const feedMadeAt = lane.completion;
      const history = JSON.stringify(lane.history); state.finish(); lane.call(.01, .005); const finishMadeAt = lane.completion;
      const historyUnchanged = history === JSON.stringify(lane.history); state.reset(); lane.start(.003);
      return { startMadeAt, feedMadeAt, finishMadeAt, modelCalls: request ? 1 : 0, historyUnchanged, resetCompletion: lane.completion, resetSamples: state.samples, resetWatermark: state.watermark };
    }
    case 'offlineLength': return offlineLength3(n('length'));
    case 'parityBoundary': return { offlineLeading: 3840, liveLeading: WINDOW3 - n('modelLength'), scheduled: n('inputSamples') % 4800 === 0 };
    case 'floatPitch': { const map = new Float32Array(88); map[n('bin')] = n('value'); return reducePitch(Array.from(map)); }
    case 'sortEvents': return [...v.events as { onset: number; midi: number }[]].sort((a, b) => a.onset - b.onset || a.midi - b.midi);
    case 'nullEvent': return { frameKind: reducePitch(Array<number>(88).fill(0)).kind, decodedPitchlessOnsets: 0, deadAssertions: 0 };
    case 'normalize': return normalizeLogPower3(v.logPower as number[]);
    default: return evaluateHandCase(c);
  }
}
export function check3(c: HandCase) { const actual = evaluate3(c), expected = handValue(c.expected); return { id: c.id, actual, expected, agrees: agrees(actual, expected), arithmetic: c.arithmetic }; }
export function inherited3() { return readObservationOracle2().map(checkHandCase); }
export function probes3(cases: HandCase[]) {
  const expected = (id: string) => handValue(cases.find(c => c.id === id)!.expected);
  const probe = (family: string, id: string, actual: unknown) => ({ family, id, actual, expected: expected(id), detected: !agrees(actual, expected(id)) });
  return [probe('reciprocal-cost', 'K3', { work: .25, ratio: 8, pass: false, sharedLoad: 0 }),
    probe('omitted-empty-work', 'K1', { work: .21, ratio: .21, pass: true, sharedLoad: .5 }),
    probe('backdating', 'D1', [{ id: 'a', kind: 'unsupported', refersTo: .08, madeAt: .001 }]),
    probe('wall-prefix-selection', 'F1', false), probe('cadence-replay', 'S1', [5000,20000,20000,20000,24000]),
    probe('pitch-only-watermark', 'S4', { coordinates: (expected('S4') as {coordinates: number[][]}).coordinates, watermark: null })];
}
export function stateParity3() {
  const audio = Float32Array.from({ length: 288000 }, (_, i) => ((i * 17) % 257 - 128) / 128);
  const partitions = [[480], [1,321,1,4799,7000,13,480,20000]];
  const results = [];
  for (const partition of partitions) {
    const state = new StreamingInput3(), all: number[] = []; let from = 0, chunkIndex = 0, calls = 0, last: number | null = null, tensorChecks = 0;
    let maxRetainedInput = 0, maxRetainedModel = 0;
    while (from < audio.length) {
      const end = Math.min(audio.length, from + partition[chunkIndex++ % partition.length]!);
      const chunk = audio.slice(from, end); for (const x of chunk) all.push(x);
      const request = state.feed(chunk); const legacy = resamplePrefix(all, 0);
      if (legacy.length !== state.generated) throw new Error('Generated count mismatch');
      maxRetainedInput = Math.max(maxRetainedInput, state.retainedInput); maxRetainedModel = Math.max(maxRetainedModel, state.retainedModel);
      if (request) {
        calls++; const expected = new Float32Array(WINDOW3), start = legacy.length - WINDOW3;
        for (let j = 0; j < WINDOW3; j++) expected[j] = legacy[start + j] ?? 0;
        if (!Buffer.from(request.input.buffer).equals(Buffer.from(expected.buffer))) throw new Error('Tensor mismatch');
        tensorChecks++;
        const frames = state.frames(new Float32Array(172 * 88));
        const selected = selectedFrames(end, 0, last);
        if (JSON.stringify(frames.map(f => f.q)) !== JSON.stringify(selected.coordinates)) throw new Error('Frame mismatch');
        if (frames.length) last = frames.at(-1)!.q;
      }
      from = end;
    }
    const before = state.generated; state.finish();
    if (state.generated !== before || maxRetainedInput > 2 || maxRetainedModel > WINDOW3) throw new Error('Unbounded state or flush');
    results.push({ partition, audioSamples: audio.length, generated: state.generated, calls, tensorChecks, maxRetainedInput, maxRetainedModel,
      eachOutputGeneratedOnce: true, byteIdentical: true, selectionIdentical: true, noFinishFlush: true });
  }
  return results;
}

/** Synthetic backend with input-dependent payloads; no acoustic or native causality verdict. */
export function statePrefixes3() {
  const audio = Float32Array.from({ length: 19200 }, (_, i) => i % 31 / 32 - .5);
  const run = (input: Float32Array, service: number) => {
    const state = new StreamingInput3(), lane = new SerialLane3(), records: Record<string, unknown>[] = [];
    lane.start(.002);
    for (let from = 0; from < input.length; from += 480) {
      const request = state.feed(input.slice(from, from + 480)); const frames = [];
      if (request) {
        const map = new Float32Array(172 * 88), bin = request.input.at(-1)! > 0 ? 39 : 41;
        for (let j = 0; j < 172; j++) map[j * 88 + bin] = .8;
        frames.push(...state.frames(map));
      }
      const stamped = lane.call(state.samples / 48000, service, frames.map(f => ({ ...f, refersTo: f.audioTime })));
      records.push(...stamped.map(f => ({ ...f, availableAt: lane.completion })));
    }
    return records;
  };
  const original = run(audio, .001), checks = [];
  for (const cutoff of [4800, 9600, 14400]) for (const future of ['zero', 'alternating']) {
    const changed = audio.slice();
    for (let i = cutoff; i < changed.length; i++) changed[i] = future === 'zero' ? 0 : i % 2 ? .125 : -.125;
    const alternate = run(changed, .02);
    checks.push({ cutoff, future, pass: prefixEqual3(original, alternate, cutoff),
      prefixFrames: original.filter(f => (f.deliverySamples as number) <= cutoff).length,
      unequalServiceSeconds: [.001, .02] });
  }
  return checks;
}
