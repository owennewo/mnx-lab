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
