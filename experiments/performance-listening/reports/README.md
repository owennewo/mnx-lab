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
| 025 | [One hesitation on the same sine scores](025-single-hesitation.html) | [g025](../runs/g025-single-hesitation/summary.json) |
| 026 | [One slowed bar on the same sine scale](026-single-slowed-bar.html) | [g026](../runs/g026-single-slowed-bar/summary.json) |

| 027 | [Confirm live pitch evidence before committing](027-live-confirmation.html) | [g027a](../runs/g027a-live-confirmation/summary.json), [preserved g027 preflight failure](../runs/g027-live-confirmation/summary.json) |

| 028 | [Other-bars tempo reference and a recorded rising tide](028-other-bars-suite.html) | [g028](../runs/g028-other-bars-suite/summary.json) |

| 029 | [Correct and complete the event oracle](029-oracle-coverage.html) | [g029](../runs/g029-oracle-coverage/summary.json) |

| 030 | [Revalidate the incumbent with audited current instruments](030-current-instruments.html) | [g030](../runs/g030-current-instruments/summary.json) |

## One experiment, one file

Its pre-registration section is committed and landed before anything runs: the
question, the stage and evidence, the listeners, numbered predictions, what would
contradict them, and decision rules. The results are appended to the same file after
the run, so git dates the prediction; the pre-registration never changes. The
experiment adds one [ledger](../ledger.md) row and one row in [reports.json](reports.json),
which the shared exporter renders. It adds no exporter of its own, and no contract file
except a new version of an instrument definition (`contracts/event-instruments-N.md`).
[PROMPT_EXPERIMENTER.md](../PROMPT_EXPERIMENTER.md) is the procedure.

## Rebuilding the readable copies

```sh
node experiments/performance-listening/reports/export-report.mjs            # every registered report
node experiments/performance-listening/reports/export-report.mjs 022        # one report
node experiments/performance-listening/reports/export-report.mjs --check    # verify without writing
```

The exporter reads each registered report's run summaries from `runs/` and checks
every source hash they pin against the run's own commit. `serve-private-review.mjs`
serves a private review folder over localhost; private audio never enters git.
