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

2026-09-30. [Development contract 2](contracts/development-contract-2.md) is in force.
The listener now has two outputs: a live cursor judged on score events, and an
end-of-piece assessment of tempo variation and every note. Progress starts on the
simplest committed scores with one synth and perfect performances, then adds one
deviation at a time. Nothing has run under this contract. Its evaluators do not exist
yet, and there is no listener built for it: the clock and `online-time-warp@8`, `@12`
and `@14` from the first series are frozen baselines, never to be developed. The next
experiment is **022**, which builds the two evaluators and their oracle cases,
renders stage 1 and measures the baselines.

No plateau or budget carries over: contract 2 starts its own. Qualification under
[research contract 1](contracts/research-contract-1.md) is untouched, with zero frozen
versions and zero assessments; its six version slots, twelve assessment slots and
reserved and final access remain unused. Winner bars 5–8 remain unexamined.

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

## Open questions

Ranked by row order; the top row is the next question. The number is an identifier
given when a question opens and never reused.

| Rank | Question | Why it is ranked here | Status | Owner item |
|---|---|---|---|---|
| 1 | Do following-evaluator@2 and assessment-evaluator@1 reproduce independently hand-worked oracle cases: hesitations, missing, wrong and dead notes, partial chords, extra notes, ambiguous events and the bad-sync case? | Nothing can be judged until the instruments are trusted | open | [Contract 2 order of work](contracts/development-contract-2.md#order-of-work), experiment 022 |
| 2 | On stage 1, where do the clock and the frozen versions 8, 12 and 14 fail under the new measures, and do those failures show the forward-only, tempo-clamped design the contract predicts? | A new instrument that cannot see a known defect is wrong; the baselines also fix the floor | open | Experiment 022 |
| 3 | Which numerical gates should the user approve, given the oracle cases and the baselines? | The contract's gates are placeholders until then | open | Experiment 022, then the user |
| 4 | Can the simplest event-based live cursor and end-of-piece assessor pass stage 1? | The first listener built for contract 2 | open | Experiment 023 |

## Superseded and stopped

| # or rank | Was | Superseded or stopped by | Date |
|---|---|---|---|
