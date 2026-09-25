# Research contract 1 — four-bar solo-guitar following

Draft 1, 2026-09-25. **Not approved, not frozen, not executable yet.** This document
proposes the first following milestone and its initial development batch. It does
not supersede research-contract-0 or change any result of experiment 001.

## Decisions already supplied by the user

The intended use is solo guitar through a microphone on this development laptop,
with a known starting position and modest tempo variation. Begin with **The Winner
Takes It All**, then **Dust in the Wind**, initially **four performed bars** each.
Add bars when measured evidence justifies it. These scope decisions are confirmed;
the numerical criteria and budgets below still require contract approval.

## Question and predictions

Can a causal audio listener follow these four-bar performances, reject unsupported
following and respond promptly, where the audio-ignoring clock cannot?

The hypothesis is improved following under observed timing and acoustic variation,
with fewer wrong/false claims than clock-follower@1. Potential regressions are delayed
entry, excessive abstention, wrong repeat occurrences and confusing similar passages.
A candidate that merely improves the positive score while failing controls contradicts
the intended benefit. The clock remains the comparator; no algorithm family is fixed.

## Capability and destination

This milestone concerns following only. It makes no note-error, technique or player
quality judgement. Solo fingerstyle or strummed guitar can contain overlapping notes
and chords; it is not assumed monophonic. Start at the first independently checked
performed bar of the selected excerpt. Supply its nominal tempo once, independently
of the candidate. Follow the declared score route continuously, including written
repeats once those enter the reviewed window. No arbitrary jumps, restarts, transposition,
unscored pauses or accompaniment are in scope for the first batch.

For this draft, modest tempo variation means local beat durations corresponding to
80–120% of the supplied nominal quarter-note BPM, with actual ranges reported. A source
outside this envelope is a separately reported probe, not silently admitted or cropped
after observing candidate failures. Nominal BPM and compliance must be established
from reviewed performance beats, not from a candidate's estimates. There is no assumption
that the two selected pieces have different quarter-note BPM just because one sounds faster.

The destination is real guitar captured through a microphone on **williao-G3-3579**,
Intel Core i7-8750H CPU, Linux. Existing library recordings are development evidence
whose original microphone and production chain remain unverified. Passing those
recordings does not establish live microphone performance or authorize Studio integration.

## Evidence and partitions

| Supply | Identity / role | Readiness |
|---|---|---|
| Existing regression | Frozen harness-v1; all five examples; development | Available; keep its v1 counts unchanged |
| First real development piece | F2msc / recording 1872366 / YouTube K643ZIiG-18; The Winner Takes It All; first four performed bars | Score/anchor preflight and local review WAV ready; human label checks pending |
| Second real development piece | qrpHc / recording 1702681 / YouTube 6caUN3HLJSI; Dust in the Wind; first four performed bars | Local review WAV and first-window structure ready; later route mismatch and human label checks remain |
| Recording-transfer probe | Re-amplified harness-v1 through a named speaker, microphone and room | No capture; cannot substitute for a human guitarist |
| Reserved retention | At least three independently reviewed piece/performer/session groups, disjoint from development | Not allocated; formal retention cannot run |
| Final acceptance | At least three further disjoint groups of real guitar through a named microphone, with reviewed positives, silence/room-noise and wrong-score controls | Not allocated; qualification cannot run |

All excerpts, additional bars, alternate files and perturbations of either selected
piece stay in development. Partition by connected groups sharing piece, performer
or recording session; unknown performer/session identity is a hold, not independence.
Another crop or YouTube encoding is not a new source. The two development pieces do
not support population confidence intervals or independent acceptance claims.

Before the first comparison, a separately recorded manifest must pin the selected
score/audio/annotation hashes, exact decoded sample crop, time origin, route, actual
profile, bounds, reviewed regions, control recipe, partition and reviewer provenance.
No manifest is frozen by this draft. Audio, scores and raw private annotations remain
outside git; approved aggregate metadata and hashes can identify them.

## Labels, controls and uncertainty

Use four performed bars, including a pickup if it is the first performed bar; the
start of bar five is an endpoint, not a fifth bar. The current cached boundaries are
review suggestions only. Independently check the score correspondence, each bar and
beat needed for the label, and the first distinguishing event for each control.
Record conservative timestamp bounds, reviewer identity and the exact score/media
hashes. A selected sample of anchors only triages a source; it cannot certify unreviewed
interiors. No candidate output may supply or repair its own ground truth.

Observed anchors and interpolated positions must remain distinguishable. Unchecked
interiors, uncertain route choices, the lead-in and regions beyond the reviewed endpoint
remain unknown. Require an independently justified position uncertainty no wider than
±0.125 quarter in each judged region. If that bound cannot be established, retain the
region as unknown; do not enlarge the ±0.25-quarter decision tolerance.

At least 80% of each positive four-bar window must have answerable reference labels
before it can support promotion or retention. Report reference coverage separately
from listener coverage. Unsupported labels need their own evidence: pair each real
excerpt with the other piece's intended score, and verify where they become audibly
distinguishable. A changed pitch is not an exact note-error label here. Include the
existing synthetic silence control; real room noise and an independently labelled
brief interruption/recovery pair are required for reserved and final acceptance.

Keep the 150 ms detection allowance, measured from an independently established
first distinguishing event, and the 200 ms decision deadline. Annotation uncertainty
and acoustically admissible alternate positions are different concepts. A new evaluator
must report conservative bounds: guaranteed correct only if the candidate satisfies
the ±0.25-quarter criterion for every possible reference position; ambiguous boundary
cases are indeterminate, never automatically correct. Retention uses lower bounds on
correct/rejection/coverage and upper bounds on exposure and missed deadlines. Unknown
and indeterminate denominators must remain visible. Sparse labels cannot earn a pass
by hiding most of the performance.

## Proposed numerical gates

These are proposed product/research choices, not literature-established universal
thresholds. Human approval is needed before using them to choose a candidate.

| Measure | Gate, per example unless stated otherwise |
|---|---|
| Position tolerance | ±0.25 quarter; correct route occurrence required |
| Supported correct | At least 95% of answerable supported points, using the conservative bound |
| Listener coverage | At least 98% of answerable points have a decision; abstention is reported separately |
| Unsupported correct rejection | At least 95% of answerable unsupported points |
| Wrong/false exposure | At most 5% of answerable labelled time; no continuous episode over 0.5 s |
| Correct-decision deadline | At most 10% of answerable points missed; no correct decision counts as missed |
| Recovery | Within 2 s of renewed answerable support on every independently labelled interruption example; absent examples mean recovery untested |
| Causality | All complete-record prefix checks pass; no failures allowed |
| Sustained processing | At most 25% of real time on the named laptop |
| Per-chunk processing | p99 at most 10 ms; maximum backlog reported |
| Delivery | 48 kHz mono, 480-sample chunks; logical audio clock and wall processing costs reported separately |

For qualification, the same gates apply to every independent acceptance group.
Three groups are a minimum evidence floor, not a claim of broad population validity.
Before Studio integration, additionally measure physical microphone-to-visible-feedback
latency in the actual browser/audio chain; proposed limits are p95 ≤250 ms and p99
≤400 ms on the named laptop, with raw measurements and clock calibration. Node replay
costs cannot satisfy this requirement. Microphone, room, gain/AGC/noise processing and
browser versions must be pinned in that acceptance manifest; none is established today.

## Four-bar progression

Start with Winner bars 1–4. Once a frozen development candidate meets the applicable
positive, negative-control, causality and cost gates, apply the same candidate to Dust
bars 1–4. Unknown labels or unavailable controls stop promotion. Recovery remains
explicitly untested until the interruption evidence exists; an initial-window pass is
only permission to inspect more bars, not a milestone pass.

When both pass, prepare and independently review bars 5–8, then evaluate cumulative
bars 1–8 and keep bars 1–4 as regressions. Apply the same rule once more for bars 9–12.
Each expansion gets a new frozen set version before evaluation. Do not choose a more
favourable four-bar start after seeing failures. First-batch maximum: twelve bars per
piece; further expansion needs a new bounded plan. Confidence means these measured
criteria, not a high confidence number emitted by the candidate.

## Selection, retention and stopping

During development, provisional selection requires every applicable absolute gate,
at least a 5-percentage-point absolute and 25% relative reduction in mean per-source
exposure fraction versus the comparator, and no deterioration exceeding 2 percentage
points in supported correctness, control rejection or deadline misses on any source.
Use the same frozen examples and their conservative uncertainty bounds. If comparator
exposure is zero, that objective has no improvement headroom: stop or propose a new
question; do not quietly switch objectives. Report each source, never only an aggregate.

Formal retain/reject requires the same rule on the independently frozen reserved set;
without it the result is development-only. Retain only if all gates and the worthwhile
gain are demonstrated. Reject a definite regression or definite failed gate. Return
inconclusive when uncertainty or missing evidence prevents either conclusion. Final
acceptance is separate and does not tune candidates. Every run records the decision,
evidence, resources and next action in the ledger and research log.

Proposed batch budget: at most six candidate versions and twelve candidate/set
assessments on development data; up to two CPU-hours on this laptop; at most six new
primary research sources answering at most two bounded questions. Stop after two
successive versions fail the worthwhile-gain criterion, or when any budget is exhausted.
One reserved comparison of one frozen candidate against the comparator is allowed
once the reserved manifest exists. Once inspected, that reserved set becomes development;
a failed candidate cannot tune against it and retry. One separate final acceptance
assessment is allowed after retention. Technical reruns require a documented infrastructure
failure and identical candidate/data bytes; keep the failed run in the history.

## Instrument prerequisite and activation

The frozen v1 schema only represents generated/handwritten provenance, sine recipes
and recording conditions of none. Its evaluator records but does not apply bounded
annotation uncertainty. It must not judge these recordings as if their interpolated
positions were exact. Implement a separately versioned real-audio schema and evaluator,
with hand-worked uncertainty/unknown-region oracles before any real candidate comparison.
Preserve v1, experiment 001 and its byte-reproduction tests.

This draft becomes usable only after explicit human contract approval, the relevant
versioned instrument checks, independently reviewed source facts and frozen manifests.
Approval does not certify a recording or make an unknown region answerable. The later
reserved and final stages remain blocked until their named evidence manifests exist.
The [evidence preparation record](../evidence/README.md) lists the current missing inputs.
