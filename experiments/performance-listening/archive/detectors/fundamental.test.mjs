import test from "node:test";
import assert from "node:assert/strict";
import { createFundamentalSupport } from "./fundamental.mjs";
import { readJSON } from "../evaluation/io.mjs";
import { createScorer, harmonicDictionary } from "./spectral.mjs";
import { detectDSP } from "./stream.mjs";
const base = readJSON(new URL("../experiments/baseline.json", import.meta.url));
const config = {
  ...base,
  fundamental: {
    strength: 1,
    minContrast: 4,
    fullContrast: 16,
    relativeAmplitudeFloor: 0.002,
  },
};
function spectrum(pitches) {
  const m = new Float64Array(2049).fill(0.001);
  for (const pitch of pitches) {
    const k = (440 * 2 ** ((pitch - 69) / 12) * 4096) / 22050;
    for (let j = Math.floor(k) - 2; j <= Math.ceil(k) + 2; j++)
      m[j] += 10 * Math.exp(-0.5 * ((j - k) / 0.6) ** 2);
  }
  return m;
}
test("credible fundamental protects a candidate; flat background and absent fundamentals do not", () => {
  const apply = createFundamentalSupport(config),
    p = new Float64Array(49).fill(0.5);
  for (const [m, expected] of [
    [spectrum([40]), 0.5],
    [spectrum([52, 59]), 0],
    [new Float64Array(2049).fill(1), 0],
  ]) {
    const w = new Float64Array(49);
    apply(w, p, m, 0.1);
    assert.equal(w[0], expected);
  }
});
test("support preserves bypass and existing evidence, respects scale, and avoids explaining a lower note harmonic twice", () => {
  const p = new Float64Array(49).fill(0.5),
    m = spectrum([40, 52]),
    apply = createFundamentalSupport(config);
  const a = new Float64Array(49),
    b = new Float64Array(49);
  a[0] = b[0] = 0.6;
  a[12] = b[12] = 0.1;
  apply(a, p, m, 0.1);
  apply(
    b,
    p,
    Float64Array.from(m, (v) => v * 0.02),
    0.002,
  );
  assert.deepEqual(a, b);
  assert.equal(a[12], 0.1);
  const w = new Float64Array(49).fill(0.3),
    copy = w.slice();
  createFundamentalSupport(base)(w, p, m, 0.1);
  assert.deepEqual(w, copy);
});
test("fundamental evidence respects causal prefixes and chunk invariance", () => {
  const c = {
    ...config,
    fusion: {
      threshold: 0.15,
      refractorySeconds: 0.09,
      associationSeconds: 0.035,
      mode: "restrike-only",
      neighborRatio: 1,
    },
  };
  const x = Float32Array.from({ length: 22050 }, (_, i) =>
    i < 3000 || i > 18000
      ? 0
      : 0.003 * Math.sin((2 * Math.PI * 82.4 * i) / 22050) +
        0.1 * Math.sin((2 * Math.PI * 164.8 * i) / 22050) +
        0.08 * Math.sin((2 * Math.PI * 247.2 * i) / 22050),
  );
  const run = (a, size) =>
    detectDSP(a, createScorer(harmonicDictionary(c), "harmonic", c), c, size)
      .events;
  const id = (ns) => ns.map(({ availableAt, emittedAt, ...n }) => n);
  const full = run(x, 256);
  assert.deepEqual(id(full), id(run(x, 2048)));
  const cut = 12032,
    starts = (ns) =>
      ns
        .filter((n) => n.decisionSample <= cut)
        .map((n) => [n.pitch, n.start, n.decisionSample, n.kind]);
  assert.deepEqual(starts(full), starts(run(x.subarray(0, cut), 256)));
});
