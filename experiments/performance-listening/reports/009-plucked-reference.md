# 009 — A reference that decays like a plucked string

## Pre-registration

Committed 2026-09-25, before `online-time-warp@3` runs on any rung. Governed by
[development contract 1](../contracts/development-contract-1.md). Results are appended
below; nothing above this line changes after the run.

### Question

Does the missing decay in the listener's reference cause both of the incumbent's rung-2
failures? [Experiment 008](008-rung2-guitar-samples.md) found that recorded guitar
timbre breaks `online-time-warp@2` in two ways. Its alignment slips during the decay of
sustained bass notes, and its support test is not calibrated across guitars. Version 2
renders its reference as sines held at full level; a plucked string decays.

### The one change

`online-time-warp@3` renders the reference with every note decaying exponentially from
its onset, with a time constant of 0.58 s. Everything else is version 2's: the features,
the alignment and the support test, with the same fixed limits.

The time constant is the median of the decays fitted to the 29 samples Winner's notes
use in the four development guitar sets, measured before this pre-registration by
`src/ladder/decay.ts`. The per-set medians range from 0.50 s to 0.91 s. No held-out set
was measured.

### A trade-off found before running

The public-data implementation test exposed one consequence already. Against a held-sine
rendering of the two-bar scale, version 3 follows only 78% of points, because its
features are log-compressed magnitudes whose shape changes with level. A decaying
reference no longer looks like a note held at full level. Its implementation check was
therefore moved to the matched case, a plucked rendering of the scale, which it passes.
Rungs 0 and 1 are held sines, so version 3 may trade them for rung 2.

### Scoreboard

Rungs 0, 1 and 2, unchanged and frozen. Version 3 and its alignment-only diagnostic are
added. Earlier candidates' results are reused from the fingerprinted cache, with one
example per candidate per rung recomputed and required to match exactly.

### Predictions

1. **The alignment stops slipping on decaying bass notes.** With support off, version 3
   makes fewer wrong positions on rung 2 than version 2's 53 in total, and the bursts at
   quarters 5.5–5.8 and 13.5–13.8 are gone on most sets.
2. **The support test is better calibrated on guitar.** Version 3 meets the
   supported-correct gate on at least 4 of the 7 rung-2 sets, against 2 for version 2,
   and the wrong-score gate on more sets than version 2's 1.
3. **It gives up the sine rungs.** On at least one rung-0 or rung-1 positive example,
   version 3 falls below 95% supported correct.
4. **The real clip improves.** On the thermometer, version 3 agrees with the sync
   reference on more points than version 2's 12.7%, and its alignment-only diagnostic on
   more than version 2's 69.8%.
5. **Every reused result reproduces** in its spot check.

### Decision rules, fixed now

- **Predictions 1 to 3 hold.** Decay matters in both directions: the features are
  sensitive to a note's envelope, and no single fixed reference envelope serves held and
  plucked notes. The next change makes the features insensitive to level envelope, so
  one reference serves both.
- **Prediction 1 holds but 2 fails.** The decay fixes the alignment, and the support test
  is miscalibrated for another reason. The support test is redesigned next.
- **Prediction 1 fails.** Decay is not what misleads the alignment; the bursts need
  another explanation before any further change.
- **Version 3 passes rungs 0, 1 and 2.** It becomes the incumbent, and rung 3, onset
  timing, follows.
