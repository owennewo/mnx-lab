# Research log

The entry point to the performance-listening experiment. It answers three questions
for a person or a resuming loop driver: what do we currently believe, on what evidence,
and what is the next question. It is piece 11 of
[EXPERIMENT_HARNESS_STRUCTURE.md](EXPERIMENT_HARNESS_STRUCTURE.md), and the only file
in the experiment that is rewritten in place. `ledger.md` holds the history, one
append-only row per run; `research/` holds one note per source read; a run's report
holds its numbers. This file points at all three and repeats none of them.

How to maintain it:

- **Current state** is a few sentences, rewritten whenever an experiment lands. It says
  where the harness stands, which candidate is current, and what the last result
  changed. No figures.
- **Findings** are one row each. A finding states a belief and cites the evidence that
  supports it: a research note, a ledger row, or a per-experiment write-up. A row
  without evidence is a hypothesis and belongs under open questions instead. When
  later evidence contradicts a finding, its status becomes `superseded` and the row
  gains the evidence that did it; the row is never deleted or reworded to fit.
- **Open questions** are ranked as the loop driver ranks them: by the contract's
  priorities first, then by frequency of the failure they concern, then by how much
  uncertainty an answer would remove. The top row is the next question. A question
  that becomes a finding moves down with its evidence; one that a budget closes is
  marked `stopped`, with the reason.
- A finding's numbers stay in the report it cites. If a figure matters enough to be
  in this file, the report it comes from matters more, so link it.
- Every commit that adds a ledger row updates this file in the same commit, even if
  the update is only to the current-state paragraph.

## Current state

2026-09-25. Planning only. The governing documents are
[APPROACH.md](APPROACH.md) and the structure document above; the first implementation
campaign is [FIRST_STEP.md](FIRST_STEP.md), whose items A to G build the contracts,
the evaluator and its oracle, a five-example synthetic set and a clock-follower
baseline, with a read-only inventory of real recordings (R1) alongside. No contract
is frozen, no set exists, no candidate has run, and no research note has been written.
The previous experiment is archived under [archive/](archive/ARCHIVED.md); its
findings are historical and are not carried over as findings here.

## Findings

Status is `holds`, `superseded` or `withdrawn`. Evidence links a research note, a
ledger row (`ledger.md#<row>`), or a findings write-up.

| # | Finding | Evidence | Status | Since | Notes |
|---|---|---|---|---|---|
| | | | | | |

## Open questions

Ranked; the top row is the next question the driver asks. Status is `open`,
`in progress`, `answered` (with the finding number) or `stopped` (with the reason).

| Rank | Question | Why it is ranked here | Status | Owner item |
|---|---|---|---|---|
| 1 | How has real-time score following been evaluated elsewhere, and do our ±0.25-quarter tolerance and 200 ms deadline sit inside those norms? | FIRST_STEP §10 question 1; answers whether the first contract's tolerances are defensible before anything is measured against them | open | FIRST_STEP item A |
| 2 | Is there a published trivial baseline for score following, so our clock floor can be compared with the usual one? | FIRST_STEP §10 question 2; decides whether the first ledger row has an external reference point | open | FIRST_STEP item A |
| 3 | Which library recordings and re-amplification opportunities are eligible real evidence for the following milestone, and with what anchor precision? | The structure document runs real evidence alongside the pipeline; without an answer the first human-approved contract cannot name its evidence supply | open | FIRST_STEP item R1 |
| 4 | Does the first run of the clock follower over `harness-v1` reproduce the pre-registered predictions in FIRST_STEP §9? | The whole first step exists to answer it; a mismatch is an instrument defect, never a finding about the candidate | open | FIRST_STEP item G |

## Superseded and stopped

Rows moved here keep their original number or rank so citations stay valid.

| # or rank | Was | Superseded or stopped by | Date |
|---|---|---|---|
| | | | |
