# 015 — Is one decoy a null at all?

## Pre-registration

2026-09-29, before any private execution. A diagnostic, not a candidate. Designed and
run by **Claude Opus 5.5 (1M context) in Claude Code**, using terminal tools,
TypeScript/tsx, Vitest and the existing scoreboard. Governed by
[development contract 1](../contracts/development-contract-1.md). This section is
immutable after the run; results will be appended below.

### Question and why

Open question 23, the top of the research log: when Winner audio is handed Dust's
score, why does the forward path's mean rank beat the fitted reversed-reference path on
39–59% of rung-2 frames ([report 014](014-reversed-decoy-support.md#what-the-relative-comparison-admits))?
The question names two causes: an advantage from the fixed start at the score's first
frame, or later sequence matching, meaning Dust's forward order fits Winner's forward
audio better than its reverse does.

This pre-registration adds a third explanation and challenges the question's premise.
Neither path belongs to the audio. If the forward path is just one more unrelated
sequence, it is **exchangeable** with its decoys. Then it beats any one of them on about
half the frames by chance, and no cause beyond that needs explaining. Under this
explanation experiment 014's rule was a coin flip on the wrong score by construction,
not a comparison defeated by a particular mechanism.

The evidence that prompted it: before writing this, I read experiment 014's private
traces (`g014b-decoy-traces/frames.json`, hash below), which are existing development
evidence. On every wrong-score example both paths' last-second mean ranks sit around
0.2–0.4, and which path is lower alternates over the clip. In 2-second bins the forward
path wins in 3–33% of frames during the first two seconds and generally more later.
An origin advantage predicts the opposite early pattern. These reversal-only
observations are disclosed here, so the predictions below make no claim about them.

### Method: fifteen decoys around the forward path

The forward path is the incumbent's: `online-time-warp@6`'s alignment and rank trace,
with support ignored, as in 014b. Each decoy is the same aligner run on the same audio
against a rearrangement of the **same reference frames**:

- **7 forward rotations**: the reference rotated by k/8 of its length, k = 1…7. Order is
  kept and only the origin, plus one seam, moves.
- **8 reversed rotations**: the reversed reference rotated by k/8, k = 0…7. k = 0 is
  experiment 014's decoy.

Every decoy holds exactly the forward reference's frames. Each live frame's rank scale
is therefore identical for all sixteen paths, and only the path through them differs.
Each rotation of the reversed reference changes the reversal's origin. Comparing the
two families therefore separates direction from origin:

| Measure, per example, over non-silent frames after the 0.2 s warm-up | Reads |
|---|---|
| Forward win rate against the 7 forward rotations, averaged | **Origin**: the handed start against other starts in the same order |
| Forward win rate against the 8 reversed rotations, minus the above | **Direction**: forward order against reversed order, with origins varied in both |
| Forward path's position among all 16, as the fraction of decoys with a lower rank (ties count half) | **Exchangeability**: 0.5 expected if the forward path is just another decoy |
| How often the forward path is strictly best of all 16 | Null expectation 1/16 = 6.25% under exchangeability |

A win is a strictly lower last-second mean rank; ties are counted separately.
The aggregate is the equal-weight mean over the nine wrong-score examples: rung 0, the
three active rung-1 controls, the four rung-2 guitars and the real clip's Dust control.
All nine share one audio/score pair, Winner audio with Dust's score. The aggregate is
one piece pair's evidence under several renderings, not nine independent tests.

On positives the same measures are also computed on frames where the forward path is
correctly aligned, within ±0.25 quarter of the exact label or the sync interpolation,
as in 014b. That shows whether the correct path clears a whole decoy family. Win rates
are also reported in 2-second bins, descriptively.

### Runs

1. **`g015a-rotation-reproduce`**: the scoreboard on the unchanged active suite with
   `--reproduce g014a-reversed-decoy-support`. The shared aligner gains an optional
   `referenceRotation` that defaults to none, so version 6's code fingerprint moves.
   Every shared result and the thermometer must reproduce, excluding measured cost.
   Seam checks run as usual.
2. **`g015b-decoy-null-traces`**: `src/ladder/decoyNullDiagnostic.ts` on the 18 active
   non-silent examples of rungs 0–2, plus the real positive and its Dust control. It
   saves all sixteen traces per example privately. As an integrity check, it compares
   the forward and unrotated-reversal traces frame by frame with 014b's
   (`frames.json`, SHA-256 `54a162cc…30d4`).

No candidate version, evaluator, label, range, pass bar, fresh source, next bars or
reserved evidence is involved. Nothing is tuned after results.

### Predictions

The first three predictions test exchangeability. All numbers are for wrong-score frames.

1. **No origin advantage.** Aggregate forward win rate against the forward rotations lies
   in [0.40, 0.60].
2. **No direction advantage.** Aggregate win rate against the reversed family differs from
   the rate against the forward rotations by at most 0.10.
3. **Exchangeable position.** The aggregate mean position lies in [0.40, 0.60], every
   wrong-score example's mean position in [0.25, 0.75], and the forward path is strictly
   best of all 16 on at most 15% of frames in every wrong-score example.
4. **The correct path clears the family.** On correctly aligned positive frames, the
   forward path is strictly best of all 16 on at least 95% of frames for every sine
   positive, rungs 0 and 1, and tonejs acoustic. It does so on at least 90% for nylon,
   electric and Shinyguitar, and at least 80% for the real positive.
5. **Integrity.** The forward and unrotated-reversal traces equal 014b's on every frame
   of all 18 examples. `g015a` reproduces every shared result of `g014a` except cost,
   plus the thermometer, and every seam check passes.

Any number outside its stated range contradicts that prediction.

### Decision rules, fixed now

- **A: exchangeable null.** If 1, 2 and 3 hold, question 23 is answered: **neither**
  the start nor the later sequence explains the forward path's wins on this pair. One
  decoy admits about half of unrelated frames by chance, so a single-decoy comparison
  cannot calibrate rejection. Question 22 stays top, restated to require a support test
  whose false-acceptance rate on unrelated audio is measured, not assumed. If 4 also
  holds, a decoy family leaves room on the positives, and the next advice concerns
  its cost. If 4 fails on any guitar, the family refuses correct frames there too, and
  that limit is recorded.
- **B: origin effect.** If 1 is contradicted above 0.60, the handed start gives the
  forward path an advantage, and a fair decoy must share it or free it. If 1 is
  contradicted below 0.40, the handed start disadvantages the forward path on this
  pair, and decoys that start elsewhere gain. Either is recorded with its size.
- **C: direction effect.** If 2 is contradicted with the reversed family beaten more,
  forward order fits the audio better than reversed order whatever the origin. That is
  the question's "later sequence matching", and reversal is then a handicapped null. If
  the reversed family is beaten less, reversal favours the decoy; record it.
- **D: B and C together.** Record both sizes; the answer is mixed, not single-cause.
- **E: unexplained.** If 3 is contradicted while 1 and 2 hold, the forward path's
  position is systematic but explained by neither origin nor direction. Question 23
  stays open, restated.
- **Prediction 4** decides no branch. It records whether a decoy family has room on the
  positives, whatever A–E says.
- **F: inconclusive infrastructure.** If 5 fails, or execution crashes, the result is
  inconclusive. Preserve the failed attempt and diagnose it; only a documented
  infrastructure correction permits a new run ID with identical code and rules.
  Observations that fit no branch are inconclusive.

### Carried-over state and preflight

`git worktree list` showed only the primary checkout. No report, ledger row, public run
or private run numbered 015 existed. The latest report, 014, is complete and landed.
This session owns worktree `listening-015-decoy-null`; dependencies were installed
once; ffmpeg is available and Node is 22.22.1. Private output creation and
deletion under the ladder's `runs/` directory were checked. Frozen asset hashes were
checked against 014's:

| Set | Manifest SHA-256 |
|---|---|
| Rung 0 v1 | f658adb47d452985bc578c73f96aa22063256e35a32ac8b3aa51cb468c897a79 |
| Rung 1 v2 | bee05932cf87d8a57cd22185919710427f77e3f1926d3c8eca549f2c8bc1d6d1 |
| Rung 2 v1 | 71211bce7991353b12dfee2a24063f15f1a4e1d2b4b9b0099f6ee54a33c134e2 |
| Winner sync proxy v1 | 80c8a6358751f356e164f75389dd50d49a2a0da6ad094f95847bd304eb5c5b8b |
| 014b private traces | 54a162cc624e8a99833db852f1953aa45c41ed453069351d030ef4342c7830d4 |

The incoming plateau count is **0 consecutive versions without a gain**, per
[report 014's resulting state](014-reversed-decoy-support.md#resulting-plateau-budgets-and-evidence-access).
This diagnostic adds no candidate version, so it cannot change that count. No
plateau-triggered research refresh or post-refresh sequence has occurred. Development
is unrationed. Qualification has no frozen candidate and no assessment. Its six version
slots, twelve assessment slots, and reserved and final access remain unused. All active
examples, including those historically named held-out, are development evidence;
bars 5–8 remain unexamined. No new research source is consulted: the question is about
the local mechanism, and the [reversed-reference note](../research/reversed-reference-decoy.md)
already records that one decoy carries no false-positive guarantee. No user judgement
or contract change is needed. The handover resets nothing.

## Results

**Decision A applies: the wrong score's path behaves like one more decoy.** Neither the
fixed start nor later sequence matching explains why Dust's forward path beats its
reverse on Winner audio. On the wrong score the forward path sits in the middle of a
family of fifteen decoys and beats a typical decoy about half the time or less.
A single decoy is therefore close to a coin flip on unrelated audio. Prediction 4
failed, but mostly because of a flaw in my own decoy family, described below.

Both runs ran at the pre-registration commit `21fcc9ec`:

| Run | Purpose | CPU seconds |
|---|---|---|
| [g015a-rotation-reproduce](../runs/g015a-rotation-reproduce/summary.json) | Active scoreboard reproduction after the shared aligner change; thermometer and seam | 171.756 |
| [g015b-decoy-null-traces](../runs/g015b-decoy-null-traces/summary.json) | Sixteen paths per example: the forward path and fifteen decoys | 429.518 |

Neither run failed or was rerun. g015b's private traces are
`/home/williao/dev/mnx-listening-data/ladder-winner-v1/runs/g015b-decoy-null-traces/frames.json`
(SHA-256 `9846ccfa…da98`). The frozen sets, labels and instruments were unchanged.

### Integrity

| Check | Result |
|---|---|
| g015a against g014a, shared results excluding cost | 57/57 identical |
| Thermometer entries against g014a | All three identical |
| Seam: replay, fixture answers, deliveries | Identical to g014a for every entry |
| g015b forward and unrotated-reversal traces against 014b | Identical on every frame of all 18 examples |

Version 6 was recomputed rather than read from the cache, because its fingerprint moved.

### The wrong score: forward path against the family

Non-silent frames after the warm-up. Win rates are per decoy, averaged over the decoys in
each family. Position is the fraction of the 15 decoys ranking better; 0.5 is what an
exchangeable path would get. "Best of all" has a null expectation of 1/16 = 0.063.

| Wrong-score example | Frames | Against 014's reversal | Against forward rotations | Against reversed family | Position | Best of all 16 |
|---|---|---|---|---|---|---|
| Rung 0 | 466 | 0.320 | 0.433 | 0.386 | 0.577 | 0.002 |
| Rung 1 constant 110 | 427 | 0.356 | 0.448 | 0.422 | 0.546 | 0.005 |
| Rung 1 drift | 450 | 0.322 | 0.429 | 0.374 | 0.591 | 0.013 |
| Rung 1 ramp | 448 | 0.339 | 0.381 | 0.387 | 0.610 | 0.011 |
| tonejs acoustic | 466 | 0.586 | 0.418 | 0.511 | 0.530 | 0.079 |
| tonejs nylon | 466 | 0.562 | 0.416 | 0.584 | 0.489 | 0.047 |
| tonejs electric | 466 | 0.436 | 0.463 | 0.484 | 0.517 | 0.006 |
| Shinyguitar | 466 | 0.386 | 0.411 | 0.434 | 0.574 | 0.045 |
| Real clip, Dust score | 466 | 0.446 | 0.443 | 0.514 | 0.500 | 0.028 |
| **Equal-weight mean** | | **0.417** | **0.427** | **0.455** | **0.548** | **0.026** |

Against forward rotations the forward path wins 38–46% in every example. That is
slightly below even, so the handed start is, if anything, a small disadvantage. Against
the reversed family the average is 3 points higher, so direction makes no material
difference. 014's reversal is not a special decoy: on acoustic and nylon it is weaker
than average, and on the sine rungs stronger.

Averaged over the nine controls in 2-second bins, which is descriptive and not
pre-registered:

| Bin | Against 014's reversal | Against forward rotations | Against reversed family |
|---|---|---|---|
| 0–2 s | 0.186 | 0.229 | 0.221 |
| 2–4 s | 0.422 | 0.340 | 0.457 |
| 4–6 s | 0.334 | 0.500 | 0.467 |
| 6–8 s | 0.524 | 0.599 | 0.545 |
| 8–9.5 s | 0.705 | 0.463 | 0.638 |

The early deficit that prompted this experiment appears against every family, not only
the reversal. The forward path is held near Dust's opening while every decoy starts
somewhere else in Dust, and on this pair Dust's opening fits Winner's opening worse than
the rest of Dust does. That is a property of this pair's content, not an advantage
the handed start gives the forward path. After the first seconds the win rates move
around one half.

### The positives: where prediction 4 failed, and why

On frames where the forward path is correctly aligned:

| Positive | Correct frames | Best of all 16 | Against forward rotations | Against reversed family |
|---|---|---|---|---|
| Rung 0 | 466 | 0.944 | 0.987 | 1.000 |
| Rung 1 constant 110 | 427 | 0.869 | 0.965 | 1.000 |
| Rung 1 drift | 450 | 0.862 | 0.961 | 1.000 |
| Rung 1 ramp | 448 | 0.891 | 0.971 | 1.000 |
| tonejs acoustic | 452 | 0.657 | 0.906 | 1.000 |
| tonejs nylon | 424 | 0.533 | 0.850 | 0.995 |
| tonejs electric | 448 | 0.592 | 0.876 | 0.997 |
| Shinyguitar | 409 | 0.543 | 0.836 | 0.992 |
| Real clip | 325 | 0.400 | 0.801 | 0.991 |

Almost every miss comes from the forward rotations, especially the smallest ones,
1/8 and 7/8, and many are exact ties. On rung 0 the forward path's rank is exactly zero,
so every miss there is a tie. The per-decoy counts are in the run summary. **The
forward rotations were not decoys that cannot be right.** A rotation keeps the whole true
sequence in order apart from one seam. Once the path has absorbed the offset with a
stretch of half- or double-speed steps, it can follow the correct frames. The
pre-registration claimed every decoy cannot be right, and for the forward rotations on
positives that was false. The claim still holds for the wrong score, where no
arrangement of Dust is right, so predictions 1–3 are unaffected.

The reversed family has no such lead-in. The correct path beats each reversed decoy on
99.1–100% of correct frames.

### An exploratory tabulation, not a decision

This was computed from the private traces after the run, and no rule depends on it.
Here the forward path is supported only when it beats **all eight reversed decoys**:

| Example | Correct positive frames kept | Wrong-score frames admitted | Admitted after the unchanged cost cap |
|---|---|---|---|
| Rung 0 | 1.000 | 0.193 | 0.193 |
| Rung 1, three controls | 1.000 each | 0.169–0.258 | 0.169–0.258 |
| tonejs acoustic | 1.000 | 0.270 | 0.270 |
| tonejs nylon | 0.976 | 0.322 | 0.315 |
| tonejs electric | 0.981 | 0.167 | 0.155 |
| Shinyguitar | 0.942 | 0.142 | 0.000 |
| Real clip | 0.961 | 0.251 | 0.251 |

The positive-frame figures here are over all non-silent frames after the warm-up.
Even with eight decoys and nine aligners' cost, 14–32% of unrelated frames are admitted.
That is above the 1/9 an independent family would give, because the rotations of one
reversed sequence are correlated with each other. A decoy family wide enough for 95%
rejection would cost many times the sustained budget that two aligners already
exceeded in [experiment 014](014-reversed-decoy-support.md#integrity-seam-recognition-and-cost).

The data remain one piece pair's controlled renderings and one real recording. The
nine wrong-score examples are not independent tests, and correlated frames are not
independent observations.

## Against the predictions

| Prediction | Outcome | Evidence |
|---|---|---|
| 1. Forward rotations beaten at 0.40–0.60 on average | **Held** | 0.427; every example 0.381–0.463 |
| 2. Reversed family within 0.10 of forward rotations | **Held** | 0.455 against 0.427, a difference of 0.028 |
| 3. Exchangeable position | **Held** | Mean position 0.548; examples 0.489–0.610; best of all at most 0.079 |
| 4. Correct path best of all 16 at 95/90/80% | **Contradicted on every positive** | 0.400–0.944. The misses come from forward rotations that contain the true sequence, often as exact ties. Against the reversed family alone, 0.991–1.000 |
| 5. Integrity | **Held** | 57/57, thermometer, seam and all 18 trace pairs identical |

## Decision

**Branch A applies.** Predictions 1–3 hold, so question 23 is answered: **neither** the
fixed start nor later sequence matching explains the wrong score's wins over its
reverse on this pair. Dust's forward path is exchangeable with rearrangements of its own
reference: it ranks mid-family, beats the average decoy of either family on 37–58% of
frames, and is best
of sixteen about as often as chance. Its start is, if anything, a small disadvantage.
A comparison with one decoy cannot calibrate rejection, because under the null it
passes about half the time.

Under A's rule for prediction 4, the limit is recorded: this sixteen-path family refuses
correct frames on every positive. The stated reason matters for what follows. The
refusals come from forward rotations that can become right after a lag, not from
decoys that cannot be right. The reversed family keeps 99–100% of correct frames against
each decoy. So this experiment does not show that decoys in general refuse correct
alignments; it shows that forward rotations are not valid decoys for a positive.

Question 22 stays top, restated as the rule requires: a support test's false acceptance
on unrelated audio must be measured, not assumed. No candidate version was added.
Version 6 stays incumbent, and no rung, next bars or later rung is opened.

### Resulting plateau, budgets and evidence access

The incoming plateau count was 0. This diagnostic adds no candidate version, so the
resulting count is **0 consecutive versions without a gain**. No research refresh or
stopping rule is triggered. Development remains unrationed: this experiment used one
scoreboard run and one diagnostic run, 601.274 CPU seconds in total. Qualification
still has zero frozen versions and zero assessments; its six version slots, twelve
assessment slots and reserved and final access are unused. All active examples remain
development evidence, and bars 5–8 remain unexamined. No new research source was
consulted and no user judgement or contract change was spent.

## Next

This is advice, not a restriction.

- **Relative comparisons against rearrangements of the handed score are expensive
  nulls.** One decoy admits about half of unrelated frames. Eight correlated reversed
  decoys still admit 14–32%, at several times the cost budget. A support test that
  relies on beating decoys would need many independent ones, and nothing yet says they
  can be made cheaply.
- **The spread that matters is in the ranks themselves.** On unrelated audio the path's
  last-second mean rank sits around 0.2–0.4 across timbres ([014 traces](014-reversed-decoy-support.md#what-the-relative-comparison-admits)).
  Correct recorded-guitar frames sit around 0.10–0.17 ([report 013](013-why-support-rejects.md#what-the-refused-frames-look-like)),
  and the real clip's also sit there. The next question is whether some statistic of
  the path's own evidence, over a longer or differently weighted window, keeps those two
  distributions apart in every timbre. The fixed 10% limit is not the only way to use
  them. A looser fixed limit remains ruled out by [report 013's decision](013-why-support-rejects.md#decision).
- **A valid decoy must not be able to become right.** A rotation can, after a lag; so
  can any rearrangement that keeps long runs of the true order. Reversal cannot.
- The steady-tempo alignment question, 20, is still open. The bursts remain the
  incumbent's other failure on the harder guitars.

## Attribution

Designed, implemented, run, interpreted and recorded by **Claude Opus 5.5 (1M context)
in Claude Code**. No delegated agent, independent executor or subsequent numbered
experiment was used.
