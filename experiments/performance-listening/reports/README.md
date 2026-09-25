# Readable experiment reports

Open [001 — Initial two-scale assessment](001-initial-two-scale.html) in a browser.
It contains a plain-language summary, the complete recorded run report, and the R1
evidence inventory. It is a self-contained local HTML file: no server, install,
JavaScript or network request is needed to read it. Expand the two evidence sections
for the detailed tables. Browser Find works after opening the relevant section.

From the repository root on Linux:

```sh
xdg-open experiments/performance-listening/reports/001-initial-two-scale.html
```

## Names and evidence

Use `NNN-short-description.html` for readable reports, with a matching Markdown
summary. Numbers increase within the active performance-listening experiment and
are not reused; archived work retains its original names. Each summary names the
exact recorded run ID, candidate, set and evaluator. A presentation-only update keeps
the report number. A new assessment receives the next number and names its new run.

| Number | Readable report | Recorded run |
|---|---|---|
| 001 | [Initial two-scale assessment](001-initial-two-scale.html) | [g001-clock-harness-v1](../runs/g001-clock-harness-v1/report.md) |

The run directory remains the original machine-readable evidence. Do not rename or
rewrite its decisions, counts, metadata or report when improving the HTML. The
[research log](../RESEARCH_LOG.md) is the current state; the [ledger](../ledger.md)
records runs. The HTML is a reading copy with source hashes, not another assessment.
The R1 section reproduces the approved local inventory snapshot, not a live library
query or newly qualified evidence.

## Rebuild report 001

Edit [the summary](001-initial-two-scale.md) or the presentation in the exporter, then:

```sh
node experiments/performance-listening/reports/export-html.mjs
node experiments/performance-listening/reports/export-html.mjs --check
```

The exporter uses Node built-ins only. It reads the summary, saved run report and
approved R1 note without running a candidate or changing any scientific record. Its
small Markdown reader supports the constructs in these three documents; it is not
a general-purpose Markdown library. The generated HTML is committed so it opens
immediately after checkout. It embeds both evidence documents and has optional links
back to the source files when kept in this checkout. To print all evidence, expand
both sections before using the browser's Print command.

## Preparation reviews

[Four-bar real-evidence preparation](real-evidence-review.html) contains the approval record, exact reviewed
contract snapshot and the current preparation record, with a link to the private listening
packet on this machine. It is not a numbered experiment result: report 002 is reserved
for an actual new assessment. Rebuild it with `node experiments/performance-listening/reports/export-evidence-review.mjs`;
add `--check` to verify that it matches its sources. Export also verifies the approved
contract snapshot against the SHA-256 in its approval record.

## Loop readiness checkpoint

[Research loop readiness](loop-readiness.html) records v2 instrument verification,
the user's source confirmation, the bar-anchor precision limit and the remaining
independent beat-review step. It is not experiment 002 or a candidate result.
Rebuild with `node experiments/performance-listening/reports/export-loop-readiness.mjs`
and verify with `--check`. Private embedded playback/beat-review pages are generated
outside git; the report source lists their commands.
