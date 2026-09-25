// Partial critical-band spectral whitening, following Klapuri (ISMIR 2006 §2.1).
// Adaptations: current FFT/window retained; relative floor and capped gains;
// nearest-band gain outside the centre range; no temporal smoothing.
export function createWhitener(config) {
  const w = config.whitening;
  if (!w || w.strength === 0) return (magnitude) => magnitude;
  if (
    !(w.strength > 0 && w.strength <= 1) ||
    !(w.floor > 0 && w.floor <= 1) ||
    !(w.maxGain >= 1 && Number.isFinite(w.maxGain))
  )
    throw Error("Invalid whitening configuration");
  const centers = Array.from(
    { length: 32 },
    (_, b) => 229 * (10 ** ((b + 1) / 21.4) - 1),
  );
  const size = config.fftSize / 2 + 1;
  const bands = Array.from({ length: 30 }, (_, i) => {
    const b = i + 1,
      entries = [];
    for (let k = 0; k < size; k++) {
      const f = (k * config.sampleRate) / config.fftSize;
      const weight =
        f <= centers[b]
          ? (f - centers[b - 1]) / (centers[b] - centers[b - 1])
          : (centers[b + 1] - f) / (centers[b + 1] - centers[b]);
      if (weight > 0) entries.push([k, weight]);
    }
    return entries;
  });
  const interpolation = Array.from({ length: size }, (_, k) => {
    const f = (k * config.sampleRate) / config.fftSize;
    if (f <= centers[1]) return [0, 0, 0];
    if (f >= centers[30]) return [29, 29, 0];
    let b = 1;
    while (centers[b + 1] < f) b++;
    return [b - 1, b, (f - centers[b]) / (centers[b + 1] - centers[b])];
  });
  return (magnitude) => {
    const sigma = bands.map((entries) =>
      Math.sqrt(
        entries.reduce((s, [k, weight]) => s + weight * magnitude[k] ** 2, 0) /
          config.fftSize,
      ),
    );
    const peak = Math.max(...sigma);
    if (peak === 0) return magnitude;
    const gains = sigma.map((s) =>
      Math.min(w.maxGain, Math.max(s / peak, w.floor) ** -w.strength),
    );
    return Float64Array.from(magnitude, (x, k) => {
      const [left, right, fraction] = interpolation[k];
      return x * (gains[left] * (1 - fraction) + gains[right] * fraction);
    });
  };
}
