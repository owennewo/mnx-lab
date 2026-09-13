const n = (pitch, start, end, velocity = 0.7) => ({
  pitch,
  start,
  end,
  velocity,
});
const entry = (id, category, actual, target = actual) => ({
  id,
  category,
  actual,
  target: structuredClone(target),
  duration: Math.max(1.8, ...actual.map((n) => n.end + 0.4)),
  split: "evaluation",
});
export function fusionHeldoutV4() {
  return [
    entry("v4-silence", "silence", []),
    entry("v4-low", "single", [n(44, 0.32, 1.48)]),
    entry("v4-high", "single", [n(86, 0.33, 1.47, 0.4)]),
    entry("v4-short", "single", [n(61, 0.34, 0.435)]),
    entry("v4-repeat", "repeated", [
      n(61, 0.33, 0.57),
      n(61, 0.71, 0.95, 0.35),
      n(61, 1.09, 1.33),
    ]),
    entry("v4-restrike", "repeated", [
      n(68, 0.31, 0.64),
      n(68, 0.64, 0.97, 0.5),
      n(68, 0.97, 1.3),
    ]),
    entry(
      "v4-rapid",
      "repeated",
      [0, 1, 2, 3].map((i) => n(66, 0.3 + i * 0.125, 0.395 + i * 0.125)),
    ),
    entry(
      "v4-octaves",
      "repeated",
      [0.31, 0.73, 1.15].flatMap((t) => [
        n(49, t, t + 0.26),
        n(61, t, t + 0.26, 0.45),
      ]),
    ),
    entry(
      "v4-fifths",
      "repeated",
      [0.32, 0.74, 1.16].flatMap((t) => [
        n(48, t, t + 0.25, 0.45),
        n(67, t, t + 0.25, 0.8),
      ]),
    ),
    entry("v4-ringing-bass", "arpeggio", [
      n(44, 0.3, 1.62, 0.8),
      n(68, 0.73, 0.98, 0.3),
      n(68, 1.14, 1.39, 0.4),
    ]),
    entry(
      "v4-arpeggio",
      "arpeggio",
      [44, 51, 56, 60].map((p, i) => n(p, 0.31 + i * 0.18, 1.52)),
    ),
    entry(
      "v4-strum",
      "strum",
      [44, 51, 56, 60, 63, 68].map((p, i) => n(p, 0.3 + i * 0.026, 1.42)),
    ),
    entry(
      "v4-wrong",
      "error",
      [n(56, 0.32, 1.15), n(61, 0.32, 1.15), n(63, 0.32, 1.15)],
      [n(56, 0.32, 1.15), n(60, 0.32, 1.15), n(63, 0.32, 1.15)],
    ),
    entry(
      "v4-extra",
      "error",
      [n(51, 0.31, 1.19), n(58, 0.31, 1.19), n(62, 0.72, 1, 0.2)],
      [n(51, 0.31, 1.19), n(58, 0.31, 1.19)],
    ),
  ];
}
