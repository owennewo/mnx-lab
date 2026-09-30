# Experiment reports

One file per numbered experiment, `NNN-short-description.md`, with a readable HTML copy
beside it. Numbering continues from the first series, so the first report here is 022.
Current state and the next question are in [the research log](../RESEARCH_LOG.md),
not here. The first series' reports, 001–021, are in
[the archive](../archive/ladder-1/reports/README.md).

| Number | Readable report | Recorded runs |
|---|---|---|
| 022 | [Event instruments, stage 1 and the frozen baselines](022-event-instruments.html) | [g022](../runs/g022-stage1-baselines/summary.json) |
| 023 | [The user's decisions in the instruments, and stage 1's controls](023-instruments-decisions.html) | [g023](../runs/g023-stage1-controls/summary.json) |
| 024 | [A fresh event listener on the sine happy path](024-event-chain-stage1.html) | [g024](../runs/g024-event-chain-stage1/summary.json) |

## One experiment, one file

Its pre-registration section is committed and landed before anything runs: the
question, the stage and evidence, the listeners, numbered predictions, what would
contradict them, and decision rules. The results are appended to the same file after
the run, so git dates the prediction; the pre-registration never changes. The
experiment adds one [ledger](../ledger.md) row and one row in [reports.json](reports.json),
which the shared exporter renders. It adds no exporter of its own, and no contract file
except a new version of an instrument definition (`contracts/event-instruments-N.md`).
[RUNNING_AN_EXPERIMENT.md](../RUNNING_AN_EXPERIMENT.md) is the procedure.

## Rebuilding the readable copies

```sh
node experiments/performance-listening/reports/export-report.mjs            # every registered report
node experiments/performance-listening/reports/export-report.mjs 022        # one report
node experiments/performance-listening/reports/export-report.mjs --check    # verify without writing
```

The exporter reads each registered report's run summaries from `runs/` and checks
every source hash they pin against the run's own commit. `serve-private-review.mjs`
serves a private review folder over localhost; private audio never enters git.
