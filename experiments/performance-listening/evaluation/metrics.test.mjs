import test from "node:test";
import assert from "node:assert/strict";
import { match, evaluate, assessment, attacks } from "./metrics.mjs";
const config = {
  pitchTolerance: 0.5,
  attackTolerance: 0.1,
  frameStep: 0.02,
  confidenceThresholds: [0, 0.5, 0.9],
};
const note = (pitch = 60, start = 0.2, end = 0.8) => ({
  pitch,
  start,
  end,
  confidence: 0.8,
  emittedAt: 0.4,
});
test("perfect predictions and empty silence are distinct", () => {
  const m = evaluate([note()], [note()], 1, config);
  assert.equal(m.onset.f1, 1);
  assert.equal(m.active.f1, 1);
  assert.equal(m.exactChordRate, 1);
  const empty = evaluate([], [], 1, config);
  assert.equal(empty.onset.f1, null);
  assert.equal(empty.exactChordRate, null);
  assert.equal(empty.silentFalseFrames, 0);
});
test("duplicate cannot gain recall and an octave is not a hit", () => {
  const m = evaluate([note()], [note(), note()], 1, config);
  assert.equal(m.onset.tp, 1);
  assert.equal(m.onset.fp, 1);
  const octave = evaluate([note()], [note(72)], 1, config);
  assert.equal(octave.onset.tp, 0);
  assert.equal(octave.octaveConfusions, 1);
  assert.equal(evaluate([note()], [], 1, config).onset.fn, 1);
});
test("maximum matching handles ambiguous adjacency where greedy fails", () => {
  assert.equal(match([0, 1], [0, 1], (a, b) => a === 0 || b === 0).length, 2);
});
test("attack tolerance is inclusive and rejection beyond it is explicit", () => {
  assert.equal(evaluate([note()], [note(60, 0.3)], 1, config).onset.tp, 1);
  assert.equal(evaluate([note()], [note(60, 0.3001)], 1, config).onset.tp, 0);
  assert.throws(
    () => evaluate([], [note(60, -1)], 1, config),
    /Invalid prediction/,
  );
});
test("unison simultaneous voices are one acoustic attack", () => {
  assert.equal(attacks([note(), note()]).length, 1);
  assert.equal(evaluate([note(), note()], [note()], 1, config).onset.recall, 1);
});
test("confidence filtering reports recall loss as well as retained predictions", () => {
  const m = evaluate(
    [note(), note(64)],
    [note(), { ...note(64), confidence: 0.2 }],
    1,
    config,
  );
  assert.equal(m.confidenceCurve[1].recall, 0.5);
  assert.equal(m.confidenceCurve[1].precision, 1);
});
test("unknown missing note is not a false accusation; real extras are measurable", () => {
  const target = [note(), note(64)];
  const unknown = assessment(target, target, [note()], config);
  assert.equal(unknown.falseAccusations, 0);
  assert.equal(unknown.unassessedTargetEvents, 1);
  const correct = assessment(
    target,
    [note(), note(65)],
    [note(), note(65)],
    config,
  );
  assert.equal(correct.correctAccusations, 1);
  assert.equal(correct.falseAccusations, 0);
  const wrong = assessment(target, target, [note(), note(65)], config);
  assert.equal(wrong.falseAccusations, 1);
});

test("a bend's active pitch follows its curve; onset remains the original pitch", () => {
  const bent = {
    ...note(60, 0.2, 0.8),
    bend: { start: 0.3, end: 0.4, cents: 200 },
  };
  const fixed = evaluate([bent], [note(60, 0.2, 0.8)], 1, config);
  assert.equal(fixed.onset.tp, 1);
  assert.ok(fixed.active.recall < 0.5);
});
