# 019 — Judge support on the trajectory actually emitted

## Pre-registration

2026-09-30. Designed and run by **GPT-6 in Codex**, terminal/TypeScript/tsx/Vitest.
Third of five authorized experiments, under [development contract 1](../contracts/development-contract-1.md).
Frozen before private evaluation. Existing acceptance gates and batch target unchanged.

### Question and evidence

Question 25: can support retain the improved alignment by judging the emitted path
while preserving wrong-score rejection? [018](018-acoustic-anchor.md) fixes Shinyguitar
alignment to 99.5%, zero wrong exposure, but support drops correct following to 87.3%.
Nylon stays at 89.9%, slightly below incumbent v8. This is a path/support interaction;
018 did not isolate rank from the cost cap. Read current research log, 018 report,
its code/tests and frozen records. Reuse [017 bounded primary-source note](../research/tempo-continuity-017.md);
no mandatory refresh yet at plateau 2. An actual-trajectory rank is a local hypothesis,
not an external method claim.

### One change and what it distinguishes

v11 uses **v10 alignment unchanged** (same features, reference, DP and acoustic
regression prior at weight 0.02). Only support's rank source changes. On each causal
analysis frame, rank the selected endpoint's local cost against all reference frames.
Average those endpoint ranks over the preceding **1 s**, then average these means
over **2 s**. This preserves v8/v10's temporal smoothing shape, **0.20** limit,
0.7 path-cost cap and warm-up. v10 instead ranks a DP backtrace for the last second;
that historical path need not be the trajectory regularized endpoints actually
emitted. The cost cap still uses the same DP backtrace, so it remains a possible
failure cause. The new path file adds trace instrumentation only; a public behavioral
test requires every claimed v11 position equal v10 alignment-only at the same clock.
No labels, sample identity, recipe timing or future audio enter the candidate.

If support now keeps Shinyguitar and controls hold, the backtrace source was an
avoidable limit. If Shinyguitar stays refused, inspect cost cap versus endpoint ranks
from the saved run rather than assuming this source fixes all support. If wrong-score
rejection fails, emitted endpoints are not sufficient rejection evidence here. Nylon's
alignment cannot improve in this experiment and will still fail; that is explicit.

### Run and predictions

`g019-emitted-support`, unchanged 19 active examples: clock, v8 and its alignment-only,
v11, v10 alignment-only. Whole scoreboard plus recognition, real thermometer and seam.
`--reproduce g018-acoustic-anchor` requires **76** shared example results identical,
excluding cost (clock, v8, old diagnostic, v10 alignment-only). v10 comparisons use
frozen 018 results. No new bars, reserved/final evidence or post-run tuning.

1. Shinyguitar supported-correct ≥95%, wrong exposure zero, missed deadlines ≤10%.
2. Every rung-0/1 example, every control, acoustic and electric passes every gate.
3. Nylon supported-correct ≥89% and ≤91%, wrong exposure ≤10.5%, longest episode
   ≤0.5 s; it still fails full following gates, consistently with unchanged alignment.
4. Every v11 claimed position matches v10 alignment-only at the same clock; all cost,
   causality, seam and reproduction checks pass (76/76 shared example results).

Each bound is judged separately; any failed component contradicts it. Mixed evidence
is reported. Thermometer recorded without selecting. No claim of suite saturation
is predicted or permitted while nylon fails.

### Decision rules

Keep v11 as provisional incumbent if all prediction 2 and 4 safeguards pass,
Shinyguitar passes every gate (giving 3/4 guitar passes versus v8's 2/4), and nylon
supported-correct is no more than **1 percentage point below v8**, wrong exposure
no more than **1 point above v8**, longest wrong episode ≤0.5 s. This permits an
explicit one-grid-point nylon trade for a new passing guitar; it does not declare
nylon passed or loosen any contract gate. Batch success still needs the original
all-example target and nylon ≤4.5% exposure. Otherwise reject and retain v8.
If rejected solely by controls, the support evidence is inadequate. If rejected
by lost positive support, diagnose rank/cap. If kept, next question remains nylon
alignment. Unanticipated outcomes fitting no branch are inconclusive. Infrastructure
or reproduction/seam failure: preserve failed attempt; only documented technical
repair permits identical frozen-code rerun under a new run ID.

### Carried-over state and preflight

018 landed and was retired before design. Main clean at f7c69ab3, worktree list only
primary; no 019 report or public/private run existed. Own worktree
`listening-019-emitted-support`; dependencies installed once. Frozen rungs/proxy and
ffmpeg available; scoreboard verifies assets. Permission for private outputs carries
over from the user request through sandbox escalation. No substituted data.

Incoming plateau **2 candidate versions without gain**, from report 018. Preserve
its stricter accounting: gain requires ≥2 supported-correct points on each of nylon
and Shinyguitar without increasing either exposure. Such gain resets to 0; otherwise
count becomes **3 and triggers a bounded research refresh before the next candidate**,
even if v11 is kept for a one-guitar improvement. Research does not reset evidence.
Development unrationed; qualification zero versions/assessments, six/twelve slots
unused, reserved/final access unused. All active examples development evidence,
bars 5–8 unopened. Batch 2/5 complete, 019–021 remain.

## Results

**Reject v11; v8 remains incumbent.** Endpoint-rank support rejects substantially more correct playing on both failing guitars. Controls, earlier rungs, acoustic/electric, causality, cost and seam checks still pass. The original batch improvement target remains unmet.

Run [g019-emitted-support](../runs/g019-emitted-support/summary.json), commit `00ca25e853d29cd6daae02594235b22efd53a3b8`, 362.107 CPU seconds, one private attempt and no technical rerun. Before private execution, the landing gate caught an unused test import; it was removed and the gate rerun successfully. Candidate and pre-registration were unchanged by that correction.

### Recorded guitars

189 answerable points per positive.

| Guitar | v8 correct | v10 correct | v11 correct | v11 wrong exposure | Longest | Missed deadlines | Failed gates |
|---|---|---|---|---|---|---|---|
| development-tonejs-acoustic-positive | 96.3% | 99.5% | 99.5% | 0.0% | 0.00 s | 0.5% | — |
| held-out-tonejs-nylon-positive | 90.5% | 89.9% | 67.7% | 1.6% | 0.15 s | 32.3% | supportedCorrect, deadline |
| held-out-tonejs-electric-positive | 95.8% | 99.5% | 99.5% | 0.0% | 0.00 s | 0.5% | — |
| held-out-shinyguitar-positive | 84.1% | 87.3% | 47.1% | 0.0% | 0.00 s | 52.9% | supportedCorrect, deadline |

### What the comparison establishes

All **6,540 v11 position decisions** in the saved 19-example record match v10 alignment-only position candidates and confidence at the same decision clock. This is an exact invariant check on frozen records, not an alternative evaluator. The new path instrumentation did not change alignment.

Shinyguitar alignment remains 188/189 correct points, zero wrong exposure. Endpoint-rank support keeps only 89 correct points, against v10 backtrace-rank support keeping 165. Nylon also loses correct following. The proposed rank source is not a better calibration for these paths at the fixed limit. Rejecting wrong positions does not rescue its much larger refusal of correct positions.

The comparison isolates the source of rank under fixed alignment, window shape, limit and cost cap. It does not distinguish endpoint phase error, timbre sensitivity or reference-feature mismatch as the explanation for the higher ranks, and the saved standard decision record does not contain per-frame rank/cap values. The suggested deeper rank/cap analysis therefore remains unanswered; no diagnostic value is invented.

### Controls and earlier rungs

| Rung / control | v11 rejection | Longest false exposure | Failed gates |
|---|---|---|---|
| 0 / wrong-score | 100.0% | 0.00 s | — |
| 0 / silence | 100.0% | 0.00 s | — |
| 1 / development-constant-2-wrong-score | 100.0% | 0.00 s | — |
| 1 / development-drift-5-wrong-score | 100.0% | 0.00 s | — |
| 1 / held-out-ramp-103-wrong-score | 100.0% | 0.00 s | — |
| 1 / silence | 100.0% | 0.00 s | — |
| 2 / development-tonejs-acoustic-wrong-score | 100.0% | 0.00 s | — |
| 2 / held-out-tonejs-nylon-wrong-score | 99.5% | 0.05 s | — |
| 2 / held-out-tonejs-electric-wrong-score | 98.9% | 0.10 s | — |
| 2 / held-out-shinyguitar-wrong-score | 100.0% | 0.00 s | — |
| 2 / silence | 100.0% | 0.00 s | — |

Every rung-0/1 example, control, acoustic and electric passes every gate. Coverage stays 100%. Every silence rejects 100%.

### Integrity, seam, cost and thermometer

Reproduction **76/76**, no mismatches. Prefix causality and per-example seam agreements all pass; navigation fixtures retain expected refusals. 48 kHz/480 equals direct, 48 kHz/128 has identical decisions within one block; all alternate-delivery causality checks pass. Recognition uses unchanged features/reference.

44.1 kHz/128: 186/186 jointly claimed positions within tolerance, 187/188 support states agree.

Worst v11 sustained cost 17.4%, worst chunk p99 2.798 ms; every cost gate passes on the declared i7-8750H/Node 22.22.1 development laptop (provisional).

| Real thermometer | v8 | v11 |
|---|---|---|
| Positive agreement | 69.8% | 6.9% |
| Wrong-score rejection | 96.8% | 97.4% |
| Silence rejection | 100.0% | 100.0% |

Thermometer recorded, never used to select, with approximate labels of unmeasured precision. One correct piece and one wrong piece, reused development audio and correlated grid points; no population, qualification or transfer claim. No new bars, reserved or final evidence accessed.

## Against the predictions

| Prediction | Outcome | Evidence |
|---|---|---|
| 1. Shinyguitar ≥95%, zero exposure, deadlines ≤10% | Mixed, overall contradicted | 47.1% correct and 52.9% missed fail; zero exposure holds |
| 2. Every earlier rung, control, acoustic/electric passes | Held | All safeguards pass |
| 3. Nylon correct 89–91%, exposure ≤10.5%, longest ≤0.5 s; still fails | Mixed, overall contradicted | 67.7% correct fails range; 1.6% exposure and 0.15 s hold; full following still fails |
| 4. Fixed positions, cost/causality/seam/reproduction | Held | Exact recorded-position comparison; 76/76 shared examples identical; all checks pass |

## Decision

**Reject v11 under the frozen rule.** Shinyguitar does not pass and nylon exceeds the permitted correct-following regression. v8 remains incumbent, sampled-guitar passes still 2/4. This is lost positive support, not a control or cost failure. The rank-source hypothesis fails here; finer rank/cap diagnosis was not answered by the saved record. Frozen v11 stays registered but leaves active entries. No new bars are permitted.

### Resulting plateau, budgets and evidence access

Incoming plateau 2. Neither failing guitar has a qualifying gain; **3 consecutive candidate versions without gain**, triggering **one bounded research refresh before another candidate**. After that refresh, the contract allows three more versions without gain before stopping; it does not reset evidence freshness or qualification budgets. Development unrationed; one candidate, one scoreboard. Qualification zero versions/assessments, six/twelve slots unused, reserved/final access unused. All current examples remain development evidence and bars 5–8 unopened. Batch **3/5 complete**; experiments 020–021 remain, target unmet.

## Next

Carry out the mandatory bounded research refresh on causal tempo/path stabilization and alternatives to feeding the stabilized endpoint back into path confidence. The successful v8 support calibration may be preserved while estimating position more robustly from its raw trajectory; this is a hypothesis, not a selection. Nylon still needs genuine alignment improvement; Shinyguitar must keep both alignment and support. Do not weaken the all-example gates or hide lost support behind lower exposure.

## Attribution

Designed, implemented, executed, interpreted and recorded by **GPT-6 in Codex**; no delegated agent or independent executor.
