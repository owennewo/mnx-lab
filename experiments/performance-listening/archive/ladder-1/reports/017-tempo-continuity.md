# 017 — A causal tempo-continuity preference at the endpoint

## Pre-registration

2026-09-30. Designed and run by **GPT-6 in Codex**, terminal/TypeScript/tsx/Vitest.
Governed by [development contract 1](../../../contracts/development-contract-1.md).
This section is frozen before private execution. First of five user-authorized
sequential experiments (017–021), each separately landed.

### Question and evidence

Question 20: does preferring steady tempo reduce recorded-guitar alignment bursts?
[016](016-windowed-rank.md) has nylon 90.5% supported-correct/9.1% wrong exposure,
Shinyguitar 84.1%/10.7%/15.9% missed deadlines. [010](010-slim-suite-and-burst-features.md)
found features usually favour the true position during bursts; [011](011-path-and-support.md)
found faster paths worsen them. A smoother endpoint is an untested alternative to
changing reference timbre or support. Read incumbent implementation, its tests and
those diagnostics before design. Bounded primary-source refresh is recorded in
[the research note](../../../research/tempo-continuity-017.md); this endpoint prior is our
hypothesis, not a replication or externally established result.

### One change

Version 9 preserves version 8 features, reference, DTW recurrence, support window,
rank threshold, warm-up and cost cap. Only endpoint selection changes: normalized
acoustic path cost plus 0.02 times squared departure from the causally predicted
endpoint, measured in units of the unchanged 0.25-quarter tolerance. Prediction
is last endpoint plus estimated velocity. Velocity starts at one reference frame
per live frame and is updated with alpha 0.02 from the endpoint displacement over
up to the preceding 50 frames (1 s), after at least 25 frames (0.5 s), clamped to
0.5–2. No labels, recipe timing, source identity or future audio are inputs. The
prior is ungated by acoustic strength; if it helps, dependence on weak versus strong
evidence remains a later question. The original implementation stays frozen;
a new path fork holds the change, with a zero-weight public reproduction test.

### Run and numbered predictions

`g017-tempo-continuity`, unchanged 19-example scoreboard, clock, v8 and its old
alignment-only diagnostic, v9 and its alignment-only diagnostic. `--reproduce
g016-windowed-rank` must reproduce 57 shared example results excluding cost.
Supplied-label recognition, real thermometer and all seam checks run normally.
No post-result tuning, new bars or reserved/final evidence.

1. Nylon supported-correct reaches at least 95%; Shinyguitar at least 90%.
2. Wrong exposure is at most 4.5% on nylon and 7% on Shinyguitar.
3. Every rung-0/1 example, every control, acoustic and electric still pass every gate.
4. Shinyguitar missed deadlines fall to at most 10%.
5. Cost is within 25% sustained/10 ms p99, causality passes; reproduction and seam pass.

Each threshold is judged separately; any failure contradicts its prediction. No
prediction of thermometer improvement is used for decisions.

### Decision rules

Keep v9 only if safeguards in predictions 3 and 5 pass, both failing guitars gain
at least 2 supported-correct percentage points and neither increases wrong exposure.
Full saturation additionally requires every gate on all 19 examples. If kept but
not saturated, continue from its measured failure. Otherwise reject and retain v8;
diagnose whether the prior lagged genuine tempo or followed its own wrong prediction
before another variation. Mixed predictions are recorded individually. Infrastructure
or reproduction/seam failure is inconclusive; preserve the failed attempt and only
rerun unchanged code after a documented infrastructure correction. Outcomes fitting
no branch are inconclusive. A rung-2 gate pass cannot compensate a failed safeguard.

### Carried-over plateau, budgets and preflight

Incoming plateau 0, from report 016. With alignment now the failing gate, a gain for
plateau accounting is at least 2 points supported-correct on each of nylon and
Shinyguitar without increasing either wrong exposure; otherwise the count becomes 1.
This is stricter than counting an isolated improvement. Three consecutive versions
without gain trigger one bounded refresh; three more stop the ladder. Development
unrationed; qualification zero versions/assessments, six/twelve slots unused.
Reserved/final evidence untouched; all active audio remains development evidence;
bars 5–8 unopened. Same model does not refresh evidence.

Preflight: main clean at 03d535f0; worktree list showed only primary checkout; no
017 report, registry row or private/public run existed. This session owns
`listening-017-tempo-continuity`, dependencies installed once. Frozen rungs 0–2 and
proxy artifacts readable, ffmpeg available. Required private writes are authorized
by the user experiment request and executed through sandbox escalation. Scoreboard
verifies every frozen asset/hash before execution. No missing prerequisite replaced.

## Results

**Reject version 9; version 8 remains incumbent.** Both failing guitars lose supported-correct, so the pre-registered keep rule fails. The five-experiment numerical target is still unmet.

Run [g017-tempo-continuity](../runs/g017-tempo-continuity/summary.json), source commit `190802bee0cf481b6916194e9dc4e22e5f5db8d4`, 366.240 CPU seconds. No failed attempt or technical rerun. Frozen sets and evaluators unchanged.

### Recorded-guitar positives

189 answerable points per positive. Rates use the frozen evaluator; no aggregate hides a failing guitar.

| Guitar | v8 correct | v9 correct | v9 wrong exposure | v9 longest | v9 missed deadlines | v9 failed gates |
|---|---|---|---|---|---|---|
| development-tonejs-acoustic-positive | 96.3% | 99.5% | 0.0% | 0.00 s | 0.5% | — |
| held-out-tonejs-nylon-positive | 90.5% | 59.3% | 12.3% | 0.60 s | 40.7% | supportedCorrect, exposure, longestExposure, deadline |
| held-out-tonejs-electric-positive | 95.8% | 99.5% | 0.0% | 0.00 s | 0.5% | — |
| held-out-shinyguitar-positive | 84.1% | 82.0% | 1.6% | 0.15 s | 18.0% | supportedCorrect, deadline |

### Alignment diagnosis

| Guitar | v8 alignment correct | v9 alignment correct | v9 alignment wrong exposure | v9 alignment longest |
|---|---|---|---|---|
| development-tonejs-acoustic-positive | 96.3% | 99.5% | 0.0% | 0.00 s |
| held-out-tonejs-nylon-positive | 90.5% | 63.5% | 36.3% | 2.85 s |
| held-out-tonejs-electric-positive | 95.8% | 99.5% | 0.0% | 0.00 s |
| held-out-shinyguitar-positive | 87.8% | 93.7% | 5.9% | 0.55 s |

Nylon alignment deteriorates from 17 to 68 wrong grid points; its longest wrong episode grows from 0.35 to 2.85 seconds. Shinyguitar alignment improves from 87.8% to 93.7%, but support rejects enough correct frames to lower supported-correct to 82.0%. This is a new path/support interaction; lower exposed error alone would misrepresent it.

Exploratory reading of the saved decision records (not a new evaluator or selection rule): nylon first exceeds +0.25 quarter at 3.42 s for v9 versus 3.22 s for v8; later v9 falls roughly 0.8 quarter behind, and its alignment-only record remains wrong through 9.19 s. The prior initially delays the jump but does not prevent a prolonged excursion. Since its predictor is updated from its own regularized endpoint, reinforcement is a plausible mechanism; this experiment does not isolate that mechanism from weight strength or initial error. Tempo curves themselves still pass.

### Earlier rungs and controls

| Rung / control | v9 rejection | v9 longest false exposure | Failed gates |
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

Every rung-0/1 example still passes every gate. Acoustic and electric both improve to 99.5% supported-correct with zero wrong exposure. Coverage is 100% everywhere for v9. Controls reject 98.9–100%, all pass; every silence rejects 100%. These successes cannot offset the nylon regression.

### Integrity, cost and thermometer

Shared results reproduce **57/57**, with no mismatch. All candidate prefix checks and per-example seam agreements pass. Navigation fixtures retain their expected refusals. For v9, 48 kHz/480 equals direct, 48 kHz/128 has identical decisions within one block, and 44.1 kHz/128 has 186/186 jointly claimed grid positions within tolerance; all delivery causality checks pass. Supplied-label recognition uses unchanged features/reference.

v9 worst sustained cost **15.6%**, worst chunk p99 **2.010 ms**; every cost gate passes. Measured on the declared i7-8750H/Node 22.22.1 development laptop, provisional.

| Real thermometer | v8 | v9 |
|---|---|---|
| Positive agreement | 69.8% | 11.1% |
| Wrong-score rejection | 96.8% | 96.8% |
| Silence rejection | 100.0% | 100.0% |

Thermometer recorded without selection, with unchanged approximate sync labels of unmeasured precision. All evidence is reused development audio, one correct piece and one wrong piece. Grid points are correlated; there is no independent-source confidence interval, qualification or transfer claim. Bars 5–8 remain unopened.

## Against the predictions

| Prediction | Outcome | Evidence |
|---|---|---|
| 1. Nylon ≥95%, Shinyguitar ≥90% supported-correct | Contradicted | 59.3%, 82.0% |
| 2. Nylon exposure ≤4.5%, Shinyguitar ≤7% | Mixed, overall contradicted | Nylon 12.3% fails; Shinyguitar 1.6% holds but correct following falls |
| 3. Earlier rungs, controls, acoustic/electric retain every gate | Held | All safeguards pass |
| 4. Shinyguitar deadlines ≤10% missed | Contradicted | 18.0% |
| 5. Cost, causality, reproduction and seam | Held | Every gate passes; 57/57 reproduce |

## Decision

**Reject v9 by the frozen rule.** Neither failing guitar gains two points supported-correct, and nylon wrong exposure rises. No candidate is selected from thermometer results. v8 stays incumbent; suite not saturated, sampled-guitar passes still 2/4, batch improvement target not met. v9 and its records remain frozen, but leave the active entries.

### Resulting plateau, budgets and evidence access

Incoming plateau 0; no qualifying alignment gain, so **1 consecutive candidate version without gain**. No stopping rule or mandatory refresh yet. One candidate version, one scoreboard; development unrationed. Qualification remains zero versions/assessments, six/twelve slots unused, reserved/final access unused. All active data remains development evidence, bars 5–8 unopened. One bounded research note added; no human judgement or loosened gate. Batch progress **1/5 experiments completed**, 018–021 remain.

## Next

Question: can a continuity preference suppress bursts without reinforcing its own selected endpoints? A causal estimate anchored to unregularized acoustic endpoints could distinguish predictor feedback from a general failure of continuity. Check the path/support interaction too: Shinyguitar improved alignment but lost supported-correct. This is advice, not a restriction; the next experiment must freeze its own rules.

## Attribution

Designed, implemented, executed, interpreted and recorded by **GPT-6 in Codex**; no delegated agent or independent executor.
