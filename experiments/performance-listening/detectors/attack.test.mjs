import test from "node:test";
import assert from "node:assert/strict";
import { AttackEvidence, attributedAttack } from "./attack.mjs";
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
    d.finish().map(({ pitch, start, decisionSample }) => ({
      pitch,
      start,
      decisionSample,
    }));
  const old = starts();
  d.push(new Float32Array(4500));
  assert.deepEqual(starts().slice(0, old.length), old);
});

for (const attribution of [
  {},
  { neighborRatio: 1 },
  { neighborRatio: 1.5 },
  { neighborRatio: 1, harmonicRatio: 1 },
])
  test(`re-strike-only preserves parent/prefix/chunks with neighbour ratio ${JSON.stringify(attribution)}`, () => {
    const c = {
      ...config,
      fusion: { ...config.fusion, mode: "restrike-only", ...attribution },
    };
    const samples = Float32Array.from({ length: 12000 }, (_, i) => {
      if (i < 1600 || i >= 10000) return 0;
      const amplitude = i < 4800 ? 0.06 : i < 7200 ? 0.25 : 0.5;
      return amplitude * Math.sin((2 * Math.PI * 440 * i) / c.sampleRate);
    });
    const scorer = () => createScorer(harmonicDictionary(c), "harmonic", c);
    const parent = detectDSP(
      samples,
      scorer(),
      { ...c, fusion: undefined },
      128,
    );
    const a = detectDSP(samples, scorer(), c, 128),
      b = detectDSP(samples, scorer(), c, 777);
    const musical = (events) =>
      events.map(({ pitch, start, end, confidence, decisionSample, kind }) => ({
        pitch,
        start,
        end,
        confidence,
        decisionSample,
        kind,
      }));
    assert.deepEqual(
      musical(a.events.filter((e) => !e.kind)),
      musical(parent.events),
    );
    assert.deepEqual(musical(a.events), musical(b.events));
    const extra = a.events.filter((e) => e.kind === "restrike");
    assert.ok(
      extra.length,
      "rises during sustained pitch must exercise extra attacks",
    );
    assert.ok(
      extra.every((e) =>
        parent.events.some(
          (p) => p.pitch === e.pitch && p.start <= e.start && p.end >= e.end,
        ),
      ),
    );
    const d = new StreamingDetector(scorer(), c);
    d.push(samples.slice(0, 8000));
    const starts = () =>
      d.finish().map(({ pitch, start, decisionSample }) => ({
        pitch,
        start,
        decisionSample,
      }));
    const old = starts();
    d.push(new Float32Array(4000));
    assert.deepEqual(starts().slice(0, old.length), old);
  });

test("attack competition uses both neighbours, preserves ties at ratio one, and is opt-in", () => {
  assert.equal(attributedAttack([0.3, 0.25, 0.8], 1, {}), true);
  assert.equal(
    attributedAttack([0.3, 0.25, 0.8], 1, { neighborRatio: 1 }),
    false,
  );
  assert.equal(
    attributedAttack([0.4, 0.4, 0.2], 1, { neighborRatio: 1 }),
    true,
  );
  assert.equal(
    attributedAttack([0.4, 0.4, 0.2], 1, { neighborRatio: 1.5 }),
    false,
  );
  assert.equal(attributedAttack([0.6, 0.2], 0, { neighborRatio: 1.5 }), true);
  assert.equal(attributedAttack([0.2, 0.6], 1, { neighborRatio: 1.5 }), true);
});

test("harmonic attribution is opt-in and rejects weaker upper hypotheses for each tested partial", () => {
  for (const offset of [12, 19, 24, 28, 31]) {
    const scores = new Float64Array(49);
    scores[40] = 0.3;
    scores[40 - offset] = 0.7;
    assert.equal(attributedAttack(scores, 40, { neighborRatio: 1 }), true);
    assert.equal(
      attributedAttack(scores, 40, { neighborRatio: 1, harmonicRatio: 1 }),
      false,
    );
    scores[40] = 0.7;
    assert.equal(attributedAttack(scores, 40, { harmonicRatio: 1 }), true);
  }
  assert.equal(attributedAttack([0.6, 0.2], 0, { harmonicRatio: 1 }), true);
});
