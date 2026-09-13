import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { wav, readWav } from "./io.mjs";
test("float WAV preserves exact sample values and validates its shape", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "listening-wav-"));
  try {
    const file = path.join(dir, "test.wav"),
      x = new Float32Array([0, -0.5, 0.25, 1]);
    fs.writeFileSync(file, wav(x, 22050));
    const out = readWav(file);
    assert.deepEqual(out.samples, x);
    assert.equal(out.sampleRate, 22050);
    fs.writeFileSync(file, Buffer.alloc(44));
    assert.throws(() => readWav(file));
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test("render comparison detects and measures last-bit changes without replacing inputs", async () => {
  const { compareRenders } = await import("./render-repeat.mjs");
  const { hash, writeJSON } = await import("./io.mjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "listening-repeat-"));
  try {
    for (const [side, value] of [
      ["a", 0.5],
      ["b", 0.5000000596046448],
    ]) {
      const base = path.join(dir, side);
      fs.mkdirSync(base);
      const bytes = wav(new Float32Array([0, value, 0]), 22050);
      fs.writeFileSync(path.join(base, "note.wav"), bytes);
      writeJSON(path.join(base, "manifest.json"), {
        browser: "test",
        rendererSourceHashes: {},
        records: [
          { file: "note.wav", fixtureHash: "same", audioHash: hash(bytes) },
        ],
      });
    }
    const a = path.join(dir, "a"),
      b = path.join(dir, "b");
    assert.equal(compareRenders(a, a).differentRecordings, 0);
    const diff = compareRenders(a, b);
    assert.equal(diff.differentRecordings, 1);
    assert.equal(diff.changedSamples, 1);
    assert.equal(diff.maxAbs, 2 ** -24);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
