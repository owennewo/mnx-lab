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
