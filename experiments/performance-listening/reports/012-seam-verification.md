# 012 — The Studio seam, verified on the scoreboard

## Pre-registration

Committed 2026-09-25, before the scoreboard first runs through the seam. Not a listening
experiment: no candidate changes, and nothing here can move a candidate's standing. It
checks [SEAM.md](../SEAM.md) part 1 end to end on the private evidence, which the bench
suite cannot reach. Results are appended below; nothing above this line changes after
the run.

### What runs

The slim active suite under [development contract 1](../contracts/development-contract-1.md),
now through the seam. Each entry is wrapped by the legacy adapter as a
[version-2](../contracts/vocabulary-v2.md) listener, delivered by the seam runner, and
translated back to version 1 for the frozen evaluator. The run is compared with
[experiment 011](011-path-and-support.md)'s run using `--reproduce`.

### Predictions

1. **Reproduction.** Every result the run shares with experiment 011 is identical,
   apart from measured processing cost, for the clock, `online-time-warp@6` and the
   alignment-only diagnostic on all 19 active examples. The thermometer also reproduces
   its recorded values.
2. **Display rule.** On every example, `liveView` of the version-2 record equals the
   evaluator's effective decision at every grid point.
3. **Replay.** Replaying every example's record through `ListeningBackend` inside
   `PlaybackSession` draws exactly the scored decision at every grid point, with no
   failures.
4. **Fixtures.** Every entry answers both navigation fixtures. The clock follows the
   repeat-and-volta fixture from the top and refuses the mid-score start. The
   four-measure candidates refuse both.
5. **Delivery.** For every entry: 48 kHz in 480-sample chunks through the adapter equals
   direct delivery; 48 kHz in 128-sample blocks gives the same decisions, each at most
   one block later; at 44.1 kHz in 128-sample blocks, wherever both deliveries claim a
   position, the two agree within ±0.25 quarter, and every delivery passes its prefix
   checks.
6. **Clamping.** No position anywhere in the suite had to be held at the score's final
   boundary.

## Results

Run [g012-seam-verification](../runs/g012-seam-verification/summary.json), on the
pre-registration commit `d5284d39`, 198 seconds of wall time. Every prediction held.
**SEAM.md part 1 is verified on the private evidence.**

| Check | Result |
|---|---|
| Reproduction of experiment 011 | 57 of 57 shared results identical; the thermometer identical |
| Display rule against the evaluator | Agrees on every example at every grid point |
| Replay through `ListeningBackend` in `PlaybackSession` | 10,800 grid points over three rungs and three entries, no failures |
| Positions held at the final boundary | None |

### Navigation fixtures

| Fixture | clock@1 | online-time-warp@6 | online-time-warp@2, alignment only |
|---|---|---|---|
| Repeat and volta, from the top | Follows: 100% supported correct | Refuses: cannot follow a repeat inside its first four measures | Refuses, same reason |
| Start mid-score | Refuses: starts only at the top | Refuses, same reason | Refuses, same reason |

### Delivery

The same for all three entries unless stated:

| Delivery | Result |
|---|---|
| 48 kHz, 480-sample chunks, through the adapter | Identical to direct delivery; prefix checks pass |
| 48 kHz, 128-sample blocks | The same decisions, each made at most 2.0 ms later, within one block; prefix checks pass |
| 44.1 kHz, 128-sample blocks | Every grid point where both deliveries claim a position agrees within ±0.25 quarter: 188 of 188 for the clock, 186 of 186 for the others; prefix checks pass |

At 44.1 kHz the adapter adds 1.8 ms on average to when a decision is made: 0.36 ms of
resampler kernel and the rest re-chunking. For the two online time-warping entries, one
grid point of 188 differs in whether a position is claimed at all, at the edge of the
0.2 s warm-up, where that delay shifts the first claim.

### Against the predictions

| Prediction | Outcome |
|---|---|
| 1. Identical to experiment 011, including the thermometer | **Held** |
| 2. The display rule equals the evaluator everywhere | **Held** |
| 3. The replay draws exactly the scored decision everywhere | **Held** |
| 4. The clock follows the repeat from the top and refuses the mid-score start; the others refuse both | **Held** |
| 5. The three deliveries behave as stated, with prefix checks passing | **Held** |
| 6. No position held at the final boundary | **Held** |
