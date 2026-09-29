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

## Results

Run [g013-why-support-rejects](../runs/g013-why-support-rejects/summary.json), on the
pre-registration commit `b9245ebd`.

**The rank limit does almost all the rejecting; the cost cap almost none.** Both
predictions were wrong.

| Clip | Frames with a correct alignment | Refused support | Refused by the rank limit alone | By the cost cap alone | By both |
|---|---|---|---|---|---|
| tonejs acoustic | 452 | 0 | — | — | — |
| tonejs nylon | 424 | 132 | 132 | 0 | 0 |
| tonejs electric | 448 | 70 | 70 | 0 | 0 |
| Shinyguitar | 409 | 230 | 222 | 0 | 8 |
| Real Winner clip | 325 | 325 | 325 | 0 | 0 |

Each clip has 466 analysis frames after the 0.2 s warm-up.

### What the refused frames look like

| Refused correct frames | Path cost, median | Mean rank, 5th percentile | Mean rank, median | Mean rank, 95th percentile |
|---|---|---|---|---|
| tonejs nylon | 0.49 | 0.102 | 0.131 | 0.188 |
| tonejs electric | 0.49 | 0.102 | 0.119 | 0.156 |
| Shinyguitar | 0.64 | 0.107 | 0.165 | 0.216 |
| Real Winner clip | 0.37 | 0.114 | 0.155 | 0.196 |

On recorded guitar, the frames the incumbent aligns correctly rank on average in the best
12–17% of the reference, not the best 10%. The real clip's path cost is lower than on any
rendered guitar, so its failure has nothing to do with cost: its alignment is right on 325
of 466 frames, and the rank limit refuses every one.

### Against the predictions

| Prediction | Outcome |
|---|---|
| 1. The cost cap refuses more than half of the rejected correct frames on each harder guitar | **Contradicted**: at most 8 of 230 frames, always with the rank |
| 2. The same on the real clip | **Contradicted**: 0 of 325 |

### Decision

The rule fixed above for this case applies: **the 10% rank limit is too strict for recorded
guitar, and the next version replaces it with a limit the evidence cannot cheat, not a looser
number.** A looser fixed limit, 20% say, would admit these frames today, but the wrong score
was only ever measured against 10%. Nothing yet says where Dust's ranks sit on recorded
guitar.

The next step is to record the same rank distributions on the wrong-score controls, rung 2's
guitars and the real clip, then design a test that compares the path's rank with what a wrong
score achieves in the same timbre. One candidate for that is a decoy: align the same audio
against a version of the score that cannot be right, and require the real path to rank
clearly better than the decoy's. The decoy's rank moves with timbre just as the true path's
does.
