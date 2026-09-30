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
