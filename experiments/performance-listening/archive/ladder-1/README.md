# The first series: experiments 001–021 (archived)

Archived on 2026-09-30, when the user directed a fresh experimental context under
[development contract 2](../../contracts/development-contract-2.md). The work here
built the instruments, the synthetic ladder and the Studio seam, and developed the
`online-time-warp` listener family to version 14 under
[development contract 1](../../contracts/development-contract-1.md). It measured a live
cursor at ±¼ quarter against steady, near-handed tempo, which is why it was set aside.

- [Research log](RESEARCH_LOG.md): the final state, every finding and question. Its
  lessons that still apply are carried into [the current log](../../RESEARCH_LOG.md#inherited-lessons).
- [Ledger](ledger.md): one row per run, 001–021.
- [Reports](reports/README.md), with their readable HTML copies.
- [Runs](runs/): the public run summaries. Private records stay in
  `mnx-listening-data/ladder-winner-v1/runs/` and `mnx-listening-data/real-evidence-01/`.
- [FIRST_STEP.md](FIRST_STEP.md): the completed plan that built the contracts, the v1
  instrument and the pipeline.

Nothing here is edited except to keep its links resolving. Report and run documents
cite their own commit's source hashes, so later work on the bench never invalidates
them. The ladder-specific exporters moved here with the reports; they are historical
and may need path changes to rerun. The code these experiments ran stays in `bench/`,
where the listeners are frozen as baselines; [the bench README](../../bench/README.md#the-code-under-contract-2)
maps it.
