# 006 — Rung 0: judging support from the aligned sequence

## Pre-registration

Committed 2026-09-25, before `online-time-warp@2` runs on the rung-0 set. Governed by
[development contract 1](../contracts/development-contract-1.md). Results are appended
below; nothing above this line changes after the run.

### Question

Does judging support from the aligned sequence, rather than from single frames,
reject Dust's score for Winner's audio on rung 0 while keeping the positive?
[Experiment 005](005-online-time-warp-rung0.md) found that `online-time-warp@1`
follows rung 0 perfectly but accepts the wrong score on 41% of points, because lone
sustained notes shared by the two pieces match single frames well.

### The candidate

`online-time-warp@2` keeps version 1's reference, features and alignment unchanged.
Only the support test differs. Over the most recent second of audio, it compares two
average matching costs:

- **Path cost:** the cost along the tempo-consistent alignment path that ends at the
  chosen position.
- **Free cost:** the cost of the best-matching reference frame for each live frame on
  its own, anywhere in the reference, in any order.

A different piece can match single frames, which keeps the free cost low, but not in
order, which keeps the path cost high. It claims support when the path cost exceeds
the free cost by at most 0.1 and the path cost itself is at most 0.7, after at least
0.2 s of audio. A uniform rise in cost, such as a timbre mismatch, raises both costs
and leaves the gap small. All four values were fixed before any run.

Rung 0 remains an implementation check for this family, because the reference uses
the same synthesis as the audio.

### Scoreboard

The same scoreboard as experiments 004 and 005, on the same frozen set
`winner-ladder-rung0-v1`, with `online-time-warp@2` added. The four earlier candidates
rerun alongside it and must reproduce their earlier results exactly.

### Predictions

1. **It passes rung 0.** It meets every gate on all three examples. On the positive
   example, the 0.2 s it waits for evidence costs at most two answerable grid points,
   leaving supported correct and deadline misses well within their gates.
2. **The wrong score is rejected.** At least 95% correct rejection on the wrong-score
   control, up from version 1's 59.3%.
3. **Thermometer.** On the real Winner clip it rejects the wrong score on more points
   than version 1's 76.2%, and still agrees with the sync reference on at least 60%
   of positive points.
4. **Determinism.** The four earlier candidates reproduce their recorded results
   exactly.

### What would contradict them

- If the wrong-score rejection stays below 95%, a tempo-consistent path through Dust's
  reference fits Winner's audio nearly as well as unconstrained matching does. That
  would mean the two pieces share whole ordered stretches, not just single notes.
- If the positive example fails, the path through the correct reference is noisier
  than unconstrained matching even with identical synthesis. That is an
  implementation defect.

### Decision rules, fixed now

- **It passes rung 0.** It becomes the incumbent. Rung 1, tempo, is built and
  pre-registered next as experiment 007.
- **It fails rung 0.** The failure is diagnosed against the categories above before
  any revision.

## Results

Run [g006-sequence-support-rung0](../runs/g006-sequence-support-rung0/summary.json),
on the pre-registration commit `3276e284`, over the unchanged frozen set
`winner-ladder-rung0-v1`.

**`online-time-warp@2` passes rung 0**, the first candidate to do so. It meets every
gate on all three examples. Under the rule fixed above it becomes the incumbent, and
rung 1 is built next.

### Rung 0, by example

| Candidate | Example | Supported correct | Correct rejection | Exposure | Longest episode | Deadline missed | Failed gates |
|---|---|---|---|---|---|---|---|
| oltw@2 | positive | 99.5% | — | 0% | 0 s | 0.5% | none |
| oltw@2 | wrong-score | — | 97.9% | 2.1% | 0.2 s | 2.1% | none |
| oltw@2 | silence | — | 100% | 0% | 0 s | 0% | none |

The one positive point it misses is at the start, while it gathers 0.2 s of evidence.
It claims to follow Dust's score on 4 of 189 wrong-score points, against 77 for
version 1. Coverage was 100%, every prefix check passed, and processing took about
14% of real time with a per-chunk p99 of about 1.6 ms.

The four earlier candidates reproduced their recorded rung-0 and thermometer results
exactly.

### Thermometer

| Real Winner clip | oltw@1 | oltw@2 | Clock |
|---|---|---|---|
| Positive: agreement with sync | 67.7% | **12.7%** | 88.4% |
| Wrong score: correct rejection | 76.2% | 99.5% | 0% |
| Silence: correct rejection | 100% | 100% | 0% |

On real guitar, version 2 rejects almost everything, the correct score included. This
is recorded, not used to select, but it is a clear warning about the next rungs.

### Against the predictions

| Prediction | Outcome |
|---|---|
| 1. It passes rung 0, missing at most two positive points while it gathers evidence | **Held**: one point missed |
| 2. Wrong-score rejection of at least 95% | **Held**: 97.9% |
| 3. On the real clip it rejects the wrong score more often than version 1 | **Held**: 99.5% against 76.2% |
| 3. On the real clip it still agrees on at least 60% of positive points | **Contradicted**: 12.7% |
| 4. The earlier candidates reproduce exactly | **Held** |

### What this changes

- **Sequence evidence separates the pieces.** A tempo-consistent path through the
  wrong score cannot match Winner's audio as well as unconstrained matching can,
  which answers question 12 for rung 0.
- **The cost gap is not robust to timbre.** The prediction assumed a timbre mismatch
  raises every frame's cost evenly. On real guitar it does not: unconstrained
  matching finds out-of-order reference frames that happen to fit the guitar's
  harmonics better, so the gap opens even on the correct score. This is the same
  pattern as finding 23: a follower that rejects the wrong score on real audio may
  simply be rejecting everything.
- **The ladder will test this directly.** Rungs 1 to 3 keep sine timbre, so version 2
  can be measured on tempo, timing and envelope first. The timbre rung is where the
  gap test must be replaced or recalibrated, and the thermometer says it will need to be.

### Next

Build rung 1, tempo, with development and held-out seeds, and pre-register
`online-time-warp@2` on it as experiment 007.
