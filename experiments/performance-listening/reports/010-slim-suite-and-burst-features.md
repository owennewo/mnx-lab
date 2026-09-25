# 010 — The slim suite, and what misleads the alignment

## Pre-registration

Committed 2026-09-25, before either run. Governed by
[development contract 1](../contracts/development-contract-1.md), including the user's
direction to cut the test count and move to the next four bars on saturation. Results
are appended below; nothing above this line changes after the run.

### Two questions

1. **Does the slim suite give the same answers, fast?** It runs the clock, the incumbent
   `online-time-warp@2` and its alignment-only diagnostic on 19 active examples instead
   of 43, with causality checked once per rung.
2. **What misleads the alignment in its bursts?** By experiment 009's rule, the bursts
   of wrong positions on recorded guitar need an explanation before another candidate
   change. This is a diagnostic, not a candidate.

### The diagnostic

On each active rung-2 guitar, run the incumbent's alignment with support off. For every
analysis frame where it is wrong by more than 0.25 quarter, split the match between the
live frame and the reference into one contribution per feature dimension: how much more
the chosen reference frame matches than the true one. Group the contributions by
semitone band and by half: sustained level, or onset change. Frames where the alignment
is right are summed the same way for comparison.

### Predictions

1. **The slim suite reproduces.** On each of the 19 active examples, the incumbent's
   and the clock's results match experiment 009's, apart from the causality checks now
   made once per rung. The whole scoreboard finishes in under three minutes.
2. **Sustained level misleads.** On each of the four guitars, the level half supplies
   more than half of the chosen frame's advantage in the wrong frames.
3. **The bass is involved.** The five bands with the largest advantage include a
   sustained bass note of a burst, D♯3, E3 or G3, or its octave, on at least three of the
   four guitars.
4. **Where it is right, the truth wins.** In correctly aligned frames the summed
   contribution favours the true frame.

### Decision rules, fixed now

- **Sustained level dominates.** The next candidate keeps the onset half and makes the
  level half insensitive to how a note's level changes after its onset.
- **Onset change dominates.** The guitar attacks mislead the onset half; it is revised
  instead.
- **Neither dominates.** The per-frame features do not explain the bursts, and the
  alignment's path constraints are examined next.

## Results

Runs [g010a-slim-suite](../runs/g010a-slim-suite/summary.json) and
[g010b-burst-features](../runs/g010b-burst-features/summary.json), on the
pre-registration commit `8718e476`.

### The slim suite reproduces, in two minutes

All 57 results, three entries on 19 active examples, match experiment 009 exactly,
apart from the causality checks now made once per rung. Every causality check passes.
The run took 123 seconds of wall time, computing all three entries from scratch because
the per-rung causality mode has its own cache key. A run that adds one challenger to a
cached suite should take about a minute.

| Scoreboard | Entries | Examples | Wall time |
|---|---|---|---|
| Experiment 008, no cache | 6 | 43 | 28 min |
| Experiment 009, cache, two new entries | 8 | 43 | 15 min |
| Experiment 010, slim suite, cold | 3 | 19 | 2 min |

The incumbent still passes rungs 0 and 1 and fails rung 2 on the active suite.

### The features do not explain the bursts

In the wrong frames, the per-frame match usually favours the **true** position, not the
position the alignment reported:

| Guitar | Wrong frames | Chosen position matches that frame better | True position matches it better |
|---|---|---|---|
| tonejs acoustic | 14 | 10 | 4 |
| tonejs nylon | 42 | 15 | 27 |
| tonejs electric | 18 | 6 | 12 |
| Shinyguitar | 57 | 14 | 43 |

On the three guitars with the most errors, the true position matches better on 82 of 117
wrong frames. The alignment's path carries it away from a position its own features
prefer, and keeps it away for 0.15–0.35 s. Only on the tonejs acoustic set, with few
errors, do the features themselves favour the wrong position.

The pre-registered band shares turned out to be ill-defined: they divide by the summed
advantage, which is negative or near zero on three guitars. The frame counts above
answer the question instead.

### Against the predictions

| Prediction | Outcome |
|---|---|
| 1. The slim suite reproduces experiment 009 and finishes in under three minutes | **Held**: 57 of 57, 123 s |
| 2. The level half supplies most of the chosen frame's advantage in wrong frames | **Contradicted**: on three of four guitars the chosen frame has no per-frame advantage to supply |
| 3. The top bands include a sustained bass note of a burst | Not answerable: the ranking divides by a negative or near-zero total |
| 4. In correctly aligned frames the truth wins | **Held** on all four guitars |

### Decision

The pre-registered rule for this case applies: **the per-frame features do not explain
the bursts, so the alignment's path is examined next.** The candidates to examine are
the choice of endpoint by length-normalised cost, which compares paths of different
lengths, and the step constraints, which limit how fast a drifted path can return. The
support test's miscalibration across guitars remains a separate, open defect.
