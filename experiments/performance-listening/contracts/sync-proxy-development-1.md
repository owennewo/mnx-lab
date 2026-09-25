# Sync-proxy development 1 — user-directed first loop

2026-09-25. This records the user's direction after approving research contract 1:
“why are you not using the sync.json for this and interpolating? It should be
\"good enough\"”. The user accepts approximate sync interpolation for this initial
development experiment. No further manual beat annotation is a prerequisite here.

Start with Winner's first four performed bars. Use the existing `sync.json` bar
anchors and linear interpolation, preserving their identity and leaving them unchanged.
Use the fixed reviewed crop and known start. Nominal handoff is the independently
computed anchor-average BPM rounded to the nearest integer for both candidates; report
that rounding explicitly. The candidate receives the score, nominal tempo and causal
audio chunks, never sync anchors, reference positions or clip labels.

This is an explicit amendment to the first *development* evidence requirement:
interior precision is unmeasured and is not required to satisfy the earlier
±0.125-quarter/80%-independently-bounded condition. The earlier 31.25% sensitivity
calculation was not a measurement of sync accuracy and is not an eligibility gate
for this experiment. Preserve the original contract, calculation and v2 checkpoint
as history; do not relabel this approximation as independently verified truth.

Keep the original ±0.25-quarter agreement tolerance, 150 ms initial allowance,
200 ms decision deadline, decision coverage/cost/causality targets and comparator.
Report early/late residuals against the interpolated reference; these may reflect
performance timing, sync imperfections, or tracker error. They are diagnostic evidence,
not certain musical mistakes. A same-source wrong-score probe uses Dust's intended
score, with unsupported following provisionally expected after the initial allowance;
its first distinguishing instant is unverified. A same-duration digital silence probe
has exact silence. Both controls use Winner's nominal handoff tempo for fairness.

All evidence is development-only. A provisional target pass is agreement with this
proxy, not formal retention or microphone qualification. Reserved/final acceptance
requirements are unchanged. Keep both raw sources, scores, sync files, per-frame
reference traces and audio outside git; commit hashes, methods and aggregate outcomes.

## First bounded question and prediction (before running)

Can a causal score-derived spectral follower use audio to reduce false following on
controls without sacrificing agreement on Winner, compared with the audio-ignoring
clock? Use a short causal spectrum, score pitch-class templates and incremental
monotone alignment. Expected: silence rejection improves; repeated harmonies, score
sustain versus plucked decay, and common harmonics may limit timing or wrong-score
rejection. Success is not assumed. One initial version and at most one focused
revision answer this first algorithm question; stop this sub-batch after that and
record its result. This uses at most four candidate/set assessments including repeated
comparators, within contract 1's six-version/twelve-assessment/two-CPU-hour ceiling.
No data or threshold is changed after seeing candidate outcomes.

Use the same frozen Winner positive, wrong-score and silence examples for both runs.
Advance the frozen candidate to Dust only if Winner meets every applicable proxy
agreement, control, coverage, exposure, deadline, causality and cost target. Otherwise
record the failed targets and next hypothesis; do not expand bars to hide the failure.
