// Append frozen negative controls BEFORE evaluating any held-out detector.
import fs from "node:fs";
import path from "node:path";
import { readJSON, writeJSON, wav, hash } from "../evaluation/io.mjs";
const dir = path.resolve(process.argv[2]),
  manifest = readJSON(path.join(dir, "manifest.json"));
if (manifest.records.some((r) => r.category === "noise"))
  throw Error("Noise controls already exist");
for (const [index, level] of [0.0003, 0.003, 0.03].entries()) {
  const length = Math.round(2 * manifest.sampleRate),
    samples = new Float32Array(length);
  let seed = 7341 + index;
  for (let i = 0; i < length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    samples[i] = ((seed / 4294967296) * 2 - 1) * Math.sqrt(3) * level;
  }
  const id = `v6-noise-${index}`,
    file = `controls/${id}.wav`,
    bytes = wav(samples, manifest.sampleRate);
  fs.mkdirSync(path.join(dir, "controls"), { recursive: true });
  fs.writeFileSync(path.join(dir, file), bytes);
  manifest.records.push({
    id,
    category: "noise",
    actual: [],
    target: [],
    duration: 2,
    split: "evaluation",
    preset: "generated-noise",
    file,
    audioHash: hash(bytes),
    generator: {
      algorithm: "LCG uniform white noise",
      seed: 7341 + index,
      expectedRms: level,
    },
  });
}
writeJSON(path.join(dir, "manifest.json"), manifest);
