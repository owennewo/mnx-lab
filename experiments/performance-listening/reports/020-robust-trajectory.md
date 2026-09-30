# 020 — Stabilize position while preserving calibrated support

## Pre-registration

2026-09-30. Designed and run by **GPT-6 in Codex**, terminal/TypeScript/tsx/Vitest.
Fourth of five authorized experiments, under [development contract 1](../contracts/development-contract-1.md).
Frozen before private evaluation. Target and acceptance gates unchanged.

### Question and mandatory refresh

Question 26: can causal trajectory stabilization improve nylon and Shinyguitar
without losing v8 support? 017–019 changed the interaction between endpoint and
support, and none was kept. v10 fixes Shinyguitar alignment but loses support;
v11 loses more. Read full research log across this batch, previous reports and
relevant implementation/tests/records. The mandatory **bounded research refresh**
after plateau 3 is completed in [the note](../research/tempo-refresh-020.md): one
primary source on stable tempo from historical alignment and its response delay.
Our robust forward-trajectory estimator is a local adaptation, not a replication.

### One change

v12 changes only v8's reported position estimator. The original raw DTW, features,
reference, rank-backtrace support, two-second rank window, 0.20 limit, cost cap and
warm-up remain unchanged. Collect causal raw endpoints from each 20 ms analysis
frame over the last **2 s**. Estimate speed as median displacement slopes for pairs
**25 frames apart (0.5 s)**, clamped to 0.5–2 times handed quarter speed. Estimate
current position as median of each raw quarter extrapolated by that speed to the
current frame. Before 26 samples, use raw endpoint and handed interpolation speed.
Interpolate between analysis frames with the fitted speed; clamp to score bounds.
The fitted position never feeds the DP recurrence or support. This is direct robust
trajectory estimation, rather than changing an endpoint's objective as 017/018 did.
The listener gets no labels, recipe timing, source identity or future audio.

Alternative failures: median slope/intercept may lag genuine tempo changes, majority
errors can bias the history, and v8 support may still refuse correct positions. The
alignment-only diagnostic distinguishes position improvement from support refusal.
A public fixture checks exact support-state equivalence to v8 and silent-tail
refusal; another verifies a non-nominal speed and nonzero offset through a transient
endpoint excursion, so the estimator is not defined as a nominal clock.

### Run and numbered predictions

`g020-robust-trajectory`, unchanged 19 active examples: clock, v8 and its alignment-only,
v12 and its alignment-only. Whole scoreboard, recognition, thermometer and seam.
`--reproduce g019-emitted-support` requires 57 shared examples identical excluding
cost. No new bars, qualification, reserved/final evidence or post-result tuning.

1. Nylon supported-correct ≥95%, wrong exposure ≤4.5%; Shinyguitar supported-correct
   ≥93%, wrong exposure ≤5%, missed deadlines ≤10%.
2. Both difficult guitars alignment-only correct ≥95%, longest wrong episode ≤0.5 s.
3. Every rung-0/1 example, control, acoustic and electric passes every gate.
4. Every v12 decision's position-versus-unsupported state matches v8 at the same clock;
   every cost, causality and seam check passes, 57/57 shared examples reproduce.

Judge all numbers separately; mixed outcomes stay mixed. Real thermometer recorded
without selection. Shinyguitar support may prevent full saturation even if position
is fixed; no support threshold is adjusted in this experiment.

### Decision rules

Keep v12 if prediction 3 and 4 safeguards pass, nylon and Shinyguitar each gain
≥2 supported-correct points over v8, and neither increases wrong exposure. If every
gate passes on all 19 examples, the suite is saturated; next experiment opens the
contract's bars 5–8 fresh check. The batch target additionally requires nylon
exposure ≤4.5%. If kept without saturation, the next question follows the remaining
measured gate. Otherwise reject and retain v8. Partial improvements are recorded
without selecting a failed safeguard. Infrastructure/reproduction/seam failure is
inconclusive, failed attempt preserved; only documented technical repair permits
rerun of identical code/rules under a new ID. Outcomes fitting no branch inconclusive.

### Carried-over state and preflight

019 landed and worktree retired before design. Main clean at 5a9e315a; only primary
worktree existed, no 020 report or private/public run. Own worktree
`listening-020-robust-trajectory`, dependencies installed once. Frozen rungs/proxy,
ffmpeg and private output authorization accessible; scoreboard re-verifies every
asset. No substituted data. Incoming plateau **3 versions without gain**; required
refresh completed above before this candidate. No reset: without ≥2 supported-correct
points gained on both failing guitars and no increased exposure, count becomes 4,
one post-refresh failure. A gain resets to 0. Three post-refresh failures stop the
ladder. Development unrationed, qualification zero versions/assessments, six/twelve
slots unused, reserved/final access untouched. All current data remains development,
bars 5–8 unopened. Batch 3/5 complete, 020–021 remain.

## Results

**Keep v12 as incumbent, without saturation.** It gains supported-correct on both failing guitars and reduces both wrong exposures while every safeguard passes. The five-experiment target remains unmet.

Run [g020-robust-trajectory](../runs/g020-robust-trajectory/summary.json), commit `0ae69937792b66b0ba8a841300876804489c4325`, 392.635 CPU seconds; one private attempt, no technical rerun. Frozen sets, labels and evaluators unchanged. Mandatory bounded research refresh completed before candidate design, with [its primary-source note](../research/tempo-refresh-020.md).

### Recorded guitars

189 answerable points per positive.

| Guitar | v8 correct | v12 correct | v8 wrong exposure | v12 wrong exposure | v12 longest | v12 missed deadlines | Failed gates |
|---|---|---|---|---|---|---|---|
| development-tonejs-acoustic-positive | 96.3% | 99.5% | 3.2% | 0.0% | 0.00 s | 0.5% | — |
| held-out-tonejs-nylon-positive | 90.5% | 92.6% | 9.1% | 6.9% | 0.35 s | 7.4% | supportedCorrect, exposure |
| held-out-tonejs-electric-positive | 95.8% | 99.5% | 3.7% | 0.0% | 0.00 s | 0.5% | — |
| held-out-shinyguitar-positive | 84.1% | 87.8% | 10.7% | 6.9% | 0.50 s | 12.2% | supportedCorrect, exposure, deadline |

Nylon gains **2.12 percentage points** supported-correct (+4/189 points), Shinyguitar **3.70 points** (+7/189). Wrong-position exposure falls from 9.1% and 10.7% to **6.9% each**, relative reductions of about 24% and 35%. This is a measured kept improvement, but below the promised target of ≥95% correct and ≤4.5%/5% exposure.

### Position versus support

| Guitar | v12 alignment-only correct | v12 supported correct | Alignment-only wrong exposure | Alignment-only longest |
|---|---|---|---|---|
| development-tonejs-acoustic-positive | 99.5% | 99.5% | 0.0% | 0.00 s |
| held-out-tonejs-nylon-positive | 92.6% | 92.6% | 6.9% | 0.35 s |
| held-out-tonejs-electric-positive | 99.5% | 99.5% | 0.0% | 0.00 s |
| held-out-shinyguitar-positive | 92.6% | 87.8% | 6.9% | 0.50 s |

Both hard guitars align correctly on 175/189 points (92.6%), so position remains a genuine limit. Shinyguitar loses another 9 correct points to unchanged support. A later position-only revision cannot exceed the existing 179/189 supported-position ceiling (94.7%) there without changing support, even with perfect alignment. That arithmetic is not permission to loosen an evaluator gate.

Across all 19 saved records, **17,939 decisions** have the same decision clock, referred-to time and position-versus-unsupported state as v8. No gain came from extra abstention or a changed support calibration. This exact invariant check supplements the frozen evaluator; it is not another instrument.

Exploratory reading of saved records: nylon’s remaining excursions occur around 3.55–3.72, 6.34–6.70 and 9.16–9.34 s; Shinyguitar around 5.00–5.46 and 6.20–6.32 s. The robust fit suppresses several raw bursts but also spreads some bias into later frames. This does not establish which history length is optimal. A longer robust history could reduce slope/intercept contamination, but could also lag real ramps. These observations do not change the decision rule.

### Controls and earlier rungs

| Rung / control | v12 rejection | Longest false exposure | Failed gates |
|---|---|---|---|
| 0 / wrong-score | 100.0% | 0.00 s | — |
| 0 / silence | 100.0% | 0.00 s | — |
| 1 / development-constant-2-wrong-score | 100.0% | 0.00 s | — |
| 1 / development-drift-5-wrong-score | 100.0% | 0.00 s | — |
| 1 / held-out-ramp-103-wrong-score | 100.0% | 0.00 s | — |
| 1 / silence | 100.0% | 0.00 s | — |
| 2 / development-tonejs-acoustic-wrong-score | 99.5% | 0.05 s | — |
| 2 / held-out-tonejs-nylon-wrong-score | 98.9% | 0.10 s | — |
| 2 / held-out-tonejs-electric-wrong-score | 98.9% | 0.10 s | — |
| 2 / held-out-shinyguitar-wrong-score | 100.0% | 0.00 s | — |
| 2 / silence | 100.0% | 0.00 s | — |

Every rung-0/1 example, control, acoustic and electric passes every gate. Acoustic/electric improve to 99.5% correct, zero wrong exposure. Coverage stays 100%. Controls are identical to v8, every silence rejects 100%.

### Integrity, seam, cost and thermometer

All **57/57** shared results reproduce. All prefix checks, per-example seam agreements and expected navigation fixture answers pass. 48 kHz/480 equals direct and 48 kHz/128 preserves decisions within one block; alternate-delivery causality passes. Recognition features/reference unchanged.

44.1 kHz/128: 186/186 jointly claimed positions within tolerance; 187/188 support states agree.

Worst sustained cost 18.3%, worst chunk p99 2.285 ms; every cost gate passes on the declared i7-8750H/Node 22.22.1 laptop, provisional.

| Real thermometer | v8 | v12 |
|---|---|---|
| Positive agreement | 69.8% | 77.2% |
| Wrong-score rejection | 96.8% | 96.8% |
| Silence rejection | 100.0% | 100.0% |

Thermometer recorded without selection, with approximate labels of unmeasured precision. Reused development audio, one correct piece and one wrong piece, correlated points; no population, independent transfer or qualification claim. Bars 5–8 remain unopened.

## Against the predictions

| Prediction | Outcome | Evidence |
|---|---|---|
| 1. Nylon ≥95% / exposure ≤4.5%; Shinyguitar ≥93% / exposure ≤5% / deadlines ≤10% | Contradicted | 92.6% / 6.9%; 87.8% / 6.9% / 12.2% |
| 2. Both hard alignments ≥95%, episode ≤0.5 s | Mixed, overall contradicted | Both 92.6% fail; nylon 0.35 s and Shinyguitar 0.50 s hold |
| 3. Every earlier rung, control, acoustic/electric passes | Held | All safeguard gates pass |
| 4. Support states unchanged; cost/causality/seam/reproduction pass | Held | Exact recorded state comparison, all checks pass, 57/57 shared results identical |

## Decision

**Keep `online-time-warp@12` as incumbent by the frozen rule.** Both failing guitars gain ≥2 supported-correct points, neither increases exposure, and every safeguard passes. Stronger numerical predictions were contradicted; the pre-registered keep rule explicitly permits a smaller attributable gain. No saturation, sampled-guitar passes still 2/4; batch numerical bar unmet. v12 and its alignment-only diagnostic remain active, v8 and its diagnostic leave active entries but stay frozen and registered.

### Resulting plateau, budgets and evidence access

Incoming plateau 3, mandatory bounded refresh completed before the candidate. A qualifying gain on both failing guitars resets the count to **0 consecutive versions without gain**. The refresh did not itself reset anything. One candidate, one scoreboard, development unrationed. Qualification remains zero versions/assessments, six/twelve slots unused, reserved/final access untouched. All current audio remains reused development evidence; bars 5–8 unopened. Batch **4/5 complete**, one numbered experiment 021 remains; original target unchanged.

## Next

Two measured limits remain: a two-second robust history still permits position bursts, and unchanged support caps Shinyguitar below 95% even if position becomes perfect. A longer history is a bounded stabilization hypothesis that must retain ramp/drift gates. A separately versioned support revision may be needed to remove the ceiling; it must demonstrate controls, not assume them. Any variants and selection rules must be fixed before the final experiment. Do not open bars 5–8 until all active gates saturate.

## Attribution

Designed, implemented, executed, interpreted and recorded by **GPT-6 in Codex**, no delegated agent or independent executor.
