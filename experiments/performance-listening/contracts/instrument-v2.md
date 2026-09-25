# Following instrument v2 — bounded real evidence

Implementation loop: this instrument tests a listener against approved research
contract 1. It preserves the v1 files and original experiment 001. The executable
format is [types](../bench/src/v2/types.ts) plus the fail-closed
[runtime schema](../bench/src/v2/validate.ts); the
[independent oracle](../bench/oracle-v2/README.md) precedes implementation.

## Evidence contract

A v2 golden identifies intended score and audio by SHA-256, mono 48 kHz sample count,
source hash, exact crop origin, tempo, route occurrences, source grouping, partition,
measured profile and independent reviewer/evidence provenance. Source checks are
explicit booleans. Structural validity does not certify them: unchecked recording
facts hold a comparison. Raw evidence stays private. The caller must verify every
asset and review-record hash before evaluating; this evaluator consumes labels and
records, not source files or permissions.

Labels tile the complete clip, including explicit unknown intervals. Each supported
interval has an affine lower/upper position envelope on one route; endpoint width
is at most 0.25 quarter, hence every interpolated width is too. This is a bound on
the entire trajectory, not a claim that two observed bar anchors certify its interior.
A reviewer must independently justify that interpolation envelope. Observed and
interpolated methods are distinct. Acoustic alternatives have their own route/band;
they are not interchangeable with measurement uncertainty. No note assessment exists.

Answerability must incorporate the approved 150 ms allowance after independently
established distinguishing evidence. The schema records `answerableFrom`; it cannot
infer that event or independently verify a reviewer's account. A manifest review must
check that derivation before freezing. Supplying a later arbitrary answerability time
to hide failures is not permitted.

## Counting and uncertainty

Sample on the 50 ms grid, also at interval/answerability boundaries and the final
partial endpoint. An endpoint belongs to its preceding interval; a point exactly at
`answerableFrom` is answerable. Unknown/pending counts remain visible. Reference
coverage is answerable time / complete clip duration, independently of listener
coverage (decision-bearing / answerable points). Every point contributes once.

The live record is the latest available decision about a time no later than the
judged time, ordered first by referred time then emission time. Estimates are held,
not extrapolated. A decision cannot arrive beyond the clip or report note verdicts.

Correctness has lower and upper bounds. Guaranteed correct means candidate tolerance
regions cover the entire true band and every claimed candidate is within tolerance
of at least one admissible band for all of that band's possible positions. Possible
correctness only requires an intersection with truth and possible admissibility of
every candidate. This deliberately conservative upper bound can include mutually
incompatible admissibility choices; it can yield inconclusive, never a false pass.
A route mismatch never matches by quarter value alone. Extra unsupported alternatives
count as wrong claims. The decision tolerance stays ±0.25 quarter.

Wrong/false exposure is **continuously integrated** over answerable time, splitting
at emissions, label boundaries and every affine-band tolerance crossing. It includes
uncertain wrong claims in the upper bound. Unsupported/uncovered states are not false
position claims, but they lose supported-correctness and deadline credit. Longest
episodes reset at unknown/pending regions: this measures labelled exposure episodes,
not an assertion that an unobserved physical episode ended there.

A point's deadline is met if a correct effective decision becomes available by
`t + 0.2 s`; a timely backdated correction can count, but cannot erase live exposure.
Guaranteed/possible correction give conservative missed-deadline bounds. No correct
decision is a missed deadline. Later decisions referring beyond t cannot repair t.
Recovery is the first supported correct grid point after independently labelled
renewed support; no such guaranteed point is inconclusive. Missing interruption
examples are explicitly untested. This grid adds up to 50 ms detection quantisation.

V2 is a new instrument: continuous exposure, conservative uncertainty, visible
unknown denominators and effective-decision deadlines must not be compared with v1
numbers as if the counting convention were unchanged.

## Decision rule and driver

[The rule](../bench/src/v2/retain.ts) applies every applicable absolute gate, conservative
per-example regressions, and the required absolute/relative exposure improvement.
Average exposure within each source piece first, then weight source pieces equally;
synthetic silence has its own source identity. Bounds are not statistical population
confidence intervals. Both records must identify identical goldens, set and instrument.
Missing evidence yields inconclusive; definite failed gates yield reject. If the
comparator exposure bound includes zero, relative improvement is unbounded/undefined
and reported as null, so it cannot earn a pass. An otherwise
eligible zero-exposure comparator stops for no headroom. Development can yield only
provisional selection. Unknown real labels must never be substituted by oracle labels.

Formal retention additionally needs at least three independent connected source
groups, real room-noise and interruption controls, and the
[partition/access registry](../bench/src/v2/partitions.ts). Sharing piece, performer or
session across partitions holds the comparison. Only one frozen reserved comparison
is allowed; inspection/reuse holds it. The registry is an externally frozen evidence
input, not a claim that this code can reconstruct prior access. Final acceptance is
separate. No automatic Studio integration exists.

[The loop driver](../bench/src/v2/driver.ts) reports the next action and remaining
contract budget from recorded state. It holds on missing evidence and unfinished runs,
stops on exhausted budgets or two successive worthwhile-gain failures, and cannot
invent annotations, extend budgets, change the objective or tune on reserved failures.
The approved batch is still unused: instrument construction/oracle fixtures are not
candidate/set assessments. Existing annotation research used two sources and one
bounded question.

The recorded checkpoint pins this document, implementation and handwritten fixtures.
Its cost/causality fields are stipulated test inputs, explicitly **not measured
performance**. A real run still needs reviewed/frozen assets and actual chunk-runner
records, measured costs and complete-record prefix tests. Readiness is an evidence
claim and is kept separate from passing instrument tests.

## Paired execution boundary

[runDevelopmentPair](../bench/src/v2/run-pair.ts) connects reviewed score, WAV and
review-record bytes to the existing copy-isolating chunk runner. Hashes and sample
counts must match; unknown reference coverage, unchecked recording facts and reserved
inputs fail before candidate creation. It produces both real decision streams,
measured costs, six prefix comparisons per example (silence and non-silent futures at
three cuts), evaluator outputs and the decision rule. The caller supplies verified
candidate/set/instrument pins and must reserve the two candidate/set assessments in
its append-only batch history before invoking it, then record returned CPU resources.
No command in this checkpoint runs a listener over the real clips.

The unchanged clock-follower@1 floor needs an integer BPM handoff in this adapter;
non-integer values are refused, not silently rounded. A future non-integer handoff
requires a separately reviewed comparator/version decision. Final microphone latency
is still measured outside this Node replay apparatus.
