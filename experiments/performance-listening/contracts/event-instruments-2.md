# Event instruments, version 2 — the user's decisions on experiment 022, and the controls

Written 2026-09-30 for [experiment 023](../reports/023-instruments-decisions.md), under
[development contract 2](development-contract-2.md#instruments), by Claude Opus 5.5
(1M context) in Claude Code. It versions [event instruments 1](event-instruments-1.md)
for the decisions the user made after experiment 022, and adds the rules that apply the
approved gates. Version 1 is not edited and stays in force for everything recorded under
it. Each thing below was written before any code that implements it.

| Name | Status in this version | What changed |
|---|---|---|
| `performance-label@2` | new version | Written dead notes; the `dead` cursor rule judged on pitchless sound; negative controls |
| `following-evaluator@2` | **unchanged** | Reads `performance-label@1` and `@2`. None of its rules changed |
| `assessment-report@2` | new version | Intervals as durations in seconds; notes as [vocabulary 2.1](vocabulary-v2.md#version-21-the-dead-verdict) statements, with the `dead` verdict |
| `assessment-evaluator@2` | new version | Flags against the typical tempo; interval durations with their tolerance; clean examples and false findings; the `dead` verdict; intended dead notes matched; what a control's assessment claims |
| `stage-gates@1` | new | The gates approved for stages 1–3, applied per example and pooled over a stage; the control-assessment gate, **proposed and awaiting the user** |

The oracle cases that pin these rules are **event-oracle@2** in
[`bench/oracle-events/`](../bench/oracle-events/README.md). The constants D = 0.2 s and
θ = 0.10 are unchanged. Everything this document does not restate is as version 1
defines it.

## `performance-label@2`

The shape of `performance-label@1`, with `format: 'performance-label@2'` and four changes.

**1. Written dead notes.** A score note may carry `dead: true`, when the score writes it
as a dead note (`_x.mnxLab.tab.technique.dead`, as Guitar Pro scores carry):

```
events: [{ index, at, quarter, notes: [{ noteKey, midi, dead?: true }] }]
```

`midi` stays the written pitch, which a dead note does not sound.

**2. Outcomes on a written dead note.** The outcome says whether the sound agrees with
the score, so on a note the score writes dead:

| Outcome | Meaning on a written dead note | Fields |
|---|---|---|
| `matched` | sounded as a pitchless onset, as written | `onset`, `end` |
| `missing` | not sounded | none |
| `wrong` | sounded with a pitch; `heardMidi` is that pitch, which may equal the written `midi`, because a dead note has no pitch to match | `onset`, `end`, `heardMidi` |
| `dead` | not allowed: a pitchless onset is what the score asks for, so it is `matched` | |

On every other note the outcomes are version 1's, and `wrong` still requires
`heardMidi ≠ midi`.

**3. The `dead` cursor rule is judged on the sound.** A sounded note is **pitchless**
when its outcome is `dead`, or `matched` on a written dead note. An event is pitchless
when every one of its sounded notes is. The `dead` rule of version 1 becomes:

| Rule | When | Admissible while it applies |
|---|---|---|
| `dead` | the latest sounded events, back to the last distinguishable one, are pitchless events | that distinguishable event through `truth`: the cursor may lag across pitchless onsets, never run ahead of them |

So the same audio gets the same admissible sets whether or not the score writes the
note dead. The other rules, `sounded`, `repeated`, `omission-similar` and `bar-anchor`,
are unchanged.

**4. Negative controls.** A label whose every segment is `unsupported` is a
**control**; any other label is a **performance**. In a control, no note of the handed
score was performed: every event is missing, and whatever sounded is listed in
`extras`. Contract 2 names two kinds, recorded as `provenance.recipe.control`:

- `silence`: digital silence of the same length as a stage example, handed that
  example's score. No extras.
- `wrong-score`: a stage example's audio, handed an unrelated score. Every note of the
  audio is an extra, with its onset, end and pitch.

Validation adds to version 1's: a written dead note never has outcome `dead`, and its
`wrong` outcome may name its written pitch; a label with no supported segment has every
event missing. It keeps every version-1 check, including that
`distinguishableAt` agrees with the segments.

## `following-evaluator@2`, unchanged

Its rules read only the positions of events, the sounded onsets, `extras`, the cursor
segments and `distinguishableAt`, and none of those means anything different under
`performance-label@2`: the change to the `dead` rule is written into the label's
admissible sets, which the evaluator reads and never infers. It judges a
`performance-label@2` exactly as it judges version 1. On a control, the whole label is
unsupported, so its answerable time is correct rejection, false following or
uncovered; recovery has one run of missing events with no event after it (not
assessable); and every extra is not assessable, because the cursor is never on event.

## `assessment-report@2`

```
{
  format: 'assessment-report@2',
  tempo: {
    overall: number | null,                                   // quarters per minute
    intervals: [{ from: ScorePosition, to: ScorePosition, seconds: number }],
    flags: [{ ordinal: number, direction: 'slow' | 'fast' }]  // bar = performed measure ordinal
  },
  notes: Decision[]   // vocabulary 2.1 `note` statements
}
```

The one change to the tempo part: an interval reports its **duration**, the seconds
between the two sounded events' onsets, instead of a tempo. The approved gate judges
durations, and a duration is what an onset detector measures; the evaluator turns it
into a tempo where one is needed. `seconds` is finite and positive.

Note statements are vocabulary 2.1's. Verdicts map to outcomes as follows, and the
mapping is part of the evaluator:

| Verdict | Outcome |
|---|---|
| `match`, `timing`, `duration` | matched |
| `missing` | missing |
| `substitution` with `observed.midi` a number | wrong, heard at that pitch |
| `substitution` with `observed` or `observed.midi` null | wrong, with the pitch heard not identified |
| `dead` | dead |
| `extra` | not assessed yet; counted, never judged |

Version 1 read a pitchless substitution as dead. Contract 2 separates them: a note heard
but not identified is not the same finding as a muted one.

## `assessment-evaluator@2`

### The expected assessment

As in version 1, it is derived from `performance` alone and never reads `cursor` or any
sync anchor.

- **Sounded events** in index order, *s₀* to *sₙ*.
- **Intervals**, between consecutive sounded events *a → b*: the **duration**
  `onset_b − onset_a` in seconds, the **score distance** `quarter_b − quarter_a` in
  quarters, and the **local tempo** `60 × distance ÷ duration`.
- **Overall tempo**: `60 × (quarter_sₙ − quarter_s₀) ÷ (onset_sₙ − onset_s₀)`, null with
  fewer than two sounded events. Unchanged.
- **Typical tempo**: the median of the intervals' local tempi, each weighted by its score
  distance. Sort the intervals by local tempo, ascending, and let *W* be the total
  distance. Walk them accumulating distance; at the first interval where the accumulated
  distance reaches *W*/2:
  - if it exceeds *W*/2, the typical tempo is that interval's local tempo;
  - if it equals *W*/2 (within 1e-9 quarters), the typical tempo is the mean of that
    interval's local tempo and the next interval's in the sorted order.

  Null with no interval. This is contract 2's reference for variation: a long hesitation
  drags the overall tempo down, but moves a median very little.
- **Bar tempo**: unchanged. The same ratio summed over the intervals that **end** in the
  bar, the bar being the performed measure `ordinal` of *b*; null where no interval ends.
- **Expected flag** from *r* = bar tempo ÷ **typical** tempo: `slow` when *r* ≤ 1 − θ,
  `fast` when *r* ≥ 1 + θ, `none` when |*r* − 1| < θ/2, and `either` in between. A bar
  with no tempo, or a piece with no typical tempo, expects `none`.
- **Notes**: every score note's outcome as labelled, and the pitch heard for a wrong one.
- **Clean**: the example is clean when every score note is matched, `extras` is empty
  and every bar expects `none`. That is contract 2's clean example: steady, with every
  note right, at any tempo.

### What it measures

- **Overall tempo**: expected, reported and handed, and the relative error
  `reported ÷ expected − 1`; null when either is null.
- **Intervals**: each reported interval is matched to an expected one with the same
  `from` and `to` event positions; the rest are *unexpected*. Counts of expected,
  matched, *unreported* (expected, with no match) and unexpected intervals. For each
  matched interval: the error in seconds, `reported − expected`, the relative error
  `reported ÷ expected − 1`, and whether it is **within tolerance**:
  |error| ≤ max(0.10 × expected, 0.030 s), the tolerance the user approved. The count
  within tolerance, and the largest absolute error in seconds and the largest absolute
  relative error over the matched intervals, each null when none matched.
- **Flags**, separately for `slow` and `fast`, against the typical tempo: positives,
  detected, negatives (bars expecting neither that direction nor `either`) and false
  alarms, as in version 1. Flags on a bar the score does not have are *unplaced*.
- **Notes**, separately for `missing`, `wrong` and `dead`: positives, detected,
  negatives (every other score note) and false alarms; for `wrong`, how many detected
  notes name the heard pitch (an unidentified pitch never does); for matched notes, how
  many are confirmed. Placement is version 1's: a statement stands on the score note of
  its `noteKey` at exactly its event's position, the last placed one standing; others are
  *unplaced*, and score notes with none are *unassessed*.
- **False findings**: the sum of the false alarms of `slow`, `fast`, `missing`, `wrong`
  and `dead`.
- **Claimed played**: the score notes whose standing statement says they sounded, as
  matched, wrong or dead.
- **Tempo claims**: 1 if the report gives an overall tempo, plus the number of reported
  intervals, plus the number of flags.
- **Clean**, from the expected assessment.

An assessor that flags everything raises a false alarm on every negative. A report
that claims a control's notes were played has a positive *claimed played*.

## `stage-gates@1`

How an example's measures become a verdict, under the gates the user approved for the
sine stages 1–3 ([contract 2](development-contract-2.md#the-gates-approved-for-stages-13)).
Each gate is named; an example **passes** when no gate applying to it fails. Fractions
are compared exactly as written; ≥ and ≤ include the bound.

**The live cursor, per example.** On a *performance*:

| Gate | Passes when |
|---|---|
| `onEvent` | on event ≥ 0.95 of supported answerable time |
| `ahead` | ahead ≤ 0.01 of supported answerable time |
| `exposure` | exposure ≤ 0.05 of answerable time |
| `episode` | longest exposure episode ≤ 0.5 s |
| `byEvent` | with fewer than 20 events that have a `distinguishableAt`, every one of them reached; otherwise at least 0.95 of them |

A fraction whose denominator is zero fails its gate, except `byEvent`, which passes with
no distinguishable event (as on a bar-resolution label). On a *control*, contract 1's
control gates, unchanged:

| Gate | Passes when |
|---|---|
| `rejection` | correct rejection ≥ 0.95 of answerable time |
| `exposure` | exposure, which on a control is false following, ≤ 0.05 of answerable time |
| `episode` | longest exposure episode ≤ 0.5 s |

**The assessment, per example.** On a *performance*:

| Gate | Passes when |
|---|---|
| `overall` | the overall tempo's relative error is within ±0.05; when the expected overall tempo is null, the reported one is null too |
| `intervals` | no expected interval is unreported and every matched interval is within tolerance |
| `notes` | no score note is unassessed |
| `clean` | the example is not clean, or it has no false finding at all |

On a *control* (**proposed by experiment 023, awaiting the user's approval**):

| Gate | Passes when |
|---|---|
| `claims` | no score note is claimed played |
| `tempo` | no tempo claim: no overall tempo, interval or flag |

A control's notes may be stated missing or left unassessed: an assessor that says only
"this is not a performance of this score" is honest. A listener that produces no
assessment fails every assessment gate that applies to the example.

**Pooled over a stage's performances.** Controls are excluded here and judged only by
their own gates (**part of the same proposal**), because a control's every note is
missing and would otherwise dominate the missing-note rates.

| Gate | Passes when |
|---|---|
| `recovery` | recovered ≥ 0.90 of the assessable recovery cases; not applicable with none |
| `extrasHeld` | held ≥ 0.90 of the assessable extra notes; not applicable with none |
| `found:<kind>` | for each of `slow`, `fast`, `missing`, `wrong` and `dead`: detected ≥ 0.90 of positives; not applicable with none |
| `falseAlarms:<kind>` | for each kind: false alarms ≤ 0.05 of negatives; not applicable with none |

**Causality and cost, per listener**: every prefix check passes, the sustained cost
ratio is ≤ 0.25, and the 99th-percentile chunk time is ≤ 10 ms, as contract 1 defined
them and the runner measures them.

A stage passes when every example of it, its controls and every earlier stage pass,
the pooled gates pass, and causality and cost pass.
