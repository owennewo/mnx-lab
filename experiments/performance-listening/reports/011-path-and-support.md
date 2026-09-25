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

## Results

Run [g011-path-and-support](../runs/g011-path-and-support/summary.json), on the
pre-registration commit `20a25255`. The clock, version 2 and its diagnostic were reused
from the cache; their spot checks reproduced. The run took 5.5 minutes of wall time,
almost all of it computing five new entries.

**Neither path change helps; the rank-based support test does, on one side.** Letting the
path react faster made the alignment much worse. Judging support by rank made rejection
of the wrong score reliable on every guitar, but did not stop the test rejecting correct
alignments on the hard guitars. Version 6 is kept and becomes the incumbent.

### The alignment changes

Wrong positions made by each alignment-only diagnostic on the four active guitars:

| Alignment | tonejs acoustic | tonejs nylon | tonejs electric | Shinyguitar | Total |
|---|---|---|---|---|---|
| Version 2: normalised endpoint, half-to-double steps | 96.3% correct | 90.5% | 95.8% | 87.8% | 52 wrong |
| Version 4: endpoint by evidence fading over 1 s | 96.3% | 68.3% | 86.8% | 57.7% | 168 wrong |
| Version 5: steps from a third to three times | 94.2% | 80.4% | 90.5% | 73.0% | 113 wrong |

Both changes give the path more freedom to follow the latest frames, and both make it
follow them wrongly more often. The whole-history normalised cost is a stabiliser, not
the cause of the bursts. Both versions also fall below the wrong-score gate on rung 0 or
rung 1, so neither passes the sine rungs any more.

### The support change

| Wrong-score rejection | Rung 0 | Rung 1, three tempi | Rung 2, four guitars |
|---|---|---|---|
| Version 2: fixed gap | 97.9% | 95.4%, 97.3%, 97.2% | 94.7%, 79.9%, 88.9%, 100% |
| Version 6: rank within the best 10% | 98.4% | 98.8%, 98.4%, 100% | 100%, 100%, 98.4%, 100% |

| Positive supported correct, rung 2 | tonejs acoustic | tonejs nylon | tonejs electric | Shinyguitar |
|---|---|---|---|---|
| Version 2 | 96.3% | 62.4% | 78.8% | 39.7% |
| Version 6 | 96.3% | 62.4% | 79.9% | 38.6% |

Version 6 passes rungs 0 and 1 with wider margins than version 2 and rejects Dust on
every guitar. Its alignment is version 2's, which is right on 87.8–96.3% of points, yet
it still reports unsupported on up to 61% of the performance on the hardest guitars.
Whether the 10% rank limit or the path-cost cap rejects those correct alignments was not
measured here.

On the real clip, version 6 agrees with the sync reference on no points: it rejects the
whole positive clip.

### Against the predictions

| Prediction | Outcome |
|---|---|
| 1. Version 4's alignment makes at most 26 wrong positions | **Contradicted**: 168 |
| 2. Version 5's alignment improves, but less than version 4's | **Contradicted**: 113, worse than version 2 |
| 3. Version 6 rejects the wrong score on 3 of 4 guitars and matches version 2's positives on 3 of 4 | **Held**: 4 of 4 and 3 of 4, though the positives did not improve |
| 4. All three versions still pass rungs 0 and 1 | **Contradicted** for versions 4 and 5; held for version 6 |
| 5. No single change passes rung 2 | **Held** |
| 6. Version 6 beats version 2 on the real clip | **Contradicted**: 0% against 12.7% |

### Decision

By the rules fixed above, only version 6's change is kept. It becomes the incumbent: it
passes rungs 0 and 1, and on rung 2 it fails only on the positive examples.

Two findings shape the next step. Faster-reacting paths made the bursts worse, so the
opposite direction is worth testing: favour a steady tempo where the audio gives little
evidence, such as during sustained notes. And the rank-based support test's rejection of
correct alignments has to be traced to its cause, the rank limit or the path-cost cap,
before either is changed.
