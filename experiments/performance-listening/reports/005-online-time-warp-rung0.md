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

## Results

Run [g005-oltw-rung0](../runs/g005-oltw-rung0/summary.json), on the
pre-registration commit `a378177c`, over the unchanged frozen set
`winner-ladder-rung0-v1`.

**The comparator does not pass rung 0.** It follows the positive example perfectly
and rejects silence completely. It fails on the wrong score, claiming to follow Winner
audio against Dust's score on 41% of answerable points. Under the rule fixed above,
this is a finding about its rejection, recorded here before any change.

### Rung 0, by example

| Candidate | Example | Supported correct | Correct rejection | Exposure | Longest episode | Deadline missed | Failed gates |
|---|---|---|---|---|---|---|---|
| oltw@1 | positive | 100% | — | 0% | 0 s | 0% | none |
| oltw@1 | wrong-score | — | **59.3%** | **40.6%** | **0.70 s** | **40.7%** | 4 |
| oltw@1 | silence | — | 100% | 0% | 0 s | 0% | none |

Coverage was 100% and every prefix check passed. Processing took about 13% of real
time, with a per-chunk p99 of about 1.7 ms.

The three frozen candidates reproduced experiment 004's rung-0 results and their
experiment 002 thermometer results exactly.

### Why the wrong score is accepted

The support test averages the matching cost of each frame at the chosen position.
Winner and Dust share single sustained notes, such as a lone G3 with nothing else
sounding, and one such frame matches the other piece's frame almost perfectly. Over
the 475 audible frames, against the best Dust reference frame inside the tempo
corridor:

| Matching cost against Dust's reference | Value |
|---|---|
| 5th percentile | 0.000 |
| Median | 0.212 |
| 95th percentile | 0.893 |
| Frames below the 0.5 support threshold | 77.7% |

On the wrong-score example the follower's recent average cost therefore hovers just
under the threshold: the median confidence of its false claims is 0.54, a cost of 0.46.
A per-frame cost cannot say whether the **sequence** of frames fits the score, and
that is the question the control asks.

### Recognition at exact labels

With its own features, the correct position is strictly cheaper than every nearby
wrong position on all 473 eligible frames; there are no ties within 1e-9. This result
is weaker than it looks. The reference uses the same synthesis as the audio, so the
correct position costs almost nothing by construction. Some margins are also tiny:

| Margin of the correct position over the nearest wrong one | Frames |
|---|---|
| Below 0.01 | 68 |
| Below 0.05 | 106 |

The near-ties sit in bar 3, where a sustained E3 bass repeats under the same
arpeggio notes. The onset term separates the static templates' ties, but repeated
material inside the corridor stays close.

### Thermometer

On the real Winner clip the comparator agrees with the sync reference on 67.7% of
points: better than spectral@1's 46.0%, below the clock's 88.4%. It rejects the wrong
score there on 76.2% of points and silence on all of them. Its wrong claims on the
positive clip cover 28.9% of the time, so most of its failures there are wrong
positions, not rejections. This is recorded, not used to select.

### Against the predictions

| Prediction | Outcome |
|---|---|
| 1. It passes rung 0 on all three examples | **Contradicted** by the wrong-score control |
| 2. The correct position is strictly cheaper on more than 90% of frames | **Held**: 100%, with 68 frames within 0.01 |
| 3. On the real clip it agrees less often than the clock | **Held**: 67.7% against 88.4% |
| 3. Its real-clip failures are mostly rejections | **Contradicted**: mostly wrong positions |
| 4. The frozen candidates reproduce experiments 004 and 002 exactly | **Held** |

### What this changes

- **Support must be judged from the sequence, not the frame.** Every candidate so far
  has decided support from how well the current sound matches one position. A
  different piece matches that well often enough to break the control. The
  alignment already holds the sequence evidence. The next version should ask whether
  a tempo-consistent path fits the recent audio nearly as well as the best frame-by-frame
  matches do, which is a comparison that is also robust to timbre.
- **Onset features remove exact ties.** The near-ties in repeated passages remain a
  question for the tempo rung, where repeated material stops lining up with the
  handed tempo.

### Next

A revised support test, as a new version on the same frozen set, pre-registered as
experiment 006. Rung 1 stays unbuilt until a candidate passes rung 0.
