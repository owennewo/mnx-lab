import FFT from "fft.js";
export const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
export function spectrogramFrame(
  samples,
  end,
  config,
  fft = new FFT(config.fftSize),
) {
  const n = config.fftSize,
    input = new Float64Array(n),
    out = fft.createComplexArray();
  let energy = 0;
  for (let i = 0; i < n; i++) {
    const x = samples[end - n + i] ?? 0;
    energy += x * x;
    input[i] = x * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  }
  fft.realTransform(out, input);
  const magnitude = new Float64Array(n / 2 + 1);
  for (let i = 0; i < magnitude.length; i++)
    magnitude[i] = Math.hypot(out[2 * i], out[2 * i + 1]);
  return { magnitude, rms: Math.sqrt(energy / n) };
}
const dot = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};
function normalize(a) {
  const n = Math.sqrt(dot(a, a));
  return Float64Array.from(a, (x) => (n ? x / n : 0));
}
export function harmonicDictionary(config) {
  return Array.from({ length: config.midiMax - config.midiMin + 1 }, (_, i) => {
    const a = new Float64Array(config.fftSize / 2 + 1),
      f = (hz(i + config.midiMin) * config.fftSize) / config.sampleRate;
    for (let h = 1; h <= 12 && h * f < a.length - 2; h++)
      for (
        let k = Math.max(1, Math.floor(h * f) - 2);
        k <= Math.ceil(h * f) + 2 && k < a.length;
        k++
      )
        a[k] += Math.exp(-0.5 * ((k - h * f) / 0.8) ** 2) / h;
    return normalize(a);
  });
}
export function templateDictionary(recordings, config) {
  return Array.from({ length: config.midiMax - config.midiMin + 1 }, (_, i) => {
    const samples = recordings.get(i + config.midiMin);
    if (!samples)
      throw Error("Missing isolated-note template " + (i + config.midiMin));
    const a = new Float64Array(config.fftSize / 2 + 1);
    // Fixed steady-state slice chosen before evaluation. No test recordings enter here.
    for (
      let end = Math.ceil(0.45 * config.sampleRate);
      end <= 0.75 * config.sampleRate;
      end += config.hopSize
    ) {
      const { magnitude } = spectrogramFrame(samples, end, config);
      for (let k = 0; k < a.length; k++) a[k] += magnitude[k];
    }
    return normalize(a);
  });
}
export function createScorer(dictionary, kind, config) {
  const gram = dictionary.map((a) =>
    Float64Array.from(dictionary, (b) => dot(a, b)),
  );
  return (magnitude, rms) => {
    if (rms < config.rmsFloor) return new Float64Array(dictionary.length);
    const v = normalize(magnitude),
      projection = Float64Array.from(dictionary, (a) => dot(a, v));
    const weights = new Float64Array(dictionary.length);
    if (kind === "harmonic") {
      // Greedy harmonic matching pursuit; selected peaks explain a residual spectrum.
      const residual = projection.slice();
      for (let step = 0; step < config.maxPolyphony; step++) {
        let best = 0;
        for (let i = 1; i < residual.length; i++)
          if (residual[i] > residual[best]) best = i;
        const amount = residual[best];
        if (amount <= 0) break;
        weights[best] += amount;
        for (let i = 0; i < residual.length; i++)
          residual[i] -= amount * gram[i][best];
      }
    } else {
      // Fixed-iteration nonnegative coordinate descent on ||D w - spectrum||².
      for (
        let iteration = 0;
        iteration < config.templateIterations;
        iteration++
      )
        for (let i = 0; i < weights.length; i++) {
          let value = projection[i];
          for (let j = 0; j < weights.length; j++)
            if (i !== j) value -= gram[i][j] * weights[j];
          weights[i] = Math.max(0, value / Math.max(gram[i][i], 1e-12));
        }
    }
    return weights; // Relative spectral coefficients, NOT calibrated probabilities.
  };
}
