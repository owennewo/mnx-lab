# First step: the first assessment against the first synthesized sources

A campaign plan for the first three rows of the construction table in
[EXPERIMENT_HARNESS_STRUCTURE.md](EXPERIMENT_HARNESS_STRUCTURE.md): **Contracts**,
**Instrument** and **Pipeline**. It ends when one versioned candidate has been run over
one frozen synthetic set, the evaluator has produced a report that agrees with numbers
predicted by hand before the run, and the causality check has passed. Nothing after
that row (real evidence, the retention rule, a second candidate) is started here,
though the plan names the question the loop asks next.

The structure document declines to choose technology; this plan makes those choices
and marks each one. Every choice is provisional in the sense that the ledger records
it, not in the sense that it may drift after the first comparison. The obligations
in [APPROACH.md](APPROACH.md) are not restated; where a section below discharges one,
it says which.

## 1. What "first assessment" means

The first milestone is **supported following**. The first assessment is therefore a
following assessment at the harness profile (level 1 in every dimension of the
APPROACH table), and the evaluator's categories are the following categories only.
Note-level fields are reserved in the golden format and left empty.

Level 1 is a check of the harness, not of listening. The plan is built around the
one consequence of that: **every number the first run produces can be worked out by
hand beforehand.** Section 9 writes those predictions down. A run that disagrees with
them is a defect in the instrument or the pipeline; it is never a finding about the
candidate. Only once the run matches the predictions do the contracts freeze.

## 2. Decisions this plan makes

| Decision | Choice | Why |
|---|---|---|
| Location | `experiments/performance-listening/` — contracts and records as Markdown/JSON beside this file; code under `bench/` | The experiment measures and does not integrate; nothing in `src/` may import it, and it is not part of any build face |
| Language and runtime | TypeScript; tests under the root's `vitest`, CLI scripts under `tsx`; **zero runtime dependencies** | The archive shows a dependency-heavy bench rots the moment it is set aside; sine generation, WAV writing and the evaluator need no library. This checkout's Node 22 is built without type stripping (`ERR_NO_TYPESCRIPT`), and the only `vite-node` on disk is a transitive leftover of a converter's older vitest, so neither is a runner to rely on |
| Score timing | The generator and the runner both read score time through `src/audio/performance.ts` (`compilePerformance`) | It is the repo's one exact source of rational score positions and already resolves passes; using it makes the intended score handed to the listener the same object Studio would hand it. The labels stay independent because they describe the **audio the generator produced**, not the score |
| Audio | Mono, 48 kHz, 16-bit PCM WAV; generated audio **uncommitted**, regenerated from a committed recipe and checked against a committed SHA-256 | Same rule as recordings; the recipe plus hash is the provenance, and a byte change is a new set version by construction |
| Package boundary | `bench/` is an npm **workspace** (`mnx-listening-bench`, private) with its own `vitest.config.ts`, like `converters/*` | The root's vitest includes only `harness/**`, so the bench's tests are its own suite, run as `npm -w mnx-listening-bench test`. `docs/gates.md` already classes `experiments/` as code; item A checks that the gate runs the bench suite for a `bench/` diff and adds a row if it does not. Nothing in `src/` may import the bench, and the bench is in no build face |
| Score format | MNX documents exactly as the pinned schema accepts them; tempo is **not** in the score at level 1 and is handed to the listener alongside it | The two-bar scale example carries no tempo; putting a `tempos` entry in would make the score the generator's, not the spec's |

The vendor example carries no `"type": "event"` on its content items. The pinned
schema (`version/27`) does not require it, and the model treats any timed item without
a container type as an event, so the copy stands verbatim; item D confirms this by
validating it and compiling it through `compilePerformance`.

## 3. The sources

Two scores, both at level 1 in every dimension except where the table says otherwise.

| Id | Score | Notes | Profile deviations from level 1 |
|---|---|---|---|
| `s1-one-bar-c4-f4` | Hand-authored: one 4/4 bar, quarter notes C4 D4 E4 F4 | The smallest score that has more than one position | none |
| `s2-two-bar-scale` | Verbatim copy of `vendor/mnx/docs/static/examples/json/two-bar-c-major-scale.json` at the current pin | Two bars, C4 to C5, one quarter per beat | **Melodic:** C5 lies outside the C4–B4 range the profile names; recorded as C4–C5, not silently accepted |

Structural ambiguity is level 1 in both: no note repeats within a score, so every
position is distinguishable from every other once its note has sounded. Navigation is
level 1: the first score event is the first sound, at audio time zero, and traversal is
continuous to the end.

Generation parameters (the harness profile, declared once in the generator's manifest
and repeated in every golden's provenance):

- 60 BPM, quarter note = 1 s; tempo handed to the listener as `{ bpm: 60, unit: "quarter" }`.
- Each note sounds for half a beat (500 ms), then silence for the rest of the beat.
- Sine at the equal-tempered frequency for A4 = 440 Hz; constant level, −12 dBFS peak.
- Envelope: 10 ms linear attack, 10 ms linear release, no other shaping.
- No lead-in, no tail beyond the last note's release plus 500 ms of silence.
- No noise, no dither. The generator is deterministic; it takes no seed.

Score duration and audible boundary are distinct, and the labels say so: each label
carries the score duration (one quarter) **and** the sounding interval (onset, onset +
500 ms), with the release point named as the end of the audible boundary. Nothing at
level 1 sounds past its release.

## 4. The harness set: `harness-v1`

Five examples. Two are positive, two are following controls, one is a declared probe
above level 1 that exists so the first candidate can be seen to be a clock and not a
listener.

| Id | Intended score | Audio | Expected following assessment | Purpose |
|---|---|---|---|---|
| `p1` | s1 | generated s1 | Position = clock × 60 BPM, supported from the first onset to the last release; single admissible position throughout | Smallest positive |
| `p2` | s2 | generated s2 | As p1 over two bars | Positive on the spec example |
| `c1-silence` | s2 | 8.5 s of digital silence | **Unsupported** throughout. Any position claim is false following | The clock follower must be caught |
| `c2-wrong-piece` | s2 | generated **descending** scale C5…C4 (same rhythm, same tempo) | Unsupported. Answerable from the first onset plus the declared detection allowance (see §5); before that, abstention or a position claim covering position 0 is justified | A plausible negative: right rhythm, wrong pitches, same length |
| `t1-tempo-90` | s2 | generated s2 at **90 BPM** | Supported; true position runs 1.5× the clock. **Tempo dimension above level 1**, recorded as such | The one example where a follower and a clock disagree |

Partition: the whole set is **development**. A deterministic generator has no seeds,
so there is no reserved or acceptance partition to declare, and the partition registry
records that no reserved claim can be made from `harness-v1`. This discharges the
"new seeds are not new sources" rule by making it impossible to break.

Deferred, named so the next set does not rediscover them: a late start (lead-in
silence, navigation level 2), a dropped note and an extra note in the audio (assessment
milestone), a repeated bar (structural ambiguity level 2), and the same five examples
re-amplified through a speaker and microphone (recording conditions, the parallel track
APPROACH asks for early).

## 5. The contracts

Written first, versioned as `v1`, and frozen at the end of the step. Each is a Markdown
document with a JSON schema beside it where a machine reads the shape.

### 5.1 Assessment vocabulary and listener interface (`contracts/vocabulary.md`)

The handoff to a listener:

```
start(intendedScore: MNX document, tempo, delivery: { sampleRate, chunkSamples })
feed(chunk: Float32Array, clock: seconds released so far) → Decision[]
finish() → Decision[]
```

A decision is one of three statements, each stamped with `madeAt` (the clock at the
moment of the decision) and `refersTo` (the audio time it describes):

- `position` — `{ candidates: [{ position, weight }], confidence }`. Position is a
  rational score offset in quarter notes from the score start, plus a `route` index
  (always pass 1 at level 1). More than one candidate expresses unresolved ambiguity;
  weights sum to one; `confidence` is the listener's belief that the true position is
  in the set at all.
- `unsupported` — following is not supported at `refersTo`; optional `reason`.
- `note` — reserved; the shape is fixed (`match | missing | extra | substitution | timing`,
  note id, observed onset and pitch) and the evaluator ignores it at this milestone.

The record is append-only. A later decision with the same or earlier `refersTo`
supersedes for the as-decided view but never removes the earlier one. Silence is not a
statement: an audio interval with no decision referring to it is **uncovered**.

Chunked, clocked delivery is the runner's job (§7.2), but the interface is shaped so a
listener cannot ask for more than has been released.

### 5.2 Golden format (`contracts/golden-format.md` + `golden.schema.json`)

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

### 5.3 Evaluator counting rules (`contracts/evaluator-rules.md`)

The evaluator samples audio time on a fixed **50 ms grid** and evaluates two views at
each grid point:

- **As-decided**: the decision a player would have been shown at that moment, i.e. the
  latest decision with `madeAt ≤ t` whose `refersTo` is the largest not exceeding `t`.
- **Hindsight**: the final superseding decision for each `refersTo`.

At each grid point in a `supported` interval, at or after `answerableFrom`:

| Listener said | Counts as |
|---|---|
| `position`, some candidate within ±0.25 quarter of the true position and the candidate set within the admissible set | **correct** |
| `position`, a candidate within tolerance but the set wider than admissible | **over-ambiguous** (reported separately, never as correct) |
| `position`, no candidate within tolerance | **wrong**; its error in quarters is recorded |
| `unsupported` | **lost** |
| nothing | **uncovered** |

In an `unsupported` interval at or after `answerableFrom`: `position` is **false
following**, `unsupported` is **correct rejection**, nothing is **uncovered**. Before
`answerableFrom` in either state, any statement is **justified** and is counted in its
own column; it is neither credited nor charged. In `unknown` regions nothing is counted.

Derived measures, each with its denominator stated in the report:

- **Position error** — distribution of the recorded errors at wrong points, and the
  fraction of answerable supported points that are correct.
- **Loss and recovery** — a loss is a run of wrong or lost points inside a supported
  interval; recovery time is from its first point to the next correct point, or
  "never" if the interval ends first.
- **False following time** — the sum of grid intervals counted false following,
  reported per example and separately for the controls.
- **Coverage and abstention** — the fraction uncovered, and the fraction `unsupported`
  where the truth was supported.
- **Confidence agreement** — decisions binned by claimed confidence into five bins;
  per bin, the observed fraction correct.
- **Timeliness** — for each grid point, the delay from `t` to the `madeAt` of the first
  decision covering it; the fraction exceeding the **decision deadline** (§5.4) is
  "missed deadlines".
- **Exposure** — the total audio time during which the as-decided view was wrong or
  false following.
- **Causality** — pass/fail from the runner's prefix-invariance test (§7.2).

Assessment-accuracy categories are absent and will be added only at the second
milestone.

### 5.4 Provisional research contract (`contracts/research-contract-0.md`)

Provisional because no comparison happens in this step; the first contract of the
milestone that governs a retain-or-reject decision is a separate, human-approved
document. This one exists so the other pieces have numbers to be built against:

- **Capability**: supported following at the harness profile; a known start; zero
  tempo freedom (the tempo handed is the tempo played), so t1 is a probe and not a
  capability claim.
- **Tolerances**: position ±0.25 quarter; detection allowance 150 ms; pitch and onset
  tolerances reserved (±50 cents, ±50 ms) and unused.
- **Delivery conditions**: 48 kHz mono, chunks of 480 samples (10 ms), released on a
  clock the runner controls.
- **Decision deadline**: 200 ms after the audio time a decision refers to.
- **Device and budget**: the development machine, named in the run record with its
  CPU; sustained processing ≤ 25 % of real time, p99 per-chunk processing ≤ 10 ms.
  Provisional until Studio names its device, and every cost result is marked so.
- **Evidence**: `harness-v1`, all development.
- **Comparator**: none yet; the clock follower is the floor.
- **Budget for this step**: no candidate trials beyond the floor; web research is
  bounded to the two questions in §10.

### 5.5 Research notes and ledger

`research/` holds one note per source in the shape the structure document fixes;
`ledger.md` holds one row per run. Both exist, empty apart from their headings, before
the first line of bench code.

## 6. Instrument: evaluator, oracle and report

### 6.1 Evaluator

`bench/src/evaluate/` reads a decision record and a golden and emits the counts of
§5.3 as JSON. It has no opinion about audio and never reads a WAV.

### 6.2 Oracle

`bench/oracle/` holds hand-written decision records against hand-written goldens, with
expected counts worked out by hand in a Markdown table beside each. The cases, chosen
so that every counting rule is exercised by at least one and every column can be wrong
in isolation:

| Case | Record | What it pins |
|---|---|---|
| `o1-perfect` | position = clock × tempo every 50 ms, made at once | all-correct baseline, zero exposure, zero missed deadlines |
| `o2-late` | as o1 but every decision made 300 ms after `refersTo` | correct in hindsight, 100 % missed deadlines, as-decided view lags |
| `o3-silent` | no decisions | 100 % uncovered, nothing charged as wrong |
| `o4-lost-then-found` | `unsupported` for the second bar's first two beats, then correct | one loss, recovery time 2 s |
| `o5-false-follow` | o1's record against the silence control | 100 % false following after `answerableFrom`, justified before |
| `o6-ambiguous` | two candidates half the time, one of them true, on a golden admitting only one | over-ambiguous counted apart from correct |
| `o7-revised` | a wrong decision superseded 100 ms later by a correct one | hindsight correct, as-decided exposure of 100 ms, the earlier decision still present |
| `o8-unknown` | o1 against a golden with an `unknown` middle region | nothing counted in the region, denominators shrink |

The oracle's expected counts are committed and tested; a change to any is a versioned
evaluator change with a ledger row.

### 6.3 Report

`bench/src/report/` renders one run as Markdown: per example, per category, with
denominators, then the causality result, then the cost figures with their conditions,
and only then a one-line summary. It also renders a two-run comparison on the same
examples with the difference per category; the uncertainty column is present and
reads "n = 1 source per example; no interval" at this step, so its absence is visible
rather than forgotten. The report renders from oracle case `o4` before any listener
exists.

## 7. Pipeline: generator, runner, first candidate

### 7.1 Generator `sine-v1`

`bench/src/generate/sine.ts`. Manifest declares: controls **harmonic** (sine only),
**rhythm** (one note per beat, half-beat sounding), **tempo** (any constant BPM),
**dynamics** (constant level); does not control polyphony (one voice), expression or
navigation. Input: an MNX document plus tempo. Output: the WAV, the note labels and the
following labels, written into the golden directly. The tempo control is what makes t1
possible without a second generator.

`bench generate harness-v1` regenerates every example's audio and fails if a hash
differs from the committed one; `bench freeze harness-v1` writes the hashes and marks
the set version. A frozen set refuses regeneration to a different hash.

### 7.2 Runner

`bench/src/run/`. For each example:

1. Reads the golden, hands the listener the intended score and tempo, and releases
   audio in 480-sample chunks. The clock is logical: chunk *k* is released at
   *k* × 10 ms, and `madeAt` is stamped from that clock, not the wall clock, so the
   decision record is identical across machines.
2. Measures wall-clock processing per chunk separately and reports mean, p95, p99,
   the sustained ratio to real time and the maximum backlog had chunks arrived in real
   time. These carry the machine's identity and are declared variable.
3. **Prefix-invariance test**: takes the first half of the example's audio as the
   prefix, runs it followed by (a) the true second half and (b) silence, and requires
   the two decision records to be identical for every decision with `madeAt` inside
   the prefix. A difference is a causality failure recorded on the run.
4. Pins the candidate id and version, set version, evaluator version, delivery
   conditions and machine into `runs/<run-id>/` alongside the record, the counts and
   the report. No randomness exists at this step; the pin field is present and `null`.

### 7.3 Candidate 0: `clock-follower`

The trivial baseline the structure document suggests. It reads nothing from the audio:
at every chunk it emits `position` = released clock × tempo, one candidate,
confidence 1. It never abstains. It is versioned `clock-follower@1` and stays in the
tree forever as the floor.

Its purpose is to be wrong in the right places. On p1 and p2 it is perfect, which shows
the positive path end to end. On c1 and c2 it is false following from
`answerableFrom` to the end, which shows the evaluator sees false following. On t1 its
error grows linearly, reaching 2.5 quarters at the last release, which shows position
error is measured and not merely counted.

## 8. Order of work

Each item's done-when is the condition the ledger row records. Items B and C do not
start until A's documents exist; D, E and F are independent of each other once A is
done; G needs everything.

| Item | Delivers | Done when |
|---|---|---|
| **A. Contracts** | §5.1–§5.5 documents, `golden.schema.json`, empty `research/` and `ledger.md`, `bench/package.json` with `test`, `generate`, `freeze`, `run`, `report` scripts | The documents cross-reference each other, the schema validates a hand-written golden, and the two research questions in §10 have notes (found or not found) |
| **B. Evaluator + oracle** | `bench/src/evaluate/`, eight oracle cases with hand-worked counts | `bench test` passes the oracle; every counting rule in §5.3 is hit by at least one case |
| **C. Report** | `bench/src/report/` | A report renders from `o4` and from the pair (`o1`, `o4`); a failing category is visible above the summary |
| **D. Scores and set** | `s1`, `s2` documents; the five golden records without audio | `s2` validates against the pinned schema; the profile deviations in §3 and §4 are in the records; the partition registry says "development only" |
| **E. Generator** | `sine-v1` with manifest | `bench generate` writes five WAVs whose note labels match the score walk from `compilePerformance` to the sample; a second `generate` reproduces the hashes |
| **F. Runner + candidate 0** | `bench/src/run/`, `clock-follower@1` | A run over `o1`'s golden with a scripted listener reproduces `o1`'s record; the prefix test runs |
| **G. First assessment** | The run of `clock-follower@1` over `harness-v1`, its report, the first ledger row, the set and contracts frozen | The report matches §9 exactly; causality passes; cost figures are recorded with the machine's name |

## 9. Pre-registered predictions for the first run

Written before the run and committed with the plan. The evaluator's grid is 50 ms;
"after answerable" excludes the first 150 ms of each example.

| Example | Correct | Wrong | False following | Lost | Uncovered | Missed deadlines | Exposure | Causality |
|---|---|---|---|---|---|---|---|---|
| p1 | 100 % of answerable points | 0 | n/a | 0 | 0 | 0 | 0 s | pass |
| p2 | 100 % | 0 | n/a | 0 | 0 | 0 | 0 s | pass |
| c1-silence | n/a | n/a | 100 % of answerable points | n/a | 0 | 0 | full length after 150 ms | pass |
| c2-wrong-piece | n/a | n/a | 100 % | n/a | 0 | 0 | as c1 | pass |
| t1-tempo-90 | until the clock and the true position part by more than 0.25 quarter, i.e. through **0.5 s** of audio (clock 0.5 q, truth 0.75 q) | every later point, error rising linearly to 2.5 q at the last release (5.0 s: truth 7.5 q, clock 5.0 q) | n/a | 0 | 0 | 0 | 4.5 s | pass |

Confidence agreement: one bin (1.0) with an observed correct fraction equal to the
weighted share of p1/p2/t1-early points among all position claims. Timeliness: every
decision is made at the chunk that releases its `refersTo`, so delay is 0 to 10 ms and
no deadline is missed. Cost: unmeasurable in effect; the run records whatever the
machine reports, marked provisional.

If the numbers differ, the ledger row says which piece was wrong and the fix is a
versioned change to that piece. The candidate is not touched.

## 10. Bounded research before the first line of code

Two questions, one note each, whether or not the search succeeds:

1. **How has real-time score following been evaluated elsewhere?** The candidate
   sources are the MIREX score-following task and the evaluation paper it derives from
   (Cont and others, ISMIR 2007, to be confirmed by the search). Wanted: their
   error tolerance, their treatment of latency versus musical time, and whether they
   count false following on unrelated audio. The note records whether §5.3's
   ±0.25-quarter tolerance and 200 ms deadline sit inside or outside those norms.
2. **Is there a published trivial baseline for score following?** If a clock or
   tempo-assumed follower appears in the literature as a floor, the note records its
   reported numbers so the ledger can say whether our floor is the usual one. If not,
   the note records the unsuccessful search.

Neither answer changes this step's contracts; both may change the first
human-approved contract that follows.

## 11. What comes after, named but not started

The first question the loop will ask, so that this plan is honest about what its
pipeline is for:

- **Candidate 1**: a single-peak follower. Per chunk, an FFT (hand-rolled radix-2 over
  a 2048-sample window, no dependency), the strongest peak's frequency, nearest score
  pitch, and a position estimate constrained to advance monotonically from the last
  matched note. Expected to match candidate 0 on p1/p2, reject c1 and c2 after their
  `answerableFrom`, and follow t1. That expectation is the hypothesis, and its
  contradicting evidence is any false following on c1 or c2.
- **The re-amplified `harness-v1`**: the same five examples through a speaker and a
  microphone, with the delay declared, as the first entry on the recording-conditions
  track APPROACH asks to raise early.
- **The first human-approved research contract**, drafted from §5.4 once the two
  research notes are in.

None of these is filed as work; they are named here so the next plan starts from a
measured floor and not from an idea.

## 12. Progress and learnings

Appended as items land. Each entry: date, item, what was done, what was learned that
the next item should know.

_(empty)_
