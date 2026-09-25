# Readable experiment reports

Current result: [003 — Recognition at supplied sync](003-recognition-at-sync.html).
The diagnostic exposes weak positive recognition and frequent ties with nearby
positions in both frozen representations. Its private companion embeds audio and
similarity traces. Winner remains at four bars.

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
the report number. A new bounded experiment receives the next number and names every constituent run;
002 groups the initial comparison and its one predeclared revision as 002a and 002b.

| Number | Readable report | Recorded run |
|---|---|---|
| 001 | [Initial two-scale assessment](001-initial-two-scale.html) | [g001-clock-harness-v1](../runs/g001-clock-harness-v1/report.md) |
| 002 | [Winner with sync interpolation](002-winner-sync-proxy.html) | [002a](../runs/g002a-spectral1-winner-sync-proxy/summary.json), [002b](../runs/g002b-spectral2-winner-sync-proxy/summary.json) |
| 003 | [Recognition at supplied sync](003-recognition-at-sync.html) | [g003-recognition-at-sync](../runs/g003-recognition-at-sync/summary.json) |

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
packet on this machine. It is preparation history, not a numbered experiment result; experiment 002 now
records the actual comparisons under the subsequent development amendment. Rebuild it with `node experiments/performance-listening/reports/export-evidence-review.mjs`;
add `--check` to verify that it matches its sources. Export also verifies the approved
contract snapshot against the SHA-256 in its approval record.

## Loop readiness checkpoint

[Research loop readiness](loop-readiness.html) records v2 instrument verification,
the user's source confirmation and the historical bar-anchor sensitivity calculation.
It now points to experiment 002 and explains why manual beat review is optional for
initial proxy development, while independent precision matters for stronger claims.
Rebuild with `node experiments/performance-listening/reports/export-loop-readiness.mjs`
and verify with `--check`. Private embedded playback/beat-review pages are generated
outside git; the report source lists their commands.

## Rebuild report 002

```sh
node experiments/performance-listening/reports/export-sync-proxy.mjs
node experiments/performance-listening/reports/export-sync-proxy.mjs --check
node experiments/performance-listening/reports/export-private-sync-proxy.mjs /home/williao/dev/mnx-listening-data/real-evidence-01
node experiments/performance-listening/reports/export-private-sync-proxy.mjs /home/williao/dev/mnx-listening-data/real-evidence-01 --check
```

The public exporter verifies every pinned implementation/policy hash in both runs.
The private exporter verifies the saved evaluation hashes and reviewed WAV identity;
it refuses output inside a git checkout. Both are presentation-only. The private page
uses native WAV playback and inline SVG/JavaScript, with no server or network requests.

## Rebuild report 003

```sh
node experiments/performance-listening/reports/export-recognition.mjs
node experiments/performance-listening/reports/export-recognition.mjs --check
node experiments/performance-listening/reports/export-private-recognition.mjs /home/williao/dev/mnx-listening-data/real-evidence-01
node experiments/performance-listening/reports/export-private-recognition.mjs /home/williao/dev/mnx-listening-data/real-evidence-01 --check
```

The public exporter verifies pinned diagnostic sources. The private exporter checks
the recorded frame hash and reviewed WAV, then embeds native audio and clickable
similarity traces. No server or network request is needed. The offline page's script,
audio and graph data are checked; its browser interaction has not been verified via
the browser tool, which blocks file navigation.
