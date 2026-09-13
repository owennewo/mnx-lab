import FFT from "fft.js";
import { spectrogramFrame } from "./spectral.mjs";
// The detector only receives chunks. It cannot inspect the recording or its labels.
export class StreamingDetector {
  constructor(scorer, config) {
    this.scorer = scorer;
    this.config = config;
    this.fft = new FFT(config.fftSize);
    this.received = 0;
    this.next = config.hopSize;
    this.buffer = new Float32Array(config.fftSize);
    this.active = new Map();
    this.events = [];
    this.frames = [];
  }
  push(chunk) {
    const c = this.config;
    for (const sample of chunk) {
      this.buffer[this.received % c.fftSize] = sample;
      this.received++;
      if (this.received !== this.next) continue;
      const ordered = Float32Array.from(
        { length: c.fftSize },
        (_, i) => this.buffer[(this.received + i) % c.fftSize],
      );
      const { magnitude, rms } = spectrogramFrame(
        ordered,
        c.fftSize,
        c,
        this.fft,
      );
      const scores = this.scorer(magnitude, rms);
      const time = Math.max(0, (this.received - c.fftSize / 2) / c.sampleRate);
      const available = this.received / c.sampleRate;
      this.frames.push({ time, available, scores: Array.from(scores) });
      for (let i = 0; i < scores.length; i++) {
        const pitch = c.midiMin + i,
          score = scores[i];
        let state = this.active.get(pitch);
        if (score >= c.activityThreshold) {
          if (!state) {
            state = {
              pitch,
              start: time,
              end: time,
              confidence: score,
              count: 0,
              decisionSample: null,
            };
            this.active.set(pitch, state);
          }
          state.count++;
          state.end = time + c.hopSize / c.sampleRate;
          state.confidence = Math.max(state.confidence, score);
          if (state.count === c.minFrames) {
            state.decisionSample = this.received;
            this.events.push(state);
          }
        } else this.active.delete(pitch);
      }
      this.next += c.hopSize;
    }
  }
  finish() {
    return this.events.map(({ count, decisionSample, ...e }) => ({
      ...e,
      decisionSample,
    }));
  }
}
export function detectDSP(samples, scorer, config, chunkSize) {
  const detector = new StreamingDetector(scorer, config),
    timeline = [];
  let completion = 0,
    cpuMs = 0;
  for (let offset = 0; offset < samples.length; offset += chunkSize) {
    const end = Math.min(samples.length, offset + chunkSize),
      arrival = end / config.sampleRate;
    const before = performance.now();
    detector.push(samples.subarray(offset, end));
    const cost = (performance.now() - before) / 1000;
    completion = Math.max(completion, arrival) + cost;
    cpuMs += cost * 1000;
    timeline.push({ end, arrival, completion, cost });
  }
  const events = detector.finish().map((e) => {
    const chunk =
      timeline[
        Math.min(
          timeline.length - 1,
          Math.ceil(e.decisionSample / chunkSize) - 1,
        )
      ];
    return { ...e, availableAt: chunk.arrival, emittedAt: chunk.completion };
  });
  return {
    events,
    cpuMs,
    realTimeFactor: cpuMs / 1000 / (samples.length / config.sampleRate),
    maxBacklog: Math.max(0, ...timeline.map((c) => c.completion - c.arrival)),
    frames: detector.frames.length,
  };
}
