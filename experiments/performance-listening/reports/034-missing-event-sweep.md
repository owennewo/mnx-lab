# 034 — One missing interior event and the batch-end full sweep

## Pre-registration

2026-10-01. **Sol 6.1 (high) in Codex**. Run 5 of the five-experiment main-track
batch, and its last. One diagnostic experiment of unchanged **event-chain@3**; no
listener, evaluator, oracle, score or gate changes.

### Question and why

Does the incumbent hold its cursor while one interior event is omitted, recover at
the next sounded event, report the omitted note as `missing`, and assess the interval
spanning the omission at the unchanged tempo? Does the batch-end full sweep preserve
all earlier passed substages, including held-note hesitation and rushed bar? This is
open question 22 and the next deviation in [contract 2](../contracts/development-contract-2.md#order-of-work).
It serves the current batch's main-track goal and discharges its sweep obligation.

The scope is the simplest monophonic s1/s2 sine scores. Every interior event is tested,
including omissions on either side of s2's bar boundary. First/last omissions have
no acquired-predecessor/next-event recovery pair; repeated-pitch ambiguity on s3,
multiple omissions and chords are later evidence, not claimed here.

### Alternatives and research

The frozen live chain allows skips of up to two events and does not advance on
silence. A missing note should leave its predecessor shown until the next pitch
selects a skip transition. In contrast, a clock advances into the silence, and a chain
without skips could stall. Per-event and pooled recovery results distinguish these.
The offline pitch alignment permits deletion; if it aligns correctly, the spanning
interval has two score quarters and two beats of elapsed time, so no slowing is
expected. Missing-note counts and interval errors separate deletion/alignment errors
from tempo arithmetic errors. These are code-based predictions, not measurements.

[024's research](../research/event-chain-024.md) remains applicable. Re-read the
primary [Nakamura et al. paper abstract, arXiv v1](https://arxiv.org/abs/1512.07748)
on 2026-10-01: its monophonic error/skip HMMs motivate explicit skip states; its
clarinet recovery results and more general algorithm establish no accuracy for this
hard-emission sine chain. No method or threshold is selected from new output.

### Stage, evidence and execution

1. Land this pre-registration before writing new stimulus/runner code, generating
   audio or executing the experiment. Run **g034-missing-event-sweep**, source tag
   `g034-missing-event-sweep-source`. Refuse an uncommitted source, a pre-registration
   not landed on origin/main or changed from its original prefix, a source-tag mismatch,
   and any existing run ID. Never overwrite a set or run.
2. Freeze **contract2-missing-event-v1** privately. Copy the 24 clean stage1-v3
   performances/controls unchanged. For each s1/s2 parent at 45, 63, 90, 99 quarters
   per minute (handed 90), silence exactly one interior event's original sample span;
   keep clip length, all other PCM samples, onsets and note ends byte-identical.
   Use every index 1..N-2 independently: s1 2 ×4 =8, s2 6 ×4 =24; **32 omissions,
   64 paired controls**, plus clean parents: **120 examples**. Silence controls have
   equal length and exactly zero PCM; wrong-score controls hand the performance audio
   to distant w2. Near-miss w1 belongs beside the subsequent wrong-note substage.
3. Labels use unchanged performance-label@2. Derive from the frozen parent: the
   omitted event's onset/distinguishableAt become null and its note becomes missing
   without timing; remove its cursor segment so its predecessor holds until the next
   sounded event. All remaining events are distinct and individually answerable.
   Check independent score/sample boundaries, exactly one missing note, all other
   played entries unchanged, next-event truth and the two-quarter spanning interval;
   validate every label and hash every asset. This is a deterministic stimulus label
   using existing audited omission rules, not a new evaluator oracle.
4. **Full sweep**: every existing suite-record example plus all 120 new-set examples,
   deduplicated with equal-ID equality checks. Expected union **1,164** examples:
   the g031b 516, 120 held-note deviations/controls, 432 rushed deviations/controls,
   and 96 missing-event deviations/controls. No set is retired. Frozen baseline
   evidence from the suite's g031b sweep is cited only after verifying its source
   hashes, transitive prior citation artifacts, producer files, adapters/runners and
   current input equality; new runner orchestration does not change the frozen
   executeSeam producer. Any changed producer/input forces fresh execution. Every
   event-chain@3 example runs fresh, with its record/report/evaluations compared to
   the latest stored @3 output where available. Frozen baselines run fresh on
   previously unmeasured inputs (expected 648 per baseline), with existing evidence
   reused by hash on 516. Full sweeps include baselines but their known failures do
   not gate the incumbent. If the conservative reuse guard fails, rerun affected
   examples rather than silently cite them.
5. Audited following-evaluator@2, assessment-evaluator@3, stage-gates@2, oracle@4
   and audit4; approved sine gates unchanged. Top of score/all parts, 48 kHz/480,
   handed 90. Six prefix checks for each fresh incumbent example; baseline prefix
   checks on at least one performance and each control per newly measured substage,
   with historical baseline prefix evidence cited. Measure causality and cost for
   every live listener; host-only cost is provisional (i7-8750H, Node 22).
6. Evaluate per-example gates and separate pools for each complete substage, the
   omission-only 96 examples and the new set's 120. Check frozen sentinel groups
   separately. Missing output, absent cost or incomplete incumbent prefix checks fail.
   Baselines emit no assessment and therefore cannot pass both outputs. Estimate
   1–2 minutes for the incumbent; several tens of minutes for new baseline evidence,
   explicitly a required sweep rather than a routine iteration.
7. Each private record is written and hashed when measured. Dry-check summary shape
   before measuring. Public summary contains provenance, aggregate/gate results and
   private detail hashes; record size, never discard completed measurement over size.
8. Apply `nextState` with fullSweep=true to earlier complete substages, confirming
   passes/reopening failures; the new missing-event substage becomes passed only if
   its own gates and earlier sentinels pass. Re-choose sentinels at this sweep with
   `chooseSentinels` and `exampleMargin`. No retirement in this experiment: diagnosis,
   sweep confirmation and new missing evidence remain separately visible.

### Predictions

| # | Prediction | What contradicts it |
|---|---|---|
| 1 | All 32 omission performances pass live gates: 192/192 sounded events reached, 32/32 recoveries within 0.2 s, no advance into the omitted event; maximum recovery delay ≤60 ms, zero ahead. | Any missed recovery/event, claim of the omitted event, ahead time or delay beyond 60 ms. |
| 2 | All 224 score notes assessed: 32/32 missing found, other 192 matched, no false note finding; 160/160 intervals within tolerance, including every two-quarter spanning interval, maximum interval error ≤30 ms, overall error ≤1%. | Misaligned/missed/false note finding, missing/bad interval, or error above the prediction. |
| 3 | No timing flags on omission/clean performances; all 80 new-set controls reject and claim no played notes/tempo. All earlier complete substage and sentinel gates pass. | Any false flag, control failure or earlier regression. |
| 4 | Every previously recorded @3 decision/report/following/assessment is byte-identical to its latest verified output. All 6,984 incumbent prefixes pass; cost sustained ≤0.005, chunk p99 ≤0.5 ms. | Changed musical output/evaluation, any prefix failure or cost beyond the prediction. |
| 5 | Clock fails the omission cursor at every tempo, and claims every silence/wrong-score control; each time warper fails at least one omission performance and rejects distant controls. Baselines have no assessment. | Any stated comparison count/direction does not hold; comparator outcomes do not alter incumbent gates. |

### Decision rules

- **D1 pass**: valid construction/provenance; all incumbent per-example gates,
  substage/new-set/omission pools, frozen sentinel groups, prefixes and cost pass.
  Keep @3 incumbent; missing-event becomes passed, prior full-substage passes become
  confirmed. Next is wrong note with w1. Predictions tighter than approved gates and
  comparator contradictions are reported without converting a gate pass to failure.
- **D2 resolved failure**: valid measurement but a required incumbent gate fails.
  Attribute failures by component; missing-event stays open if its gates or earlier
  sentinels fail, earlier failed substages reopen, and repair of the lowest failure
  ranks first. This unchanged-listener diagnostic adds no failing version.
- **D3 infrastructure**: preserve a pre-measurement failure with zero measurements;
  preserve every completed private record if measuring fails; if only final recording
  fails, preserve completed measurements without a verdict until repair. Diagnose
  before one technical rerun **g034a-missing-event-sweep**, same question/listener/data,
  runner repairs only, reusing completed records only with producer/input hashes.
  If unresolved, no state change. A musical failure is never rerun.
- Evidence fitting no branch is inconclusive. D1/D2/D3/inconclusive all close this
  batch at 5 of 5; an independent parent-session process review follows, no next
  experiment by this session.

### Carried-over stopping count, budgets and preflight

Unchanged from [033's resulting state](033-rushed-bar.md#resulting-stopping-count-budgets-and-evidence-access):
**0** consecutive failing listener versions; three development versions; eight
completed comparisons. Six qualification versions, twelve assessment slots, all
reserved/final access unused; Winner bars 5–8 unexamined. Latest full sweep g031b;
this batch-end sweep is due now. This adds one comparison, no version.

Only main was checked out at preflight; no 034 report/public/private run or owner
exists, including the archive. Own worktree `listening-034`, dependencies installed
once; ffmpeg present and private data/earlier records readable. Private output writes
use the same authorized data root. No new decision needs the user. The session's
direction is preserved verbatim:

> You cannot ask the user questions: record anything that needs them in your report and the research log.
