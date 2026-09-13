const n = (pitch, start, end, velocity = 0.7) => ({
  pitch,
  start,
  end,
  velocity,
});
const entry = (id, category, actual, target = actual) => ({
  id: `v5-${id}`,
  category,
  actual,
  target: structuredClone(target),
  duration: Math.max(2, ...actual.map((n) => n.end + 0.4)),
  split: "evaluation",
});
export function fusionHeldoutV5() {
  return [
    entry("silence", "silence", []),
    entry("low-f", "single", [n(41, 0.37, 1.53)]),
    entry("low-g", "single", [n(43, 0.39, 1.61)]),
    entry("upper", "single", [n(70, 0.36, 0.91, 0.45)]),
    entry("bass-upper", "mixture", [
      n(41, 0.37, 1.53),
      n(70, 0.37, 0.93, 0.45),
    ]),
    entry("octave", "octave", [n(43, 0.38, 1.54), n(55, 0.38, 1.54, 0.35)]),
    entry("double-octave", "octave", [
      n(46, 0.41, 1.59, 0.5),
      n(70, 0.41, 1.59, 0.5),
    ]),
    entry("quiet-inner", "chord", [
      n(43, 0.36, 1.52),
      n(58, 0.36, 1.52, 0.22),
      n(65, 0.36, 1.52),
      n(70, 0.36, 1.52, 0.5),
    ]),
    entry("short", "single", [n(65, 0.43, 0.515, 0.5)]),
    entry("restrike", "repeated", [
      n(62, 0.37, 0.72),
      n(62, 0.72, 1.07, 0.45),
      n(62, 1.07, 1.42),
    ]),
    entry("ringing", "arpeggio", [
      n(43, 0.36, 1.78),
      n(67, 0.74, 1.02, 0.35),
      n(67, 1.22, 1.5, 0.45),
    ]),
    entry(
      "strum",
      "strum",
      [43, 50, 55, 59, 62, 67].map((p, i) => n(p, 0.37 + i * 0.021, 1.65)),
    ),
    entry(
      "wrong",
      "error",
      [n(55, 0.37, 1.5), n(62, 0.37, 1.5), n(65, 0.37, 1.5)],
      [n(55, 0.37, 1.5), n(61, 0.37, 1.5), n(65, 0.37, 1.5)],
    ),
    entry(
      "extra",
      "error",
      [n(50, 0.36, 1.55), n(57, 0.36, 1.55), n(61, 0.83, 1.13, 0.23)],
      [n(50, 0.36, 1.55), n(57, 0.36, 1.55)],
    ),
  ];
}
