import base from "../experiments/baseline.json";
import { StreamingDetector } from "../detectors/stream.mjs";
import { harmonicDictionary, createScorer } from "../detectors/spectral.mjs";
let detector, config, chunks, sent, samples, cpuMs;
self.onmessage = ({ data }) => {
  try {
    if (data.type === "init") {
      config = {
        ...base,
        fusion: {
          threshold: 0.15,
          refractorySeconds: 0.09,
          associationSeconds: 0.035,
          mode: "restrike-only",
          neighborRatio: 1,
        },
        ...(data.recipe === "F-006"
          ? {
              fundamental: {
                strength: 0.75,
                minContrast: 4,
                fullContrast: 16,
                relativeAmplitudeFloor: 0.002,
              },
            }
          : {}),
      };
      detector = new StreamingDetector(
        createScorer(harmonicDictionary(config), "harmonic", config),
        config,
      );
      chunks = [];
      sent = 0;
      samples = 0;
      cpuMs = 0;
      self.postMessage({ type: "ready", config });
    } else if (data.type === "audio") {
      const start = performance.now();
      detector.push(data.samples);
      cpuMs += performance.now() - start;
      chunks.push(data.samples);
      samples += data.samples.length;
      let sum = 0,
        peak = 0;
      for (const x of data.samples) {
        sum += x * x;
        peak = Math.max(peak, Math.abs(x));
      }
      self.postMessage({
        type: "update",
        samples,
        cpuMs,
        rms: Math.sqrt(sum / data.samples.length),
        peak,
        active: [...detector.active.values()]
          .filter((e) => e.decisionSample !== null)
          .map((e) => e.pitch),
        events: detector.events
          .slice(sent)
          .map((e) => ({
            ...e,
            detectedAt: e.decisionSample / config.sampleRate,
          })),
      });
      sent = detector.events.length;
      detector.frames.length = 0; // Frame scores are not an unbounded live recording.
    } else if (data.type === "finish") {
      const pcm = new Float32Array(samples);
      let offset = 0;
      for (const chunk of chunks) {
        pcm.set(chunk, offset);
        offset += chunk.length;
      }
      self.postMessage(
        { type: "finished", pcm, config, events: detector.finish(), cpuMs },
        [pcm.buffer],
      );
      chunks = [];
    }
  } catch (error) {
    self.postMessage({ type: "error", message: error.message });
  }
};
