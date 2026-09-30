# 018 — Anchor continuity to the acoustic path

## Pre-registration

2026-09-30. Designed and run by **GPT-6 in Codex**, terminal/TypeScript/tsx/Vitest.
Governed by [development contract 1](../contracts/development-contract-1.md).
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
[017 primary-source note](../research/tempo-continuity-017.md); no broader research
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
