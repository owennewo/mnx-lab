import test from "node:test";
import assert from "node:assert/strict";
import { AttackEvidence } from "./attack.mjs";
import { detectDSP, StreamingDetector } from "./stream.mjs";
import { harmonicDictionary, createScorer } from "./spectral.mjs";
const config = {
  fftSize: 1024,
  hopSize: 128,
  sampleRate: 8000,
  midiMin: 60,
  midiMax: 72,
  rmsFloor: 0.0001,
  maxPolyphony: 6,
  activityThreshold: 0.22,
  minFrames: 2,
  fusion: { threshold: 0.3, refractorySeconds: 0.09, associationSeconds: 0.07 },
};
test("sustain is not a second attack; consumed rises and refractory survive dropouts", () => {
  const a = new AttackEvidence(config),
    spectrum = new Float64Array(513).fill(1);
  a.push(spectrum, 1, 0.2);
  assert.equal(a.permits(0, 0.2), true);
  a.consume(0, 0.2);
  a.push(spectrum, 1, 0.22);
  assert.equal(a.permits(0, 0.22), false);
  a.push(new Float64Array(513), 0, 0.24);
  a.push(spectrum, 1, 0.26);
  assert.equal(a.permits(0, 0.26), false);
  assert.equal(a.permits(0, 0.3), true);
  assert.equal(a.permits(0, 0.4), false);
});
test("unrelated spectral rise does not automatically retrigger every pitch", () => {
  const a = new AttackEvidence(config),
    spectrum = new Float64Array(513);
  // A bin outside every harmonic neighborhood for C4, but inside A4's fundamental.
  spectrum[Math.round((440 * 1024) / 8000)] = 1;
  a.push(spectrum, 1, 0.2);
  assert.equal(a.permits(9, 0.2), true);
  assert.equal(a.permits(0, 0.2), false);
});
test("fusion events are chunk-invariant and cannot revise emitted starts using future audio", () => {
  const signal = Float32Array.from({ length: 8000 }, (_, i) =>
    i > 1600 && i < 6000 ? 0.2 * Math.sin((2 * Math.PI * 440 * i) / 8000) : 0,
  );
  const scorer = () =>
    createScorer(harmonicDictionary(config), "harmonic", config);
  const musical = (events) =>
    events.map(({ pitch, start, end, confidence, decisionSample }) => ({
      pitch,
      start,
      end,
      confidence,
      decisionSample,
    }));
  const a = detectDSP(signal, scorer(), config, 128),
    b = detectDSP(signal, scorer(), config, 777);
  assert.ok(a.events.length);
  assert.deepEqual(musical(a.events), musical(b.events));
  assert.ok(
    b.events.every(
      (e) => e.availableAt >= e.decisionSample / config.sampleRate,
    ),
  );
  const d = new StreamingDetector(scorer(), config);
  d.push(signal.slice(0, 3500));
  const starts = () =>
    d
      .finish()
      .map(({ pitch, start, decisionSample }) => ({
        pitch,
        start,
        decisionSample,
      }));
  const old = starts();
  d.push(new Float32Array(4500));
  assert.deepEqual(starts().slice(0, old.length), old);
});
