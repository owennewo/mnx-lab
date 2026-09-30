# 021 — Longer robust history and bounded support calibration

## Pre-registration

2026-09-30. Designed and run by **GPT-6 in Codex**, terminal/TypeScript/tsx/Vitest.
Fifth and final numbered experiment of the user-authorized 017–021 batch, under
[development contract 1](../contracts/development-contract-1.md). Frozen before
private evaluation. The original improvement target and all evaluator gates remain.

### Question and evidence

Question 27: can a more stable causal history close the remaining position gates,
with a separately demonstrated support change removing Shinyguitar's ceiling while
controls hold? [020](020-robust-trajectory.md) kept v12: nylon 92.6%, Shinyguitar 87.8%,
exposure 6.9% each; both alignment-only 92.6%. Raw support states are exactly v8's.
Shinyguitar can make only 179/189 supported position claims, a 94.7% ceiling even if
its alignment were perfect. This measured limit motivates a new support version;
it does not permit changing the 95% acceptance gate. Read current research log,
020/019 reports, relevant implementation/tests and saved raw/fitted records.
Reuse [the completed mandatory refresh](../research/tempo-refresh-020.md). Longer
history may reduce median-slope contamination from brief excursions but may lag
real tempo ramps; the support limit change may admit the wrong score.

### Three finite versions, one change per parent

No version is tuned after results. Their code is frozen before any run.

| Version | Parent | Sole behavioral change | Position / support relationship |
|---|---|---|---|
| v13 | v12 | Robust position history **2 → 4 s** | Same raw DP and support (rank limit 0.20) |
| v14 | v13 | Rank limit **0.20 → 0.21** | Same position, windows, raw DP and cost cap |
| v15 | v14 | Robust position history **4 → 6 s** | Same support as v14 (rank limit 0.21) |

The 0.21 limit is the smallest hundredth-step above 0.20, fixed from the measured
support ceiling, not chosen by looking at a new trace or thermometer result. The
4 s history doubles the tested span; 6 s tests whether greater history removes
residual excursions at a tempo-tracking cost. These are development choices on
spent evidence, not independent validation. Slope-pair span stays 0.5 s, estimator
and all other code remain v12's; new files preserve every older frozen version.
No label, recipe timing, source identity or future audio enters any candidate.
No new unit tests mirror the parameter substitutions; the existing meaningful
trajectory/support tests and whole scoreboard are the proof.

### Evidence, run and predictions

`g021-stability-calibration`, unchanged 19 active examples: clock, incumbent v12 and
its alignment-only diagnostic; v13, v14, v15 and alignment-only diagnostics for v13
and v15. v14 has v13's identical positions, so one diagnostic measures both. Whole
scoreboard, recognition, real thermometer and all seam checks; `--reproduce
g020-robust-trajectory` requires **57 shared examples** identical excluding cost.
No new bars, reserved/final evidence or post-result tuning.

1. v13 alignment-only correct ≥95% on both hard guitars, no episode >0.5 s;
   nylon supported-correct ≥95%, exposure ≤4.5%; Shinyguitar supported-correct ≥93%
   but below 95% because unchanged support still imposes its ceiling.
2. v14 passes every gate on all 19 examples, including both hard guitars ≥95%,
   nylon exposure ≤4.5%, Shinyguitar ≤5%, both missed deadlines ≤10%.
3. v15 has no more nylon wrong exposure than v14, and still passes every rung-0/1
   example. A failure here shows the extra history adds bias or tempo lag.
4. Every v13 decision has the same support state/time as v12; v14 position decisions
   equal v13 alignment-only at that time; v15 and v14 have identical support states.
5. All variants pass cost, causality and seam checks, and 57/57 shared examples
   reproduce. All control gates are individually required for any kept candidate.

Judge each numerical bound and invariant separately; report mixed evidence, never
turn a failed prediction into a pass. The thermometer is recorded without selection.

### Decision and selection rules, fixed before running

An eligible candidate must preserve every v12-passing rung-0/1 example, every
control, acoustic and electric; pass all cost/causality/seam checks; gain ≥2
supported-correct percentage points on each of nylon and Shinyguitar over v12;
and increase neither wrong exposure. This is the same gain/safeguard principle as
020. A candidate failing a safeguard is rejected regardless of aggregate accuracy.

Selection among eligible candidates is fixed:

1. Prefer a candidate meeting **the full original batch target**: every gate on all
   19 examples, nylon/Shinyguitar supported-correct ≥95%, nylon wrong exposure ≤4.5%,
   Shinyguitar ≤5%, Shinyguitar missed deadlines ≤10%. If several, choose fewer changes
   from v12, in order v13, v14, v15.
2. Otherwise prefer one passing every gate on all 19 examples, then fewer changes.
   If nylon exposure still exceeds 4.5%, explicitly report target not fully met.
3. Otherwise maximize the worse of the two hard-guitar supported-correct rates,
   then minimize their summed wrong exposure, then fewer changes (v13, v14, v15).
   This is a provisional gain, not saturation or batch-target success.
4. If none eligible, reject all and retain v12.

A better variant's passing result cannot erase another variant's failed prediction.
If one saturates the suite, bars 5–8 become the next fresh-check question. This is
already the fifth experiment, so **no sixth experiment or new-bars run** is started
in this batch; bars 5–8 remain unexamined and transfer unestablished. Infrastructure,
shared reproduction or common seam failure is inconclusive; preserve the attempt,
only documented technical repair permits an identical frozen-code/rules rerun under
a new ID. Variant-specific cost or causality failure rejects that variant. Unanticipated
outcomes outside these branches are inconclusive, not a favorable retrospective rule.

### Carried-over state and preflight

020 landed and its worktree was retired before design. Main clean at ba0197b2;
only primary worktree existed, no 021 report/public/private run. Own worktree
`listening-021-stability-calibration`; dependencies installed once. Required frozen
sets/proxy/ffmpeg and private output permission accessible; scoreboard verifies all
asset hashes. No substituted data or missing prerequisite.

Incoming plateau **0** after 020's measured gain; the mandatory refresh after 019
was completed before 020. For each new version, in order 13, 14, 15, a qualifying
gain means the eligible gain/safeguard rule against the incumbent v12 above; gain
resets count to 0, otherwise increment. Three without gain require a new bounded
refresh before another candidate, and three further failures stop. This experiment
has only these three fixed versions and no unregistered continuation. Development
unrationed, qualification zero versions/assessments, six/twelve slots unused,
reserved/final access untouched. All current examples are reused development;
bars 5–8 unopened. Batch 4/5 complete; completing this record ends the five-run batch.

## Results

**Keep v14 provisionally. Five experiments are complete; the full target is not met.** Nylon now passes comfortably. Shinyguitar improves, but supported-correct remains below 95%. No variant saturates the 19-example suite. The real-clip thermometer also regresses sharply (32.3% versus the starting 69.8%), so the development gain does not establish real-playing improvement.

Run [g021-stability-calibration](../runs/g021-stability-calibration/summary.json), recorded commit `6e553926faa8c52b6f08dcb48059e81be7614589`, **747.922 CPU seconds**; one private attempt, no technical rerun. Every candidate, evaluator, example, label and decision rule was frozen before the run.

### All three variants, against the incumbent

189 answerable points per guitar positive. Exposure means time displaying a wrong position, not time refusing to follow.

| Version | Guitar | Correct | Wrong exposure | Longest wrong episode | Missed deadlines | Failed gates |
|---|---|---|---|---|---|---|
| online-time-warp@12 | Nylon | 92.6% (175/189) | 6.9% | 0.35 s | 7.4% (14/189) | supportedCorrect, exposure |
| online-time-warp@12 | Shinyguitar | 87.8% (166/189) | 6.9% | 0.50 s | 12.2% (23/189) | supportedCorrect, exposure, deadline |
| online-time-warp@13 | Nylon | 98.9% (187/189) | 0.5% | 0.05 s | 1.1% (2/189) | — |
| online-time-warp@13 | Shinyguitar | 89.9% (170/189) | 4.8% | 0.30 s | 10.1% (19/189) | supportedCorrect, deadline |
| online-time-warp@14 | Nylon | 98.9% (187/189) | 0.5% | 0.05 s | 1.1% (2/189) | — |
| online-time-warp@14 | Shinyguitar | 91.5% (173/189) | 4.8% | 0.30 s | 8.5% (16/189) | supportedCorrect |
| online-time-warp@15 | Nylon | 97.9% (185/189) | 1.6% | 0.15 s | 2.1% (4/189) | — |
| online-time-warp@15 | Shinyguitar | 69.3% (131/189) | 27.3% | 1.55 s | 30.7% (58/189) | supportedCorrect, exposure, longestExposure, deadline |

The four-second position history (v13 versus v12) raises nylon by **6.35 percentage points** and Shinyguitar by **2.12 points**, reducing wrong exposure on both. This change preserves the raw support states. The isolated rank-limit change (v14 versus v13) adds **3/189 correct Shinyguitar points, 1.59 percentage points**, with identical claimed positions and wrong exposure. Increasing history to six seconds (v15 versus v14) damages Shinyguitar substantially and also increases nylon exposure; longer history is not uniformly better.

### Position versus support

| Position diagnostic | Nylon correct | Shinyguitar correct | Shinyguitar exposure |
|---|---|---|---|
| online-time-warp@12/alignment-only | 92.6% | 92.6% | 6.9% |
| online-time-warp@13/alignment-only | 98.9% | 94.7% | 4.8% |
| online-time-warp@15/alignment-only | 97.9% | 72.5% | 27.3% |

Exact saved-record checks: v13 matches v12's decision clock, referred-to time and support state on **17,939 decisions**. All **7,305 v14 position claims** have exactly v13 alignment-only's candidate positions/weights; v15 and v14 have identical clocks/support states on **17,939 decisions**. The changes are attributable to history and rank limit respectively. These comparisons supplement the frozen instrument without changing its verdict.

Shinyguitar’s four-second alignment is itself only 94.7% correct. v14 has 173 correct, 9 wrong and 7 lost points; its alignment-only diagnostic has 179 correct, 9 wrong and 1 lost. Six correct points are still lost to support. Neither perfect support alone nor this tested position history alone would meet the full target. The fitted position and raw support remain different signals; the run does not uniquely explain the remaining position bias or establish an optimal history.

### Earlier rungs and controls

| Version | Rung 0/1 passing | Acoustic / electric correct | Controls passing | Active examples passing all gates | Eligible under frozen rule |
|---|---|---|---|---|---|
| online-time-warp@13 | 10/10 | 99.5% / 99.5% | 11/11 | 18/19 | Yes |
| online-time-warp@14 | 10/10 | 99.5% / 99.5% | 11/11 | 18/19 | Yes |
| online-time-warp@15 | 10/10 | 99.5% / 98.4% | 11/11 | 18/19 | No |

Every v12-passing example is preserved by v13 and v14. The whole tempo suite still passes, rather than only the guitars improved by a steady history. Every candidate keeps coverage 100%. Controls are individually mandatory, not averaged into a favourable rate.

| Rung / control | v13 rejection | v14 rejection | v15 rejection | v14 longest false exposure |
|---|---|---|---|---|
| 0 / wrong-score | 100.0% | 100.0% | 100.0% | 0.00 s |
| 0 / silence | 100.0% | 100.0% | 100.0% | 0.00 s |
| 1 / development-constant-2-wrong-score | 100.0% | 100.0% | 100.0% | 0.00 s |
| 1 / development-drift-5-wrong-score | 100.0% | 100.0% | 100.0% | 0.00 s |
| 1 / held-out-ramp-103-wrong-score | 100.0% | 98.9% | 98.9% | 0.09 s |
| 1 / silence | 100.0% | 100.0% | 100.0% | 0.00 s |
| 2 / development-tonejs-acoustic-wrong-score | 99.5% | 99.5% | 99.5% | 0.05 s |
| 2 / held-out-tonejs-nylon-wrong-score | 98.9% | 98.9% | 98.9% | 0.10 s |
| 2 / held-out-tonejs-electric-wrong-score | 98.9% | 98.9% | 98.9% | 0.10 s |
| 2 / held-out-shinyguitar-wrong-score | 100.0% | 100.0% | 100.0% | 0.00 s |
| 2 / silence | 100.0% | 100.0% | 100.0% | 0.00 s |

The support change is a candidate calibration, not a lowered acceptance gate. Its wrong-score controls still have to meet ≥95% rejection and every exposure/deadline rule. All digital-silence controls reject 100%.

### Integrity, delivery and cost

All **57/57** shared results reproduce, with no mismatches. Every prefix check, per-example seam agreement and expected navigation fixture answer passes. All three variants pass the unchanged sustained-cost and chunk-p99 gates. Recognition features/reference remain unchanged. All private artifact SHA-256 values match the public summary.

| Version | Worst sustained cost | Worst chunk p99 | 48 kHz/480 direct equality | 48 kHz/128 decisions / block limit | 44.1 kHz positions / jointly claimed | 44.1 kHz support agreement / grid |
|---|---|---|---|---|---|---|
| online-time-warp@13 | 17.2% | 2.673 ms | True | True / True | 186/186 | 187/188 |
| online-time-warp@14 | 18.3% | 2.298 ms | True | True / True | 186/186 | 187/188 |
| online-time-warp@15 | 18.6% | 2.258 ms | True | True / True | 186/186 | 187/188 |

Alternate-delivery causality passes for every entry. Cost is provisional on the declared i7-8750H / Node 22.22.1 laptop; the gate is ≤25% real time and p99 ≤10 ms. Alternate-rate agreement is recorded as measured, not represented as bit-identical.

### Real-clip thermometer, not used for selection

| Version | Positive agreement | Wrong-score rejection | Silence rejection |
|---|---|---|---|
| online-time-warp@12 | 77.2% | 96.8% | 100.0% |
| online-time-warp@13 | 32.3% | 96.8% | 100.0% |
| online-time-warp@14 | 32.3% | 96.8% | 100.0% |
| online-time-warp@15 | 28.6% | 96.8% | 100.0% |

**Material transfer limitation:** the kept v14 real-clip agreement is **32.3%**, down from v12 **77.2%** and the batch-start v8 **69.8%**. The longer history improves the exact-timing guitar suite while badly worsening this reused real clip. This is contrary evidence to broad transfer. Approximate sync labels have unmeasured precision, but that does not justify ignoring the regression. The frozen contract excludes the thermometer from selection, so the development choice remains v14; it supplies no real-playing improvement claim. Correlated development points are not independent trials or a population estimate.

## Against the predictions

| Prediction | Outcome | Evidence |
|---|---|---|
| 1. v13 both alignments ≥95%, episodes ≤0.5 s; nylon target; Shinyguitar ≥93% supported | Mixed, overall contradicted | Nylon 98.9%, 0.5% exposure and episode 0.05 s hold; Shinyguitar alignment 94.7% and supported 89.9% contradict accuracy bounds; its episode 0.30 s holds |
| 2. v14 every gate / full original target | Contradicted | 18/19 pass; Shinyguitar correct 91.5% fails ≥95%; its 4.8% exposure and 8.5% missed deadlines hold; nylon target holds |
| 3. v15 no more nylon exposure, all rung-0/1 examples pass | Mixed, overall contradicted | Earlier examples hold; nylon exposure increases from 0.5% to 1.6%; Shinyguitar also deteriorates sharply |
| 4. Exact state/position invariants | Held | All saved-record comparisons above match |
| 5. Cost, causality, seam, reproduction and individual controls | Held | All pass; 57/57 shared results identical |

## Decision

**Keep `online-time-warp@14` by selection branch 3, provisionally.** Both v13 and v14 gain ≥2 correct percentage points on each hard guitar over v12, increase neither exposure, and preserve every safeguard. No candidate satisfies branch 1 (full target) or branch 2 (every active gate). The worse hard-guitar correct rate is 91.5% for v14 versus 89.9% for v13, so branch 3 selects v14. v15 is ineligible because it worsens Shinyguitar over the incumbent. No result or failed prediction is erased by the selection.

Active entries become clock, v14 and v13 alignment-only (the exactly identical position diagnostic for v14, established above). Older versions and all records remain frozen/registered. No alias or newly evaluated diagnostic is invented after the run. Sampled-guitar passes **3/4**, active-example passes **18/19**; not saturation and not success against the full five-experiment bar.

### Five-experiment outcome against the original bar

| Measure | Before batch (v8) | Final incumbent (v14) | Original target | Verdict |
|---|---|---|---|---|
| Nylon correct | 90.5% | 98.9% | ≥95% | Met |
| Nylon wrong exposure | 9.1% | 0.5% | ≤4.5% | Met |
| Shinyguitar correct | 84.1% | 91.5% | ≥95% | Not met |
| Shinyguitar wrong exposure | 10.7% | 4.8% | ≤5% | Met |
| Shinyguitar missed deadlines | 15.9% | 8.5% | ≤10% | Met |
| Recorded-guitar passes | 2/4 | 3/4 | 4/4 | Not met |
| All active examples pass | 17/19 | 18/19 | 19/19 | Not met |

Nylon supported-correct gains **8.47 percentage points** (+16/189), Shinyguitar **7.41 points** (+14/189) from the batch starting incumbent. Wrong-position exposure drops about **94%** on nylon (9.1% → 0.5%) and **55%** on Shinyguitar (10.7% → 4.8%). Acoustic/electric are 99.5% correct with zero wrong exposure; the earlier tempo, controls, coverage, cost and causality safeguards remain intact. The only final failed active gate is Shinyguitar supported-correct.

| Numbered experiment | Learned / resulting decision |
|---|---|
| 017 | Self-predicted endpoint prior amplifies nylon errors; reject v9 |
| 018 | Acoustic anchor fixes Shinyguitar alignment but support discards the gain and nylon fails; reject v10 |
| 019 | Emitted-endpoint rank loses much more correct support at unchanged position; reject v11; complete required bounded refresh before next candidate |
| 020 | Robust reported position improves both hard guitars without changing support; keep v12 |
| 021 | Four-second history solves nylon; small separate rank change adds Shinyguitar support; six-second history regresses; provisionally keep v14 |

All five numbered experiments are complete, each pre-registered, run, interpreted and landed sequentially. No sixth run is used to conceal the remaining failure.

### Resulting plateau, budgets and evidence access

Incoming plateau 0; v13 qualifying gain resets to 0, v14 qualifying gain resets to 0, v15 no qualifying gain increments to **1 consecutive version without gain**. No refresh or stop rule currently applies. The completed mandatory refresh before 020 remains recorded; evidence is not refreshed by a new model or experiment.

Batch **5/5 complete**, original improvement target **partly met**. Development unrationed; qualification zero versions/assessments, six/twelve slots unused; reserved/final access untouched. Every current example remains reused development evidence. Bars 5–8 remain unopened because no candidate saturated; transfer to those bars is unestablished. This is a development incumbent, not a Studio-ready or qualified listener.

## Next

Why does the remaining Shinyguitar case still miss ≥95% supported-correct while both position and support contribute losses? The next question should discriminate those limits using the saved records, preserve every passing example, and avoid blindly extending history: six seconds demonstrably worsens it. A future experiment must pre-register its own method/rules. The real-clip regression also warrants an explanation before making any transfer claim; it is a recorded limitation despite its non-selection role. First saturate the existing suite; only then open bars 5–8. No further experiment is started in this five-run batch.

## Attribution

Designed, implemented, executed, interpreted and recorded by **GPT-6 in Codex**, no delegated agent or independent executor.
