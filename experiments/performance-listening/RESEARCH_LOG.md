# Research log

The entry point to the performance-listening experiment. It answers three questions
for a person or a resuming loop driver: what do we currently believe, on what evidence,
and what is the next question. It is the only file in the experiment that is rewritten
in place. No other document restates the current state: the README, the report index
and the evidence records link here instead. `ledger.md` holds the history, one
append-only row per run; `research/` holds one note per source read; a run's report
holds its numbers. This file points at all three and repeats none of them.

This log began on 2026-09-30 with [development contract 2](contracts/development-contract-2.md).
The first series, experiments 001–021 under contract 1, is archived in
[archive/ladder-1/](archive/ladder-1/README.md), with its own
[research log](archive/ladder-1/RESEARCH_LOG.md). Only the lessons below carry over.

How to maintain it:

- **Current state** is a few sentences, rewritten whenever an experiment lands. It says
  where the work stands, which listener is current, and what the last result changed.
  No figures.
- **Findings** are one row each. A finding states a belief and cites the evidence that
  supports it: a research note, a ledger row, or a per-experiment write-up. A row
  without evidence is a hypothesis and belongs under open questions instead. When
  later evidence contradicts a finding, its status becomes `superseded` and the row
  gains the evidence that did it; the row is never deleted or reworded to fit.
- **Open questions** are ranked by the contract's order of work first, then by how much
  uncertainty an answer would remove. The top row is the next question. A question
  that becomes a finding moves down with its evidence; one that a budget closes is
  marked `stopped`, with the reason.
- A finding's numbers stay in the report it cites.
- Every commit that adds a ledger row updates this file in the same commit, even if
  the update is only to the current-state paragraph.
- **This file is the handover.** Each experiment may be run by a different model, and
  the incoming model reads this whole file, including the inherited lessons, before
  choosing its question. A model's private memory is not handover state.
  [APPROACH.md](APPROACH.md#who-runs-an-experiment-one-model-one-experiment) sets out
  the procedure.

## Current state

2026-09-30. [Development contract 2](contracts/development-contract-2.md) remains in force, with approved sine-stage gates and independently audited event-oracle@2. [Experiment 026](reports/026-single-slowed-bar.md) tested one slowed bar with unchanged **event-chain@1**. Assessment and controls pass, but the live cursor fails on two E4→F4 transitions: overlapping pitch windows both read as a future G4, and the live chain commits to a skip from which it cannot move backward. Whole-recording alignment discards the spurious token. Stage 1 and hesitation remain passed through hash-verified unchanged regression evidence. No frozen listener, instrument or oracle changed; no audit is due.

**The user adjusted the rules after 026** ([contract 2](contracts/development-contract-2.md#keeping-the-suite-lean-the-rising-tide)):
routine runs use a lean active suite, the rising tide, with sentinels from passed
substages, gimmes retired to sweep-only and full sweeps at milestones; the frozen
baselines are sweep-only from now; a stopping rule counts listener versions that fail
the lowest open substage; bar flags will compare a bar with the other bars and need
three of them; single-deviation substages may be grouped. 027 still repairs the live
cursor; 028 then builds event instruments 3 and the suite record, with its audit.

The next experiment is **027**, investigating transient pitch skips and live-state recovery on the frozen slowed-bar set while preserving earlier substages and controls. Rushed bars wait for this lowest unpassed substage. [Review R5](reviews.md#r5-after-experiment-026-and-the-post-r4-process-changes) found the failed verdict supported and completed R4's outside process check on a different model from the process author. Grouping substages is now allowed; later recorded-guitar gates and product/qualification decisions remain with the user, and none blocks this next bounded investigation.

Under the [stopping rule](contracts/development-contract-2.md#stopping), 026 was one failed attempt with an unchanged listener, not a failing version: the count of failing listener versions is 0. [Report 026](reports/026-single-slowed-bar.md#resulting-plateau-budgets-and-evidence-access) records the state and unchanged budgets/access. Qualification is untouched and Winner bars 5–8 remain unexamined. Evidence remains short-score sine development transformations, with no generalisation or product claim.

## Inherited lessons

What the first series established that still applies. Each is evidence about sound,
alignment or measurement, not about the old objective. The archive holds the details.

| # | Lesson | Evidence |
|---|---|---|
| L1 | Develop on audio with an exact answer first. On a real recording, a tracking defect and an acoustic limit produce the same failure. | [Report 004](archive/ladder-1/reports/004-rung0-clean-winner.md), archived findings 20–21 |
| L2 | Matching the current sound against static templates ties with nearby positions in repeated harmony; the order of events is what disambiguates. | [Report 003](archive/ladder-1/reports/003-recognition-at-sync.md), [report 005](archive/ladder-1/reports/005-online-time-warp-rung0.md), archived findings 18, 22, 26 |
| L3 | Support judged from the current sound alone accepts a different piece that shares sustained notes. | [Report 005](archive/ladder-1/reports/005-online-time-warp-rung0.md), archived finding 25 |
| L4 | Recorded guitar against a sine reference shifts every absolute match threshold, in both directions depending on the guitar. A threshold is only meaningful per timbre, or relative to the performance itself. | [Report 008](archive/ladder-1/reports/008-rung2-guitar-samples.md), [report 009](archive/ladder-1/reports/009-plucked-reference.md), archived findings 28, 31, 34 |
| L5 | Frame alignment on recorded guitar fails in short bursts while sustained bass notes decay, even where the features prefer the true position. | [Report 008](archive/ladder-1/reports/008-rung2-guitar-samples.md), [report 010](archive/ladder-1/reports/010-slim-suite-and-burst-features.md), archived findings 32, 37 |
| L6 | Steady-tempo assumptions help exactly timed synthetic audio and hurt real playing: a four-second tempo history improved the synthetic guitars while real-clip agreement fell sharply. Making the path react faster made its bursts worse. | [Report 011](archive/ladder-1/reports/011-path-and-support.md), [report 021](archive/ladder-1/reports/021-stability-calibration.md), archived findings 38, 53, 54 |
| L7 | Comparing against one rearranged copy of the score is a coin flip on unrelated audio; a family of them is correlated and expensive. | [Report 015](archive/ladder-1/reports/015-decoy-null.md), archived findings 44, 46 |
| L8 | Rejection of a wrong score means nothing without acceptance of the right one; read them together. | [Report 004](archive/ladder-1/reports/004-rung0-clean-winner.md), archived finding 23 |
| L9 | The real clip's sync anchors are bar-level and of unmeasured precision. Interpolated positions cannot grade anything finer than a bar, and an audio-ignoring clock scores highly on a steady professional. | [Report 002](archive/ladder-1/reports/002-winner-sync-proxy.md), [anchor precision](evidence/bar-anchor-precision-1.json), archived findings 13, 15 |
| L10 | The frozen v1 evaluator needs clip durations exact to 1e-9 s: pad audio to a multiple of 3 samples at 48 kHz. | [Report 007](archive/ladder-1/reports/007-rung1-tempo.md), archived finding 30 |
| L11 | A development limit fitted on the examples it is scored on, against one wrong piece, is not independent evidence. Fresh bars, pieces or sounds are. | [Report 016](archive/ladder-1/reports/016-windowed-rank.md), archived finding 47 |

## Findings

Status is `holds`, `superseded` or `withdrawn`.

| # | Finding | Evidence | Status | Since | Notes |
|---|---|---|---|---|---|
| 1 | following-evaluator@2 and assessment-evaluator@1 reproduce every number of the hand-worked event-oracle@1, which covers every rule named in contract 2, and the oracle catches deliberate evaluator faults | [Report 022](reports/022-event-instruments.md#the-instruments-against-their-oracle), [oracle](bench/oracle-events/README.md) | holds | 022 | The oracle was frozen before the evaluators existed |
| 2 | On stage 1, the frozen time warpers' only failure is running ahead: at half speed all three reach events 0.15–0.9 s before they sound, and v12 and v14 are also ahead at 70% and 110% | [Report 022](reports/022-event-instruments.md#the-baselines-on-stage-1); superseded by [report 023](reports/023-instruments-decisions.md#the-baselines-on-the-controls) | superseded | 022 | Supports the contract's forward-only, tempo-clamped prediction; no deviation yet, so nothing about smoothing is concluded. Stage 1 had no controls; with them, running ahead is not their only failure (finding 8) |
| 3 | At the handed tempo, stage 1 cannot tell any listener from the clock: the sine audio is the time warpers' own reference, and their event timelines equal the clock's | [Report 022](reports/022-event-instruments.md#the-baselines-on-stage-1) | holds | 022 | The off-tempo examples carry stage 1 |
| 4 | How a continuous position maps to an event decides a baseline's score: under a nearest-onset mapping the clock at the handed tempo falls from 100% to 55–60% on event | [Report 022](reports/022-event-instruments.md#the-baselines-on-stage-1) | holds | 022 | The scored rule (the last onset reached) was fixed before any run |
| 5 | Under the contract's definition of variation, a single long hesitation in a short piece lowers the overall tempo enough that steady bars must be flagged fast | Oracle case A3, [report 022](reports/022-event-instruments.md#for-the-user-three-decisions-the-evidence-raises); superseded by the user's decision and [event-oracle@2's A3](reports/023-instruments-decisions.md#the-instruments-against-their-oracle) | superseded | 022 | A definitional question for the user, not a listener result. The user chose the typical (median) tempo; against it the steady bar is no longer flagged |
| 6 | assessment-evaluator@2 and stage-gates@1, with the unchanged following-evaluator@2, reproduce every number and gate verdict of the hand-worked event-oracle@2, which implements every decision the user made on 022; event-oracle@1 still passes, and seven injected faults are each caught | [Report 023](reports/023-instruments-decisions.md#the-instruments-against-their-oracle), [oracle](bench/oracle-events/README.md) | holds | 023 | Pending the audit (question 6): author and oracle agree by construction until an independent reading does |
| 7 | Stage 1's controls separate following from listening: the clock falsely follows every silence and wrong-score control for their whole answerable time, and the frozen time warpers reject every silence control | [Report 023](reports/023-instruments-decisions.md#the-baselines-on-the-controls), [g023](runs/g023-stage1-controls/summary.json) | holds | 023 | Qualifies finding 3, which is about the performances alone |
| 8 | The frozen time warpers follow a wrong score whose notes lie a semitone from the audio's in the same rhythm: `w1` against s2's second bar at 90 and 99, for 0.41–1.65 s (correct rejection 64.5–91.9%), with the path two and a half to four quarters behind; where `w1`'s notes are a tritone or more away, or the audio is at 45 or 63, they reject it | [Report 023](reports/023-instruments-decisions.md#the-baselines-on-the-controls) | holds | 023 | Same family as lesson L3; the mechanism (semitone leakage, a two-second rank window) is inferred from the code, not tested |
| 9 | In a two-bar piece the bar with more intervals sets the typical tempo, so a second bar that drags throughout makes a steady first bar read fast | Oracle case A7, [report 023](reports/023-instruments-decisions.md#for-the-user-two-decisions-and-one-observation) | holds | 023 | A consequence of the approved definition, reported to the user; not a listener result |
| 10 | event-chain@1 passes stage 1 with both outputs, at every tested steady tempo, with no false findings and rejection of both controls | [Report 024](reports/024-event-chain-stage1.md#new-listener-the-eight-performances), [g024](runs/g024-event-chain-stage1/summary.json) | holds | 024 | Restricted to distinct-pitch monophonic sines on s1/s2; finding recall/recovery/extra-note gates have no positives here |
| 11 | Replacing w1 with the approved distant w2 makes every frozen time warper pass all stage-1 cursor controls without changing its performance records | [Report 024](reports/024-event-chain-stage1.md#comparators-causality-and-cost) | holds | 024 | A change to the control's difficulty, not an algorithm improvement; the original w1 failure remains |
| 12 | event-chain@1 holds through a single silent hesitation and passes its cursor, interval and bar-flag gates without losing stage 1; short resumption abstention stays within the gates | [Report 025](reports/025-single-hesitation.md#both-outputs-on-the-40-hesitations), [g025](runs/g025-single-hesitation/summary.json) | holds | 025 | Two distinct-pitch sine scores, fixed pause locations; no claim for chords, ringing guitar or other deviations |
| 13 | All four frozen comparators run ahead and fail every tested hesitation cursor example; the time warpers still reject the distant controls | [Report 025](reports/025-single-hesitation.md#controls-regressions-causality-and-cost) | holds | 025 | Some slow parents already fail, so not every failure is attributable solely to the pause; none assesses |
| 14 | On a single slowed bar, event-chain@1 assesses every note and interval and reproduces the approved typical-tempo flags, but its live cursor skips two correctly played F4 events after overlapping windows falsely identify G4 | [Report 026](reports/026-single-slowed-bar.md#diagnosis-a-transient-pitch-skip-inside-the-slowed-bar), [g026](runs/g026-single-slowed-bar/summary.json) | holds | 026 | Frozen listener, two short sine-scale transformations; other 38 performances and all controls pass; transient phase/frame explanation is inferred, not isolated |
| 15 | With the approved interval-end attribution, slowing the first bar of the two-bar scale can make the unchanged second bar read fast, while slowing the second bar makes it read slow; event-chain@1 reproduces this asymmetry | [Report 026](reports/026-single-slowed-bar.md#the-approved-typical-tempo-asymmetry) | holds | 026 | End-to-end evidence for the median-reference limitation; no instrument change |

## Open questions

Ranked by row order; the top row is the next question. The number is an identifier
given when a question opens and never reused.

| Rank | Question | Why it is ranked here | Status | Owner item |
|---|---|---|---|---|
| 11 | Can a new listener reject transient pitch skips or recover from premature live-state commitment, passing the frozen slowed-bar set and all earlier regressions/controls? | Lowest unpassed substage: two mixed-window G4 observations skip F4, while offline assessment succeeds; fix or test the measured cause before adding rushed bars | open | [Report 026 next](reports/026-single-slowed-bar.md#next), experiment 027 |
| 10 | Does event-chain@1 follow a single slowed bar and assess its variation correctly, preserving stage 1 and the hesitation substage? | Answered: no as a complete substage; assessment/controls pass but two cursor examples fail. Earlier substages preserved (findings 14–15) | answered | [Report 026](reports/026-single-slowed-bar.md) |
| 9 | Does event-chain@1 hold its cursor through a single hesitation and report the resulting tempo variation, without losing stage 1? | Answered: both outputs and controls pass; exact regression records and assessments preserved (finding 12) | answered | [Report 025](reports/025-single-hesitation.md) |
| 4 | Can the simplest event-based live cursor and end-of-piece assessor pass stage 1, controls included, with stage 1's wrong score replaced by a distant one? | Answered: event-chain@1 passes both outputs and all controls (finding 10) | answered | [Report 024](reports/024-event-chain-stage1.md) |
| 6 | Does an independent session, re-deriving **event-oracle@2** by hand from [event instruments 2](contracts/event-instruments-2.md), agree with it? | Answered: yes on every number a gate reads. 66 records and reports re-derived, all 13 derived blocks included: 63 agree, 0 disagree, 3 ambiguous (F9's `indeterminate` figure only, question 8) | answered | [Audit 2](bench/oracle-events/audit-2.md), Claude Fable 5.1 |
| 5 | Do the instruments, versioned for the user's decisions (typical-tempo reference, interval durations with a floor, clean examples, the dead verdict, the controls), reproduce a re-worked hand oracle, and what do the frozen baselines do on stage 1's new controls? | Answered: yes, exactly (finding 6); the clock fails every control and the time warpers fail two wrong-score controls (findings 7, 8) | answered | [Report 023](reports/023-instruments-decisions.md) |
| 1 | Do following-evaluator@2 and assessment-evaluator@1 reproduce independently hand-worked oracle cases? | Answered: yes, exactly (finding 1) | answered | Experiment 022 |
| 2 | On stage 1, where do the clock and the frozen versions 8, 12 and 14 fail, and do the failures show the forward-only, tempo-clamped design? | Answered: ahead of a slow player; indistinguishable at the handed tempo (findings 2–3) | answered | Experiment 022 |
| 3 | Which numerical gates, flag reference tempo and dead-note verdict does the user approve? | Decided by the user after 022 | answered: gates approved for stages 1–3 with two changes; typical tempo; a dead verdict | [Report 022](reports/022-event-instruments.md#proposed-gates-awaiting-the-users-approval) |
| 7 | Does the user approve the proposed control-assessment gates and the exclusion of controls from the pooled finding rates, and does `w1` stay as stage 1's wrong score? | Decided by the user after 023 | answered: gates approved; `w1` moves to stage 2, and stage 1 gets a distant wrong score | [Contract 2](contracts/development-contract-2.md#the-progression-start-simple-one-change-at-a-time) |
| 8 | Which figure owns the excluded time that is both pending and indeterminate? | The audit's one ambiguity | answered: once, as pending, by the [clarification](contracts/event-instruments-2.md#clarification-2026-09-30); no oracle number changes | [Audit 2](bench/oracle-events/audit-2.md) |

## Superseded and stopped

| # or rank | Was | Superseded or stopped by | Date |
|---|---|---|---|
| Finding 2 | The time warpers' only stage-1 failure is running ahead | Finding 8: with controls, they also follow a semitone-neighbour wrong score ([report 023](reports/023-instruments-decisions.md)) | 2026-09-30 |
| Finding 5 | A hesitation makes steady bars read fast | The user's typical-tempo decision, implemented in event instruments 2 ([report 023](reports/023-instruments-decisions.md)) | 2026-09-30 |
