# 011 — The alignment path and the support test, one change at a time

## Pre-registration

Committed 2026-09-25, before any of the three new versions runs on the suite. Governed by
[development contract 1](../contracts/development-contract-1.md) and its slim active suite.
Results are appended below; nothing above this line changes after the run.

### Questions

The incumbent `online-time-warp@2` fails rung 2, recorded guitar at exact timing, with
two separate defects. [Experiment 010](010-slim-suite-and-burst-features.md) found that
its alignment's error bursts come from the path, not the features. [Experiment 008](008-rung2-guitar-samples.md)
found that its support test is miscalibrated across guitars. This experiment tests one
change per version against version 2, so each effect can be attributed.

### The versions

All three are built on one configurable implementation whose default configuration
reproduces version 2 decision for decision on public audio, including tempo-varied audio,
a wrong score and the alignment-only mode.

| Version | The one change | Aimed at |
|---|---|---|
| online-time-warp@4 | The position is the endpoint with the lowest cost when older evidence fades with a 1 s time constant, instead of the lowest cost over the whole history divided by path length | Alignment bursts: a drifted path can be overtaken by one that fits the recent audio |
| online-time-warp@5 | Steps allow local tempo from a third to three times the handed tempo, instead of a half to double | Alignment bursts: a drifted path can return faster |
| online-time-warp@6 | Support when the path's reference frames rank, on average over the last second, within the best 10% of all reference frames for the same sound, instead of a fixed gap between path and unconstrained cost; the path-cost cap stays | Support calibration: a rank does not move when timbre shifts every cost |

Versions 4 and 5 also run as alignment-only diagnostics. Version 6's alignment is
version 2's, so version 2's diagnostic already measures it. The 1 s fade, the wider
steps and the 10% limit were fixed before any run.

### Scoreboard

The slim active suite: 19 examples from rungs 0, 1 and 2, with the clock, version 2 and
its diagnostic reused from the cache.

### Predictions

For reference, version 2's alignment-only diagnostic makes 52 wrong positions over the
four active guitars, and version 2 rejects the wrong score on at least 95% of points on
one of the four.

1. **The recent-evidence endpoint fixes most bursts.** Version 4's alignment-only
   diagnostic makes at most 26 wrong positions on the four active guitars.
2. **It does more than wider steps.** Version 5's alignment-only diagnostic makes fewer
   than 52 wrong positions, but more than version 4's.
3. **Rank support is calibrated across guitars.** Version 6 rejects the wrong score on at
   least 95% of points for at least three of the four active guitars, and its
   supported-correct rate is at least version 2's on at least three of them.
4. **Nothing breaks the sine rungs.** All three versions still pass rungs 0 and 1.
5. **No single change passes rung 2.** Each version fixes at most one of the two defects.
6. **The real clip improves with rank support.** On the thermometer, version 6 agrees
   with the sync reference on more points than version 2's 12.7%.

### Decision rules, fixed now

- A change is **kept** when it improves what it aims at and still passes rungs 0 and 1.
- **Kept changes are combined** into one version, run next on the same suite.
- **No change is kept.** The path and support explanations are both wrong as posed, and
  the next step is diagnosis, not another variation.
