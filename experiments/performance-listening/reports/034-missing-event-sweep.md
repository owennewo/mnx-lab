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

## Results

**D1: the single missing interior event passes, and the batch-end sweep confirms all
prior substages.** The unchanged event-chain@3 recovered at every next sounded event,
identified every omitted note, and kept the spanning interval at the correct tempo.
Every earlier musical output and evaluation is reproduced. This is simple monophonic sine evidence;
stage 2 is incomplete, and nothing here qualifies guitar or Studio integration.

[g034-missing-event-sweep](../runs/g034-missing-event-sweep/summary.json) ran once at
`c7b0e4daa1d3b61409326806cc39ca72787abd6e`, pinned by `g034-missing-event-sweep-source`, in **2712.4 s**.
The pre-registration landed at `55b06375` before stimulus/runner code and is unchanged
above. The incumbent phase, including provenance checks, completed in **117.54 s**;
the rest was the required baseline sweep. There was no failed attempt or technical
rerun. Every record was written and hashed as measured, after a dry summary assembly.

### The omission: both outputs and controls

| Evidence | Performances / controls | Cursor pass | Assessment pass | Sounded events reached | Score notes assessed | Intervals within tolerance |
|---|---|---|---|---|---|---|
| Interior omissions, s1 | 8 / 16 | 24/24 | 24/24 | 24/24 | 32/32 | 16/16 |
| Interior omissions, s2 | 24 / 48 | 72/72 | 72/72 | 168/168 | 192/192 | 144/144 |
| Omissions together | 32 / 64 | 96/96 | 96/96 | 192/192 | 224/224 | 160/160 |
| Clean parents with controls | 8 / 16 | 24/24 | 24/24 | 48/48 | 48/48 | 40/40 |
| Entire full sweep | 388 / 776 | 1164/1164 | 1164/1164 | 4304/4304 | 4336/4336 | 3916/3916 |

| Omission-performance measure | Result |
|---|---|
| Recovery at the next sounded event | **32/32**, maximum delay **35.229 ms** |
| Omitted event ever claimed by the live cursor | 0/32 |
| Missing findings | **32/32** (100%); zero false missing findings on 192 matched-note negatives |
| Correctly played notes confirmed | 192/192 |
| Two-quarter spanning intervals | 32/32 reported within tolerance |
| Maximum interval-duration error | 17.625 ms |
| Maximum overall-tempo relative error | 0.503% |
| Ahead / wrong exposure | 0 s / 0 s |
| Minimum on-event fraction | 98.651% |
| Slow/fast flags and false note findings | 0 |

The cursor holds its predecessor through the silent omitted beat. At resumption it
briefly abstains for 20–30 ms while confirming the next pitch, as earlier silent
hesitations did; every next event is reached within the approved 200 ms. The worst
on-event fraction is me-s1-99-e3 (30 ms abstention in a short clip), still above 95%.
All 80 new-set controls reject and claim no played score note or tempo.

The assessment distinguishes omission from slowing: the interval from event k−1 to
k+1 spans two score quarters and two performed beats, including omissions on either
side of the bar boundary. No event/interval is relocated. The short scores' bar flags
are ineligible, so their lack of flags is not a four-bar omission test. First/last
omissions, multiple omissions and repeated-pitch ambiguity remain outside this claim.

Construction: 32 silent spans verified zero, every byte outside them exactly equal
to its clean parent, 384 surviving onset/end boundaries unchanged, exactly one missing
note per performance, every control validated and every parent copied unchanged.
The stimulus-label test hand-checks both boundary omissions at 60 quarters per minute
against existing audited instrument definitions; no evaluator or oracle was changed.
The bounded source refresh is [recorded separately](../research/missing-event-034.md).

### Earlier substages: complete-set sweep results

| Substage | Examples, controls included | Cursor pass | Assessment pass | Resulting state |
|---|---|---|---|---|
| stage1 | 24 | 24/24 | 24/24 | confirmed |
| hesitation | 120 | 120/120 | 120/120 | confirmed |
| slowedBar | 120 | 120/120 | 120/120 | confirmed |
| four-bar-tempo-revalidation | 252 | 252/252 | 252/252 | confirmed |
| held-note-hesitation | 144 | 144/144 | 144/144 | confirmed |
| rushed-bar | 456 | 456/456 | 456/456 | confirmed |

These complete groups overlap on clean parents. Together with the new omissions,
the deduplicated union is 1,164.
Every frozen sentinel group also passes. **1,068/1,068** earlier @3 decision records,
raw reports, following evaluations and assessment evaluations are byte-identical to
the latest verified record (g033, otherwise g032, otherwise g031b). All earlier
slow/fast flags therefore remain unchanged: **89/91** slow and **64/66** fast, with
zero false alarm. The four misses are the already recorded threshold-boundary misses,
not new regressions. Missing, wrong and dead false findings remain zero throughout;
wrong/dead/extra-note positive capability is still untested.

### Frozen baselines, provenance, causality and cost

| Listener | Omission performance cursor pass | Recovery cases reached | Omission controls reject | Examples reused / fresh |
|---|---|---|---|---|
| clock-follower@1 | 0/32 | 18/32 | 0/64 | 516 / 648 |
| online-time-warp@8 | 0/32 | 0/32 | 64/64 | 516 / 648 |
| online-time-warp@12 | 0/32 | 24/32 | 64/64 | 516 / 648 |
| online-time-warp@14 | 0/32 | 30/32 | 64/64 | 516 / 648 |

The new sweep also measures their earlier newly added deviations in full:

| Baseline cursor on new deviation performances | Held-note | Rushed bar | Missing event |
|---|---|---|---|
| clock-follower@1 | 0/40 | 8/144 | 0/32 |
| online-time-warp@8 | 4/40 | 7/144 | 0/32 |
| online-time-warp@12 | 0/40 | 8/144 | 0/32 |
| online-time-warp@14 | 0/40 | 4/144 | 0/32 |

Occasional cursor passes are recorded explicitly; they are unchanged algorithms on
new inputs, not improvements. All four baseline assessments are absent, as before;
their cursor evidence is informational and excluded from the incumbent's gate pools. Recovery alone does not
establish following: a clock can happen to reach a next event while also advancing
through silence and failing the cursor time gates.

Reuse guard: **357** pinned TypeScript source checks all unchanged; current frozen
manifests/assets and every equal-ID input checked; **2,064** historical baseline
artifacts verified before measurement, with transitive g025/g026 records and hashes.
The only excluded changed TypeScript file is compare031.ts, a post-run read-only
diagnostic that produces no listener/runner/evaluator record. Existing adapter and
executeSeam sources are unchanged. Each baseline reuses 516 historical examples and
runs 648 fresh examples; **2,592** baseline examples measured fresh in total.

| Incumbent, provisional on this host | Result | Approved gate |
|---|---|---|
| Prefix checks | **6,984/6,984** | every check |
| Maximum sustained cost ratio, finish included | 0.002671 | ≤0.25 |
| Maximum chunk p99 | 0.170277 ms | ≤10 ms |
| Maximum backlog | 7.548911 ms | reported |

Host: Intel(R) Core(TM) i7-8750H CPU @ 2.20GHz, v22.22.1. Baseline prefix checks and
cost results are recorded separately in the public summary (historical checks cited,
54 fresh checks per baseline on one performance and both controls per new substage).
This remains algorithm timing on the host, not microphone-to-display latency.

All baseline prefix and cost gates also pass (maxima include cited historical cost
records):

| Baseline | Prefix checks | Maximum sustained ratio | Maximum chunk p99 |
|---|---|---|---|
| clock-follower@1 | 138/138 | 0.002544 | 0.082 ms |
| online-time-warp@8 | 138/138 | 0.212396 | 4.508 ms |
| online-time-warp@12 | 138/138 | 0.208766 | 4.522 ms |
| online-time-warp@14 | 138/138 | 0.222552 | 5.160 ms |

| Artifact | Path / SHA-256 |
|---|---|
| Frozen set | `/home/williao/dev/mnx-listening-data/contract2-missing-event-v1/manifest.json`; `2963093a18f7327652c5e3bbeb1f67ae779acce3f54ec6b9c6cc04b695a73880` |
| Per-example results | `/home/williao/dev/mnx-listening-data/diagnostic-runs/g034-missing-event-sweep/results.json`; `98b969d304829cc0b9d50d96d74dbe55e6e5cabe3c24e3e2472d1a6fc5ffa283` |
| Aggregates, margins, identities and omission traces | `/home/williao/dev/mnx-listening-data/diagnostic-runs/g034-missing-event-sweep/aggregate-details.json`; `ff7cb147fe8f3a83cfd312a88b111cb667cb5d486debb0074b84e124b03c8d15` |
| Public summary | 89,774 bytes; `59f6b6aeed5583c5aecb281f8a085c874d1f238ec3c0e5655b2ff4348ae093d8` |

## Against the predictions

| # | Verdict | Evidence |
|---|---|---|
| 1 | Held | 192/192 sounded events, 32/32 recoveries, maximum recovery 35.229 ms, no omitted-event claims or ahead exposure |
| 2 | Held | 224/224 notes assessed, 32/32 missing and 192/192 matched, 160/160 intervals including all 32 spans, maximum error 17.625 ms, overall error 0.503% |
| 3 | Held | No omission/clean flags or false findings; all 80 new-set controls and every earlier complete group/sentinel pass |
| 4 | Held | 1068/1068 identities, 6984/6984 prefixes; sustained 0.002671, p99 0.170277 ms |
| 5 | Held | The baseline table gives every omission cursor/control/recovery count; no baseline assesses |

## Decision

**D1 applies.** Valid construction/provenance, all incumbent per-example gates, each
complete-substage/new-set/omission pool, every frozen sentinel group, prefixes and
cost pass. event-chain@3 remains incumbent; **missing-event becomes passed**, and
all earlier substages are confirmed by the full sweep. Stage 2 remains incomplete.

Sentinels are re-chosen for every passing substage by the frozen margin/ASCII rule.
Missing-event performance sentinels are me-s1-99-e3, me-s2-99-e2 and me-s2-99-e3;
their four paired score controls and every earlier newly selected sentinel are pinned
by artifact/hash in [the suite record](../bench/suite-record.json). The routine union
is now **44** unique IDs. No set is retired; no oracle was created or re-versioned, so no oracle audit is due.

### Resulting stopping count, budgets and evidence access

**0** consecutive failing listener versions; **three** development listener versions;
**nine** completed listener comparisons (one added unchanged-version diagnostic).
All six qualification versions, twelve assessment slots and all reserved/final access
remain unused; Winner bars 5–8 unexamined. Latest full sweep is now **g034**; next
no later than 039, or sooner on a stage claim, new gates or a batch end.

**The batch closes at 5 of 5.** 030–031 retain their original verdicts and the user's
authorized g031b completion; 032–034 passed held-note hesitation, rushed bar and
missing-event recovery. This sweep confirms their predecessors and the first two of
those new substages. An independent process review follows through the parent session;
this session runs no further experiment and does not review its own batch.

## Next

Next in the approved order is a **single wrong note with the near-miss w1 control**.
It is a separate question: a missing event can be skipped on exact pitch evidence,
whereas a wrong note still sounds its score event and must be followed and identified.
The current hard pitch matcher has no positive wrong-note evidence, so this pass does
not establish that capability. Keep both recovery and wrong-score rejection visible.

Direction of travel: the event-state skip transitions and offline deletion/interval
accounting are plausible to retain for longer scores and chords. The zero-crossing
sine pitch detector, exact pitch emissions and adjacent-pitch restrictions still need
work before chords or recorded guitar. This experiment supplies no evidence for
first/last omissions, multiple omissions, repeated-pitch ambiguity or recording transfer.

**Awaiting the user:** no new approval or evidence needed for this result or the next
sine substage. The independent batch process review is due; evidence-based gates before
stage 4, qualification and Studio product decisions remain standing future user
choices. The session's no-questions direction is preserved in the pre-registration
and research log.

## Attribution

Designed, implemented, executed and recorded by **Sol 6.1 (high) in Codex**.
The pre-registration passed its landing gate and reached main before new code or
measurement. The stimulus test and bench type check passed before the source commit;
final landing requires the gate on the rebased recorded tree. No frozen listener,
evaluator, oracle, contract, score, baseline or earlier private set was edited.
