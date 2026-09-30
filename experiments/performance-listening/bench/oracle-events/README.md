# Event oracle, version 1

The hand-worked oracle cases of [`following-evaluator@2` and `assessment-evaluator@1`](../../contracts/event-instruments-1.md),
written for [experiment 022](../../reports/022-event-instruments.md) by Claude Opus 5.5
(1M context) in Claude Code on 2026-09-30, **before either evaluator existed**, from the
rules in the instruments contract. No listener's output was consulted: every record and
report here is a few hand-placed decisions, and every expected number was worked by hand
from the label and the rules. `freeze.json` pins the file's hash; the bench test refuses
a changed file. A correction is a new version with the error explained, never an edit to
match an evaluator.

## The shorthand

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

## The toy scores

| Score | Events |
|---|---|
| `toy8` | Two 4/4 bars of quarters: C4 D4 E4 F4 \| G4 A4 B4 C5 (`n0`–`n7`) |
| `chordsRepeat` | One bar: C major three times, then G major |
| `chordsVaried` | One bar: C, F, G, C major triads |
| `toyDD` | One bar: C4 D4 D4 E4 |

## Coverage

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
