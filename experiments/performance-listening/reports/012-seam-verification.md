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
