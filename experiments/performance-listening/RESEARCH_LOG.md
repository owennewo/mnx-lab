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

2026-09-25. A is landed. B/C now provide the independent evaluator, eleven hand-worked
oracle cases and single/pair reports; no listener exists and no candidate has run.
The oracle pins persistence, pending claims and abstention before the pipeline is
built. Instrument contracts remain draft and the research contract is provisional,
not human-approved. Next: the five-example score/set records (D) and the read-only
real-source inventory (R1), then generator, runner and the clock floor.

## Findings

Status is `holds`, `superseded` or `withdrawn`. Evidence links a research note, a
ledger row (`ledger.md#<row>`), or a findings write-up.

| # | Finding | Evidence | Status | Since | Notes |
|---|---|---|---|---|---|
| 1 | The published evaluation distinguishes alignment error from reporting latency; its example threshold does not validate our musical-position tolerance or deadline. | [Cont 2007 note](research/cont-2007-evaluation.md), [MIREX note](research/mirex-2015.md) | holds | 2026-09-25 | Instrument tolerances unchanged |
| 2 | The bounded search found no published audio-ignoring clock floor with comparable numbers. | [Search outcome](research/trivial-baseline-search.md) | holds | 2026-09-25 | An unsuccessful search, not a claim of absence |
| 3 | The root gate needed an explicit workspace suite for the listening bench and its disk-read evidence. | [Gate rule](../../tools/gate.mjs), [contract test](bench/test/contracts.test.ts) | holds | 2026-09-25 | Item A; production boundary already exists |
| 4 | The oracle distinguishes loss, abstention and live exposure; backdated corrections preserve the wrong live claim until replaced. | [Oracle arithmetic](bench/oracle/README.md), [o4 report](bench/oracle/o4-lost-then-found/report.md), [pair report](bench/oracle/comparison-o1-o4.md) | holds | 2026-09-25 | B/C instrument evidence; no listener result |

## Open questions

Ranked; the top row is the next question the driver asks. Status is `open`,
`in progress`, `answered` (with the finding number) or `stopped` (with the reason).

| Rank | Question | Why it is ranked here | Status | Owner item |
|---|---|---|---|---|
| 1 | How has real-time score following been evaluated elsewhere, and do our ±0.25-quarter tolerance and 200 ms deadline sit inside those norms? | FIRST_STEP §10 question 1; answers whether the first contract's tolerances are defensible before anything is measured against them | answered (findings 1–2) | FIRST_STEP item A |
| 2 | Is there a published trivial baseline for score following, so our clock floor can be compared with the usual one? | FIRST_STEP §10 question 2; decides whether the first ledger row has an external reference point | answered (findings 1–2) | FIRST_STEP item A |
| 3 | Which library recordings and re-amplification opportunities are eligible real evidence for the following milestone, and with what anchor precision? | The structure document runs real evidence alongside the pipeline; without an answer the first human-approved contract cannot name its evidence supply | open | FIRST_STEP item R1 |
| 4 | Does the first run of the clock follower over `harness-v1` reproduce the pre-registered predictions in FIRST_STEP §9? | The whole first step exists to answer it; a mismatch is an instrument defect, never a finding about the candidate | open | FIRST_STEP item G |

## Superseded and stopped

Rows moved here keep their original number or rank so citations stay valid.

| # or rank | Was | Superseded or stopped by | Date |
|---|---|---|---|
| | | | |
