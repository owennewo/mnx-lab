# 002 — Winner: first four bars with sync interpolation

**The first real-audio development loop is complete. Neither spectral follower
passes.** Both reject silence and the wrong-score probe much better than the clock,
but they lose too much of the correct performance. Keep Winner at four bars; do not
advance to positive Dust or longer excerpts yet.

This is implementation research, using the user's requested `sync.json` interpolation.
Manual beat annotation is not a prerequisite for this development experiment.
The wider microphone-following milestone remains unfinished.

## What we measured

The fixed 9.507-second Winner clip contains the four bars the user reviewed as solo
guitar. Five existing bar boundaries supply a linearly interpolated position reference.
The original sync, score and audio files are unchanged and hash-pinned privately.
Both algorithms receive the same score, known start, and nominal 101 BPM (the anchor
average 100.978568 rounded once before running), but never the sync anchors or labels.
Audio arrives causally at 48 kHz in 10 ms chunks. There are 189 evaluation points per
example, spaced 50 ms apart after the 150 ms initial allowance, including the clip end.

The controls are the same Winner recording with Dust's score, and exact digital
silence with Winner's score. Dust's recording has not been advanced to a positive test.
The wrong-score probe assumes rejection is warranted after the initial allowance;
its precise first distinguishing instant is unverified. Silence has no such ambiguity.

Position agreement means within ±0.25 quarter notes of the interpolated reference.
This measures useful approximate following, not independently verified beat accuracy.
Early/late residuals may include performer timing, sync imperfections and tracker error.
The earlier 31.25% calculation was a worst-case sensitivity analysis, **not a measured
accuracy of sync.json**, and is not an eligibility gate here.

## Results

| Measure | Clock @1 | Spectral @1 | Spectral @2 | Target |
|---|---|---|---|---|
| Winner position agreement | 88.36% (167/189) | 46.03% (87/189) | 17.99% (34/189) | ≥95% |
| Winner position claims | 189/189 | 123/189 | 42/189 | Report separately |
| Winner lost / rejected points | 0/189 | 66/189 | 147/189 | Never counted as correct following |
| Wrong-score rejection | 0% | 95.77% (181/189) | 100% (189/189) | ≥95% |
| Silence rejection | 0% | 100% | 100% | ≥95% |
| Winner wrong-position exposure | 11.76% | 19.24% | 4.27% | ≤5% |
| Winner longest wrong episode | 1.10 s | 0.55 s | 0.20 s | ≤0.50 s |
| Winner missed decision deadlines | 11.64% | 53.97% | 82.01% | ≤10% |
| Decision emission coverage, every example | 100% | 100% | 100% | ≥98% |

Decision emission coverage includes explicit rejection. It is not supported-following
coverage. Version 2's lower wrong exposure mostly comes from declining to follow;
that does not rescue its failed positive agreement. All failed positive decisions
also miss the 200 ms correctness deadline: these versions never issue corrections.
Exposure and longest episodes use the declared 50 ms evaluation grid.

| Timing against sync, on position claims only | Clock @1 | Spectral @1 | Spectral @2 |
|---|---|---|---|
| Signed mean: positive ahead, negative behind | +70 ms | −70 ms | −8 ms |
| Median absolute residual | 52 ms | 71 ms | 73 ms |
| 95th percentile absolute residual | 164 ms | 592 ms | 232 ms |
| Denominator | 189 claims | 123 claims | 42 claims |

A small residual among the surviving claims does not show reliable following. The
private listening trace displays rejected intervals as gaps rather than zero error.
These are correlated observations from one performance, not 189 independent trials;
no population confidence interval or transfer claim is justified.

## Hypotheses and decision

Version 1 compares short causal pitch-class spectra with score-derived templates and
uses a monotone incremental alignment with a tempo prior. It was motivated by the
[bounded alignment research](../research/dixon-2005-online-alignment.md), not a claim
that a published piano result transfers to guitar. Harmonics and ringing notes were
a plausible explanation for its failures.

The [pre-recorded revision](../research/spectral-revision-2.md) preserves pitch register
and gives each score note a simple harmonic template. The alignment, rejection
threshold and reference stay unchanged. This made rejection more conservative and
positive following substantially worse. The predicted improvement was contradicted.
The experiment does not isolate whether representation, template decay, alignment or
confidence calibration is the main cause; it does rule out accepting either candidate
as a useful following improvement on this clip.

Both versions reduce source-weighted wrong exposure versus the audio-ignoring clock,
but both violate positive accuracy, deadline and regression limits. The recorded
verdict for each is **proxy-targets-not-met**. Neither is retained; the clock remains
the permanent floor, not a successful listener. No reserved or acceptance sets were
used. Formal retention and microphone qualification were not assessed.

The predeclared sub-batch allowed two versions and four candidate/set assessments,
including the clock twice. It is now closed. The second run's generic `next` field
still says “at most one focused revision”; the predeclared cap and this closing record
take precedence. The run record is preserved unchanged.

## Cost and research budget

All 72 complete-record prefix checks passed: three cut points, two altered futures,
three examples, two algorithms in each of two runs. No measured replay backlog occurred.
On this laptop (Intel i7-8750H, Node 22.22.1), the maximum chunk p99 was 1.39 ms for
version 1 and 1.67 ms for version 2, below the 10 ms target. Maximum sustained ratios
were 5.88% and 6.96% of audio time, below 25%. Maximum initialization times were
101 ms and 96 ms. Replay costs are provisional; microphone-to-feedback latency was
not measured.

The two runs consumed 16.261452 + 18.324054 = **34.585506 CPU seconds**, including
prefix checks. Contract 1 now has two of six candidate versions and four of twelve
candidate/set assessments used; this narrower two-version sub-batch is exhausted.
Web research has used three of six source slots and both bounded questions. No budget
was extended to keep trying until a pass.

## Where the loop is now

Question → fixed evidence → initial candidate → diagnosis → one revision → decision
→ next question are complete for experiment 002. The next useful question is whether
score-template similarity distinguishes correct from incorrect position when alignment
is supplied for diagnosis. Use the existing sync proxy as privileged diagnostic input
to separate acoustic representation/confidence from tracking errors; do not count such
a result as end-to-end following. That is a proposed next bounded experiment, not an
unreported third candidate trial. No further annotation is needed to begin it.

Winner remains first and stays at four bars. Only a candidate that clears its targets
should move to Dust; eight and twelve bars follow the agreed progression. Stronger
independent evidence is still needed for eventual retention and live-microphone use.

## Evidence and reproduction

Policy: [user-directed sync development](../contracts/sync-proxy-development-1.md).
Set: `winner-four-bars-sync-proxy-v1`, SHA-256
`80c8a6358751f356e164f75389dd50d49a2a0da6ad094f95847bd304eb5c5b8b`.
Evaluator: `sync-proxy-evaluator@1`.

- [Run 002a: initial spectral follower](../runs/g002a-spectral1-winner-sync-proxy/summary.json), source commit `b1a1f103`.
- [Run 002b: register/harmonic revision](../runs/g002b-spectral2-winner-sync-proxy/summary.json), source commit `56434dd9`.

Each aggregate summary pins the implementation, policy, private full records and
private evaluations. Full traces, the frozen manifest, audio and scores stay outside
git under `/home/williao/dev/mnx-listening-data/real-evidence-01/`. The private page
`002-winner-sync-proxy.html` embeds the Winner WAV and saved timing traces; it works
offline without a server or access to the original media paths.

To reproduce candidate decisions, use a detached checkout of the recorded source
commit in an isolated worktree, and a separate private copy of the frozen set and its
hash-identical assets. The runner refuses existing run IDs and enforces the batch
budget; never delete history to make room. A fresh private parent directory gets a
fresh reproduction history, clearly separate from development selection. Cost timings
will vary. The private manifest uses absolute paths; preserve those paths or create a
new relocated manifest identity and report that difference.

```sh
npx tsx experiments/performance-listening/bench/src/proxy/run.ts /private/reproduction/proxy-winner-v1 g002r-reproduction 1
# On the revision's recorded source commit, use a different fresh reproduction parent:
npx tsx experiments/performance-listening/bench/src/proxy/run.ts /private/reproduction-v2/proxy-winner-v1 g002s-reproduction 2
```

The preparer reads the original sync sidecar directly and refuses to replace an
existing frozen set. All commands and report exporters preserve the recorded outcomes.
