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

### Current batch: the challenger track, experiment 035

Opened 2026-10-02 by the user, run through a parent session (Claude Fable 5.1 in Claude
Code) that launches the experimenter, the seam auditor and the reviewer as separate
herdr sessions: GPT-6.1-Sol (high) in Codex, Claude Fable 5.1 in Claude Code and Claude
Opus 5.5 in Claude Code. The user's request, in order:

> I've done more research - some of this points towards me training a "better than basic
> pitch" model

> Lets suppose that Basic Pitch is promising. Perhaps we should consider a new contract
> that is more "midi" based wdyt?

> ok - can you plan the basic pitch challenger

> I'm happy for you to decide on those decisions (I allow all the options)

> you are running in herdr and there are other agents in your space including alice
> (Opus 5.5), bob (Fable 5.1) and Dave (codex opus 6.1). Can you use these agents to
> complete this plan

**Goal.** One challenger experiment, 035, under
[the contract's challenger section](contracts/development-contract-2.md#the-challenger-track-basic-pitch-observations)
and [avenue A2](TRACK_PROPOSALS.md#a2-basic-pitch-observations-through-the-event-chain):
Basic Pitch observations through the unchanged event chain, judged by the unchanged
instruments and controls on the frozen sine sets and on new `sample-render@1` renders of
the stage-1 and stage-2 scores from the development guitars, assessment output first,
with an in-process live spike that measures parity with the offline model, look-ahead
and cost. It carries an exploration budget, not predictions; the rule for a second
experiment is in the contract. It also takes up R10's third escalation, the guitar
thermometer. The main track is not run in this batch and its questions keep their rank.

**Roles.** Experimenter: the Codex session. Audit of the observation seam's timing, after
the seam and its producer land: the Fable session, which writes none of it. Process
review of the batch: the Opus session, which writes none of it and is not the model of
R9 and R10. The count is one numbered experiment; the audit and the review are not
counted.

**Progress.** Run 1 of 1: [035 pre-registration](reports/035-challenger-basic-pitch.md#pre-registration) landed before measurement; GPT-6.1-Sol (high) in Codex is the experimenter.

### Previous batch, closed: 030–034

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

**Progress. Reopened by the user at run 2 of 5; three runs remain.** Run 1:
[030](reports/030-current-instruments.md), Sol 6.1 (high) in Codex: a resolved
reporting failure. Run 2: [031](reports/031-other-bars-reporting.md), Claude Opus 5.5
in Claude Code: an **unresolved infrastructure outcome**, which closed the batch under
[section 9](PROMPT_EXPERIMENTER.md#9-batches). The parent reported the closure and
031's two routes to the user, who answered on 2026-10-01:

> claude usage is back. Can you get things spinning again

> g031b is fine

So the overdue sweep is completed as **`g031b-reporting-sweep` under 031's frozen
pre-registration**, by the user's authority (open question 20), and the batch continues
with its remaining three numbered experiments, 032–034, under the unchanged goal. The
completion run's verdict is recorded against 031; it adds no run to the count. Process
review R9 covers 030–031 as closed; the batch's remaining runs get their own review.

**Run 3 done: [032](reports/032-held-note-hesitation.md), Sol 6.1 (high) in Codex, D1.**
**Run 4 done: [033](reports/033-rushed-bar.md), Claude Opus 5.5 in Claude Code, D1.**
**Run 5 done: [034](reports/034-missing-event-sweep.md), Sol 6.1 (high) in Codex, D1.**
**Closed at 5 of 5.** The resumed batch passed held-note hesitation, rushed bar and
one missing interior event on simple sines; its final full sweep confirms every
previously passed substage, with earlier outputs preserved. Stage 2 remains incomplete.
Process review [R10](reviews.md#r10-after-the-resumed-batch-g031b-and-032034-with-the-direction-review)
covers g031b and 032–034, and carries the different-model direction review of the whole
process that had been due since R5; R9's original 030–031 review stays recorded.

2026-10-01. [Contract 2](contracts/development-contract-2.md) remains in force and
**event-chain@3 remains incumbent**. [034](reports/034-missing-event-sweep.md#results)
passes a missing interior event on the one- and two-bar scores: the cursor holds the
predecessor and recovers at the next sound, the assessment identifies the omitted
note, and the interval spanning it preserves the steady tempo. The complete batch-end
sweep passes every earlier substage and control, preserving all earlier outputs.
The [suite record](bench/suite-record.json) confirms earlier states, adds the passed
missing-event substage and re-chooses sentinels by the frozen rule; no set is retired.
Next is the single wrong note with w1, a capability this deletion result does not establish.

The latest full sweep is g034; next due no later than 039, or sooner on a stage claim,
new gates or batch end. [034's resulting state](reports/034-missing-event-sweep.md#resulting-stopping-count-budgets-and-evidence-access)
carries stopping count 0 and unchanged qualification budgets/access: no new listener
version, no qualification evidence, Winner bars 5–8 unexamined. Earlier substages
now have a second recorded complete-set incumbent pass, the new omission substage one.

[Audit 4](bench/oracle-events/audit-4.md) remains the current oracle audit. 034 created
no oracle, so no audit is due. The next process review is due after the next experiment
or audit, by a model other than Claude Fable 5.1 where one is available (R9 and R10 were
both by it).

**Awaiting the user:** nothing from 034 itself. Of R10's three escalations, the
sentinel rule's tie-break and pool and baselines in full sweeps (R9's second escalation)
are still open; the guitar-sound thermometer is taken up by the challenger track
(experiment 035, above).
Evidence-based recorded-guitar gates before stage 4 and eventual qualification/product
choices remain standing future decisions. This session's direction is preserved:

> You cannot ask the user questions: record anything that needs them in your report and the research log.

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
| 20 | Under audited current instruments, event-chain@2 retains every historical cursor/note/interval/control result, but obsolete short-score bar flags reopen hesitation and slowedBar | [030 results](reports/030-current-instruments.md#each-attempted-substage-with-its-controls), [g030](runs/g030-current-instruments/summary.json) | holds | 030 | A reporting-policy compatibility failure; earlier instruments2 passes remain historical |
| 21 | The unchanged event chain passes its own four-bar clean/slowed measurements, including repeated nonadjacent pitches; boundary estimates miss two required slow flags within approved pooled recall | [030 four-bar diagnosis](reports/030-current-instruments.md#diagnosis-obsolete-flag-policy-with-boundary-misses-on-four-bars) | holds | 030 | Earlier sentinel failures prevent a substage pass; no chords, guitar, missing/wrong/dead or transfer claim |
| 22 | The one permitted technical rerun can fail after measuring everything, which leaves complete private evidence with no recorded verdict: 031's g031a measured all 516 @3 examples and every baseline, then failed its own public-summary size check | [031 results](reports/031-other-bars-reporting.md#the-two-attempts), [g031a](runs/g031a-reporting-sweep/summary.json) | holds | 031 | A process fact, not a listening result. g031a's observations (@3 identical to @2 apart from flags; no false findings; four-bar slow 89/91) are diagnostic only |
| 23 | event-chain@3, @2 with flags only on eligible bars against the other bars, passes the full sweep. Live records and musical output are identical to @2 on 516/516 examples. It raises no flag on one- and two-bar scores, has no false findings anywhere, and finds 89/91 four-bar slow bars, the two misses at a true ratio of exactly 0.90 | [031 completion](reports/031-other-bars-reporting.md#completion-g031b-by-the-users-authority), [g031b](runs/g031b-reporting-sweep/summary.json) | holds | 031 (g031b) | Monophonic sine scores only. Missing/wrong/dead/extra have no positives. Boundary recall rests on millisecond onset estimates |
| 24 | event-chain@3 holds through a single hesitation with the previous sine sustained, passes both outputs and controls, and preserves every active earlier regression output; resumption estimates shift by up to two hops from silent counterparts within the approved gates | [032](reports/032-held-note-hesitation.md#both-outputs-controls-and-regressions), [g032](runs/g032-held-note-hesitation/summary.json) | holds | 032 | Two short monophonic scores, constant sustain with no overlap/decay; no bar-flag positives or new wrong/missing/dead/extra capability |
| 25 | event-chain@3 passes a single rushed bar at 1.05–1.30 of base tempo on s2 and s3: every event, note and interval, and 64/66 expected fast flags with no false alarm; both misses are bars whose true ratio is 1.10 to within 3e-6 | [033](reports/033-rushed-bar.md#results), [g033](runs/g033-rushed-bar/summary.json) | holds | 033 | Monophonic sine scores only; the first fast-flag positives. With g031b's slowed bars, four of five exact-threshold positives are missed, all on the side of 1.0: a near coin flip at 10 ms onset resolution, too few cases to establish a bias |
| 26 | event-chain@3 recovers after every single interior omission on s1/s2, identifies all missing notes, and preserves spanning-interval tempo; the batch-end sweep confirms earlier substages and reproduces all earlier outputs | [034](reports/034-missing-event-sweep.md#results), [g034](runs/g034-missing-event-sweep/summary.json) | holds | 034 | Distinct-pitch monophonic sines, one silent beat per example; no first/last or multiple omission, repeated-pitch ambiguity, wrong/dead note or guitar claim |

## Open questions

Ranked by row order; the top row is the next question. The number is an identifier
given when a question opens and never reused.

| Rank | Question | Why it is ranked here | Status | Owner item |
|---|---|---|---|---|
| 24 | With Basic Pitch observations as its front end and the incumbent's chain unchanged, does the challenger pass the assessment gates, controls included, on `sample-render@1` renders of the stage-1 scores from the development guitars, what does it do on the frozen sine sets, and what look-ahead and cost does an in-process live path need against the 200 ms cursor gate? | The user opened the challenger track on 2026-10-02 (current batch); the first experiment carries an exploration budget, so this is the question it explores rather than predicts | open | [Contract 2, challenger track](contracts/development-contract-2.md#the-challenger-track-basic-pitch-observations), [avenue A2](TRACK_PROPOSALS.md#a2-basic-pitch-observations-through-the-event-chain) |
| 23 | Does the incumbent follow and identify a single wrong note, while rejecting near-miss w1 and retaining every confirmed substage and the passed omission sentinels? | Next deviation in contract 2 after missing-event passes; exact-pitch deletion success does not establish wrong-note following/assessment | open | [034 next](reports/034-missing-event-sweep.md#next), [contract 2 order](contracts/development-contract-2.md#order-of-work) |
| 22 | Does the unchanged incumbent recover after a single missing event (cursor recovery, `missing` findings, the spanning interval) while retaining every passed substage, and does the full sweep due at batch end 034 confirm the substages passed since g031b? | Next deviation in contract 2's order; rushed bar now passed (finding 25); the sweep is due at the batch's end | answered: yes, D1 (finding 26) | [Contract 2 order](contracts/development-contract-2.md#order-of-work), [034](reports/034-missing-event-sweep.md) |
| 21 | Does the unchanged incumbent pass one rushed bar, retaining the held-note and earlier substages under current gates? | Answered by 033: all 479 active examples pass; fast flags 64/66, misses only at the exact threshold | answered: yes, D1 (finding 25) | [033](reports/033-rushed-bar.md) |
| 19 | After reporting repair, does the incumbent hold a hesitation while the previous note keeps ringing, before rushed/missing/wrong/dead/extra deviations? | Answered by 032 on constant non-overlapping sine sustain; ringing/overlapping guitar remains outside this stage | answered: yes, D1 (finding 24) | [032](reports/032-held-note-hesitation.md) |
| 20 | Does a completion of 031's frozen pre-registration (event-chain@3 in the full sweep, with the repaired summary writer) record D1: stage 1 confirmed, hesitation/slowedBar/four-bar passed, sentinels re-chosen? | Answered by g031b: all 516 examples, pools, sentinels, causality and cost pass | answered: yes, D1 (finding 23); route chosen by the user, "g031b is fine" | [031 completion](reports/031-other-bars-reporting.md#completion-g031b-by-the-users-authority) |
| 17 | Can a new listener change only its offline bar-reporting policy to the approved other-bars reference/eligibility, clearing reopened hesitation and slowedBar and four-bar revalidation while preserving live/note/interval behavior? | Lowest reopened substage comes first;030 isolates obsolete flags with all other components passing | answered by g031b: yes (finding 23); g031/g031a's D3 stays recorded | [031](reports/031-other-bars-reporting.md) |
| 18 | Does the full sweep due by031 preserve all historical/current evidence and controls, with frozen baselines reused only where producers and inputs remain unchanged? | Required by the rising tide, independent of routine component passes; combine with031's repair evaluation | answered by g031b: yes, the sweep passes; baselines cited by hash where unchanged and fresh on four bars | [030 resulting state](reports/030-current-instruments.md#resulting-stopping-count-budgets-and-evidence-access) |
| 16 | Does unchanged event-chain@2 pass current-instrument historical and frozen four-bar revalidation? | Answered: stage1 passes; short-score reporting fails and reopens hesitation/slowedBar; four-bar own measures pass but earlier sentinels prevent promotion | answered: resolved failure | [030](reports/030-current-instruments.md) |
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
