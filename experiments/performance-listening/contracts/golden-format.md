Version v1; draft instrument contract. Freeze only after item G.

# Golden format (`contracts/golden-format.md` + `golden.schema.json`)

One directory per example:

```
sets/harness-v1/<example>/
  golden.json          the record below
  score.mnx.json       the intended score handed to the listener
  audio.wav            uncommitted; regenerated, hash-checked
```

`golden.json` fields, all required unless marked:

- `set`, `example`, `version` — identity; the set version is the frozen unit.
- `intended` — path to the score, the tempo handoff, the route (pass list).
- `audio` — path, sample rate, channels, duration, SHA-256, and the generator's
  manifest id plus parameters (the recipe).
- `labels.notes[]` — the actual-performance labels: pitch (MIDI number and Hz),
  onset, audible end (release), score duration, `scoreNoteId` where the note is a
  score note and `null` where it is not (c2's notes are all `null` against s2).
  Each carries `precision` (`exact` for generated audio) and `provenance`.
- `labels.following[]` — a piecewise description over audio time: intervals with
  `state: supported | unsupported | unknown`, `admissible: [position…]` for supported
  intervals (one entry at level 1), `route`, and **`answerableFrom`**: the audio time
  from which the interval's state can be established from the audio alone. Regions
  the labels cannot speak for are `unknown` and are neither success nor failure.
  A supported interval may be marked **`abstainable: true`** (optional, default
  false): the route continues but no acoustic support for it is present, as across an
  omitted note or a sustained extra one. There, `unsupported` is an abstention rather
  than a loss (§5.3). No interval in `harness-v1` is abstainable; the field exists so
  the dropped-note and extra-note cases named in §4 need no format change.
- `expected` — the following verdict summary the evaluator should reproduce
  (§9's predictions live here, per example).
- `profile` — the eight dimensions, each with its level and the actual range
  present (`melodic: { level: 1, range: "C4–C5", note: "C5 exceeds the level-1 range" }`).
- `conditions` — recording conditions; for generated audio, `none`.
- `provenance` — how every label was obtained: `generated` with the manifest id, the
  score's origin line (vendor path and pin for s2), and the perturbation recipe where
  one exists (c2: "score s2 handed with audio of descending-scale; every note is a
  substitution against the score, so the example is unsupported following rather than
  eight note-level substitutions").
- `partition` — `development | reserved | acceptance`.
- `noteAssessment` — reserved, `null`.

`answerableFrom` is where the level-1 tolerances enter the labels rather than the
evaluator. The provisional research contract (§5.4) sets a **detection allowance** of
150 ms after an onset; an interval's `answerableFrom` is the first onset that
distinguishes the state plus that allowance. For p1 and p2 following is answerable
from 150 ms; for c2, unsupported is answerable from 150 ms (the first note is C5, not
C4); for c1 it is answerable from the first moment a note should have sounded and did
not, taken as 150 ms into the first beat.


Related: [vocabulary](vocabulary.md), [golden format](golden-format.md),
[counting rules](evaluator-rules.md), [provisional research contract](research-contract-0.md).

## Concrete v1 encoding

[golden.schema.json](golden.schema.json) is the machine shape; the handwritten
[example](handwritten.golden.json) exercises it before any evaluator exists.
A trajectory is `{ atStart: {num, den}, quartersPerSecond: {num, den}, route }`.
Its value at time t is atStart + (t − interval.start) × quartersPerSecond.
Supported intervals carry `truth` and `admissible` trajectories; the latter can
express equivalent routes. They carry a `route` occurrence and `answerableFrom`.
All intervals carry `precision` and `provenance`; bounded precision specifies a
nonnegative `uncertaintySeconds`. Unknown intervals assert no truth.

Intervals are ordered, contiguous, cover the audio, and use (start,end] for the
50 ms grid, with t=0 belonging to the first interval if sampled separately.
Supported regions end at the final audible release; the trailing silence is unknown.
Controls are unsupported through the audio end. A trajectory continues across the
inter-note silent gaps; none of harness-v1 is abstainable. No intended timing is
silently promoted to an observed label.

Audio SHA-256 is null while authoring and a lowercase digest once frozen. Recipe
parameters include `bpm`, `mode` (score, descending, silence), sample rate, peak dBFS,
attack/release seconds, sounding beat fraction and final silence seconds. Score
origins and perturbations are provenance, never listener inputs. Runtime semantic
checks supplement JSON Schema: ordering, bounds, route consistency, exact sample
boundaries, admissibility and valid decision weights cannot be established by shape
alone. Hashes and version locks cover scores, labels, recipes and manifests as well
as audio; changing any frozen content requires a new set version.
