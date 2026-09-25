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

## Results

Run [g009-plucked-reference](../runs/g009-plucked-reference/summary.json), on the
pre-registration commit `6b4d0f01`. The six earlier entries were reused from the
fingerprinted cache, and all 18 spot checks, one per entry per rung, reproduced
exactly. The run took 15 minutes, almost all of it computing version 3 and its
diagnostic; the same scoreboard took 28 minutes without the cache.

**A fixed plucked decay is not the fix.** Version 3 does not reduce the alignment's
wrong positions on rung 2 overall, does not improve the support test's calibration
across guitars, and loses rung 1 by a hair. Under the rule fixed above, prediction 1
failed, so the bursts need another explanation before any further change.

### Rung 2, versions 2 and 3

| Sample set | v2 supported correct | v3 supported correct | v2 alignment only | v3 alignment only | v3 wrong-score rejection |
|---|---|---|---|---|---|
| tonejs acoustic | 96.3% | 98.9% | 96.3% | 98.9% | **94.2%** |
| Martin | **94.2%** | 95.8% | **94.2%** | 95.8% | **93.1%** |
| Spanish | **91.0%** | **94.2%** | **94.2%** | 96.8% | **94.7%** |
| Fender | 96.3% | 96.3% | 96.3% | 96.3% | **82.5%** |
| tonejs nylon | **62.4%** | **70.4%** | **90.5%** | **91.5%** | **78.3%** |
| tonejs electric | **78.8%** | **78.3%** | 95.8% | 96.3% | **86.2%** |
| Shinyguitar | **39.7%** | **38.6%** | **87.8%** | **90.5%** | 100% |

Bold marks a value below the 95% gate. The first four sets are development and the
last three held out.

| Rung 2, summed over the seven positives | Version 2 | Version 3 |
|---|---|---|
| Alignment only: wrong positions | 53 | 57 |
| Incumbent: lost points | 214 | 202 |
| Sets meeting the supported-correct gate | 2 | 3 |
| Sets meeting the wrong-score gate | 1 | 1 |

### Where decay helped and where it did not

The bursts of wrong positions from experiment 008, with the support test off:

| Sample set | Version 2 bursts | Version 3 bursts |
|---|---|---|
| tonejs acoustic | 5.55 ahead, 13.63 ahead | one point at 13.72 |
| Martin | 5.72, 9.60, 11.11, 13.55 | 4.63, 5.81, 9.60, 11.11, 13.63, each shorter |
| tonejs nylon | 5.47, 8.58, 10.10, 10.60, 13.63 | 5.47, 8.58, 10.60, 12.12, 13.63 |
| Shinyguitar | 5.55, 6.56, 8.08, 9.09, 10.10, 11.62, 13.47 | 5.55, 6.56, 8.08, 10.10, 11.62, 13.55 |

Positions are in quarters. Decay removed the bursts on the tonejs acoustic set and
lifted the Spanish set's alignment from 94.2% to 96.8%. Those two development sets decay
closest to the reference's 0.58 s, at a median of 0.51 s and 0.50 s. It shortened some
bursts on Martin, which decays at 0.69 s. On the held-out nylon and Shinyguitar sets the
bursts stayed, in the same places. A single fixed envelope matches some guitars and not
others.

### Rungs 0 and 1

Version 3 passes rung 0. On rung 1 it follows every positive example, with its worst
at 99.4%, so the trade-off seen in the public test did not appear on Winner. It loses
rung 1 on the wrong-score margin that was already thin for version 2 on fast tempi:
the held-out 109 BPM control rejects 94.9%, and the development 106 BPM control's
exposure is 5.1%.

### Thermometer

On the real Winner clip, version 3 agrees with the sync reference on 18.5% of points,
against 12.7% for version 2. Its alignment-only diagnostic agrees on 68.3%, against
69.8%.

### Against the predictions

| Prediction | Outcome |
|---|---|
| 1. Fewer alignment errors than version 2's 53, bursts gone on most sets | **Contradicted**: 57; gone on one set of seven |
| 2. Supported-correct gate on at least 4 of 7 sets; wrong-score gate on more than 1 | **Contradicted**: 3 and 1 |
| 3. Gives up the sine rungs on a positive example | **Contradicted**: every rung-0 and rung-1 positive at least 99.4%; it lost rung 1 on a wrong-score control instead |
| 4. Beats version 2 on the real clip, with and without support | **Half held**: 18.5% against 12.7%; alignment only 68.3% against 69.8% |
| 5. Every reused result reproduces | **Held**: 18 of 18 |

### What this changes

- **One fixed envelope cannot serve every guitar.** Decay helps exactly where the
  reference's decay matches the instrument, and nowhere else. This points to features
  that do not depend on how a note's level changes over time, not to a better choice of
  one decay.
- **The support test is miscalibrated independently of decay.** Matching the envelope
  on the set where it matched best did not bring the test within its gates there.
- **Held-out evidence is running out.** Experiments 008 and 009 have now examined the
  held-out sets' failures in detail, which makes them development evidence. A revised
  candidate needs fresh held-out guitars. Seven sample sets exist in hand, and only the
  Iowa, Freesound, Karoryfer, freepats and Kinwie origins are independent.

### Next

Under the rule fixed above, the bursts need an explanation before another candidate
change. The next step is a diagnostic, not a candidate: for each burst, compare the
live frame's features with the reference at the true position and at the position the
alignment chose, to see which bands mislead it. Fresh held-out guitar samples are
needed before the next candidate can be judged.
