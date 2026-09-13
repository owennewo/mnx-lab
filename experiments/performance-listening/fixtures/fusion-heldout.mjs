// Frozen before F-001 parameter selection. These become regression cases after this run.
const note = (pitch, start, end, velocity = .7) => ({pitch, start, end, velocity});
const entry = (id, category, actual) => ({id, category, actual, target: structuredClone(actual), duration: Math.max(1.6, ...actual.map(n => n.end + .4)), split: "evaluation"});
export function fusionHeldout() {
  return [
    entry("hold-silence", "silence", []),
    entry("hold-sustain-low", "single", [note(45,.31,1.41)]),
    entry("hold-sustain-high", "single", [note(73,.29,1.37,.35)]),
    entry("hold-short", "single", [note(57,.32,.42)]),
    entry("hold-repeat", "repeated", [note(57,.31,.51),note(57,.64,.84,.4),note(57,.97,1.17,.8)]),
    entry("hold-restrike", "restrike", [note(69,.3,.58),note(69,.58,.86,.45),note(69,.86,1.14,.8)]),
    entry("hold-fast", "repeated", [0,1,2,3].map(i=>note(62,.3+i*.13,.4+i*.13))),
    entry("hold-ringing", "arpeggio", [note(45,.3,1.5),note(64,.61,.81),note(64,.96,1.16)]),
    entry("hold-arpeggio", "arpeggio", [45,52,57,61].map((p,i)=>note(p,.3+i*.17,1.4))),
    entry("hold-strum", "strum", [45,52,57,61,64,69].map((p,i)=>note(p,.3+i*.018,1.3))),
  ];
}
