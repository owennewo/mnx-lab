# Partial spectral whitening

[Back to fusion log](../fusion-log.md)

- **ID:** spectral-whitening
- **Role:** acoustic evidence preprocessing, between FFT magnitudes and pitch scoring.
- **Implementation:** proposed; no code or new configuration implemented.
- **Evidence:** untried in this bench; literature-supported experiment.
- **Disposition:** agreed next experiment; not an accepted recipe.

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

All new knobs below are proposed; numeric sweeps must be frozen before measurement.

| Parameter | Units / values | Availability | Tried / proposed | Interaction |
|---|---|---|---|---|
| Whitening strength | Dimensionless, including bypass | Proposed | Unchosen; none tried | Partial versus full flattening and noise amplification |
| Envelope bandwidth / filterbank | Hz or perceptual bands | Proposed | Unchosen; none tried | Preserve harmonic peaks while estimating broad colour |
| Envelope floor / maximum gain | Magnitude / gain ratio | Proposed | Unchosen; none tried | Prevent quiet/noisy bands from dominating |
| Temporal smoothing | Milliseconds, causal | Proposed | Unchosen; none tried | Stability versus attack smearing; reset behaviour |
| Scorer weights and activity threshold | Relative coefficients | Existing fixed 1/h and threshold 0.22 | Parent values first; any recalibration explicit | A representation change changes score scale |

## Timing and cost contract

Start with F-003, 22050 Hz, 4096-sample trailing window, 256-sample hop and two-frame
confirmation. No future samples. Envelope state, if introduced, must persist across
chunks and reset with the detector. No new confirmation delay assumed. Marginal cost,
backlog and accuracy are unmeasured. Measure construction separately from streaming;
use the standing 25% extra processing / 25 ms p95 budget against F-003, with a target
device still unselected. Retain a bypass control; no production fallback is implemented.

## Trial history

No configurations have been tried. Agreement to investigate is not an experimental result.

## What works, what does not, what is unknown

The private Gymnopedie investigation motivates the question: low A2/E2 fail even alone,
and stronger upper partials are reported. This does not prove whitening will fix the
problem. The source, WAVs and diagnostics remain local in ignored output directories
`output/gymnopedie-v1/` and `output/gymnopedie-bars5-8-v1/`; do not publish the arrangement.

Unknowns include noise amplification, real octave preservation, competing notes and
compatibility with the fixed harmonic dictionary. Whitening cannot recreate missing
information; pitch inference must still tolerate weak or absent fundamentals.

## Next experiment and acceptance question

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
