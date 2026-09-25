# F-001: revise, do not adopt

Implementation loop · 2026-09-13. The fixed harmonic parent F-000 remains the default.

Twelve frozen configurations were measured on 102 existing cases, with three processing
passes each. No configuration met the acceptance rules. The deterministic diagnostic choice
was **F-001-01**: rise threshold 0.15, refractory 90 ms, association 35 ms. Its selection
was locked before scoring 30 new cases across the same three instruments. Held-out results
also failed. All 102 parent musical outputs and decision samples matched the archived baseline.

| Measure | Development parent → candidate | Held-out parent → candidate |
|---|---|---|
| Repeated attack precision | 8.0% → 20.7% | 11.6% → 27.6% |
| Repeated attack recall | 50.0% → 66.7% | 36.7% → 70.0% |
| Repeated attack F1 | 13.8% → 31.6% | 17.6% → 39.6% |
| Overall attack recall | 75.3% → 36.2% | 59.0% → 47.4% |
| Overall attack F1 | 27.7% → 26.2% | 20.2% → 29.6% |
| Active-pitch F1 | 61.5% → 38.8% | 52.5% → 36.6% |
| False accusations | 896 → 341 | 332 → 135 |
| Missed unexpected attacks | 3 → 9 | 0 → 0 |
| Unassessed target attacks | 72 → 161 | 32 → 41 |

Repeat counts are 9 TP / 103 FP / 9 FN → 12 / 46 / 6 on development, and
11 / 84 / 19 → 21 / 55 / 9 on held-out. Fewer accusations come with substantially
more unassessed material; they cannot be read as reliable assessment. Held-out cases contain
no deliberate wrong-note mutations, so their zero missed-unexpected count is not evidence
of error-detection coverage. Development retains the existing error cases.

## Cost and latency

Median total processing increased **5.33%** on development and **5.24%** on held-out,
within the provisional 25% budget. Timing passes are retained in each summary. The local
Node replay excludes initialization, microphone capture, browser scheduling and display.

| Timing | Development parent → candidate | Held-out parent → candidate |
|---|---|---|
| Matched-attack p95 | 134.00 → 105.59 ms | 157.68 → 128.18 ms |
| Maximum replay backlog | 4.95 → 5.01 ms | 5.32 → 2.52 ms |
| Common matched-truth p95 | 81.54 → 81.56 ms (80 attacks) | 99.06 → 99.11 ms (21 attacks) |

The overall latency reduction mostly changes the matched population; common matches show
essentially unchanged timing. Development repeat-only p95 actually rises 77.1 → 130.7 ms
as additional attacks are recovered. The frozen latency gate was pooled and common-match,
not a per-category timing gate. Do not claim faster re-strike decisions from these results.

## What failed and what to try next

All settings lost excessive active-pitch coverage and strum accuracy. The chosen setting
reduced development strum attack F1 from 16.2% to 0%; held-out from 24.2% to 5.9%.
Active arpeggio F1 fell 53.2% → 28.0% and 52.4% → 34.3%, respectively.

The current coupling makes a recent attack a prerequisite for maintaining a recovered
pitch track after a dropout. That can discard useful pitch evidence. A diagnostic replay
of development nylon strum found MIDI 52 first crossed the pitch threshold 46.4 ms after
its last spectral rise, and MIDI 56 after 139.3 ms: both outside the chosen 35 ms window.
This is an illustrative mechanism, not a complete causal attribution. Tentative starts
also consume a crossing before persistence confirms them. Shared harmonics remain a risk.

**Next experiment:** separate ongoing pitch presence from attack decisions. First isolate
the re-strike-only contribution while preserving the parent’s pitch tracks; then decide
whether onset association needs different timing or confirmation rules. Freeze a new
protocol and fresh held-out cases before tuning. Do not simply promote the least-bad
setting or widen windows against the already-inspected held-out results.

## All tried configurations

| ID | Threshold | Refractory ms | Association ms | Repeat F1 | Overall attack F1 | Active F1 | Extra processing | Eligible |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| F-001-01 | 0.15 | 90 | 35 | 31.6% | 26.2% | 38.8% | 5.33% | No |
| F-001-02 | 0.15 | 90 | 70 | 27.0% | 33.8% | 52.2% | 5.47% | No |
| F-001-03 | 0.15 | 160 | 35 | 31.6% | 26.2% | 38.8% | 4.91% | No |
| F-001-04 | 0.15 | 160 | 70 | 27.3% | 33.9% | 52.2% | 5.06% | No |
| F-001-05 | 0.3 | 90 | 35 | 21.6% | 26.3% | 39.4% | 5.12% | No |
| F-001-06 | 0.3 | 90 | 70 | 20.0% | 34.5% | 52.8% | 5.54% | No |
| F-001-07 | 0.3 | 160 | 35 | 21.6% | 26.1% | 38.9% | 5.66% | No |
| F-001-08 | 0.3 | 160 | 70 | 20.0% | 34.3% | 52.4% | 5.42% | No |
| F-001-09 | 0.5 | 90 | 35 | 21.9% | 25.2% | 38.2% | 5.59% | No |
| F-001-10 | 0.5 | 90 | 70 | 21.3% | 33.8% | 51.7% | 6.46% | No |
| F-001-11 | 0.5 | 160 | 35 | 21.9% | 25.2% | 38.2% | 5.41% | No |
| F-001-12 | 0.5 | 160 | 70 | 21.3% | 33.6% | 51.4% | 5.64% | No |

Exact failure reasons and per-category/per-preset counts: [development summary](development-summary.json)
and [held-out summary](heldout-summary.json). The [selection lock](selection.json) precedes
held-out evaluation; [decision](decision.json) retains both failures. [Provenance](provenance.json)
pins configuration, measured source hashes and machine. Detector/scorer/evaluator hashes
identify the measured implementation; later runner changes only make archive paths portable
and add timing checkpoints. Full predictions for every sweep setting remain in ignored
`output/fusion-attack-v1`; committed case JSONL retains parent and selected predictions.
The audio manifests pin both frozen inputs; keep original WAVs for exact replay.

This is evidence on synthetic playback and these sample packs, not generalization to a
microphone, a different guitar, or a player. The new schedules become regression evidence now.
