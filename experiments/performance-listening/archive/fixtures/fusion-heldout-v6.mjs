const n = (pitch, start, end, velocity = 0.65) => ({
  pitch,
  start,
  end,
  velocity,
});
const entry = (id, category, actual, target = actual) => ({
  id: `v6-${id}`,
  category,
  actual,
  target: structuredClone(target),
  duration: Math.max(2, ...actual.map((n) => n.end + 0.4)),
  split: "evaluation",
});
export function fusionHeldoutV6() {
  return [
    entry("silence", "silence", []),
    entry("low-fsharp", "single", [n(42, 0.29, 1.43, 0.6)]),
    entry("quiet-low-e", "single", [n(40, 0.41, 1.49, 0.35)]),
    entry("upper", "single", [n(67, 0.31, 0.88, 0.5)]),
    entry("bass-upper", "mixture", [
      n(42, 0.29, 1.43, 0.6),
      n(69, 0.29, 0.97, 0.4),
    ]),
    entry("octave", "octave", [n(46, 0.33, 1.47), n(58, 0.33, 1.47, 0.3)]),
    entry("upper-only", "mixture", [
      n(54, 0.34, 1.48),
      n(61, 0.34, 1.48, 0.45),
    ]),
    entry("quiet-inner", "chord", [
      n(46, 0.32, 1.46),
      n(61, 0.32, 1.46, 0.21),
      n(65, 0.32, 1.46),
      n(70, 0.32, 1.46, 0.45),
    ]),
    entry("short", "single", [n(63, 0.39, 0.475, 0.45)]),
    entry("restrike", "repeated", [
      n(65, 0.29, 0.66),
      n(65, 0.66, 1.03, 0.4),
      n(65, 1.03, 1.4),
    ]),
    entry("ringing", "arpeggio", [
      n(42, 0.31, 1.72),
      n(66, 0.69, 0.98, 0.3),
      n(66, 1.19, 1.48, 0.4),
    ]),
    entry(
      "strum",
      "strum",
      [42, 49, 54, 58, 61, 66].map((p, i) => n(p, 0.32 + i * 0.024, 1.58)),
    ),
    entry(
      "wrong",
      "error",
      [n(54, 0.31, 1.47), n(60, 0.31, 1.47), n(64, 0.31, 1.47)],
      [n(54, 0.31, 1.47), n(59, 0.31, 1.47), n(64, 0.31, 1.47)],
    ),
    entry(
      "extra",
      "error",
      [n(49, 0.33, 1.48), n(56, 0.33, 1.48), n(60, 0.79, 1.11, 0.2)],
      [n(49, 0.33, 1.48), n(56, 0.33, 1.48)],
    ),
  ];
}
