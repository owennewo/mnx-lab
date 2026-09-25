# F-005: partial spectral whitening

Implementation loop · 2026-09-13 · parent F-003 · **revise; not adopted**.

Partial whitening improves true-note coverage, including the weak A2 and mixed A4
controls that motivated this work. It does not resolve E2. General attack precision
remains poor, development false accusations increase, some categories regress, and
fresh-set processing exceeds the provisional budget. F-000 stays default and F-003
remains the preferred earlier experimental reference. F-005 is a measured component
candidate, not a reliable player grader or a replacement default.

## Frozen experiment

[Protocol and all summaries](summary.json) · [per-case public results](cases.jsonl) ·
[technique and configuration](../../fusion-techniques/spectral-whitening.md).
Measured local pre-rebase implementation/protocol revision: `18e2d9b`, with detector
hashes recorded in the protocol. The algorithm was frozen before running;
subsequent source formatting was verified equivalent by syntax-tree comparison
(disregarding empty statements). The committed source includes that formatting and
a JSONL export change; neither changes the measured detector. No threshold recalibration,
new harmonic model, analysis-window/hop adjustment or event-rule change was made.

Thirty triangular bands follow Klapuri 2006 section 2.1. Envelope standard deviations
produce gains proportional to inverse envelope strength; gains are linearly interpolated
between band centres, with nearest-band gain outside the centre range. Strengths were
0 (exact bypass), 0.25, 0.50 and 0.67; the relative envelope floor was 1e-4 and gain cap
16. The implementation normalises band amplitudes to the frame's strongest band before
flooring/capping. It retains our FFT rather than adopting the paper's zero-padding and
uses no temporal smoothing. This is a bounded adaptation, not a reproduction of the
whole published estimator. [Paper](https://archives.ismir.net/ismir2006/paper/000125.pdf).

Only pitch-scorer input is whitened. Attack flux retains raw magnitudes; neighbour
attribution consumes the resulting pitch coefficients. The fixed 1/h dictionary,
activity threshold 0.22, 4096-sample trailing context, 256-sample hop and two-frame
confirmation remain unchanged. Coefficients are not probabilities; changing the frontend
can change the significance of a fixed threshold and its interaction with re-strikes.

## Development selection: 252 archived public cases

Original 102 evaluation cases plus the four previous held-out sets (30 + 36 + 42 + 42),
covering all three presets. These are now development material. Selection maximised
pooled onset F1, ties preferring lower strength; private diagnostics were excluded.

| Strength | Correct attacks | Extras | Attack score /100 | Active-pitch score /100 |
|---|---:|---:|---:|---:|
| 0 | 541/681 | 2565 | 28.6 | 57.8 |
| 0.25 | 560/681 | 2759 | 28.0 | 60.7 |
| 0.5 | 581/681 | 2786 | 28.7 | 64.8 |
| 0.67 | 598/681 | 2711 | 30.0 | 67.8 |

0.67 wins the declared selection rule, but selection is not acceptance. False accusations
increase from 2,563 to 2,711; these differ slightly from extra detections because assessment
compares with the target score, while pitch accuracy compares with the actual render.
The masking, repeated, bend, MNX and re-strike category F1 drops exceed the allowed 2 points.
In particular re-strike F1 falls from 51.9 to 31.6 on its small development category.
These are real counterexamples to claiming an unqualified improvement.

## Fresh confirmation: 42 cases, 96 attacks

Fourteen new patterns rendered through each of guitar, guitar2 and piano. The setting
was locked before these were evaluated; no tuning followed. The source fixtures and
[render manifest](audio-manifest.json) identify the public audio inputs.

| Recipe | Correct attacks | Extras | Attack score /100 | Active-pitch score /100 |
|---|---:|---:|---:|---:|
| F-003 | 64/96 | 462 | 20.6 | 47.3 |
| F-005 (0.67) | 85/96 | 430 | 27.8 | 63.8 |

All three presets improve pooled attack F1. The candidate gains 22 matched truth
identities and loses one (a true note in guitar2's quiet-inner chord), net +21. Genuine
octave attacks found rise from 8/12 to 11/12, while extras in those octave cases rise
from 75 to 80. Pure silence stays silent; microphone/background-noise behaviour is
unmeasured. No fresh category breaches the aggregate F1-drop allowance, which does not
mean every true note is preserved.

## Private diagnostic controls

These use the previously frozen WAVs and contribute no tuning decisions. The four-bar
result preserves causal context by replaying the preceding audio. Unmatched onsets use
the same 100 ms early bar-allocation boundaries as the earlier diagnosis, not the first
whole-piece report's strict clock-boundary rows.

| Strength | Bars 5–8 attacks found | Extras | Attack score /100 |
|---|---:|---:|---:|
| 0 | 16/21 | 27 | 50.0 |
| 0.25 | 16/21 | 31 | 47.1 |
| 0.5 | 19/21 | 35 | 50.7 |
| 0.67 | 19/21 | 30 | 54.3 |

At 0.67: A2 alone is recovered; E2 alone remains missed; A4 alone stays detected; E2+A4
recovers A4 while still missing E2. In the four bars, both A2 attacks and the mixed A4
are recovered. The two remaining misses are E2. This supports the usefulness of reducing
timbre dependence without showing that preprocessing alone solves weak fundamentals.
No new whole-piece score is claimed. Private schedules, PCM and detailed predictions
remain in ignored local output; the committed report carries aggregates only.

## Timing and cost

Three counterbalanced passes over the same fresh audio produced median streaming
processing totals of **6.053 s for F-003 and 7.660 s for F-005**, a **26.5% increase**
against the 25% budget. Per-pass totals are in the summary. These are elapsed processing
measurements on the recorded machine, excluding setup, sample loading, rendering and
evaluation; they are not a target-device CPU guarantee. Development costs are single-pass
screening measurements and were not used for the cost decision.

For the 63 attacks matched by both recipes, simulated-emission p95 latency falls from
167 ms to 129 ms. Matching identities avoids comparing different successful-note subsets;
onset estimates can still differ. The algorithm adds no future-audio context or gate delay.

## Decision and next questions

**Revise; keep disabled by default.** Reject adoption because of development false
accusations/category regressions and fresh processing cost. Retain the measured recipe
as a candidate for later fusion work. Do not describe this as either a complete fix or
evidence that whitening as a class fails. Only one envelope design and gain cap were
tried, with fixed downstream thresholds.

The next agreed experiment is the flexible harmonic model with whitening bypassed.
Then a separately recorded combined trial can test their interaction. Potential later
whitening work includes scorer-threshold calibration, bounded implementation optimisation,
and checking the unchanged raw attack branch against changed pitch coefficients. These
remain untried; no extra sweep was conducted after seeing the fresh results.

## Reproduction and checks

Run from the repository root; `LISTENING_ARCHIVE_ROOT` points to the frozen prior audio
and private controls. Use fresh output directory names: completed stages refuse overwrite.

```sh
npm --prefix experiments/performance-listening test
LISTENING_ARCHIVE_ROOT=/path/to/frozen/output node experiments/performance-listening/experiments/fusion-whitening.mjs development /path/to/new-run
node experiments/performance-listening/rendering/render.mjs /path/to/new-audio --fusion-heldout-v5
node experiments/performance-listening/experiments/fusion-whitening.mjs heldout /path/to/new-run /path/to/new-audio
LISTENING_ARCHIVE_ROOT=/path/to/frozen/output node experiments/performance-listening/experiments/fusion-whitening.mjs diagnostics /path/to/new-run
node experiments/performance-listening/experiments/fusion-whitening.mjs export /path/to/new-run /path/to/new-report
```

Use archived WAVs for exact comparisons; new browser renders may differ in floating-point
roundoff. The run records input audio hashes and detector hashes; the fresh render manifest
records browser, sample-pack and renderer provenance. Tests cover exact bypass, silence,
bounded gain, amplitude-scale invariance, peak locations, causal prefixes and delivery
chunk invariance. No production app imports or defaults change.
