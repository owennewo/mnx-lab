// Positive, optional evidence for a locally prominent fundamental. This is a
// spectral-background proxy, not a calibrated noise model or a pitch probability.
export function createFundamentalSupport(config) {
  const f = config.fundamental;
  if (!f || f.strength === 0) return () => {};
  if (
    !(f.strength > 0 && f.strength <= 1) ||
    !(f.minContrast > 1) ||
    !(f.fullContrast > f.minContrast) ||
    !(f.relativeAmplitudeFloor > 0)
  )
    throw Error("Invalid fundamental support configuration");
  const pitches = Array.from(
    { length: config.midiMax - config.midiMin + 1 },
    (_, i) => 440 * 2 ** ((config.midiMin + i - 69) / 12),
  );
  const centers = pitches.map((hz) =>
    Math.round((hz * config.fftSize) / config.sampleRate),
  );
  const lowerExplanations = pitches.map((hz, i) =>
    pitches.slice(0, i).flatMap((lower, j) => {
      const h = Math.round(hz / lower);
      return h >= 2 &&
        h <= 12 &&
        Math.abs(12 * Math.log2(hz / (lower * h))) <= 0.5
        ? [j]
        : [];
    }),
  );
  return (weights, projection, magnitude, rms) => {
    const selected = Array.from(weights, (w) => w >= config.activityThreshold);
    for (let i = 0; i < weights.length; i++) {
      // Skip work that cannot change the current event gate.
      const upperBound = f.strength * projection[i];
      if (upperBound < config.activityThreshold || upperBound <= weights[i])
        continue;
      if (lowerExplanations[i].some((j) => selected[j])) continue;
      const center = centers[i];
      let k = center;
      for (const j of [center - 1, center + 1])
        if (magnitude[j] > magnitude[k]) k = j;
      const peak = magnitude[k];
      if (!(peak > 0) || peak <= magnitude[k - 1] || peak <= magnitude[k + 1])
        continue;
      // Three-bin log-parabolic interpolation prevents one low-frequency FFT
      // peak from supplying independent support to neighbouring semitones.
      const left = Math.log(Math.max(magnitude[k - 1], 1e-30)),
        middle = Math.log(peak),
        right = Math.log(Math.max(magnitude[k + 1], 1e-30));
      const delta = (0.5 * (left - right)) / (left - 2 * middle + right);
      const hz =
        ((k + Math.max(-0.5, Math.min(0.5, delta))) * config.sampleRate) /
        config.fftSize;
      if (Math.abs(12 * Math.log2(hz / pitches[i])) > 0.5) continue;
      if ((4 * peak) / config.fftSize < f.relativeAmplitudeFloor * rms)
        continue;
      const sides = [-7, -6, -5, -4, -3, 3, 4, 5, 6, 7]
        .map(
          (d) => magnitude[Math.max(1, Math.min(magnitude.length - 1, k + d))],
        )
        .sort((a, b) => a - b);
      const background = Math.max((sides[4] + sides[5]) / 2, 1e-30),
        ratio = peak / background;
      const support = Math.max(
        0,
        Math.min(
          1,
          Math.log(ratio / f.minContrast) /
            Math.log(f.fullContrast / f.minContrast),
        ),
      );
      // Preserve evidence that greedy higher-pitch allocation could otherwise
      // erase. Absent fundamentals do not veto the original harmonic scorer.
      weights[i] = Math.max(weights[i], f.strength * projection[i] * support);
    }
  };
}
