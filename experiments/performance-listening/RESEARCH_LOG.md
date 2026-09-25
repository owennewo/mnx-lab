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

2026-09-25. The synthetic first step remains complete and reproducible. Real-evidence
preparation is now active: the user selected The Winner Takes It All, then Dust in
the Wind, starting with four performed bars and expanding only on measured success.
Private playable review crops and structural preflight are ready; no real interval
has been independently approved or frozen. Research contract 1 is drafted for the
confirmed solo-guitar/microphone/laptop scope but is not approved. Before comparison,
we need source/label review and a separately versioned real-audio instrument that
handles annotation uncertainty. No audio-driven candidate or retention run has begun.
See the [preparation record](evidence/README.md) and [contract draft](contracts/research-contract-1-draft.md).

Readable overview and complete evidence: [001 — Initial two-scale assessment](reports/001-initial-two-scale.html).

## Findings

Status is `holds`, `superseded` or `withdrawn`. Evidence links a research note, a
ledger row (`ledger.md#<row>`), or a findings write-up.

| # | Finding | Evidence | Status | Since | Notes |
|---|---|---|---|---|---|
| 1 | The published evaluation distinguishes alignment error from reporting latency; its example threshold does not validate our musical-position tolerance or deadline. | [Cont 2007 note](research/cont-2007-evaluation.md), [MIREX note](research/mirex-2015.md) | holds | 2026-09-25 | Instrument tolerances unchanged |
| 2 | The bounded search found no published audio-ignoring clock floor with comparable numbers. | [Search outcome](research/trivial-baseline-search.md) | holds | 2026-09-25 | An unsuccessful search, not a claim of absence |
| 3 | The root gate needed an explicit workspace suite for the listening bench and its disk-read evidence. | [Gate rule](../../tools/gate.mjs), [contract test](bench/test/contracts.test.ts) | holds | 2026-09-25 | Item A; production boundary already exists |
| 4 | The oracle distinguishes loss, abstention and live exposure; backdated corrections preserve the wrong live claim until replaced. | [Oracle arithmetic](bench/oracle/README.md), [o4 report](bench/oracle/o4-lost-then-found/report.md), [pair report](bench/oracle/comparison-o1-o4.md) | holds | 2026-09-25 | B/C instrument evidence; no listener result |
| 5 | The vendor score compiles without adding event types or tempo; the fixed recipes distinguish positive tails from supported following and give the two controls different durations. | [Set records](sets/harness-v1/README.md), [score/set checks](bench/test/set.test.ts) | holds | 2026-09-25 | D; no generated audio yet |
| 6 | Deterministic sine generation reproduces the independently drafted note boundaries and following labels; compiler sink counts do not measure musical polyphony. | [Generator checks](bench/test/generate.test.ts), [manifest](generators/sine-v1.json) | holds | 2026-09-25 | E |
| 7 | The runner reproduces the independent oracle record with sample-clock stamps and isolated chunks; complete-record prefix checks catch divergent output identities. | [Runner tests](bench/test/runner.test.ts) | holds | 2026-09-25 | F; silence-only futures cannot discriminate causality |
| 8 | The available library snapshot supplies structural following candidates, but no source is ready to freeze without independent solo/route/precision and access evidence. | [Evidence inventory](research/evidence-inventory.md) | holds | 2026-09-25 | R1; no real-source qualification |
| 9 | The first end-to-end clock run agrees with the independent predictions and exposes false following and tempo drift; this validates the instrument at the synthetic harness profile, not listening capability. | [First run](ledger.md#g001-clock-harness-v1), [prediction and reproduction checks](bench/test/first-run.test.ts), [instrument freeze](contracts/freeze.json) | holds | 2026-09-25 | G; research contract remains provisional |
| 10 | The frozen v1 instrument cannot yet judge uncertain real-audio labels: its schema is generator-specific and its evaluator does not use annotation bounds. | [Contract prerequisite](contracts/research-contract-1-draft.md#instrument-prerequisite-and-activation), [v1 types](bench/src/types.ts), [v1 evaluator](bench/src/evaluate/index.ts) | holds | 2026-09-25 | A separate version is required before real comparisons |
| 11 | The selected first four-bar windows map structurally and decode reproducibly, while independent score/audio and precision checks remain open; Dust has a later route mismatch. | [Preflight snapshot](evidence/initial-four-bars-preflight.json), [preparation record](evidence/README.md) | holds | 2026-09-25 | Human review pending, no real golden |

## Open questions

Ranked; the top row is the next question the driver asks. Status is `open`,
`in progress`, `answered` (with the finding number) or `stopped` (with the reason).

| Rank | Question | Why it is ranked here | Status | Owner item |
|---|---|---|---|---|
| 1 | Can the user approve the draft numerical contract and independently check the selected four-bar source/label evidence? | Scope and sources are confirmed; playable review crops and a concrete draft now exist | in progress | [Real-evidence preparation](evidence/README.md) |
| 2 | How has real-time score following been evaluated elsewhere, and do our ±0.25-quarter tolerance and 200 ms deadline sit inside those norms? | FIRST_STEP §10 question 1; answers whether the first contract's tolerances are defensible before anything is measured against them | answered (findings 1–2) | FIRST_STEP item A |
| 3 | Is there a published trivial baseline for score following, so our clock floor can be compared with the usual one? | FIRST_STEP §10 question 2; decides whether the first ledger row has an external reference point | answered (findings 1–2) | FIRST_STEP item A |
| 4 | Which library recordings and re-amplification opportunities are eligible real evidence for the following milestone, and with what anchor precision? | The structure document runs real evidence alongside the pipeline; without an answer the first human-approved contract cannot name its evidence supply | answered (finding 8; missing evidence explicit) | FIRST_STEP item R1 |
| 5 | Does the first run of the clock follower over `harness-v1` reproduce the pre-registered predictions in FIRST_STEP §9? | The whole first step exists to answer it; a mismatch is an instrument defect, never a finding about the candidate | answered (finding 9) | FIRST_STEP item G |

## Superseded and stopped

Rows moved here keep their original number or rank so citations stay valid.

| # or rank | Was | Superseded or stopped by | Date |
|---|---|---|---|
| | | | |
