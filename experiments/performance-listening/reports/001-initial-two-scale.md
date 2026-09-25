# 001 — Initial two-scale assessment

The first assessment succeeded: the harness produced every predicted result and its
causality checks passed. It establishes a reproducible way to measure following and
false claims of following. It does not establish an ability to listen to music.

## What we tried

We gave a deliberately audio-ignoring clock follower an intended score and a starting
tempo. It advanced by elapsed time and always claimed full confidence. The two sources
were a one-bar C4–F4 sequence and a two-bar C-major scale, rendered as simple sine tones.
Five examples tested matching audio, silence, the wrong tune and a faster performance.

## What happened

| Example | Result | Meaning |
|---|---|---|
| One-bar sequence, matching tempo | 68 / 68 answerable points correct | A clock can pass this positive example without hearing anything. |
| Two-bar scale, matching tempo | 148 / 148 correct | A second positive alone does not distinguish following from timing. |
| Silence | 168 / 168 false-following claims; 8.35 s exposure | The harness catches confident claims when there is no musical evidence. |
| Wrong tune: descending scale | 158 / 158 false-following claims; 7.85 s exposure | Correct rhythm and tempo cannot rescue a wrong-piece claim. |
| Scale played at 90 BPM, clock given 60 BPM | Correct through 0.5 s, then 90 wrong points; 4.5 s exposure; final error 2.5 quarter notes | The tempo probe exposes a follower that merely advances a clock. |

“Answerable” excludes the detection allowance and unlabelled tails. These are
correlated observations on a 50 ms grid, not hundreds of independent performances.
The two controls have different durations; their exposure is each duration minus
150 ms. The detailed report below preserves the full denominators and both views.

## What we learned

The positive examples are too easy to demonstrate listening by themselves. The
negative controls and tempo probe are essential: they make an audio-ignoring strategy
fail visibly, even while it looks perfect on the matching scores.

All 15 prefix checks passed: changing the future did not change earlier decisions.
The silence example's identical silent futures make its checks non-discriminating;
the other four examples supply actual future changes. Recorded processing costs were
within the provisional development-machine budget. This cheap clock baseline says
little about the cost of a future audio listener or microphone-to-feedback latency.

The labels, candidate and counting rules were not adjusted to obtain agreement. The
set and instrument contracts were frozen after the recorded run agreed with the
predictions; reproduction checks regenerate identical audio and decision bytes.

## What R1 adds

The inventory covers 103 recording entries across the available library snapshot,
plus explicit exclusions and re-amplification opportunities. **No real-source set is
ready to freeze.** The remaining work is to verify solo status, score and performed
route correspondence, anchor precision, and rights/access. Re-amplification also
needs physical capture and delay/drift calibration. A plausible title or a structurally
fitting anchor range is not enough to qualify a recording.

## Where this leaves us

A–G and R1 are complete. The measurement pipeline is ready for the next planned step;
real-world listening performance remains untested. Research-contract-0 is still
provisional and not human-approved. The next plan can use these results and the
inventory to define an approved research contract and prepare real evidence before
making qualification or retention claims.

This is the readable report for recorded run **g001-clock-harness-v1**, using
**clock-follower@1**, **harness-v1**, and **following-evaluator@1**. The report number
001 is a reading and filing aid; it does not rename the run or start a new experiment.
