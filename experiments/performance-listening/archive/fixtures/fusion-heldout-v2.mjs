const note = (pitch, start, end, velocity = 0.7) => ({
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
  duration: Math.max(1.7, ...actual.map((n) => n.end + 0.4)),
  split: "evaluation",
});
export function fusionHeldoutV2() {
  return [
    entry("v2-silence", "silence", []),
    entry("v2-low-sustain", "single", [note(43, 0.33, 1.42)]),
    entry("v2-high-sustain", "single", [note(75, 0.28, 1.36, 0.4)]),
    entry("v2-short", "single", [note(59, 0.37, 0.45)]),
    entry("v2-repeat-soft", "repeated", [
      note(59, 0.28, 0.49),
      note(59, 0.63, 0.84, 0.3),
      note(59, 0.98, 1.19, 0.8),
    ]),
    entry("v2-restrike", "repeated", [
      note(67, 0.32, 0.63),
      note(67, 0.63, 0.94, 0.45),
      note(67, 0.94, 1.25),
    ]),
    entry(
      "v2-rapid",
      "repeated",
      [0, 1, 2, 3].map((i) => note(65, 0.29 + i * 0.115, 0.375 + i * 0.115)),
    ),
    entry("v2-ringing", "arpeggio", [
      note(43, 0.29, 1.5),
      note(62, 0.67, 0.9),
      note(62, 1.05, 1.28),
    ]),
    entry(
      "v2-arpeggio",
      "arpeggio",
      [43, 50, 55, 59].map((p, i) => note(p, 0.32 + i * 0.19, 1.5)),
    ),
    entry(
      "v2-strum",
      "strum",
      [43, 50, 55, 59, 62, 67].map((p, i) => note(p, 0.31 + i * 0.022, 1.4)),
    ),
    entry(
      "v2-wrong-inner",
      "error",
      [note(55, 0.3, 1.1), note(60, 0.3, 1.1), note(62, 0.3, 1.1)],
      [note(55, 0.3, 1.1), note(59, 0.3, 1.1), note(62, 0.3, 1.1)],
    ),
    entry(
      "v2-quiet-extra",
      "error",
      [note(50, 0.3, 1.1), note(57, 0.3, 1.1), note(61, 0.64, 0.91, 0.2)],
      [note(50, 0.3, 1.1), note(57, 0.3, 1.1)],
    ),
  ];
}
