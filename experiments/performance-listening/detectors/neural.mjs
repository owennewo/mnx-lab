import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import * as tf from "@tensorflow/tfjs";
import {
  BasicPitch,
  outputToNotesPoly,
  noteFramesToTime,
} from "@spotify/basic-pitch";
import { hash } from "../evaluation/io.mjs";
const require = createRequire(import.meta.url);
export async function createNeural(config) {
  await tf.setBackend("cpu");
  await tf.ready();
  const base = path.join(
    path.dirname(require.resolve("@spotify/basic-pitch/package.json")),
    "model",
  );
  const json = fs.readFileSync(path.join(base, "model.json")),
    modelJSON = JSON.parse(json);
  const parts = modelJSON.weightsManifest.flatMap((g) =>
    g.paths.map((p) => fs.readFileSync(path.join(base, p))),
  );
  const bytes = Buffer.concat(parts);
  const model = await tf.loadGraphModel({
    load: async () => ({
      modelTopology: modelJSON.modelTopology,
      weightSpecs: modelJSON.weightsManifest.flatMap((g) => g.weights),
      weightData: bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ),
    }),
  });
  const engine = new BasicPitch(Promise.resolve(model));
  return {
    provenance: {
      package: "@spotify/basic-pitch",
      version: "1.0.1",
      backend: tf.getBackend(),
      tfjs: tf.version.tfjs,
      license: "Apache-2.0",
      modelHash: hash(json),
      weightsHash: hash(bytes),
      mode: "offline-only",
      windowSeconds: 2,
      confidence: "uncalibrated mean frame activation",
    },
    async detect(samples) {
      let frames = [],
        onsets = [];
      // The upstream JS evaluator leaves intermediate tensors alive. Own a scope per
      // serial inference call; the model was created outside it and remains retained.
      tf.engine().startScope();
      const start = performance.now();
      try {
        await engine.evaluateModel(
          samples,
          (f, o) => {
            frames.push(...f);
            onsets.push(...o);
          },
          () => {},
        );
        const notes = noteFramesToTime(
          outputToNotesPoly(
            frames,
            onsets,
            config.neural.onsetThreshold,
            config.neural.frameThreshold,
            config.neural.minNoteFrames,
            true,
            null,
            null,
            true,
          ),
        );
        const cpuMs = performance.now() - start,
          duration = samples.length / config.sampleRate;
        return {
          events: notes.map((n) => ({
            pitch: n.pitchMidi,
            start: Math.max(0, n.startTimeSeconds),
            end: Math.max(0, n.startTimeSeconds + n.durationSeconds),
            confidence: n.amplitude,
            availableAt: duration,
            emittedAt: duration + cpuMs / 1000,
          })),
          cpuMs,
          realTimeFactor: cpuMs / 1000 / duration,
          maxBacklog: null,
        };
      } finally {
        tf.engine().endScope();
      }
    },
    dispose() {
      model.dispose();
    },
  };
}
