# 005 — Rung 0: the online time-warping comparator

## Pre-registration

Committed 2026-09-25, before `online-time-warp@1` runs on the rung-0 set. Governed by
[development contract 1](../contracts/development-contract-1.md). Results are appended
below; nothing above this line changes after the run.

### Question

Does the comparator named in the development contract pass rung 0? Experiment 004's
pre-registered rule makes this the next step: no spectral version passed rung 0, so
the comparator is measured before any spectral template is revised.

### The candidate

`online-time-warp@1` follows the family of Dixon (2005): it aligns incoming audio
against a reference that is fully known in advance, one live frame at a time.

- **Reference.** The listener renders the first four measures of the score it is
  handed as sines, at the handed tempo, with the same `score-render@1` code that built
  rung 0. That is the scope every candidate so far has used. The score is the
  listener's input, so rendering it is permitted. It never sees labels, sync or recipe.
- **Features.** Every 20 ms, from a causal 170 ms window: log energy in each semitone
  from C2 to C7, plus the positive change of that energy since the previous frame,
  weighted twice. The change term marks note onsets, which static templates lacked.
- **Alignment.** Each live frame adds one row of a cumulative cost matrix, with steps
  that keep the local tempo between half and double the handed tempo. The position is
  the reference frame whose length-normalised path cost is lowest.
- **Support.** The follower claims a position while a 0.3 s moving average of the
  matching cost at that position stays below 0.5, and reports unsupported otherwise
  or on silence. Both values were fixed before any run; a different value is a new
  version.

**Rung 0 is an implementation check for this candidate, not a test of listening.**
Its reference uses the same synthesis as the rung-0 audio, so on the positive example
the correct alignment has zero cost. Passing rung 0 is required before rung 1 and is
not evidence of following ability. The tempo rung is the first informative test.

### Scoreboard

The same scoreboard as experiment 004, on the same frozen set
`winner-ladder-rung0-v1`, with `online-time-warp@1` added. The three frozen
candidates rerun alongside it and must reproduce experiment 004 exactly.

### Predictions

1. **It passes rung 0.** It meets every gate on all three examples: at least 95%
   supported correct, at least 95% correct rejection on both controls, exposure within
   5%, and no deadline, causality or cost failure.
2. **Recognition.** With its own features at exact labels, the correct position is
   strictly cheaper than every nearby wrong position on more than 90% of frames. The
   onset term removes most of the ties the static templates had.
3. **Thermometer.** On the real Winner clip its sine reference meets real guitar
   timbre. It agrees with the sync reference on fewer points than the clock's 88%, and
   most of its failures there are rejections rather than wrong positions.
4. **Determinism.** The three frozen candidates reproduce their experiment 004
   rung-0 results and their experiment 002 thermometer results exactly.

### What would contradict them

- A rung-0 failure on the positive example is an implementation defect, because the
  correct alignment costs nothing. It is fixed as a new version and reported, and it
  is not a finding about online time warping.
- A wrong-score failure means the 0.5 support threshold or the features do not
  separate Winner from Dust even with matching timbre. That is a finding about this
  candidate's rejection, recorded before any change.
- Ties above 10% of frames would mean the onset term does not do what it is for.

### Decision rules, fixed now

- **It passes rung 0.** It becomes the incumbent. Rung 1, tempo, is built and
  pre-registered next as experiment 006.
- **It fails rung 0.** The failure is diagnosed against the categories above before
  any revision. A revision is a new version, run on the same frozen set.
