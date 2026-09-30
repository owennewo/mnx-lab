# 018 — Anchor continuity to the acoustic path

## Pre-registration

2026-09-30. Designed and run by **GPT-6 in Codex**, terminal/TypeScript/tsx/Vitest.
Governed by [development contract 1](../../../contracts/development-contract-1.md).
Second of the five authorized experiments (017–021). Frozen before private execution.

### Question and evidence

Question 24: can continuity suppress bursts without reinforcing its own selected
endpoint, while retaining support? [017](017-tempo-continuity.md) rejected v9:
nylon correct following fell to 59.3%, alignment-only to 63.5%, longest alignment
error 2.85 s. Acoustic/electric improved to 99.5%; Shinyguitar alignment improved
to 93.7% but supported-correct fell to 82.0%. The saved records show nylon's first
jump delayed but a longer subsequent lag. Feedback from regularized endpoints is
a plausible explanation, not an established cause. Re-read the full research log,
017 report, relevant implementations/tests and private recorded decisions. Reuse
[017 primary-source note](../../../research/tempo-continuity-017.md); no broader research
refresh is required at plateau 1.

### One change, alternatives and discrimination

Version 10 changes v9's predictor only. Its endpoint objective keeps the normalized
acoustic cost plus **0.02** times squared deviation in **0.25-quarter** units.
Features, reference, DP recurrence, support and all other gates remain unchanged.
Instead of last regularized endpoint plus an EMA velocity, predict current position
from least-squares regression of **unregularized acoustic endpoints** over the last
100 frames (2 s). Include the current causal frame. Fit after at least 25 rows
(0.5 s); before that the raw acoustic winner is the prediction. Clamp fitted slope
to 0.5–2, as before. Each raw winner minimizes the original normalized DP cost;
the DP never consumes the chosen endpoint, so this stream is independent of prior
feedback. No label, recipe timing, timbre identity, nominal-clock-only emission or
future audio enters. New frozen files preserve v9 unchanged. A zero-weight public
behavioral test must reproduce the original path exactly.

If nylon recovers while acoustic/electric gains remain, recursive prediction was
an avoidable defect. If nylon stays worse, raw acoustic trend or regularization
strength may itself be unsuitable. If alignment improves but supported-correct does
not, the path/support interaction still blocks success. These alternative outcomes
are reported explicitly rather than assuming the feedback explanation is proved.

### Evidence and predictions

`g018-acoustic-anchor`: unchanged 19 active examples, clock, v8 and its alignment-only
diagnostic, v10 and its alignment-only diagnostic. Whole scoreboard, supplied-label
recognition, real thermometer and all seam checks; `--reproduce g017-tempo-continuity`
requires all 57 shared examples to reproduce excluding cost. v9 comparisons use its
frozen 017 results. No private candidate run or tuning before this pre-registration.
No new bars, qualification, reserved/final evidence or post-run tuning.

1. Nylon supported-correct ≥95%, wrong exposure ≤4.5%; Shinyguitar supported-correct
   ≥90%, wrong exposure ≤7%.
2. Nylon alignment-only correct ≥95%, longest wrong episode ≤0.5 s, against v9's
   63.5% and 2.85 s; Shinyguitar alignment-only correct ≥93%.
3. Every rung-0/1 example, control, acoustic and electric passes every gate.
4. Shinyguitar missed deadlines ≤10%.
5. Every cost, causality and seam check passes; 57/57 shared results reproduce.

Each number is judged separately; a failed bound contradicts that component and
mixed evidence stays mixed. The real thermometer is recorded, never selects.

### Decision rules

Keep v10 only if prediction 3 safeguards and prediction 5 integrity/cost pass,
nylon and Shinyguitar each gain ≥2 supported-correct points over v8, and neither
increases wrong exposure. Full saturation additionally requires all 19 examples
passing every gate; the batch target also requires nylon exposure ≤4.5%.
Otherwise reject, retain v8 and investigate the measured limit. A better alignment
alone does not satisfy the keep rule. Mixed predictions do not invent a keep branch.
Infrastructure, reproduction or seam failure: inconclusive, failed attempt retained;
only a documented infrastructure repair permits rerun of identical frozen code/rules.
An unanticipated outcome fitting no branch is inconclusive.

### Carried-over state and preflight

Incoming plateau **1 version without gain**, report 017. The same gain definition:
both failing guitars gain ≥2 supported-correct points over the incumbent without
increasing either wrong exposure. Gain resets to 0; none increments to 2. At 3,
one bounded refresh; three further failures stop. Development unrationed;
qualification zero versions/assessments, six/twelve slots and reserved/final access
unused. All active examples are reused development evidence; bars 5–8 remain unopened.

017 landed and its worktree was retired before design. Main clean at b49c3e1e;
no other worktree or 018 public/private run/report existed. This session owns
`listening-018-acoustic-anchor`, dependencies installed once. Required artifacts and
ffmpeg accessible; 017 verified every frozen hash, and scoreboard does so again.
Private output permission carried over from the user request via sandbox escalation.
No substitute data or missing prerequisite. Batch completed 1/5, 018–021 remain.

## Results

**Reject v10 as incumbent.** Nylon stays below v8 and its wrong exposure rises; the keep rule requires a gain on both failing guitars. v8 remains incumbent. The acoustic-anchored predictor substantially improves over rejected v9, and fixes Shinyguitar alignment, but does not meet the batch target.

Run [g018-acoustic-anchor](../runs/g018-acoustic-anchor/summary.json), commit `4a2349d0d8349afe48d4403954dcf6a18ba600f7`, 375.660 CPU seconds; one attempt, no infrastructure rerun. All frozen sets, labels and instruments unchanged.

### Recorded guitars

189 answerable points per positive.

| Guitar | v8 correct | v9 correct | v10 correct | v10 wrong exposure | Longest | Missed deadlines | Failed gates |
|---|---|---|---|---|---|---|---|
| development-tonejs-acoustic-positive | 96.3% | 99.5% | 99.5% | 0.0% | 0.00 s | 0.5% | — |
| held-out-tonejs-nylon-positive | 90.5% | 59.3% | 89.9% | 9.6% | 0.40 s | 10.1% | supportedCorrect, exposure, deadline |
| held-out-tonejs-electric-positive | 95.8% | 99.5% | 99.5% | 0.0% | 0.00 s | 0.5% | — |
| held-out-shinyguitar-positive | 84.1% | 82.0% | 87.3% | 0.0% | 0.00 s | 12.7% | supportedCorrect, deadline |

### Alignment versus support

| Guitar | v9 alignment correct | v10 alignment correct | v10 alignment wrong exposure | Longest wrong episode |
|---|---|---|---|---|
| development-tonejs-acoustic-positive | 99.5% | 99.5% | 0.0% | 0.00 s |
| held-out-tonejs-nylon-positive | 63.5% | 89.9% | 9.6% | 0.40 s |
| held-out-tonejs-electric-positive | 99.5% | 99.5% | 0.0% | 0.00 s |
| held-out-shinyguitar-positive | 93.7% | 99.5% | 0.0% | 0.00 s |

On nylon, changing the predictor restores alignment from 63.5% to 89.9% and reduces the longest wrong episode from 2.85 s to 0.40 s. This supports a predictor-specific failure in 017, but cannot attribute it uniquely to feedback: evidence window and fitting method changed together as part of the predictor. It still does not beat v8 nylon alignment (90.5%).

On Shinyguitar, v10 alignment-only reaches 188/189 correct points (99.5%), with zero wrong exposure; support reduces that to 165/189 (87.3%). It refuses 23 correct grid points. This is direct evidence of a path/support interaction: v8 support was calibrated on another path. The source of its refusals, rank or cost cap, has not been isolated in this run. Lower wrong exposure alone does not establish a passing listener.

### Controls and earlier rungs

| Rung / control | v10 rejection | Longest false exposure | Failed gates |
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

Every rung-0/1 example, every control, acoustic and electric passes every gate. Coverage remains 100%; every silence rejects 100%. Baseline passing behavior is preserved, but the rejected candidate remains at 2/4 guitar passes.

### Integrity, cost and thermometer

Reproduction **57/57**, no mismatch. Every prefix causality, per-example seam agreement and expected navigation fixture result passes. 48 kHz/480 equals direct, 48 kHz/128 preserves decisions within one block. All alternate-delivery causality checks pass. Recognition features and reference unchanged.

44.1 kHz/128: 186/186 jointly claimed positions within tolerance, 187/188 support states agree.

Worst v10 sustained cost 16.8%; worst p99 2.560 ms; all cost gates pass on the declared i7-8750H/Node 22.22.1 machine, provisional.

| Real thermometer | v8 | v10 |
|---|---|---|
| Positive agreement | 69.8% | 75.1% |
| Wrong-score rejection | 96.8% | 96.8% |
| Silence rejection | 100.0% | 100.0% |

Thermometer recorded without selection against approximate sync labels of unmeasured precision. One correct piece and one wrong piece; correlated grid points on reused development audio. No independent transfer, qualification or population claim. Bars 5–8 remain unopened.

## Against the predictions

| Prediction | Outcome | Evidence |
|---|---|---|
| 1. Nylon ≥95% / exposure ≤4.5%; Shinyguitar ≥90% / exposure ≤7% | Mixed, overall contradicted | Nylon 89.9% / 9.6% fails; Shinyguitar 87.3% fails, zero exposure holds |
| 2. Nylon alignment ≥95%, longest ≤0.5 s; Shinyguitar alignment ≥93% | Mixed, overall contradicted | Nylon 89.9% fails, 0.40 s holds; Shinyguitar 99.5% holds |
| 3. Every earlier rung, control, acoustic/electric passes | Held | All safeguard examples pass every gate |
| 4. Shinyguitar deadlines ≤10% missed | Contradicted | 12.7% |
| 5. Cost, causality, seam and reproduction | Held | Every check passes; 57/57 shared examples identical |

## Decision

**Reject v10 by the fixed keep rule; retain v8.** Nylon supported-correct changes by −0.53 points, with higher wrong exposure. Shinyguitar gains 3.17 points and removes wrong exposure, but a one-guitar gain cannot meet a two-guitar rule. No full saturation, no next-bars access; no retrospective favorable branch. v10 remains frozen as useful evidence and a possible parent for a new hypothesis, and leaves active entries.

### Resulting plateau, budgets and evidence access

Incoming plateau 1; no gain on both failing guitars, so **2 consecutive candidate versions without gain**. No mandatory refresh yet; a further version without gain triggers one bounded refresh. Development unrationed; one new version and one scoreboard run. Qualification still zero versions/assessments, six/twelve slots unused; reserved/final evidence untouched. Reused development examples, bars 5–8 unopened, no freshness reset. Batch progress **2/5 complete**, 019–021 remain.

## Next

The predictor change fixes Shinyguitar alignment but exposes support as a bottleneck again. Determine whether support can judge the actual emitted path rather than the historical DP backtrace while preserving every control. Nylon still needs a separate alignment improvement; it must not be hidden by Shinyguitar gains or greater abstention. Any chosen method must be pre-registered as a new version.

## Attribution

Designed, implemented, executed, interpreted and recorded by **GPT-6 in Codex**, no delegated agent or independent executor.
