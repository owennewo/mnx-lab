import { hz } from "./spectral.mjs";
// Causal, pitch-local positive spectral flux. No extra FFT or score/truth access.
export class AttackEvidence {
  constructor(config) {
    this.config = config;
    this.previous = new Float64Array(config.fftSize / 2 + 1);
    this.bands = Array.from(
      { length: config.midiMax - config.midiMin + 1 },
      (_, i) => {
        const bins = [];
        for (let h = 1; h <= 6; h++) {
          const center = Math.round(
            (hz(config.midiMin + i) * h * config.fftSize) / config.sampleRate,
          );
          for (let k = center - 1; k <= center + 1; k++)
            if (k > 0 && k < this.previous.length) bins.push([k, 1 / h]);
        }
        return bins;
      },
    );
    this.above = this.bands.map(() => false);
    this.crossing = this.bands.map(() => -Infinity);
    this.consumed = this.bands.map(() => -Infinity);
    this.lastStart = this.bands.map(() => -Infinity);
  }
  push(magnitude, rms, time) {
    this.bands.forEach((bins, i) => {
      let rise = 0,
        energy = 0;
      for (const [k, weight] of bins) {
        rise += Math.max(0, magnitude[k] - this.previous[k]) * weight;
        energy += magnitude[k] * weight;
      }
      const above =
        rms >= this.config.rmsFloor &&
        energy > 0 &&
        rise / energy >= this.config.fusion.threshold;
      if (above && !this.above[i]) this.crossing[i] = time;
      this.above[i] = above;
    });
    this.previous.set(magnitude);
  }
  permits(i, time) {
    return (
      this.crossing[i] > this.consumed[i] &&
      time - this.crossing[i] <= this.config.fusion.associationSeconds &&
      time - this.lastStart[i] >= this.config.fusion.refractorySeconds
    );
  }
  consume(i, time) {
    this.consumed[i] = this.crossing[i];
    this.lastStart[i] = time;
  }
}

// Compare only evidence already available on this frame. Coefficients are not probabilities.
export function attributedAttack(scores, index, fusion) {
  if (fusion.neighborRatio === undefined) return true;
  const competitor = Math.max(scores[index - 1] ?? 0, scores[index + 1] ?? 0);
  return scores[index] >= fusion.neighborRatio * competitor;
}
