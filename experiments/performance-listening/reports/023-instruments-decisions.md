# 023 — The user's decisions in the instruments, and stage 1's controls

## Pre-registration

2026-09-30. Designed and run by **Claude Opus 5.5 (1M context) in Claude Code**,
terminal/TypeScript/tsx/Vitest. Step 2 of
[development contract 2's order of work](../contracts/development-contract-2.md#order-of-work),
and no further: it versions the instruments and their oracle, adds the controls to
stage 1 and remeasures the frozen baselines. **It develops no listener.** Landed before
any code implementing the new versions exists and before anything runs.

### Question and why

The research log's top question, 5: *do the instruments, versioned for the user's
decisions (typical-tempo reference, interval durations with a floor, clean examples, the
dead verdict, the controls), reproduce a re-worked hand oracle, and what do the frozen
baselines do on stage 1's new controls?*

After experiment 022 the user decided its open questions
([contract 2, the gates](../contracts/development-contract-2.md#the-gates-approved-for-stages-13)):
the gates are approved for the sine stages with interval durations judged to ±10% or
±30 ms and no false finding on a clean example; variation is judged against the player's
typical (median) tempo; dead notes get their own verdict, and a dead note the score
writes is a match; every stage carries silence and wrong-score controls. Version 1 of the
instruments implements none of those, and 022's stage 1 had no controls, so it could not
tell a listener that hears from one that always follows (lesson L8). No listener can be
judged until both are fixed, and the fixed oracle has been audited.

The question has two parts, and the experiment distinguishes their failure modes:

- **The instruments.** A disagreement between the new evaluators and the hand-worked
  oracle is either an evaluator defect, a hand-working error, or an ambiguous rule; the
  decision rules below separate them. Carrying 022's following cases over unchanged also
  tests that the label change did not disturb what was already trusted.
- **The controls.** Stage 1 at the handed tempo cannot tell a listener from a clock
  (finding 3). The controls can: the clock follows whatever it is given, so it must fail
  every control, while a listener that hears should reject silence and a score with no
  pitch in common with the audio. If the clock passed a control, the instruments, not
  the clock, would be wrong.

### What is defined now, and what is built after

Landed with this pre-registration, before any code implements them:

- [`contracts/event-instruments-2.md`](../contracts/event-instruments-2.md):
  `performance-label@2`, `assessment-report@2`, `assessment-evaluator@2` and
  `stage-gates@1`; `following-evaluator@2` is unchanged and reads both label versions.
  Its one proposal, **how a control's assessment is judged**, and the exclusion of
  controls from the pooled finding rates, are marked as awaiting the user.
- The `dead` verdict as [vocabulary version 2.1](../contracts/vocabulary-v2.md#version-21-the-dead-verdict),
  additive, as the contract directs.
- [`bench/oracle-events/oracle-2.json`](../bench/oracle-events/README.md), **event-oracle@2**,
  hand-worked from those rules: following cases F1–F10 carried over from version 1 with
  their gate verdicts added, new following cases F11 and F12, and assessment cases A1–A13,
  re-working A3 and A7 for the typical tempo and every assessment case for interval
  durations. 13 following cases with 32 records, 13 assessment cases with 37 report
  evaluations (A6's report is judged against four labels). Its SHA-256 is `e29ba389170181cffdf6f67fd51052f5ca58709927a1767e42819ccf3f157a2c` (`freeze-2.json`).
  No listener's output was consulted; no listener exists under contract 2.
- [`sources/w1-two-bar-black-keys.mnx.json`](../sources/w1-two-bar-black-keys.mnx.json),
  stage 1's wrong score: two bars of quarters, F#4 G#4 A#4 C#5 | D#5 F#5 G#5 A#5. It has
  the rhythm of s1 and s2 and not one pitch in common with them, so a listener that
  tracks onsets without pitch would follow it, and one that hears pitch should not. It
  compiles cleanly in Studio's performance model (checked by a read-only probe).

Built after this lands, in this order, each step only once the previous one holds:

1. In `bench/src/events/`: `label.ts` gains `performance-label@2` (written dead notes,
   their outcomes and the control check), keeping version 1 unchanged; a new
   `assessment2.ts` (assessment-report@2 and assessment-evaluator@2) and `gates.ts`
   (stage-gates@1); `oracle.ts` reads version 2 beside version 1. `listen/` gains the
   `dead` verdict. A bench test checks the oracle's frozen hash and requires every
   expected number and gate verdict: seconds to 1e-9, tempi and ratios to 1e-6, counts
   and verdicts exactly. The version-1 oracle test stays as it is and must still pass.
   `following.ts` and `assessment.ts` are not edited.
2. `bench/src/stages/stage1v2.ts`: renders and freezes **`contract2-stage1-v2`**, only after
   step 1 passes.
3. `bench/src/stages/run023.ts`: the runner, committed before run `g023-stage1-controls`.

### Stage 1, with its controls

- **The eight examples, unchanged**: s1 and s2, sine, handed 90, played steady at 45,
  63, 90 and 99, rendered by the same code as 022 (`mixSines` from `ladder/render.ts`),
  now labelled as `performance-label@2`.
- **Eight silence controls**, one per example: digital silence of exactly the example's
  length, handed that example's score at 90.
- **Eight wrong-score controls**, one per example: the example's own audio handed `w1`
  at 90. Every note of the audio is an extra in the label; every note of `w1` is missing.
- **24 examples**, frozen as the new private set `contract2-stage1-v2` beside the old ones
  in `/home/williao/dev/mnx-listening-data/`, with a manifest whose hash is recorded in
  its `freeze.json`. `contract2-stage1-v1` is not touched. The stage script also records
  whether each example's audio is byte-identical to its v1 counterpart.

### Baselines

`clock-follower@1`, `online-time-warp@8`, `@12` and `@14`, unchanged, through the
unchanged legacy adapter, handed `{ from: top, parts: all, 90 per minute, rate 1 }` at
48 kHz in 480-sample chunks, on all 24 examples. Positions map to events by
following-evaluator@2's rule 1, as in 022. They produce no assessment, so
assessment-evaluator@2 and the assessment gates are exercised by the oracle alone, and
every baseline fails the assessment gates for want of an assessment. Causality is
checked per listener on four examples at the handed tempo: s1-90, s2-90, and s2-90's
silence and wrong-score controls. Cost is the runner's. Each record is compared with the
same listener's record on the same example in run `g022-stage1-baselines`.

### Predictions

The clock's numbers follow from the definitions, so predictions 3 and 4 check the
runner and instruments together; 5 and 6 are genuine predictions about the time warpers.

| # | Prediction |
|---|---|
| 1 | following-evaluator@2, assessment-evaluator@2 and stage-gates@1 reproduce every number and gate verdict in event-oracle@2 without an erratum. |
| 2 | following-evaluator@2 and assessment-evaluator@1 still reproduce event-oracle@1 unchanged. |
| 3 | The eight examples' audio is byte-identical to `contract2-stage1-v1`'s, and all 32 baseline records on them are byte-identical to g022's, so their following measures equal g022's. |
| 4 | The clock fails all 16 controls: false following is 100% of answerable time, correct rejection 0, and the longest episode is the whole answerable time. |
| 5 | Each time warper passes all 8 silence controls with correct rejection at 100% of answerable time: below its level floor it states `unsupported`. |
| 6 | Each time warper passes all 8 wrong-score controls: correct rejection ≥ 95% of answerable time, exposure ≤ 5%, no episode over 0.5 s. With no pitch in common, its path cost should exceed its cap. |
| 7 | Every prefix check passes; every sustained cost ratio is ≤ 0.25 and every 99th-percentile chunk time ≤ 10 ms. |
| 8 | Under stage-gates@1 no baseline passes stage 1, for want of an assessment. On the cursor gates of the eight examples, the clock and v8 pass s1-90, s2-90 and s1-99 only, and v12 and v14 only the two at 90, as 022 recorded. |

What would contradict them: any oracle number or verdict not reproduced (1, 2); any byte
difference in audio or records (3); any control where the clock's false following is
below 100% of answerable time (4); a time warper with any correct-rejection shortfall on
silence (5) or failing any wrong-score control gate (6); a failed prefix check or a cost
over budget (7); a cursor-gate pattern other than the one stated (8).

### Decision rules, fixed now

- **D1, the instruments.** Trusted if the bench test reproduces every number and verdict
  of event-oracle@2 and still reproduces event-oracle@1. A disagreement is diagnosed. An
  evaluator defect is fixed in the evaluator. If the hand-work is wrong by the rules as
  written, the correction is a new oracle version, event-oracle@3, with the arithmetic
  and rule shown and recorded in this report, and it is @3 that awaits the audit; an
  oracle number is never changed to match an evaluator. If a rule is ambiguous, the
  instruments get a new version, event-instruments-3, with the change recorded. If the
  evaluators still disagree after that, stop: question 5 is unresolved, and nothing is
  rendered or run.
- **D2, the set.** Rendered only after D1. If any of the eight examples' audio differs
  from v1's (contradicting 3), no baseline runs until the cause is found and recorded;
  a benign cause is recorded and the run proceeds, with prediction 3 contradicted.
- **D3, the baselines** are recorded whatever they show; none is tuned, rerun with other
  settings or dropped. A refusal at `start` is a valid answer. A crash or failed prefix
  check is an infrastructure or causality finding: the attempt is preserved and
  diagnosed before any rerun, which takes a new run ID. If a baseline's record on an
  example differs from g022's, the difference is diagnosed and recorded; g022's numbers
  are not replaced.
- **D4, what the controls show.** If the clock passes any control gate (contradicting 4),
  the instruments are wrong: stop and diagnose before recording anything about the time
  warpers. Otherwise the time warpers' control results are recorded as evidence about
  them. If 5 and 6 hold, the stage-1 finding stands with its controls: the time warpers
  hear, and fail stage 1 only by running ahead of slow play. If a time warper fails a
  control, which one and how is recorded, and the control is shown to be informative.
- **D5, the proposal.** The control-assessment gate (`claims`, `tempo`) and the exclusion
  of controls from the pooled finding rates are **proposed, never adopted** here. The
  oracle shows what they do: they must pass the honest control reports (A12-A, A12-B,
  A13-A) and fail the ones that claim notes or tempo (A12-C, A13-B). The proposal is
  flagged in the research log as awaiting the user's approval. Nothing in contract 2
  changes.
- **Inconclusive.** Observations that fit no branch above are recorded as inconclusive,
  with no favourable branch invented afterwards.

The oracle audit is the next question whatever happens here, unless D1 stops the
experiment, in which case resolving the disagreement is.

### Carried-over state and preflight

- **Plateau and budgets.** No plateau: [report 022](022-event-instruments.md#resulting-plateau-budgets-and-evidence-access)
  records none, having developed no listener, and this experiment develops none.
  Research contract 1's six version slots, twelve assessment slots and reserved and
  final access are unused, and this experiment uses none. Winner bars 5–8 remain
  unexamined and are not touched. `contract2-stage1-v1` is development evidence already
  examined by the four baselines; its eight examples reappear in v2 as the same audio.
- **Ownership.** No other worktree, report or run claims 023; this one is
  `~/dev/mnx-labs-worktrees/listening-023`. Run ID `g023-stage1-controls` is unused.
- **Access.** `/home/williao/dev/mnx-listening-data/` is readable and writable and holds
  `contract2-stage1-v1`; `ffmpeg` is available though not needed (the sine renderer writes
  WAV directly). The bench's 206 tests pass on the starting commit.

## Results

Run [`g023-stage1-controls`](../runs/g023-stage1-controls/summary.json) at commit
`d7368acd`, on the frozen set `contract2-stage1-v2` (SHA-256 `5b7cfd5d…`, 24 examples),
in 74 s of wall time. The pre-registration above is unchanged.

### The instruments against their oracle

following-evaluator@2 (unchanged), assessment-evaluator@2 and stage-gates@1 reproduced
**every number and gate verdict of event-oracle@2 on their first complete run, with no
erratum**: all 32 following records with their gate verdicts, the 16 derived expected
assessments (typical tempo, interval durations, bar ratios and flags, clean) and all 37
report evaluations with theirs (`bench/test/event-oracle-2.test.ts`, 86 checks).
following-evaluator@2 and assessment-evaluator@1 still reproduce event-oracle@1 (57
checks, unchanged). To check that the new test bites, seven deliberate faults were
introduced one at a time and removed; each failed it:

| Fault | Oracle checks failed |
|---|---|
| Flags against the overall tempo instead of the typical tempo | 8 |
| The lower median at an exact half, instead of the mean of the two middle tempi | 3 |
| No 30 ms floor on the interval tolerance | 1 |
| A pitchless substitution read as dead (version 1's rule) | 1 |
| Claimed played counting only matched notes | 7 |
| The `clean` gate switched off | 4 |
| A control's exposure and episode gates switched off | 2 |

`bench/test/event-label.test.ts` gains checks of `performance-label@2`: a written dead
note played dead must be labelled matched, may ring at its written pitch as a wrong note,
cannot appear in a version-1 label, and a control plays no note of its score; and of the
control labeller. `listen/` accepts the `dead` verdict with no observed pitch and rejects
one with a pitch. The bench's full suite, 295 tests and its typecheck, passes.

Two things were settled while implementing, neither changing an oracle number:

- **`contract2-stage1-v1` cannot be re-verified by its own reader.** Its manifest names
  its score files by absolute path inside 022's worktree, which was retired, so
  `readStageSet` fails on it. Its manifest hash and every WAV hash still verify. The v2
  set names scores relative to the experiment, and `stage1v2.ts` compares v1's audio
  through its frozen manifest and WAV bytes directly.
- **Pooled finding gates with no assessment.** Event instruments 2 says a listener with
  no assessment fails every per-example assessment gate. `gates.ts` also fails every
  pooled finding gate when any performance in the pool has no assessment, rather than
  finding nothing to judge and passing. That follows the per-example rule, but the
  contract does not state it; the next instruments version should.

### The set

All 24 examples rendered and froze. **The eight performances are byte-identical to
`contract2-stage1-v1`'s**, and every one of the 32 baseline records on them is
byte-identical to g022's, so their following measures equal g022's exactly
([report 022's table](022-event-instruments.md#the-baselines-on-stage-1) stands). The
silence controls are 2.42–10.67 s of digital zeros; each wrong-score control lists its
performance's 4 or 8 notes as extras and every note of `w1` as missing.

### The baselines on the controls

Correct rejection and false following are fractions of answerable time; the longest
episode is the longest run of false following.

| Listener | Silence (8) | Wrong score on s1 (4) | Wrong score on s2 at 45 and 63 | w1-s2-90 | w1-s2-99 |
|---|---|---|---|---|---|
| clock | all fail: false following 100% | all fail: 100% | all fail: 100% | fails: 100% | fails: 100% |
| v8 | all pass: rejection 100% | all pass: 100% | pass: 100% | **fails**: rejection 91.9%, false following 0.41 s | **fails**: rejection 64.5%, false following 1.65 s in one episode |
| v12 | all pass: 100% | all pass: 100% | pass: 100% | **fails**: 91.9%, 0.41 s | **fails**: 64.5%, 1.65 s |
| v14 | all pass: 100% | all pass: 100% | pass: 100% | **fails**: 86.9%, 0.67 s episode | **fails**: 64.5%, 1.65 s |

The clock's false following is the whole answerable time on every control, and its
longest episode is that whole time, 2.2–10.5 s. Each time warper passes 14 of the 16
controls.

**Where the time warpers follow the wrong score.** From the private records: every false
claim falls in the second bar of s2's audio, at the two tempi nearest the handed 90.
At 99, all three claim `w1` positions from 3.20 s to the end of the clip (4.85 s), moving
through `w1` quarters 2.6 to 4.2 (A#4, C#5, into D#5) while the audio plays s2's
quarters 5.3 to 8 (A4, B4, C5). The path is two and a half to four quarters behind, and the
notes it claims lie a semitone from the ones sounding, in the same rhythm: s2's second bar, G4 A4 B4 C5,
sits a semitone from `w1`'s first, F#4 G#4 A#4 C#5, note for note. At 90, v8 and v12
claim `w1` quarter 4.2 (D#5) over the last 0.41 s, while C5 sounds; v14 claims quarters
3.7–4.2 (C#5, then D#5) over the last 0.67 s. On s1, whose notes are a tritone or more from
`w1`'s at the same positions, and at 45 and 63, nothing is claimed. The mechanism
(semitone leakage in their features, and a two-second rank window) is an inference from
the code, not tested here.

**Integrity and cost.** No listener refused at `start`. All 96 prefix checks passed
(six on each of four examples per listener, including one silence and one wrong-score
control). The largest sustained cost ratio was 0.18 (v8), the largest 99th-percentile
chunk time 2.2 ms, with no backlog.

### Under stage-gates@1

No baseline passes stage 1: none makes an assessment, so each fails every assessment
gate on every example and every pooled finding gate. The recovery and extra-note pooled
gates do not apply (stage 1 has no missing events or extra notes), and causality and
cost pass for all four.

| Listener | Performances passing the cursor gates | Controls passing |
|---|---|---|
| clock | 3 of 8: s1-90, s1-99, s2-90 | 0 of 16 |
| v8 | 3 of 8: s1-90, s1-99, s2-90 | 14 of 16 |
| v12 | 2 of 8: s1-90, s2-90 | 14 of 16 |
| v14 | 2 of 8: s1-90, s2-90 | 14 of 16 |

## Against the predictions

| # | Verdict | Evidence |
|---|---|---|
| 1 | **Held** | Every number and gate verdict of event-oracle@2 reproduced; no erratum, no new version. |
| 2 | **Held** | event-oracle@1's 57 checks still pass. |
| 3 | **Held** | All eight performances byte-identical to v1; all 32 records byte-identical to g022's. |
| 4 | **Held** | The clock's false following is 100% of answerable time on all 16 controls. |
| 5 | **Held** | Every time warper rejects every silence control for 100% of answerable time. |
| 6 | **Contradicted** | Each time warper fails 2 of the 8 wrong-score controls, w1-s2-90 and w1-s2-99, following `w1` for 0.41–1.65 s where its notes lie a semitone from the audio's. It held on the other six. |
| 7 | **Held** | All 96 prefix checks passed; sustained ratio at most 0.18, p99 at most 2.2 ms. |
| 8 | **Held** | No baseline passes, for want of an assessment; the cursor-gate pattern on the performances is exactly the one stated. |

## Decision

- **D1:** the instruments are **trusted**, pending the audit: following-evaluator@2,
  assessment-evaluator@2 and stage-gates@1 reproduce event-oracle@2, which covers every
  decision the user made, and event-oracle@1 still passes. No oracle or instruments
  version was needed. Question 5's first part is answered. event-oracle@2 now waits for
  its audit by a different session before any listener is judged by it.
- **D2:** the eight performances' audio is identical to v1's; the run proceeded.
- **D3:** the baselines are recorded as they ran; none was tuned, rerun or dropped. Their
  records on the eight performances are g022's, byte for byte.
- **D4:** the clock fails every control, as it must, so the controls see a listener that
  always follows. Prediction 5 held and 6 did not, so the branch is the second one: the
  time warpers hear silence and a distant wrong score, but **follow a wrong score whose
  notes sit a semitone from the audio's in the same rhythm**, and the wrong-score control
  is informative. The stage-1 finding therefore changes: the time warpers fail stage 1 by
  running ahead of slow play (022) *and* by following `w1` against s2 at 90 and 99.
- **D5:** the control-assessment gates (`claims`, `tempo`) and the exclusion of controls
  from the pooled finding rates are **proposed, awaiting the user**. On the oracle they do
  what D5 required: the honest control reports A12-A, A12-B and A13-A pass, and A12-C and
  A13-B, which claim notes and tempo, fail.

### For the user: two decisions and one observation

1. **The control-assessment gates, proposed.** On a control, the assessment passes when
   it claims no score note was played (as matched, wrong or dead) and reports no tempo at
   all: no overall tempo, interval or flag. Stating the notes missing and saying nothing
   both pass, because "this is not a performance of this score" is an honest answer.
   Controls are excluded from the pooled finding rates, where their every note being
   missing would swamp the missing-note figures. Awaiting approval.
2. **Is `w1` a fair wrong score?** It was chosen to share no pitch with s1 and s2. It
   turns out that s2's second bar is, note for note, a semitone from `w1`'s first bar in
   the same rhythm. From `w1`'s side, that bar is four consecutive neighbouring-note wrong
   notes, a bar late. Contract 2 wants a cursor that moves on a wrong note, usually a
   neighbouring fret, so a good listener has to accept one such note and reject a bar of
   them. That is a demanding control, which is why it was informative. It is frozen as
   stage 1's control, and every later listener is judged against it unless you decide
   otherwise: keep it, or have the next set use a more distant wrong score beside it or
   instead.
3. **Observation, no decision needed.** In a two-bar piece, the bar with more intervals
   sets the typical tempo (oracle case A7): if the second bar drags throughout, the
   typical tempo is the dragged one, and the steady first bar is flagged fast. On longer
   pieces a median is decided by most of the piece. If you would rather the flag land on
   the dragged bar here, the reference needs another definition.

### Resulting plateau, budgets and evidence access

No plateau: no listener was developed. Under contract 2, two experiments have run.
Research contract 1's six version slots, twelve assessment slots and reserved and final
access remain unused. Winner bars 5–8 remain unexamined. The new private set
`contract2-stage1-v2` is development evidence, now examined by the four frozen
baselines; its eight performances are `contract2-stage1-v1`'s audio.

## Next

Advice, not a rule.

- **The audit comes first.** event-oracle@2 is re-versioned, so a different session
  audits it under [AUDITING_AN_ORACLE.md](../AUDITING_AN_ORACLE.md) before experiment 024
  judges anything by it. The cases the audit must cover are every assessment case and
  F11–F12; the README's coverage table lists them.
- **Experiment 024**, the first new listener, is judged on `contract2-stage1-v2` under
  stage-gates@1. Three things this run suggests:
  - Stage 1 now separates listening from following: the clock fails every control. A
    listener that moves only on evidence of an onset will not run ahead, but it must
    also decline to follow a bar of near-miss pitches, or `w1` against s2 will catch it.
  - The time warpers are cheap on stage 1 (sustained ratio under 0.2), so a listener
    well within budget has room.
  - The assessment needs its own design; the baselines offer nothing to compare with.
- The next instruments version should state the pooled rule for a listener with no
  assessment, and `contract2-stage1-v1`'s absolute score paths mean its own reader
  cannot re-verify it; neither affects a result here.

## Attribution

Designed, run and recorded by Claude Opus 5.5 (1M context) in Claude Code.
