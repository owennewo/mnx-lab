# Event instruments, version 5 — sentinels for the guitar stages

2026-10-06, **Claude Opus 5.5 (high) in Claude Code**, for
[experiment 052](../reports/052-sentinel-instrument.md). This version defines
**stage-gates@3** and freezes **event-oracle@5**. It carries out two directions the user
adopted:

- [The second amendment, decision 3](development-contract-2.md#amendment-2026-10-05-host-stalls-guitar-sweeps-sentinels-and-the-outside-review),
  R10's rule: a substage's sentinels come from its deviation examples only, and ties on
  margin are broken by severity in the direction of difficulty (slowest tempo, longest
  pause, most extreme bar factor) before by name.
- [The first amendment, decision 3](development-contract-2.md#amendment-2026-10-04-sampled-guitar-replaces-the-sines-and-the-promotion-rule):
  on the guitar stages the chunk p99 gate is replaced by the cursor deadline on a clock
  that includes the listener's measured compute. A margin over a guitar example
  therefore has no p99 entry.

Everything else is inherited unchanged from [event instruments 3](event-instruments-3.md)
and [4](event-instruments-4.md): the numerical gates, following-evaluator@2,
assessment-evaluator@3, the substage states, retirement, run plans and the
normalised headroom of every other gate. No gate is loosened. stage-gates@2 and its
oracle stay as they are; the retired sine sets keep their record.

## 1. The candidate pool

A substage is either the **base** substage of its stage (stage 1: clean, steady
performances) or names one **deviation** (`hesitation`, `slowed-bar`, `rushed-bar`, …).
A performance's deviation is the `deviation` of its generator recipe, or none for a clean
performance.

- A **base** substage's candidate performances are its examples with no deviation.
- A **deviation** substage's candidate performances are its examples whose deviation is
  the substage's. Clean parents and any other example in its set are not candidates:
  stage 1's sentinels already carry the clean parents.
- A **control's parent** is the performance whose audio it carries (the wrong-score
  control) or whose length it takes (the silence control). A control is a candidate when
  its parent is a candidate performance. A control whose parent is not among the
  substage's evaluated examples is refused.
- A substage with no candidate performance is refused.

Guitars are pooled: a substage's pool spans every development guitar, as its pass does.

## 2. The margin of one example

The margin is the minimum normalised headroom over every applicable gate entry, exactly
as in [instruments 3](event-instruments-3.md#deterministic-sentinels), with one change
on a stage whose deadline is compute-inclusive (every guitar stage):

| Entry | Headroom | Applies |
|---|---|---|
| binary gates (cursor, assessment, cost, every prefix check) | 1 when all pass; otherwise the example is **refused**, not ranked | always |
| exposure fraction | `(.05 − fraction)/.05` | always |
| longest episode | `(.5 − longest)/.5` | always |
| sustained cost ratio | `(.25 − ratio)/.25` | always |
| chunk p99 | `(10 − p99 ms)/10` | **only on a chunk-p99 stage (the retired sines); never on a guitar stage** |
| on event | `(fraction − .95)/.05` of supported answerable time | performances |
| ahead | `(.01 − fraction)/.01` | performances |
| each event's delay | `(.2 − delay)/.2`; an unreached event contributes 0 | performances |
| overall tempo | `(.05 − |error|)/.05` | performances with an expected overall tempo |
| each interval | `(max(.1 × expected, .03) − |error s|)/max(.1 × expected, .03)` | performances |
| correct rejection | `(fraction − .95)/.05` of answerable time | controls |

On a guitar stage the event delay is the one following-evaluator@2 reads from the
decision record, whose `madeAt` already includes the listener's measured compute
([observation-seam@5](observation-seam-5.md)); the margin does not recompute it. An
example with no prefix check is refused. A value below zero by more than 1e-12 is a
failed gate and the example is refused; within 1e-12 it is clamped to 0. Margins are
compared as computed, in IEEE double precision; the oracle states expected margins to
1e-12.

## 3. Severity

Every candidate performance gets a **severity**, a tuple compared element by element;
the larger tuple is the harder example.

| Substage | Severity tuple |
|---|---|
| base (stage 1) | (−tempo) |
| `hesitation` | (pause seconds, −tempo) |
| `slowed-bar`, `rushed-bar` | (|factor − 1|, −tempo) |

`tempo` is the performance's steady tempo in quarters per minute (for a deviation, its
parent's tempo), `pause` the hesitation's added silence in seconds, and `factor` the
altered bar's tempo factor, each as the generator recipe records it. `|factor − 1|` is
computed in double precision from the recorded factor. A substage whose deviation has
no row here, or a candidate missing a field its row needs, is refused: a later version
defines the next deviation's severity before its substage can choose sentinels.

A control's severity is its parent's.

## 4. Order and selection

Candidates are ordered by **margin ascending**; equal margins (exactly equal doubles) by
**severity descending**; equal severities by **ascending ASCII example ID**. The order
does not depend on input order.

- **Performances:** the first three in that order; fewer than three candidates means
  all.
- **Controls:** for each performed score of the candidate performances, in ascending
  ASCII order of score name, the first silence control and then the first wrong-score
  control in that order among the candidate controls whose parent was performed from
  that score. A control's performed score is its parent's score, never the score it is
  handed. A performed score missing either kind is refused.

Duplicate example IDs, and a margin that is not a finite number at least 0, are refused.

## 5. When the choice is made, and what the suite record holds

Sentinels are chosen from a substage's passing full-sweep evaluation, frozen with the
substage, and re-chosen only at a full sweep, as before. A failing sentinel reopens its
substage. The routine plan, the states and retirement are stage-gates@2's, unchanged.

The **guitar suite record** (`bench/suite-record-guitar.json`, format
`contract2-suite@2`) holds, for each guitar substage: its status; the evaluation it was
chosen from, by path and hash; the listener and instrument versions; the candidate
count; each sentinel's ID, margin, limiting entry, severity and private artifact by path
and hash. It also names the sets that run only in a full sweep, the frozen comparators
cited by hash, and the next full sweep due. The sine suite record
(`bench/suite-record.json`) is history and is not edited.

The record is written with `"selection": "provisional"` until an independent session has
audited event-oracle@5 under [the audit rule](development-contract-2.md#auditing-an-oracle).
A provisional selection is not used by any run. The audit's agreement makes it
`"in force"`, recorded with the audit's path and hash; a disagreement is resolved by a
new oracle version and a fresh selection.

## 6. Coverage

| Rule | Oracle cases |
|---|---|
| Base pool takes clean performances only | K3 |
| Deviation pool excludes clean parents and their controls | K1 |
| Control is a candidate through its parent; parent absent refused | K1, Z4 |
| Margin: no p99 entry on a guitar stage; p99 entry on a chunk-p99 stage | G3 |
| Margin: delay, cost, interval, overall, onEvent entries | G1, G2 |
| Margin: episode and exposure limit | G6 |
| Margin: controls (rejection, cost) | G4, G5 |
| Margin: unreached event gives 0 | G7 |
| Margin: failed binary gate, failed or absent prefix check, late event refused | G8–G11 |
| Severity, base: slower first | K3 |
| Severity, hesitation: longer pause, then slower | K2, K4 |
| Severity, slowed and rushed bar: larger \|factor − 1\|, then slower | K6, K7 |
| Margin beats severity | K2 (wrong-score control), K4 |
| Name last, after margin and severity | K5 |
| Control severity is the parent's | K2, K3, K4, K6 |
| Controls per performed score, through the parent | K8, K10 |
| Fewer than three candidates | K8 |
| Input-order independence | K9 |
| Refusals: undefined severity, missing field, no candidate, missing control kind, duplicate, invalid margin | Z1–Z8 |

Suite states, retirement and run plans are covered by event-oracle@4 (stage-gates@2
rules, unchanged). The suite record's fields are checked structurally by the run that
writes it, not by a hand case.
