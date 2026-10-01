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

### Current batch

Opened 2026-10-01 by the user: **five numbered experiments on the main track**, 030
onwards, run through a parent session (Claude Fable 5.1 in Claude Code) that launches
the experimenters, auditors and the reviewer as separate sessions in herdr. Three
sessions are available to it: Claude Opus 5.5 in Claude Code, Claude Fable 5.1 in
Claude Code, and Sol 6.1 in Codex; each run's ledger row names which ran it. The
user's request:

> you are running in herdr and can use it to contact and instruct different agents.
> you have bob (claude opus 5.5) and carol (claude Fable 5.1) and dave (codex sol 6.1)
> at your disposal. You can chose which you want to be reviewer or experimentor, etc.
> We won't start a new track. Lets continue our main track. Can you continue. I want
> you to run 5 experiments (happy for you to also do related things (e.g. full test,
> oracle tweaks). Is it clear what your scope is?

**Goal.** Continue the main track under [contract 2](contracts/development-contract-2.md)'s
order of work. No new track is opened and nothing in [TRACK_PROPOSALS.md](TRACK_PROPOSALS.md)
is adopted. Related work the loop already owes is in scope: the full sweep due by 031,
oracle corrections and the audits they require, and revalidation of historical passes
under the current instruments. The count is five numbered experiments; audits and the
process review are not counted. The batch ends early under
[section 9 of the experimenter prompt](PROMPT_EXPERIMENTER.md#9-batches); the
contract, the gates and the rules of the loop are unchanged by it.

**Progress.** Run 1 of 5 is in progress: [030 pre-registration](reports/030-current-instruments.md), owned by Sol 6.1 (high) in Codex in `listening-030`. Revalidate the frozen incumbent under audited current instruments before adding the next deviation.

2026-09-30. [Development contract2](contracts/development-contract-2.md) remains in force. **event-chain@2** remains the incumbent, with stage1, silent hesitation and slowed-bar passes under audited instruments2 from [027](reports/027-live-confirmation.md). Stage2 is incomplete. [029](reports/029-oracle-coverage.md) corrects audit3's B1 arithmetic, reshapes B11 with exact onset values, and freezes missing report/suite cases as event-oracle@4. The existing implementation agrees with the new hand answers; no listener was developed, executed or judged.

**[Audit 4](bench/oracle-events/audit-4.md) is done and agrees in full**: an independent session re-derived every case of oracle 4 and a sample of the inherited following, note and control cases from oracle 2, with no disagreement and no ambiguity, so the audit prerequisite to judging a listener with instruments 3 is met. Oracle3, [audit3](bench/oracle-events/audit-3.md) and [028](reports/028-other-bars-suite.md)'s mixed verdict remain unchanged as history. [Instruments4](contracts/event-instruments-4.md) versions the corrected oracle coverage without changing musical definitions, evaluator implementation or approved numerical gates; the audit lists the rules still without a frozen case, none read by a gate on the stages in hand. The next numbered experiment can take up stage 2's remaining deviations under the [order of work](contracts/development-contract-2.md#order-of-work). Synthetic missing-evidence/parent-score adapters are not end-to-end stage evidence; the historical record has no retirement, so its retirement-record check remains vacuous.

The [suite record](bench/suite-record.json) remains historical instruments2 bootstrap evidence with pending revalidation, no new confirmation and no performance retirement. The frozen four-bar sine evidence awaits audited measurement. The next full sweep remains due no later than031 after026, earlier at stage completion/new gates/batch end. [029's resulting state](reports/029-oracle-coverage.md#resulting-stopping-count-budgets-and-evidence-access) carries unchanged stopping count, budgets and qualification access; Winner bars5–8 remain unexamined. The main-track batch above is active. [Process review R8](reviews.md#r8-after-audit-3-and-experiment-029) checked audit 3 and 029; audit 4 has since landed.

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
| 16 | Three-window live pitch confirmation in event-chain@2 prevents the two observed slowed-bar skips without changing any musical assessment, while adding one hop to ordinary acquisitions and hesitation resumption abstention | [Report 027](reports/027-live-confirmation.md#both-outputs-including-earlier-regressions), [g027a](runs/g027a-live-confirmation/summary.json) | holds | 027 | All frozen earlier substages/controls pass; prevention on these sine transients, not recovery after commitment or evidence for other sounds/errors |
| 17 | Instruments3 reproduce all new assessment hand cases except frozen B1: endpoint attribution contradicts its frozen first other-bars reference and ratio | [028 discrepancy](reports/028-other-bars-suite.md#instruments-against-the-frozen-oracle), [g028](runs/g028-other-bars-suite/summary.json) | holds | 028 | Author diagnosis at 028; [audit 3](bench/oracle-events/audit-3.md) independently confirms B1; no frozen answer changed and no listener judged |
| 18 | Historical instruments2 passing evidence gives deterministic margin-ranked sentinels and a smaller routine regression set, with no justified performance retirement yet | [028 suite](reports/028-other-bars-suite.md#suite-record-and-rising-tide), [suite record](bench/suite-record.json) | holds | 028 | One incumbent@2 evaluation; no new confirmation, transfer or version3 listener verdict |
| 19 | Corrected event-oracle@4 agrees with existing instruments on the bar arithmetic, report accounting and added suite rules; old oracle/instrument/listener bytes remain unchanged | [029](reports/029-oracle-coverage.md#results), [g029](runs/g029-oracle-coverage/summary.json) | holds | 029 | Implementation agreement; [audit 4](bench/oracle-events/audit-4.md) independently agrees on every case. Synthetic adapters and vacuous retirement-record checks have explicit limits |

## Open questions

Ranked by row order; the top row is the next question. The number is an identifier
given when a question opens and never reused.

| Rank | Question | Why it is ranked here | Status | Owner item |
|---|---|---|---|---|
| 15 | Does an independent session rederive event-oracle@4's corrected B1/B11 and every added report/null/omission/state/selection/headroom/plan case, agreeing with the frozen answers and checking the explicit adapter/procedural limits? | Answered: 138 cases re-derived (89 in oracle 4, 49 inherited samples from oracle 2), 138 agree, 0 disagree, 0 ambiguous; B1's corrected reference and ratio and B11's exact `either` boundary confirmed; two places where the rule text is thinner than the case (S13, X4/X5) noted without changing a verdict; rules still uncovered listed, none gate-read on the stages in hand | answered | [Audit 4](bench/oracle-events/audit-4.md), Claude Fable 5.1 |
| 14 | Does a corrected event-oracle@4 carry B1's bar 0 reference as 30 (ratio 1), settle B11's boundary (state the comparison arithmetic or reshape the case so its 1.05 ratio is exact), and freeze hand cases for the rules audit 3 found uncovered — report-level bar measures (ineligible and `either` bars in the false-alarm denominators, summaries matched by ordinal, local/reference/ratio errors), a bar whose reference is null, reopening a `passed` substage, a routine pass preserving `confirmed`, the `rejection` and interval headroom formulas — and does an independent audit agree with it? | The audit rule makes this a prerequisite to any listener judgement under instruments3; B1 changes informational reference/ratio fields without changing its verdict or `clean`; B11's ambiguity changes `clean` and whether a bar-3 flag is a false alarm | answered: corrected; implementation and [audit 4](bench/oracle-events/audit-4.md) agree | [029](reports/029-oracle-coverage.md), [Audit 3](bench/oracle-events/audit-3.md), [audit rule](contracts/development-contract-2.md#auditing-an-oracle) |
| 13 | Does an independent session rederive event-oracle@3, including B1's preserved disagreement and every new other-bar/suite rule? | Answered: 34 cases re-derived, 32 agree, 1 disagree (B1's bar 0 reference and ratio, as the freeze recorded), 1 ambiguous (B11's decimal onsets); uncovered rules listed for question 14 | answered | [Audit 3](bench/oracle-events/audit-3.md), Claude Fable 5.1 |
| 12 | Do new event instruments and stage states implement the approved other-bars reference and rising tide, with a frozen hand-worked oracle and deterministic suite record? | Implemented but mixed: B1 frozen hand arithmetic disagrees; suite/bootstrap/data checks hold, independent audit next | answered: mixed, pending audit | [028](reports/028-other-bars-suite.md) |
| 11 | Can a new listener reject transient pitch skips or recover from premature live-state commitment, passing the frozen slowed-bar set and all earlier regressions/controls? | Answered: event-chain@2 prevents both skips; all 264 examples and earlier pools pass, musical assessment unchanged, +10 ms ordinary live latency (finding 16) | answered | [Report 027](reports/027-live-confirmation.md) |
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
