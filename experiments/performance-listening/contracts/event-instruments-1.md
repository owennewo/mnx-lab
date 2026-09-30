# Event instruments, version 1 — labels, the event cursor and the end-of-piece assessment

Written 2026-09-30 for [experiment 022](../reports/022-event-instruments.md), under
[development contract 2](development-contract-2.md#instruments), by Claude Opus 5.5
(1M context) in Claude Code. It defines four versioned things, each written before any
code that implements it:

| Name | What it is |
|---|---|
| `performance-label@1` | What a performance was: the score's events, what sounded and when, per-note outcomes, and which events the audio supports as the cursor over time |
| `following-evaluator@2` | How a version-2 record's live cursor is judged against a label |
| `assessment-report@1` | The shape of an end-of-piece assessment: tempo, bar flags and version-2 `note` statements |
| `assessment-evaluator@1` | How an assessment report is judged against a label |

A change to any rule below is a new version of the thing it belongs to. The oracle cases
that pin these rules are in [`bench/oracle-events/`](../bench/oracle-events/README.md).
**No numerical gate is defined here.** The constants below are definitions (what an
answerable moment is, when a bar counts as slow), not pass bars; the pass bars are
proposed separately and approved by the user.

Two constants are used throughout:

- **D = 0.2 s**, the decision deadline, as [contract 1](development-contract-1.md) set
  it and contract 2 keeps it.
- **θ = 0.10**, the bar-flag threshold (provisional: see the assessment section). It is
  a definition of "well below or above", flagged for the user with the gate proposal.

## `performance-label@1`

A label is one JSON object. Times are seconds from the start of the audio. Positions are
Studio's `ScorePosition` in its JSON form (`{ ordinal, metricOffset: { num, den } }`,
decimal strings), as [vocabulary 2](vocabulary-v2.md#wire-details) stores them.

```
{
  format: 'performance-label@1',
  id: string,
  score: { path: string, sha256: string | null },     // null only for hand-made oracle scores
  handoff: { from: ScorePosition, quartersPerMinute: number },
  duration: number,                                    // seconds judged: [0, duration)
  audio: { path, sampleRate, samples, sha256 } | null, // null for oracle labels, which have no audio
  events: [{ index, at: ScorePosition, quarter: number, notes: [{ noteKey, midi }] }],
  performance: {
    events: [{ index, onset: number | null, distinguishableAt: number | null,
               notes: [{ noteKey, outcome, onset?, end?, heardMidi? }] }],
    extras: [{ onset, end, midi: number | null }]
  },
  cursor: { resolution: 'event' | 'bar',
            segments: [{ from, uncertainty, state: 'supported' | 'unsupported',
                         truth: number | null, admissible: number[], rule: string[] }] },
  provenance: { kind: 'generated' | 'hand-worked', recipe?: object, note: string }
}
```

**Events.** An event is the set of score notes sharing one performed onset: a chord or
a single note. `events` lists them in performed order, `index` counting from 0; `at` is
the onset's `ScorePosition`, `quarter` the same position in quarters from the top of the
performance (for tempo arithmetic), and `notes` the score notes with Studio's `noteKey`
and MIDI pitch. For a generated label they come from Studio's compiled performance of the
score; for an oracle label they are written by hand.

**What sounded.** `performance.events` has one entry per score event, in the same
order, and one note entry per score note. A note's `outcome` is one of:

| Outcome | Meaning | Fields |
|---|---|---|
| `matched` | sounded at the written pitch | `onset`, `end` |
| `missing` | not sounded | none |
| `wrong` | sounded at another pitch | `onset`, `end`, `heardMidi` (≠ the written pitch) |
| `dead` | sounded as a pitchless onset: muted or percussive | `onset`, `end` |

An event's `onset` is the earliest onset of its sounded notes, or `null` when every note
is missing (a **missing event**). An event with at least one sounded note is a
**sounded event**; one with some notes missing is a **partial chord**. Sounded events'
onsets increase with their index: the performance plays the events in score order
(true of every stage in contract 2's progression). `end` is when the note stops
sounding, including any ringing. `extras` are sounds that belong to no score note, such
as a stray open string; they never change the cursor truth and are not yet assessed.

**The cursor truth.** `cursor.segments` is a piecewise description of the audio time,
each segment running from its `from` to the next segment's `from` (the last to
`duration`). The first starts at 0.

- `state: 'unsupported'` means the audio is not a performance of this score (silence,
  another piece). Any position claimed there is false following.
- In a `supported` segment, `truth` is the **true cursor**: the latest sounded event by
  that time, or `null` before the first one, or `null` in a bar-resolution label where
  the event is not known.
- `admissible` is the set of events the audio so far supports, any of which counts as
  correct: always containing `truth` when `truth` is not null.
- `uncertainty` is how far the segment's start may be from the true boundary, in
  seconds: 0 for exact labels, the declared band around an anchor otherwise.
- `rule` names the rules below that produced `admissible`.

In an **event-resolution** label, the segments start exactly at 0 (with `truth: null,
admissible: []` if the first onset is later) and at the onset of every sounded event,
whose `truth` is that event; extras start no segment. A **bar-resolution** label has one
segment per sync anchor, `truth: null` and `admissible` the events of the anchored bar:
it is how a recording known only at bar level is judged.

**Admissible sets.** The label states them; the evaluator never infers them. They are
written by these rules, which apply the contract's "answerable only when the audio can
tell":

| Rule | When | Admissible while it applies |
|---|---|---|
| `sounded` | the latest sounded event is distinguishable from what came before | `{truth}` |
| `dead` | the latest sounded events, back to the last distinguishable one, are dead events (every sounded note dead) | that distinguishable event through `truth`: the cursor may lag across pitchless onsets, never run ahead of them |
| `repeated` | `truth` repeats the pitches of the events before it, back to the first of the run | the run's first sounded event through `truth`: re-strikes of one chord may be undercounted, never overcounted |
| `omission-similar` | an omitted event and the sounded event beside it cannot be told apart by their sound | both events, in either order |
| `bar-anchor` | bar-resolution labels | the anchored bar's events |

`distinguishableAt` is the event's onset when the segment that starts there has exactly
`{index}` admissible, and `null` otherwise (a missing event, a dead or repeated event,
an omission it cannot be told from, or any bar-resolution label). **A decision deadline
starts only at a distinguishing event**: the event that ends an ambiguity is the one the
cursor must reach.

Validation rejects a label whose events are out of order, whose note entries do not
match the score notes, whose outcomes lack or carry the wrong fields, whose sounded
onsets decrease, whose event-resolution segments do not start at exactly the sounded
onsets with that event as truth, whose admissible set omits its truth, or whose
`distinguishableAt` disagrees with the segments.

## `following-evaluator@2`

Input: a label and a version-2 record (`listen/contract.ts`, validated by
`listen/validate.ts`). Note statements are ignored.

1. **The shown event.** A position statement shows its heaviest candidate (the first
   of equal weight), as Studio draws it (`listen/backend.ts`). That position shows the
   **last event whose `at` is at or before it**, comparing `(ordinal, metricOffset)`;
   a position before the first event shows event −1. This is the one rule for every
   listener, whether it emits event positions or continuous ones: the cursor is on the
   chord or note it has most recently reached, never on the one it is approaching.
2. **Two views.** The **as-decided** view at time t is `liveView(record, t)`
   (`listen/liveView.ts`): what Studio draws. The **hindsight** view at t is the
   decision with the latest `refersTo ≤ t` regardless of when it was made, the later
   made among equals. Both are exact: they change only at `madeAt` or `refersTo`
   instants, and the evaluator integrates over the exact intervals between breakpoints,
   with no grid, so it needs no special clip length.
3. **Excluded time.** *Pending*: from 0 until D after the start of the first segment
   that has a non-empty admissible set or is unsupported. *Indeterminate*: within
   `uncertainty` of any segment start. Everything else in `[0, duration)` is
   **answerable**.
4. **Grace.** For D after a segment starts (except the first), the previous segment's
   admissible events also count: the cursor has D to move.
5. **Categories** at each answerable moment:

   | Truth | Listener shows | Counts as |
   |---|---|---|
   | supported | an admissible event | **on event** |
   | supported | a non-admissible event after the reference | **ahead** |
   | supported | a non-admissible event before the reference | **behind** |
   | supported | `unsupported` | **abstained** |
   | supported | nothing yet | **uncovered** |
   | unsupported | a position | **false following** |
   | unsupported | `unsupported` | **correct rejection** |
   | unsupported | nothing yet | **uncovered** |

   The reference is `truth`, or the largest admissible event when `truth` is null.
   Showing an event the player never played, after they have gone past it, is behind.
6. **Measures**, for each view, in seconds with their denominators: every category,
   pending, indeterminate, answerable and supported-answerable time; *on event* and
   *ahead* as fractions of supported-answerable time. For the as-decided view only:
   - **exposure**: ahead, behind and false-following time, as a fraction of answerable
     time, and the **longest episode**, a maximal run of exposure that nothing
     answerable or excluded interrupts;
   - **by event**: of the events with a `distinguishableAt`, how many the cursor shows
     at some moment in `[distinguishableAt, distinguishableAt + D]`; each event's delay
     is the first moment at or after `distinguishableAt` that it is shown, whether or
     not within D, or null;
   - **recovery**: for each run of consecutive missing events, whether the cursor
     reaches (as by event) the first distinguishable sounded event after it;
   - **extra notes**: for each extra note whose onset falls in answerable time while
     the cursor is on event, whether the cursor stays on event from that onset until
     the next segment starts (**held**) or not (**moved**); otherwise not assessable.

Causality and cost are measured by the runner (`bench/src/seam/runner.ts`), as
contract 1 defined them.

### Legacy listeners: positions in quarters

The frozen baselines emit version-1 positions, performed quarters from the top, which
the legacy adapter (`bench/src/seam/legacy.ts`) converts with Studio's
`scorePositionAt`; a claim past the end is held at the final boundary. The converted
position is judged by rule 1 like any other: **a continuous position maps to the last
event whose onset it has reached**, so a cursor 0.01 quarter short of an onset is still
on the previous event, and one 0.01 quarter past it is on the next. The final boundary
maps to the last event.

## `assessment-report@1`

What an assessor hands over once the piece has ended:

```
{
  format: 'assessment-report@1',
  tempo: {
    overall: number | null,                                 // quarters per minute
    intervals: [{ from: ScorePosition, to: ScorePosition, quartersPerMinute: number }],
    flags: [{ ordinal: number, direction: 'slow' | 'fast' }]  // bar = performed measure ordinal
  },
  notes: Decision[]   // version-2 `note` statements
}
```

Tempo has no statement kind in vocabulary 2, so the tempo part is a bench shape until
Studio promotes one. Notes use the vocabulary's `note` statement unchanged. Its
verdicts map to this contract's outcomes as follows, and the mapping is part of the
evaluator:

| Verdict | Outcome |
|---|---|
| `match`, `timing`, `duration` | matched |
| `missing` | missing |
| `substitution` with `observed.midi` a number | wrong, heard at that pitch |
| `substitution` with `observed` or `observed.midi` null | dead: a sounded note with no pitch |
| `extra` | not assessed yet; counted, never judged |

## `assessment-evaluator@1`

### The expected assessment

The evaluator derives what a correct assessment says from `performance` alone, so the
same sounds always expect the same assessment, whatever a generator called them. It
never reads `cursor` or any sync anchor.

- **Sounded events** in index order; the first and last are *s₀* and *sₙ*.
- **Local tempo** of each interval between consecutive sounded events *a → b*:
  `60 × (quarter_b − quarter_a) ÷ (onset_b − onset_a)`. It is measured between onsets,
  never from written durations, so an omitted event between them, a rest or a ringing
  note does not read as slowing.
- **Overall tempo**: `60 × (quarter_sₙ − quarter_s₀) ÷ (onset_sₙ − onset_s₀)`, every pause
  included and the final ringing excluded; null with fewer than two sounded events. The
  handed tempo is reported beside it and never judged.
- **Bar tempo**: the same ratio summed over the intervals that **end** in the bar
  (the bar is the performed measure `ordinal` of *b*), so a hesitation is charged to
  the bar whose note came late. Null for a bar no interval ends in.
- **Expected flag** from the ratio *r* = bar tempo ÷ overall tempo: `slow` when
  *r* ≤ 1 − θ, `fast` when *r* ≥ 1 + θ, `none` when |*r* − 1| < θ/2, and `either` in
  between, where a flag is neither required nor a false alarm. A bar with no tempo
  expects no flag.
- **Notes**: every score note's outcome as labelled.

### What it measures

- **Overall tempo**: expected, reported and relative error (`reported ÷ expected − 1`).
- **Intervals**: each expected interval is matched to a reported one with the same
  `from` and `to` event positions. Counts of expected, matched, unreported and
  unexpected intervals, and each matched interval's relative error with the largest
  absolute one.
- **Flags**, separately for `slow` and `fast`: *positives* (bars expecting it),
  *detected* (of those, flagged so), *negatives* (bars expecting neither it nor
  `either`) and *false alarms* (of those, flagged so).
- **Notes**, separately for `missing`, `wrong` and `dead`: positives, detected,
  negatives (every other score note) and false alarms; for `wrong`, how many detected
  notes name the heard pitch; for matched notes, how many are confirmed. A note
  statement is placed by its `at` (exactly the event's position) and `noteKey`; the last
  placed statement for a note stands. Statements that place on no score note are
  *unplaced*; score notes with no placed statement are *unassessed*.

An assessor that flags everything detects every finding and raises a false alarm on
every negative, so any false-alarm limit below 100% fails it.
