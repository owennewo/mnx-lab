# 013 — Why the support test rejects correct alignments

## Pre-registration

Committed 2026-09-29, before the diagnostic runs. A diagnostic, not a candidate. Governed
by [development contract 1](../contracts/development-contract-1.md). Results are appended
below; nothing above this line changes after the run.

### Question

The incumbent `online-time-warp@6` claims support only when two conditions hold over the
last second: the path's reference frames rank, on average, within the best 10% for the
current sound, and the path's average matching cost is at most 0.7. On rung 2's harder
guitars it reports unsupported for a third to three fifths of the performance, though its
alignment is right on most of those frames. On the real clip it rejects everything. Which
condition is doing the rejecting?

### Method

Run the incumbent with a trace, which reports the values behind each support decision and
changes none of them, on the four active rung-2 guitars and on the real Winner clip. At every
analysis frame after the 0.2 s warm-up where the aligned position is within ±0.25 quarter of
the truth but support is refused, record whether the rank limit refused, the path-cost cap
refused, or both. The truth on rung 2 is the exact rendering. On the real clip it is the
sync interpolation, whose precision is unmeasured.

### Predictions

1. **The cost cap does most of the rejecting.** Recorded guitar raises every frame's cost
   against a sine reference, but the rank of the right frame survives that. On each of the
   three harder guitars, tonejs nylon, tonejs electric and Shinyguitar, the cap alone or
   together with the rank refuses more than half of the rejected correct frames.
2. **The real clip is the same.** On the real clip, the cap refuses more than half of the
   rejected correct frames.

### Decision rules, fixed now

- **The cap dominates.** The next version drops the absolute cost cap and relies on the
  rank, which already rejects the wrong score on every guitar, with silence still rejected
  by level. It is run on the slim suite.
- **The rank limit dominates.** The limit is too strict for recorded guitar. The next
  version replaces the fixed limit with one the evidence cannot cheat, not a looser number.
  That design needs the distribution of ranks this diagnostic records.
- **Both refuse together.** Both conditions measure the same timbre mismatch. The next
  version changes the features' sensitivity to timbre before either condition is revisited.
