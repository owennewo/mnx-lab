# Explicit fundamental evidence

[Back to fusion log](../fusion-log.md)

- **ID:** fundamental-evidence
- **Role:** positive pitch evidence after greedy harmonic allocation.
- **Implementation:** optional [fundamental.mjs](../detectors/fundamental.mjs), called by the harmonic scorer.
- **Evidence:** [F-006 measured report](../findings/fusion-fundamental-v1/README.md).
- **Disposition:** revise; optional experiment, not a production default.

## Purpose and fit

A low note's fundamental can be weak relative to its upper harmonics but distinct from
its local spectral background. Greedy selection of upper pitches can erase the candidate's
harmonic score without explaining that low-frequency peak. Test a protected evidence term
for that remaining support, uniformly across MIDI 40–88. This is one ingredient for the
[flexible harmonic model](flexible-harmonic-model.md); the original 1/h dictionary remains.
It is not yet joint model selection or a fitted flexible harmonic envelope.

The feature estimates local peak prominence, not calibrated signal-to-noise probability.
It is positive-only: a missing fundamental does not reject an existing pitch hypothesis,
and finding a lower note does not automatically delete higher notes. Run with whitening
bypassed, F-003 attack/attribution rules fixed, and the same analysis window/hop.

For a candidate pitch, find a local peak in the nearest three FFT bins and estimate its
frequency with three-bin log-parabolic interpolation. Require agreement within half a
semitone. Compare the peak against the median of bins 3–7 away on either side, excluding
the main lobe. Also require approximate peak sinusoidal amplitude (4*peak/FFT size) to
exceed a small fraction of the window RMS. This is an amplitude guard, not an absolute
microphone noise-floor measurement.

The support factor is clipped log contrast: zero at contrast 4, one at contrast 16.
The proposed coefficient floor is strength × original harmonic projection × support.
Take the maximum of that floor and the original post-pursuit coefficient. Do not add
support when an already-selected lower pitch could explain this peak as its partial
2–12. That conservative guard cannot decide whether an overlapping higher note really
was played too; it leaves the original coefficient intact.

## Configuration

The five known E2/E3/B3 recordings informed this design and are development controls,
not fresh confirmation. Freeze the [plan](../experiments/fusion-fundamental.json) before
measuring the strength sweep. No pitch-specific exceptions or post-result thresholds.

| Parameter | Units / values | Availability | Tried grid / fixed choice | Interaction |
|---|---|---|---|---|
| `fundamental.strength` | Coefficient multiplier | Optional config | 0, 0.5, 0.75, 1 | Zero is exact bypass; candidate selection excludes bypass but acceptance compares against it |
| `minContrast`, `fullContrast` | Magnitude ratios | Optional config | 4, 16 | Local background is a proxy, not independently measured noise |
| `relativeAmplitudeFloor` | Peak amplitude / raw RMS | Optional config | 0.002 | Suppress tiny relative residues; can miss truly quiet fundamentals |
| Peak search / frequency tolerance | Bins / semitones | Fixed | Nearest bin ±1; interpolated frequency ±0.5 semitone | Avoid boosting adjacent pitches from the same FFT peak |
| Background offsets | FFT bins | Fixed | ±3…7; median of ten values | Coupled to FFT resolution and nearby notes |
| Lower-pitch overlap guard | Partials / semitones | Fixed | Partials 2…12, within 0.5 semitone | Original selected-pitch snapshot; no extra support for explained upper peaks |
| Invocation bound | Coefficient | Fixed rule | Only if strength × projection can reach 0.22 and exceed the existing coefficient | Avoid work that cannot change the current event gate |

## Timing and cost contract

Current F-003 framing: 22050 Hz, 4096 samples, hop 256, two-frame confirmation. Raw FFT
magnitudes are used; no extra FFT, lookahead, model load or temporal state is added.
Frequency neighbourhoods and overlap relationships are precomputed outside streaming
cost. Measure whole streaming pipeline cost, common-match latency, and accuracy before
adoption. The provisional budgets remain +25% processing and +25 ms common-match p95;
no target device is selected. Reset follows the existing detector lifecycle.

## Trial history

| Trial | Configuration and evidence | Result / decision |
|---|---|---|
| FD-001 | Fixed 0/0.5/0.75/1 sweep; 294 archived cases, whitening off | Select 0.75; attacks 605→669/777, extras 3027→3086. Re-strike F1 51.9→46.7%. Not accepted |
| FD-002 | Locked 0.75; fresh v6 42 musical + 3 noise cases; three cost passes | Attacks 66→77/96 with no previously matched truth lost; extras 423→427; active F1 51.8→63.4%; cost ratio 1.0007, common p95 +0.061 ms. False-accusation gate fails |
| FD-003 | Known isolated controls and causal private bars 5–8 | All four bass attacks recovered: 16→20/21; extras 27→29. E2 alone and trio recovered without invented E2 in higher-only controls. A4 with E2 still missed |

No accepted configuration yet. Fresh quiet E2 improves for both guitars, not piano.
Noise emits no events; genuine octave coverage survives, but piano octave extras rise.
See the report for denominators, timing and measurement limitations.

## What works, what does not, what is unknown

Tests cover exact bypass, scale invariance, local peaks versus flat background, absent
fundamental behaviour, lower-harmonic overlap guards and causal/chunk-invariant replay.
These verify mechanics, not musical accuracy. A spectral peak can arise from an overtone,
recording noise, a transient or another string. A positive fundamental cue alone cannot
establish all simultaneous notes, and fixed coefficients can interact with re-strike logic.

## Measured protocol and next acceptance question

Measure the fixed sweep on 294 archived musical cases. Lock the best nonzero candidate
by pooled onset F1 even if it loses to bypass; this is candidate selection, not adoption.
Then evaluate the locked setting on fresh v6 musical patterns across three presets plus
three deterministic broadband-noise controls, with three counterbalanced cost passes.
Inspect the original private controls and causal Gymnopedie passage separately.

Require improved balanced attack accuracy, no precision/recall loss, no extra false
accusations, category/active F1 losses no greater than 2 points and the standing cost
budget. Check E2 recovery AND absence of invented E2 in upper-only controls; preserve
true higher notes, true octaves and repeated attacks. Report late recognition separately
from onset matches. Do not combine with whitening or retune after observing fresh results.

Next: investigate whether this lower-note evidence can reduce false upper-note attribution
without losing genuine octaves or melody. Freeze a separate trial before tuning; no
combination with whitening has been measured.
