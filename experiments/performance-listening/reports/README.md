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

| 031 | [Report bar flags against the other bars, in a full sweep](031-other-bars-reporting.html) | Unresolved infrastructure: [g031](../runs/g031-reporting-sweep/summary.json) and [g031a](../runs/g031a-reporting-sweep/summary.json), both preserved failures; completed by [g031b](../runs/g031b-reporting-sweep/summary.json), D1 |

| 032 | [Hold through a hesitation while the preceding note sounds](032-held-note-hesitation.html) | [g032](../runs/g032-held-note-hesitation/summary.json), D1 |

| 033 | [One rushed bar, on the two-bar scale and the four-bar melody](033-rushed-bar.html) | [g033](../runs/g033-rushed-bar/summary.json), D1 |

| 034 | [One missing interior event and the batch-end full sweep](034-missing-event-sweep.html) | [g034](../runs/g034-missing-event-sweep/summary.json), D1 |

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

| 035 | [Basic Pitch observations through the unchanged event chain](035-challenger-basic-pitch.html) | [g035](../runs/g035-challenger-basic-pitch/summary.json), D1 continuation; timing audit pending |
| 036 | [The incumbent on the challenger's guitar renders](036-incumbent-guitar.html) | [g036](../runs/g036-incumbent-guitar/summary.json), E2: the guitar renders separate the front ends |
| 037 | [Settle observation timing and count compute](037-challenger-observation-seam.html) | [g037](../runs/g037-challenger-observation-seam/summary.json), D1 implementation agreement; independent seam-2 audit required |

| 038 | [Quiet-noise controls for both unchanged listeners](038-challenger-quiet-noise.html) | [g038](../runs/g038-challenger-quiet-noise/summary.json), D1; nominal live only |
| 039 | [Dominant-pitch decoding for Martin’s wrong-score claims](039-challenger-dominant-pitch.html) | [g039](../runs/g039-challenger-dominant-pitch/summary.json), D1 component repair; live still unresolved |
| 040 | [Streaming state and the compute-inclusive seam](040-challenger-streaming-state.html) | [g040](../runs/g040-challenger-streaming-state/summary.json), D1 implementation agreement; independent seam-3 audit next, native cost/cursor open |
| 041 | [Incremental neural inference and seam 4](041-challenger-incremental-neural.html) | [g041a](../runs/g041a-challenger-incremental-neural/summary.json), D1 exploratory; [g041](../runs/g041-challenger-incremental-neural/summary.json) invalid timing preserved; independent audit next |
| 042 | [Finish state and safe offline lengths](042-challenger-finish-length.html) | [g042](../runs/g042-challenger-finish-length/summary.json), D1 author agreement; independent seam-5 audit and 041 implementation review before stage verdict |
| 043 | [Timer attribution and formal guitar stage](043-challenger-guitar-stage.html) | [g043](../runs/g043-challenger-guitar-stage/summary.json), D2: cost/deadline failures |
| 044 | [Trace the no-inference service stalls](044-challenger-stall-diagnosis.html) | [g044](../runs/g044-challenger-stall-diagnosis/summary.json), D3: no attribution; batch stops at 8 of 10 |
| 045 | [Formal guitar stage on a quiet host](045-challenger-quiet-host-stage.html) | [g045](../runs/g045-challenger-quiet-host-stage/summary.json), D2: two Martin deadline misses; valid quiet host |
| 046 | [Full-workload service-stall attribution](046-challenger-full-workload-trace.html) | [g046](../runs/g046-challenger-full-workload-trace/summary.json), D3: no attribution; full workloads do not reproduce stalls |
| 047 | [Reuse streaming input/window buffers](047-challenger-input-buffers.html) | [g047](../runs/g047-challenger-input-buffers/summary.json), D1 resource variant: complete parity, explicit window allocations reduced; no stage claim |
| 048 | [Stop copying unused live neural outputs](048-challenger-output-copies.html) | [g048](../runs/g048-challenger-output-copies/summary.json), D1 resource variant: 80% fewer targeted slice/copy bytes, complete fresh parity; no stage claim |
