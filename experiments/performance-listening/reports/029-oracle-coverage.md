# 029 — Correct and complete the event oracle

## Pre-registration

2026-09-30. **Sol 6.1 (high) in Codex**, terminal/TypeScript/tsx/Vitest.
Research-log question14; exactly one instrument experiment, no listener developed,
executed or judged. [Audit3](../bench/oracle-events/audit-3.md) is independent evidence
for the correction. Approved contract2 and instruments3 are the primary rules;
external acoustic research cannot resolve these arithmetic/coverage questions.

### Question and alternatives

Does corrected event-oracle@4 resolve B1/B11 and freeze hand-worked cases for the
uncovered bar-report, null-reference, omission, suite-state, selection, headroom and
run-plan rules, and does the existing implementation reproduce them? Alternative
explanations are wrong hand arithmetic, rounded boundaries, evaluator report counting,
and missing-evidence/state adapters. Separate literal cases distinguish them.
No agreement by this author is an independent audit.

### Method fixed before validation implementation or execution

1. Land this pre-registration, [instruments4](../contracts/event-instruments-4.md),
   oracle4 and its SHA-256 freeze before writing the new loader/validation/runner.
   Oracle3, old definitions and listener/instrument implementations stay frozen.
   Correct B1 reference30/ratio1. Reshape B11 with exact integer onsets and84/80=1.05.
   Add hand cases for null reference/no intervals/omission, report ordinal matching,
   duplicate/unknown/missing bars, signed/null errors, ineligible and optional flag
   denominators, missing flags, clean gates, state reopening/preservation, absent
   required evidence, selection refusals/parent score, normalized headroom and plans.
2. Validate against existing assessment3/gates2; do not version a listener or change
   a gate. Compare finite numbers within1e-9; IDs, booleans, nulls and verdicts exactly.
   Per-case checks preserve expected answers even if wrong. Never repair a frozen
   answer within this experiment. Check fault sensitivity by perturbing B1/reference,
   B11/verdict, flag denominators, ordinal matching, state transitions, rejection and
   interval headroom, and retired-set plans. Require every deliberate wrong answer
   to fail validation. Frozen oracle1–3 tests retain their recorded meanings.
3. Use one new instrument run **g029-oracle-coverage**. Refuse dirty/uncommitted code,
   an unlanded or changed pre-registration and an existing public/private run ID.
   Pin commit and source hashes, tag **g029-oracle-coverage-source**, and preserve
   attempts/failures. Public summary below300KB names private details by path/hash.
   Check inherited frozen bytes and historical suite structure/19 sentinel IDs;
   verify frozen baseline producer sources unchanged from main at pre-registration.
   Baseline behavior is preserved by byte-identical producers, not fresh execution.
   No listener runs, so no fresh causality/cost claim is made.
4. This is instrument validation, neither a routine listener evaluation nor a full
   sweep or stage claim. No data preparation, Winner/reserved/final evidence, new
   gate or batch. Existing four-bar evidence remains untouched. Full sweep remains
   due by031 after026, earlier at stage completion/new gates/batch end. The routine
   two-minute goal applies to listener evaluation; report validation runtime here.

### Predictions

| # | Prediction |
|---|---|
| 1 | Every corrected/inherited and added oracle4 assessment/report count/error/verdict exactly agrees under stated precision; B1 reference30/ratio1, B11 either/unclean, null-reference/omission cases agree. |
| 2 | All suite/state/selection/headroom/retirement/plan cases agree; missing evidence refuses pass, routine preserves confirmed, failures reopen passed, retired sentinels remain and reopened full sets return. |
| 3 | All eight deliberately incorrect answer families are detected; inherited oracle suites and frozen producers remain unchanged. |
| 4 | One compact provenance-pinned instrument record completes, with zero listener executions, stage confirmations, performance retirements or evidence-budget use. |

Any mismatch contradicts its prediction; mixed evidence is reported by case.

### Decision rules

- **D1 agreement:** all validation/provenance checks pass. Record oracle4 as agreeing
  with implementation, **pending independent audit4**, and rank that audit first.
  No listener or stage approval follows.
- **D2 disagreement/mixed:** preserve every failed case and frozen answer; diagnose
  arithmetic versus implementation from the written rules. No silent repair of the
  oracle or historical verdict. Rank independent audit4 with the discrepancy.
- **D3 infrastructure:** preserve failed attempt, diagnose it before a technical
  rerun using a new ID and unchanged method/evidence/oracle. Only runner/adapter
  implementation faults may be repaired within the frozen semantics. No outcome
  fitting a branch means inconclusive; it is never an agreement claim.

### Carried-over stopping count, budgets and preflight

Unchanged from [028](028-other-bars-suite.md#resulting-stopping-count-budgets-and-evidence-access):
0 consecutive failing listener versions, two development listener versions and four
completed listener comparisons; zero qualification versions/assessments, all six
version/twelve assessment slots and reserved/final accesses unused. Winner5–8
unexamined. No batch active; instrument work adds no listener version/comparison.
Budget one successful instrument run plus D3 technical reruns only.

Worktree list shows only main, reports/ledger/archive/private directories and tags
show029 and g029 unused. listening-029 isolated worktree created; dependencies
installed once; ffmpeg available; private input directories readable and write probe
succeeded. No private audio is needed or replaced. This session stops after landing
and retirement; it does not run its own independent audit or process review.

## Results

**D1: all frozen oracle4 checks agree with the implementation, pending independent
audit4.** [g029-oracle-coverage](../runs/g029-oracle-coverage/summary.json) completed
in **1.086 s** at `65376fbf`, pinned by annotated tag
`g029-oracle-coverage-source`. The public summary is **28,791 bytes**; the private
attempt, complete case comparisons and historical validation are named there by
absolute path and SHA-256. No listener ran or received a new verdict.

### Corrections and report behavior

The pre-registration and frozen hand answers landed and pushed at `9cba7778` before
validation implementation. Oracle4's SHA-256 remains
`6fe74176cc66daeec5fccd3e07c0c8cb84051293fedd78a6b3641fb628103c02`.
Oracle3, every existing instrument/listener and every inherited test remain unchanged.
No frozen expected answer was rewritten during validation.

| Check family | Agreed / checked |
|---|---|
| Assessment hand cases | 15 / 15 |
| Bar summaries from hand-reported intervals | 15 / 15 |
| Hand report evaluation | 8 / 8 |
| Pooled report gates | 4 / 4 |
| State transitions | 13 / 13 |
| Absent required evidence | 5 / 5 |
| Sentinel selection, including reversed order and parent score | 16 / 16 |
| Scalar headroom and refusal cases | 13 / 13 |
| Interval headroom and refusal cases | 4 / 4 |
| Whole-example minimum headroom and refusal cases | 7 / 7 |
| Retirement history | 5 / 5 |
| Routine/sweep/reopened plans | 5 / 5 |
| **Total** | **110 / 110** |

**B1:** the other-bar intervals have weights 3 at 30 and 1 at 60. Their weighted median
is 30, so bar 0's reference is 30 and its ratio 1. The crossing interval still belongs
to bar 1; neither short-score bar can receive a verdict. This corrects the oracle,
not the existing evaluator or 028's mixed result.

**B11:** exact integer onsets0,6,12,18,23 and distances8,8,8,7 produce three local
interval tempi 80 and a final 84. Every other-bars median is 80: when an earlier bar
is excluded, the remaining80 weight 16 exceeds the 84 weight 7. The final ratio is
84/80=1.05, so bar 3 is optional `either`, and the example is unclean. The new inputs
settle the old rational-versus-literal-decimal ambiguity without reinterpreting the
old frozen decimal inputs.

| Added measurement case | Observed agreement |
|---|---|
| B13–B14, missing reference/no intervals | Reference and ratio null, no flags; all-null numeric deltas remain null |
| B15, omission before a bar crossing | Sounded0→2 interval spans4 quarters/4 seconds, wholly assigned to bar 1; missing n1 makes unclean |
| R1, flags on ineligible bars | Both bars negative for each direction; one false slow and one false fast, two false findings; both pooled false-alarm gates fail |
| R2, both directions flagged on optional bar 3 | Optional bar excluded from both denominators; three negatives per direction, zero false findings |
| R3, reversed summary order | Four matches by ordinal, no summary errors; slow positive found, false fast onbar 0 counted |
| R4, duplicate/unknown/missing summaries | Two matched, two unreported, two unexpected; first ordinal2 summary retained; signed local/reference/ratio errors6/−5/0.2 |
| R5, null/value mismatch | Null delta if either operand null, differing contributor count/eligibility reported; no new acceptance threshold |
| R6–R7, false clean flag/missed positive | Clean per-example gate fails on a false flag; a missing slow positive fails pooled recall; summary absence alone creates no finding |

The report cases pin flag counts independently of summary coverage. They also expose
the current informational-field limitation: a null/value mismatch has a null delta,
not a dedicated mismatch flag. This experiment documents that existing rule and
introduces no threshold for informational summaries.

### Suite coverage, integrity and sensitivity

Routine passes preserve `confirmed`; sentinel and sweep failures reopen `passed`;
an attempted open substage cannot pass with a failed sentinel or absent required
examples, controls, pooled gates, causality or cost. Selection includes paired
controls for every performed score, even when that score has no performance among
the top3, and groups a wrong-score control by its parent performance's score.
Duplicate IDs, negative/nonfinite margins, missing performances/controls and failed
binary evidence are refused. Zero answerable time is refused. Unreached events
contribute 0; margin ranks use the minimum applicable headroom, with 1e-12 noise
clamping only at zero. Interval margins use the 30 ms floor or 10% budget; a failing
interval is refused through its ordinary gate before ranking.

The absent-evidence and parent-score cases exercise explicit input adapters around
stage-gates@2, which receives aggregate booleans and normalized score identities.
They establish those adapters' semantics, not that a future listener runner will
collect every required component correctly. The independent audit should check
this distinction rather than treating an adapter test as an end-to-end stage pass.

All **eight wrong-answer families** are detected: B1 reference, B11 verdict/clean,
optional flag denominator, ordinal matching, state preservation, rejection margin,
interval floor headroom and retired-set routine plan. These perturb copies of the
expected answers, not evaluator code: they demonstrate assertion sensitivity and
do not replace an independent rederivation of the oracle.

The run verifies **214 existing source/test/oracle files** byte-identical at the
pre-registration commit, including frozen baseline/listener/evaluator producers;
**264 historical artifact hashes**; historical summary and manifest hashes; the
future four-bar manifest hash; and exact reproduction of all **19** stored sentinel
IDs. Historical suite statuses remain passed under instruments2, never newly
confirmed. Frozen baseline summary citations remain sweep-only. **No performance
set retires.** Routine plans retain retired sentinels; sweeps restore every full set;
an attempted reopened substage restores its full set. The historical record has no
retirements, so retirement-record date/evidence/replacement validation is vacuous
here; the conditional rule and its run-plan examples are frozen, not a fabricated
retirement claim.

No fresh causality/cost measurement is appropriate because no listener executes.
Existing behavior is preserved by unchanged producers and stored provenance, not
by a fresh baseline run. No audio, score, label or reserved/final evidence is created,
replaced or newly evaluated. No infrastructure attempt failed and no rerun occurred.
A pre-run git-add command used repository-relative paths from the bench directory
and failed before commit/execution; it was corrected from the worktree root.

## Against the predictions

| # | Verdict | Evidence |
|---|---|---|
| 1 | Held | All 15 assessment, 15 reported-bar, 8 report and 4 pool checks agree; B1/B11 corrected and null/omission cases match |
| 2 | Held | All 68 remaining suite/state/selection/headroom/retirement/plan checks agree, including explicit refusal cases |
| 3 | Held | Eight wrong-answer families detected; inherited 211 oracle tests pass; 214 old files byte-identical |
| 4 | Held | One 28,791-byte pinned record in 1.086s; zero listener executions, new stage confirmations, retirements or qualification access |

## Decision

**D1 applies.** Oracle4 agrees with the existing implementation on every frozen
check, with independent **audit4 required before instruments3 judge a listener**.
The arithmetic question and implementation agreement are resolved; independent
agreement is not this author's claim. D2/D3 do not apply. Preserve audit3, oracle3,
028's mixed verdict and every historical instruments2 listener pass unchanged.
No new gate, stage pass or listener improvement is claimed.

### Resulting stopping count, budgets and evidence access

Unchanged from 028: **0 consecutive failing listener versions**, two development
listener versions and four completed listener comparisons. Eight contract2 numbered
experiments recorded. Instrument work adds no version/comparison; all six
qualification version slots/twelve assessment slots and reserved/final accesses
remain unused. Winner bars5–8 unexamined. No batch active. Next full sweep remains
due no later than 031 after 026, earlier at stage completion/new gates/batch end.

## Next

Rank **independent event-oracle@4 audit** first. Re-derive every changed/added case,
including report-level counters and deltas, omitted/null-reference cases, missing
required evidence, parent-score grouping, headroom refusals and retirement/run
plans, and at least one case per inherited rule. Audit4 must distinguish synthetic
adapter coverage from actual runner evidence and the vacuous retirement-record
check. Any disagreement requires a separately numbered resolution. Only after the
audit may a listener run four-bar tempo revalidation and the remaining stage2
substages in the approved order.

Direction of travel: other-bars measurement, report accounting and explicit suite
state can survive chords, recorded guitar and longer scores. This instrument
repair supplies no evidence that the monophonic sine pitch estimator/event chain
transfers to those sounds or recovers missing/wrong/dead notes.

## Attribution and validation

Designed, implemented, executed and recorded by **Sol 6.1 (high) in Codex**, one
model throughout. Pre-registration landing gate passed, including 369 bench tests.
Focused oracle4 validation passed 118 tests (110 checks plus 8 sensitivity probes);
inherited oracle suites passed 211 tests; bench TypeScript passed before execution.
The final rebased-tree repository gate is required before landing. This author
performs neither its own independent oracle audit nor its process review.
