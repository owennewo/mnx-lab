# Event oracles

Hand-worked oracle cases for the event instruments. Each version is frozen by its own
freeze record, and a correction is a new version with the error explained, never an edit
to match an evaluator. Every new or re-versioned oracle is audited by a session that did
not write it (`audit-N.md`, per [contract 2](../../contracts/development-contract-2.md#auditing-an-oracle))
before any listener is judged by it.

| Version | File | Freeze | Instruments | Audit |
|---|---|---|---|---|
| event-oracle@3 | `oracle-3.json` | `freeze-3.json` | [event instruments 3](../../contracts/event-instruments-3.md) | [audit-3.md](audit-3.md): 34 cases, 32 agree, 1 disagree (B1's bar 0 reference and ratio: 30 and 1, not 60 and 0.5, as the freeze recorded), 1 ambiguous (B11's decimal onsets read literally give `none` and clean; as the intended rationals, `either` and unclean); report-level bar measures, the null reference and several suite states uncovered. A corrected version is required before any listener is judged |
| event-oracle@2 | `oracle-2.json` | `freeze-2.json` | [event instruments 2](../../contracts/event-instruments-2.md) | [audit-2.md](audit-2.md): 63 agree, 0 disagree, 3 ambiguous (F9's `indeterminate` figure; no gate affected), settled by the [clarification](../../contracts/event-instruments-2.md#clarification-2026-09-30) |
| event-oracle@1 | `oracle.json` | `freeze.json` | [event instruments 1](../../contracts/event-instruments-1.md) | none; written before the audit rule |

## Event oracle, version 3

Written and frozen before implementation by **Sol 6.1 (high) in Codex** for
[028](../../reports/028-other-bars-suite.md). New cases use direct quarter/ordinal/onset
arrays, one matched note per onset; B7 and B12 use toy unequal-length measures. Every
case carries its hand arithmetic and expected bar fields. B1–B12 cover other-bar exclusion,
three-contributor eligibility, sparse bars, endpoint attribution, steady half speed,
self-dominating intervals, exact-half weights and inclusive threshold/optional boundaries.
S1–S8 cover suite states; selection, normalized margin and retirement cases use synthetic
numbers independent of listener output. Original oracles keep every unchanged rule.

**B1 is a frozen counterexample, not a passing oracle case.** Its first-bar reference
was handwritten as 60; the three-quarter crossing interval ends in the second bar and
makes the other-bar weighted median 30, with ratio 1. Tests preserve the frozen wrong
answer and explicitly reproduce the disagreement. No frozen byte was edited. The
independent audit must decide it; any correction is a later numbered version. The audit
should cover every new case and every added/changed rule, including suite selection and
state arithmetic. Version3 has not judged any listener.

## Event oracle, version 2

Written for [experiment 023](../../reports/023-instruments-decisions.md) by Claude Opus 5.5
(1M context) in Claude Code on 2026-09-30, **before assessment-evaluator@2 or
stage-gates@1 existed**, from the rules in
[event instruments 2](../../contracts/event-instruments-2.md). No listener's output was
consulted. It judges following-evaluator@2 (unchanged), assessment-evaluator@2 and
stage-gates@1.

**What it carries over, and what it re-works.**

- Following cases F1–F10 and their labels are version 1's, byte for byte in content:
  following-evaluator@2 did not change, and none of those labels contains a written dead
  note or a control of the new kind. Each record gains `gates`, the stage-gates@1 gates
  it fails, worked from its version-1 numbers.
- Every assessment case is re-worked, because assessment-report@2 reports intervals as
  seconds and every case's expected measures gain the new ones. A1, A2, A4, A5 and A6
  keep their labels and their verdicts; A3 and A7 change verdict under the typical
  tempo (A3's steady first bar no longer reads fast; in A7 the dragged bar sets the
  typical tempo). New reports: A2-D, A3-C, A4-C, A5-C.
- New: following cases F11 (a written dead note) and F12 (the wrong-score control);
  assessment cases A8 (the typical tempo at an exact half), A9 (the 30 ms floor), A10
  and A11 (written dead notes), A12 (the silence control) and A13 (the wrong-score
  control).

**The shorthand, as version 1's, plus:**

- A score note is `[noteKey, midi]`, or `[noteKey, midi, "dead"]` when the score writes it
  dead. A played event without overrides is matched, including on a written dead note.
- A label may name its `control` kind, recorded as `provenance.recipe.control`.
- A report's intervals are `[from, to, seconds]`. Note overrides add `"dead"`; a
  substitution with `null` is a wrong note whose pitch was not identified.
- A following record's `expected.gates` and a report's `expected.gates` list the gates it
  fails, compared as sets.
- An assessment case's `derived` is `{ handed, overall, typical, intervals: [[from, to,
  seconds, quartersPerMinute]], bars: [[ordinal, quartersPerMinute, ratio, expected]],
  clean }`. A report's `expected` is `{ overallError, intervals: [expected, matched,
  unreported, unexpected, within], worst: [largest seconds error, largest relative
  error], slow, fast, missing, dead: [positives, detected, negatives, false alarms],
  wrong: [..., pitch correct], matched: [positives, confirmed], unassessed, unplaced,
  falseFindings, claimedPlayed, tempoClaims, clean, gates }`.

**New toy scores**: `toyDW`, `toy8` with E4 (`n2`) written dead; `toyW`, two bars of
quarters F#4 G#4 A#4 C#5 | D#5 F#5 G#5 A#5 (`w0`–`w7`), which shares no pitch with `toy8`.

**Coverage of the rules version 2 added or changed**

| Rule | Cases |
|---|---|
| Written dead notes: the cursor may show the note or its predecessor | F11 |
| A written dead note played as written is matched; reporting it dead is a false finding | A10 |
| A written dead note played with a pitch is wrong, even at its written pitch | A11 |
| The `dead` verdict; an unidentified pitch is wrong, not dead | A5 |
| The wrong-score control, for the cursor | F12 |
| Controls for the assessment: nothing claimed played, no tempo claimed (proposed gate) | A12, A13 |
| Flags against the typical tempo, not the overall tempo | A3, A7 |
| The typical tempo at an exact half of the weight | A8 |
| Interval durations: within 10% | A3-C |
| Interval durations: the 30 ms floor on short intervals | A9 |
| An unreported interval fails; an unexpected one is counted | A2-D, A5-B, A10-C |
| Overall tempo gate | A4-C, A9-C |
| Every score note assessed | A1-C |
| No false finding on a clean example | A4-B, A9-C, A10-B |
| Flag-everything passes per example on an unclean one; the pooled false-alarm gates fail it | A1-B, A2-C |
| The cursor gates: `byEvent` alone (F3-D, F4-C, F7-B), `ahead` alone (F9 late-narrow), `onEvent` with `byEvent` (F7-A), and together (F1-B, F2-B, F6-B) | as listed |
| Not exercised: `byEvent` on an example with 20 or more distinguishable events, where 95% suffices | none; every toy score is shorter |
| The control cursor gates | F8, F12 |

## Event oracle, version 1

The hand-worked oracle cases of [`following-evaluator@2` and `assessment-evaluator@1`](../../contracts/event-instruments-1.md),
written for [experiment 022](../../reports/022-event-instruments.md) by Claude Opus 5.5
(1M context) in Claude Code on 2026-09-30, **before either evaluator existed**, from the
rules in the instruments contract. No listener's output was consulted: every record and
report here is a few hand-placed decisions, and every expected number was worked by hand
from the label and the rules. `freeze.json` pins the file's hash; the bench test refuses
a changed file. A correction is a new version with the error explained, never an edit to
match an evaluator.

### The shorthand

`oracle.json` writes labels, records and reports compactly; `bench/src/events/oracle.ts`
expands them into `performance-label@1` labels, version-2 records and
`assessment-report@1` reports without computing anything:

- **Scores** list events as `{ at: "ordinal:num/den", quarter, notes: [[noteKey, midi]] }`.
- **Labels** give each event's `onset` and `end` (every note matched unless overridden),
  `missing: true` for a missing event, note overrides `"missing"`, `{ "wrong": heardMidi }`
  or `{ "dead": end }`, each event's `distinguishableAt` in `distinguishable`, extras as
  `[onset, end, midi]`, and the cursor segments in full.
- **Records** are `[madeAt, event]`, `[madeAt, "u"]` for an `unsupported` statement, or
  `[madeAt, event, refersTo]`; `refersTo` is otherwise `madeAt`. A position is the event's
  `at`, weight 1, confidence 1.
- **Reports** give tempo as written, flags as `[ordinal, direction]`, and notes by
  exception: `default` verdict, per-key overrides (`"missing"`, `["substitution", midi |
  null]`), `omit` (no statement) and `misplace` (the statement placed at another event).

### The toy scores

| Score | Events |
|---|---|
| `toy8` | Two 4/4 bars of quarters: C4 D4 E4 F4 \| G4 A4 B4 C5 (`n0`–`n7`) |
| `chordsRepeat` | One bar: C major three times, then G major |
| `chordsVaried` | One bar: C, F, G, C major triads |
| `toyDD` | One bar: C4 D4 D4 E4 |

### Coverage

| Rule in contract 2 | Cases |
|---|---|
| Holding through a hesitation | F1 |
| Recovery after a missing event | F2, F10 |
| Dead-note ambiguity, deadline from the distinguishing event | F3, F3b |
| Repeated-chord ambiguity, deadline from the distinguishing event | F4 |
| Omission before a similar event | F10 |
| Wrong notes and partial chords: the cursor moves, the notes are marked | F5, A1 |
| An extra note must not move the cursor | F6 |
| Ahead counted separately | F1-B, F2-C, F3-C, F3b-C, F4-D, F6-B, F9-L2 |
| Abstention, no statement yet, and a late revision in hindsight | F7 |
| False following on a non-performance | F8 |
| Bad sync: only the reference's uncertainty grows | F9 |
| Local tempo between matched onsets; a missing note is not slowing | A2 |
| A hesitation located by bar | A3 |
| Slow but steady playing: no flags | A4 |
| An assessor that flags everything fails | A2-C |
| Dead notes in the assessment | A5 |
| A bar near the threshold is optional | A7 (depends on θ = 0.10) |
