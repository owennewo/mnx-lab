import test from "node:test";
import assert from "node:assert/strict";
import { StreamingDetector, detectDSP } from "./stream.mjs";
import { harmonicDictionary, createScorer } from "./spectral.mjs";
const c = {
  fftSize: 1024,
  hopSize: 128,
  sampleRate: 8000,
  midiMin: 60,
  midiMax: 72,
  minFrames: 2,
  activityThreshold: 0.22,
  rmsFloor: 0.0001,
  maxPolyphony: 6,
};
const signal = Float32Array.from({ length: 8000 }, (_, i) =>
  i >= 1600 && i < 5000 ? Math.sin((2 * Math.PI * 440 * i) / 8000) * 0.2 : 0,
);
const scorer = () => createScorer(harmonicDictionary(c), "harmonic", c);
test("pure tone supplies independently known pitch and silence emits nothing", () => {
  const out = detectDSP(signal, scorer(), c, 128);
  assert.ok(out.events.some((n) => n.pitch === 69));
  assert.equal(
    detectDSP(new Float32Array(8000), scorer(), c, 128).events.length,
    0,
  );
});
test("different chunk boundaries preserve musical output, availability respects chunks", () => {
  const a = detectDSP(signal, scorer(), c, 128),
    b = detectDSP(signal, scorer(), c, 777);
  const musical = (out) =>
    out.events.map(({ pitch, start, end, confidence }) => ({
      pitch,
      start,
      end,
      confidence,
    }));
  assert.deepEqual(musical(a), musical(b));
  assert.ok(
    b.events.every(
      (e) =>
        e.availableAt >= e.decisionSample / c.sampleRate &&
        e.emittedAt >= e.availableAt,
    ),
  );
});
test("future suffix cannot alter evidence already emitted", () => {
  const a = new StreamingDetector(scorer(), c),
    b = new StreamingDetector(scorer(), c);
  a.push(signal.slice(0, 3500));
  b.push(signal.slice(0, 3500));
  const before = structuredClone(a.frames);
  const starts = (detector) =>
    detector
      .finish()
      .map(({ pitch, start, decisionSample }) => ({
        pitch,
        start,
        decisionSample,
      }));
  const emitted = starts(a);
  assert.deepEqual(a.frames, b.frames);
  a.push(signal.slice(3500));
  b.push(new Float32Array(4500));
  assert.deepEqual(a.frames.slice(0, before.length), before);
  assert.deepEqual(b.frames.slice(0, before.length), before);
  assert.deepEqual(starts(a).slice(0, emitted.length), emitted);
  assert.deepEqual(starts(b).slice(0, emitted.length), emitted);
});

test("nonnegative template solver separates a known overlapping dictionary", () => {
  const q = Math.SQRT1_2;
  const score = createScorer(
    [new Float64Array([1, 0, 0]), new Float64Array([q, q, 0])],
    "template",
    { ...c, templateIterations: 64 },
  );
  const weights = score(new Float64Array([2, 1, 0]), 1);
  assert.ok(Math.abs(weights[0] - 1 / Math.sqrt(5)) < 1e-6);
  assert.ok(Math.abs(weights[1] - Math.sqrt(2 / 5)) < 1e-6);
});
