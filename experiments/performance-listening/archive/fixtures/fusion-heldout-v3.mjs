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
  duration: Math.max(1.75, ...actual.map((n) => n.end + 0.4)),
  split: "evaluation",
});
export function fusionHeldoutV3() {
  return [
    entry("v3-silence", "silence", []),
    entry("v3-sustain-low", "single", [n(46, 0.34, 1.46)]),
    entry("v3-sustain-high", "single", [n(78, 0.3, 1.42, 0.4)]),
    entry("v3-short", "single", [n(58, 0.36, 0.445)]),
    entry("v3-repeat", "repeated", [
      n(58, 0.3, 0.52),
      n(58, 0.66, 0.88, 0.35),
      n(58, 1.02, 1.24),
    ]),
    entry("v3-restrike", "repeated", [
      n(70, 0.3, 0.64),
      n(70, 0.64, 0.98, 0.5),
      n(70, 0.98, 1.32),
    ]),
    entry(
      "v3-rapid",
      "repeated",
      [0, 1, 2, 3].map((i) => n(63, 0.32 + i * 0.12, 0.41 + i * 0.12)),
    ),
    entry(
      "v3-adjacent",
      "repeated",
      [0.31, 0.72, 1.13].flatMap((t) => [
        n(63, t, t + 0.25),
        n(64, t, t + 0.25),
      ]),
    ),
    entry(
      "v3-quiet-adjacent",
      "repeated",
      [0.32, 0.75, 1.18].flatMap((t) => [
        n(66, t, t + 0.24),
        n(67, t, t + 0.24, 0.25),
      ]),
    ),
    entry("v3-ringing", "arpeggio", [
      n(46, 0.31, 1.55),
      n(65, 0.69, 0.94),
      n(65, 1.09, 1.34),
    ]),
    entry(
      "v3-arpeggio",
      "arpeggio",
      [46, 53, 58, 62].map((p, i) => n(p, 0.3 + i * 0.18, 1.5)),
    ),
    entry(
      "v3-strum",
      "strum",
      [46, 53, 58, 62, 65, 70].map((p, i) => n(p, 0.32 + i * 0.024, 1.4)),
    ),
    entry(
      "v3-wrong",
      "error",
      [n(58, 0.31, 1.13), n(63, 0.31, 1.13), n(65, 0.31, 1.13)],
      [n(58, 0.31, 1.13), n(62, 0.31, 1.13), n(65, 0.31, 1.13)],
    ),
    entry(
      "v3-extra",
      "error",
      [n(53, 0.32, 1.18), n(60, 0.32, 1.18), n(64, 0.7, 0.98, 0.22)],
      [n(53, 0.32, 1.18), n(60, 0.32, 1.18)],
    ),
  ];
}
