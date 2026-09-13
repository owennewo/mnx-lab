import test from "node:test";
import assert from "node:assert/strict";
import { MicrophonePolicy } from "./policy.mjs";
import { StreamingDetector } from "../detectors/stream.mjs";
const base = {
  sampleRate: 22050,
  hopSize: 256,
  fftSize: 4096,
  midiMin: 69,
  midiMax: 69,
  minFrames: 2,
  rmsFloor: 0.0001,
  activityThreshold: 0.22,
};
test("background is measured on full windows, then frozen; calibration cannot emit notes", () => {
  const c = { ...base },
    p = new MicrophonePolicy(c),
    run = p.wrap((_m, rms) => Float64Array.of(rms < c.rmsFloor ? 0 : 1));
  for (let i = 0; i < p.calibrationFrames; i++)
    assert.equal(run([], 0.001)[0], 0);
  assert.equal(p.calibrated, true);
  assert.ok(Math.abs(c.rmsFloor - 0.001 * 10 ** 0.6) < 1e-12);
  assert.equal(run([], 0.003)[0], 0);
  assert.equal(run([], 0.01)[0], 1);
  const floor = c.rmsFloor;
  for (let i = 0; i < 200; i++) run([], 0.1);
  assert.equal(c.rmsFloor, floor);
  assert.equal(c.minFrames, 8);
  assert.ok(Math.abs(p.summary().confirmationSpanMs - 81.26984127) < 1e-6);
});
test("longer confirmation rejects brief candidate evidence and preserves causal decision time", () => {
  const c = { ...base },
    p = new MicrophonePolicy(c, { marginDb: 0, confirmationMs: 75 });
  let frame = 0;
  const scorer = p.wrap(() =>
    Float64Array.of(++frame <= 5 || frame >= 8 ? 1 : 0),
  );
  const d = new StreamingDetector(scorer, c);
  d.push(new Float32Array(14 * c.hopSize));
  assert.equal(d.events.length, 0);
  d.push(new Float32Array(c.hopSize));
  assert.equal(d.events.length, 1);
  assert.equal(d.events[0].decisionSample, 15 * c.hopSize);
});
test("original settings bypass calibration and retain original confirmation/floor; runs are independent", () => {
  const c = { ...base },
    p = new MicrophonePolicy(c, { marginDb: 0, confirmationMs: 0 });
  assert.equal(p.wrap(() => Float64Array.of(1))([], 0)[0], 1);
  assert.equal(c.minFrames, 2);
  assert.equal(c.rmsFloor, base.rmsFloor);
  assert.equal(new MicrophonePolicy({ ...base }).calibrated, false);
  assert.throws(
    () => new MicrophonePolicy({ ...base }, { confirmationMs: -1 }),
  );
});
