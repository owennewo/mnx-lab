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
