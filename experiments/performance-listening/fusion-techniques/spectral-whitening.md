# Partial spectral whitening

[Back to fusion log](../fusion-log.md)

- **ID:** spectral-whitening
- **Role:** acoustic evidence preprocessing, between FFT magnitudes and pitch scoring.
- **Implementation:** optional [whitening.mjs](../detectors/whitening.mjs), enabled only by explicit scorer configuration.
- **Evidence:** measured F-003 ablation on 252 development + 42 fresh cases, with private diagnostic controls.
- **Disposition:** F-005 candidate; revise, not adopted. Development regressions and fresh cost block acceptance.

## Purpose and fit

Estimate the broad spectral envelope and partially flatten its influence so instrument
colour does not dominate harmonic evidence. The existing whole-frame L2 normalisation
changes overall level, not relative harmonic amplitudes. Human equal-loudness compensation
is a different operation and is not assumed appropriate for this detector.

Klapuri's [2006 multi-F0 method, section 2.1](https://archives.ismir.net/ismir2006/paper/000125.pdf)
applies partial spectral whitening before harmonic salience estimation. This is the
reference mechanism to investigate, not a claim that its settings transfer unchanged.
Whiten a smooth envelope, not every individual spectral peak independently.

Place this on the pitch-evidence branch initially. Keep the existing attack-flux input
raw so one experiment does not silently change two branches. Any later whitening of
attack evidence is a separate trial. A changed representation may require compatible
dictionary weights and thresholds; record those dependencies explicitly. Keep
[flexible harmonic modelling](flexible-harmonic-model.md) separate initially.

## Configuration

The SW-001/002 grid was frozen before measurement; no post-result recalibration occurred.

| Parameter | Units / values | Availability | Tried / proposed | Interaction |
|---|---|---|---|---|
| Whitening strength | Dimensionless, including bypass | `whitening.strength` | 0, 0.25, 0.50, 0.67 | Partial versus full flattening and noise amplification |
| Envelope bandwidth / filterbank | Hz or perceptual bands | Fixed in code | 30 triangular bands, Klapuri centre formula | Preserve harmonic peaks while estimating broad colour |
| Envelope floor / maximum gain | Magnitude / gain ratio | `whitening.floor`, `whitening.maxGain` | 1e-4 relative to strongest band; gain cap 16 | Prevent quiet/noisy bands from dominating |
| Temporal smoothing | Milliseconds, causal | Not implemented | None | Stability versus attack smearing; reset behaviour |
| Scorer weights and activity threshold | Relative coefficients | Existing fixed 1/h and threshold 0.22 | Unchanged; no recalibration | A representation change changes score scale |

## Timing and cost contract

Start with F-003, 22050 Hz, 4096-sample trailing window, 256-sample hop and two-frame
confirmation. No future samples. Envelope state, if introduced, must persist across
chunks and reset with the detector. No new confirmation delay assumed. The measured fresh-set median processing increase is 26.5%, above the 25% budget.
Common-match p95 decreases by 38 ms; accuracy and category regressions are reported below. Measure construction separately from streaming;
use the standing 25% extra processing / 25 ms p95 budget against F-003, with a target
device still unselected. Retain a bypass control; no production fallback is implemented.

## Trial history

| Trial / date | Configuration | Evidence | Outcome / decision |
|---|---|---|---|
| SW-001 · 2026-09-13 | F-003 + strengths 0/0.25/0.50/0.67; floor 1e-4, cap 16, no smoothing or recalibration | 252 archived public development cases | 0.67 selected: attacks 541→598/681, extras 2565→2711, active F1 57.8→67.8; false accusations/category drops block adoption |
| SW-002 · 2026-09-13 | Locked 0.67 versus bypass, three counterbalanced cost passes | 42 fresh cases / 96 attacks | Correct 64→85, extras 462→430, active F1 47.3→63.8; cost +26.5%, above budget; revise |
| SW-003 · 2026-09-13 | All frozen strengths, excluded from selection | Private isolated controls + causal four-bar diagnosis | At 0.67: 16→19/21 attacks, extras 27→30; A2 and mixed A4 recovered, E2 missed; no whole-piece rescore |

[Detailed configuration, negative results, provenance and reproduction](../findings/fusion-whitening-v1/README.md).

## What works, what does not, what is unknown

The private Gymnopedie investigation motivates the question: low A2/E2 fail even alone,
and stronger upper partials are reported. Whitening partially improves these controls but does not recover E2. It introduces
additional development false attacks and does not pass the acceptance gates. The source, WAVs and diagnostics remain local in ignored output directories
`output/gymnopedie-v1/` and `output/gymnopedie-bars5-8-v1/`; do not publish the arrangement.

Unknowns include noise amplification, real octave preservation, competing notes and
compatibility with the fixed harmonic dictionary. Whitening cannot recreate missing
information; pitch inference must still tolerate weak or absent fundamentals.

## Next experiment and acceptance question

The initial experiment below is complete; see SW-001…003. Next, run the agreed flexible
harmonic model alone before considering a combined trial. Future whitening recalibration,
noise controls and implementation optimisation remain untried.


Compare bypass versus partial whitening on identical frozen audio with F-003 held fixed.
Choose and record the configuration grid and any permitted recalibration before running.
Use the isolated A2/E2, A4-alone and E2+A4 controls plus the four-bar passage as development
material. Keep genuinely simultaneous octave notes, quiet chord tones, silence, release
transients and real re-strikes as counterexamples. Use fresh untuned material across all
three presets for confirmation; Gymnopedie is now development evidence, not held out.

Seek fewer false/missed attacks with preserved true upper notes, improved ongoing pitch
coverage, and acceptable latency/cost. Stop or revise if gains depend on a particular
sample, merely suppress true notes, or inflate noise. Only after isolated measurements
consider combining this with the flexible harmonic model.
