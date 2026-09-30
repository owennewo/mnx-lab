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
