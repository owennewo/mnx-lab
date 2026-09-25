Version v1; draft instrument contract. Freeze only after item G.

# Evaluator counting rules (`contracts/evaluator-rules.md`)

The evaluator samples audio time on a fixed **50 ms grid** and evaluates two views at
each grid point:

- **As-decided**: the decision a player would have been shown at that moment. Among
  decisions with `madeAt ≤ t`, take the one with the largest `refersTo` not exceeding
  `t`; among equals, the latest `madeAt`. This is the persistence rule of §5.1 made
  operational: a decision stands until one with a later or equal `refersTo` arrives,
  and a backdated correction cannot displace it.
- **Hindsight**: the final superseding decision for each `refersTo`.

At each grid point in a `supported` interval, at or after `answerableFrom`:

| Listener said | Counts as |
|---|---|
| `position`, some candidate within ±0.25 quarter of the true position and the candidate set within the admissible set | **correct** |
| `position`, a candidate within tolerance but the set wider than admissible | **over-ambiguous** (reported separately, never as correct) |
| `position`, no candidate within tolerance | **wrong**; its error in quarters is recorded |
| `unsupported`, interval not `abstainable` | **lost** |
| `unsupported`, interval `abstainable` | **abstained** (its own column; neither correct nor lost) |
| nothing | **uncovered** |

In an `unsupported` interval at or after `answerableFrom`: `position` is **false
following**, `unsupported` is **correct rejection**, nothing is **uncovered**. Before
`answerableFrom` in either state the point is **pending**: any statement is counted in
the pending column and is neither credited nor charged, but a `position` there with
confidence ≥ 0.8 is additionally counted as a **confident pending claim**, so a
listener that guesses before the evidence exists is visible even though it is not
penalised. In `unknown` regions nothing is counted.

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
- **Timeliness** — for each answerable grid point, the delay from `t` to the `madeAt`
  of the first decision covering it **that the rules above count as correct or as a
  correct rejection**. A point whose first such decision arrives after the **decision
  deadline** (§5.4), or never, is a missed deadline; a wrong or absent decision is a
  missed deadline, not a missing latency observation. Prompt output that says the
  wrong thing earns nothing here.
- **Exposure** — the total audio time during which the as-decided view was wrong or
  false following, plus the longest continuous such episode. It is computed from the
  as-decided view alone, so a later correction shortens nothing already accrued.
- **Causality** — pass/fail from the runner's prefix-invariance test (§7.2).

Assessment-accuracy categories are absent and will be added only at the second
milestone.


Related: [vocabulary](vocabulary.md), [golden format](golden-format.md),
[counting rules](evaluator-rules.md), [provisional research contract](research-contract-0.md).

## Operational details fixed before the oracle

Sample at t = 0.05, 0.10, …, including the last grid point at an interval end.
No decision is expected before the first chunk at 0.01 s. Counts are grid-point
counts, not independent observations. Time sums use the right-edge cell (t−0.05,t],
clipped to the labelled interval and answerableFrom. Thus an answerable point exactly
at answerableFrom has zero duration; a wrong point at 0.55 s contributes (0.50,0.55].
A non-grid final partial cell is also evaluated at its right edge with its actual
width. This fixes endpoint arithmetic without extending supported labels into a tail.

In hindsight a statement covers [refersTo, next distinct refersTo); the last persists.
Revisions compete only at equal refersTo. For timeliness, examine all revisions of
the statement covering t and find the first correct one, not a later statement about
a different time. A stale live estimate is evaluated at t without extrapolating it.
Delay is max(0, madeAt−t); deadline equality passes. No correct decision means null
delay AND one missed deadline. Record per-point delays as well as their distribution.

A candidate matches a trajectory only on the same route and within the inclusive
position tolerance. Correct requires a truth match AND every candidate matching an
admissible trajectory. A truth match with an excessive set is over-ambiguous. Wrong
error is the nearest absolute quarter distance on the true route; null means no
candidate on that route, reported separately, never silently zero.

Loss episodes start at a wrong or lost point, stay unresolved until a correct point,
and are censored at the end of that supported interval. Over-ambiguous, uncovered or
abstained points do not start losses or count as recovery. Exposure counts only wrong
and false-following cells in the live view; unknown gaps break continuous episodes.

Report both views with separate denominators (supported, unsupported, pending,
answerable). Coverage is uncovered / answerable. Abstention is (lost + abstained) /
supported, with its components separate. Confidence bins are [0,.2), [.2,.4),
[.4,.6), [.6,.8), [.8,1]; count position claims at grid points, not feed calls.
Each bin reports all claims, pending claims, correct claims / all claims, and
correct claims / answerable claims. Pending is neither correct nor wrong; its
separate count makes the all-claims fraction interpretable. Unsupported carries no
confidence. The weighted all-claims fraction is the prediction in FIRST_STEP §9.

The evaluator never reads audio or golden.expected as an answer. Causality comes
only from the runner; an oracle-only report says not run. No retention decision is
implemented. Instrument versions change when these meanings or oracle answers change.
