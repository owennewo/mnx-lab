# Readable experiment reports

Numbered, self-contained HTML reading copies of each experiment. They open in a
browser without a server, install or network request. Current state and the next
question are in [the research log](../RESEARCH_LOG.md), not here.

| Number | Readable report | Recorded run |
|---|---|---|
| 001 | [Initial two-scale assessment](001-initial-two-scale.html) | [g001-clock-harness-v1](../runs/g001-clock-harness-v1/report.md) |
| 002 | [Winner with sync interpolation](002-winner-sync-proxy.html) | [002a](../runs/g002a-spectral1-winner-sync-proxy/summary.json), [002b](../runs/g002b-spectral2-winner-sync-proxy/summary.json) |
| 003 | [Recognition at supplied sync](003-recognition-at-sync.html) | [g003-recognition-at-sync](../runs/g003-recognition-at-sync/summary.json) |
| 004 | [Rung 0: clean Winner](004-rung0-clean-winner.html) | [g004-rung0-clean-winner](../runs/g004-rung0-clean-winner/summary.json) |
| 005 | [Rung 0: online time-warping comparator](005-online-time-warp-rung0.html) | [g005-oltw-rung0](../runs/g005-oltw-rung0/summary.json) |
| 006 | [Rung 0: sequence-based support](006-sequence-support-rung0.html) | [g006-sequence-support-rung0](../runs/g006-sequence-support-rung0/summary.json) |
| 007 | [Rung 1: tempo](007-rung1-tempo.html) | [g007-rung1-tempo](../runs/g007-rung1-tempo/summary.json) |
| 008 | [Rung 2: recorded guitar samples](008-rung2-guitar-samples.html) | [g008-rung2-guitar-samples](../runs/g008-rung2-guitar-samples/summary.json) |
| 009 | [A reference that decays like a plucked string](009-plucked-reference.html) | [g009-plucked-reference](../runs/g009-plucked-reference/summary.json) |
| 010 | [The slim suite, and what misleads the alignment](010-slim-suite-and-burst-features.html) | [g010a](../runs/g010a-slim-suite/summary.json), [g010b](../runs/g010b-burst-features/summary.json) |
| 011 | [The alignment path and the support test](011-path-and-support.html) | [g011-path-and-support](../runs/g011-path-and-support/summary.json) |

## One experiment, one file

From experiment 004 on, a numbered experiment is one file, `NNN-short-description.md`.
Its pre-registration section is committed before the run: question, rung or evidence,
candidates, prediction and what would contradict it. The results are appended to the
same file after the run, so git dates the prediction. The experiment adds one
[ledger](../ledger.md) row and one row in [reports.json](reports.json), which the shared
exporter renders. It adds no contract file and no exporter of its own.
[Development contract 1](../contracts/development-contract-1.md#records) sets this rule.
Experiments 002 and 003 predate it and keep their separate pre-run plans.

Numbers increase and are never reused; archived work keeps its original names. A
presentation-only update keeps the number. A report names every constituent run; 002
groups an initial comparison and its one predeclared revision as 002a and 002b.

The run directory remains the original machine-readable evidence. Do not rename or
rewrite its decisions, counts, metadata or report when improving the HTML. The HTML
is a reading copy with source hashes, not another assessment.

## Rebuild

From the repository root:

```sh
node experiments/performance-listening/reports/export-report.mjs            # every registered report
node experiments/performance-listening/reports/export-report.mjs 003        # one report
node experiments/performance-listening/reports/export-report.mjs --check    # verify without writing
```

The shared exporter checks every source hash a registered run pins against the commit
that run recorded, so later edits to the same files never invalidate an earlier
report. It then renders the summary and embeds each run's aggregate evidence. It uses
Node built-ins only; its small Markdown reader supports headings, paragraphs, bullets
and tables.

Report 001 has a different layout, with the R1 evidence inventory embedded, and keeps
its own exporter:

```sh
node experiments/performance-listening/reports/export-html.mjs
node experiments/performance-listening/reports/export-html.mjs --check
```

## Preparation review

[Four-bar real-evidence preparation](real-evidence-review.html) contains the approval
record, the exact reviewed contract snapshot and the preparation record, with a link
to the private listening packet on this machine. It is approval history, not a
numbered result. Rebuild it with `export-evidence-review.mjs`; add `--check` to verify
it. Export also verifies the approved contract snapshot against its approval record.

## Private playback

Audio, scores and per-frame traces stay outside git, in
`/home/williao/dev/mnx-listening-data/real-evidence-01/`. Each exporter below refuses
to write inside a git checkout and checks the recorded hashes before embedding audio.
The pages use native WAV playback with no server or network request.

```sh
D=/home/williao/dev/mnx-listening-data/real-evidence-01
node experiments/performance-listening/reports/export-private-sync-proxy.mjs $D    # 002 traces
node experiments/performance-listening/reports/export-private-recognition.mjs $D   # 003 traces
node experiments/performance-listening/reports/export-private-listening.mjs $D     # both four-bar clips
node experiments/performance-listening/reports/export-beat-review.mjs $D           # optional beat bounds
node experiments/performance-listening/reports/serve-private-review.mjs $D         # same pages over localhost
```

These per-experiment private exporters predate the one-renderer rule. From 004 on,
runs write their traces in one shape so a single private page plays any run.
Browser automation blocks `file://` navigation, so the offline pages have not been
interactively verified through that tool; playback over localhost was checked in
Chrome.
