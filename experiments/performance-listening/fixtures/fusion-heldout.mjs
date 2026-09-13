// Frozen before F-001 parameter selection. These become regression cases after this run.
const note = (pitch, start, end, velocity = 0.7) => ({
  pitch,
  start,
  end,
  velocity,
});
const entry = (id, category, actual) => ({
  id,
  category,
  actual,
  target: structuredClone(actual),
  duration: Math.max(1.6, ...actual.map((n) => n.end + 0.4)),
  split: "evaluation",
});
export function fusionHeldout() {
  return [
    entry("hold-silence", "silence", []),
    entry("hold-sustain-low", "single", [note(45, 0.31, 1.41)]),
    entry("hold-sustain-high", "single", [note(73, 0.29, 1.37, 0.35)]),
    entry("hold-short", "single", [note(57, 0.32, 0.42)]),
    entry("hold-repeat", "repeated", [
      note(57, 0.31, 0.51),
      note(57, 0.64, 0.84, 0.4),
      note(57, 0.97, 1.17, 0.8),
    ]),
    entry("hold-restrike", "restrike", [
      note(69, 0.3, 0.58),
      note(69, 0.58, 0.86, 0.45),
      note(69, 0.86, 1.14, 0.8),
    ]),
    entry(
      "hold-fast",
      "repeated",
      [0, 1, 2, 3].map((i) => note(62, 0.3 + i * 0.13, 0.4 + i * 0.13)),
    ),
    entry("hold-ringing", "arpeggio", [
      note(45, 0.3, 1.5),
      note(64, 0.61, 0.81),
      note(64, 0.96, 1.16),
    ]),
    entry(
      "hold-arpeggio",
      "arpeggio",
      [45, 52, 57, 61].map((p, i) => note(p, 0.3 + i * 0.17, 1.4)),
    ),
    entry(
      "hold-strum",
      "strum",
      [45, 52, 57, 61, 64, 69].map((p, i) => note(p, 0.3 + i * 0.018, 1.3)),
    ),
  ];
}
