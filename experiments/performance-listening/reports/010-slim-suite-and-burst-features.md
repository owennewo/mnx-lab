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
