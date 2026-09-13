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
