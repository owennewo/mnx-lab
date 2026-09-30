# 017 — A causal tempo-continuity preference at the endpoint

## Pre-registration

2026-09-30. Designed and run by **GPT-6 in Codex**, terminal/TypeScript/tsx/Vitest.
Governed by [development contract 1](../contracts/development-contract-1.md).
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
[the research note](../research/tempo-continuity-017.md); this endpoint prior is our
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
