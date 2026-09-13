# Flexible harmonic model

[Back to fusion log](../fusion-log.md)

- **ID:** flexible-harmonic-model
- **Role:** acoustic pitch evidence; revise the harmonic scorer's spectral assumptions.
- **Implementation:** proposed; no replacement model implemented.
- **Evidence:** untried; motivated by measured failure of the existing scorer.
- **Disposition:** agreed next experiment; not an accepted recipe.

## Purpose and fit

The current dictionary fixes harmonic amplitudes to 1/h. This is a useful simplification,
not a universal instrument spectrum. Investigate a model that can recognise a weak or
absent fundamental through several partials without treating every strong partial as an
independent played pitch. Preserve genuine simultaneous octaves and higher melody notes.

Consumes the same FFT magnitudes and supplies pitch evidence to the existing temporal
tracker. Begin on raw magnitudes with [whitening](spectral-whitening.md) bypassed so its
contribution can be isolated. Possible model forms include a bounded family of smooth
harmonic envelopes or harmonic salience with less dependence on fixed amplitude ratios;
these are alternatives to choose and document before a trial, not implemented settings.

[UNSW's guitar examples](https://newt.phys.unsw.edu.au/jw/musFAQ.html) illustrate a weak
low-note fundamental. [Klapuri 2006](https://archives.ismir.net/ismir2006/paper/000125.pdf)
provides a reference for weighted harmonic salience and joint/iterative estimation.
Neither source establishes the accuracy of our eventual configuration.

## Configuration

| Parameter | Units / values | Availability | Tried / proposed | Interaction |
|---|---|---|---|---|
| Harmonic envelope / weighting family | Relative amplitudes | Proposed replacement for fixed 1/h | Unchosen; none tried | Permit variable timbre without arbitrary per-note fitting |
| Weak-fundamental allowance | Weight / penalty | Proposed | Unchosen; none tried | Avoid both octave mistakes and invented subharmonic pitches |
| Evidence for an additional pitch | Residual or joint score criterion | Proposed | Unchosen; none tried | Shared harmonics do not prove a second played note |
| Complexity / regularisation | Model-dependent | Proposed | Unchosen; none tried | Bound overfitting and CPU cost |
| Harmonic count / bin width | Partials / FFT bins | Existing fixed 12 / 0.8 | Parent initially | Do not change frequency resolution at the same time |
| Frontend / event thresholds | Shared configuration | Existing | Frozen F-003 initially | Any score recalibration must be recorded, not hidden |

## Timing and cost contract

Retain F-003 framing: 22050 Hz, 4096-sample trailing context, 256-sample hop and two-frame
confirmation. No future audio or score labels. Record any extra model state/reset needs;
construction and steady-state cost separately. Accuracy, marginal processing, backlog
and latency are unmeasured. Standing provisional acceptance budgets are 25% extra
processing and 25 ms p95 increase against F-003; target hardware remains unselected.
Model complexity must be bounded before streaming trials. No production fallback exists;
retain F-003 as the experiment's reference.

## Trial history

No configurations have been tried. The weak-bass diagnosis is motivation, not a trial of
this proposed model. No F-number is assigned before a concrete recipe is frozen.

## What works, what does not, what is unknown

The local Gymnopedie controls show A4 detected alone but lost when E2 is added, while
A2/E2 are missed alone. Multiple mechanisms could contribute: spectral normalisation,
greedy allocation, dictionary mismatch and thresholds. Do not claim one is established
as the sole cause. Private audio and diagnostics stay in ignored local output.

A flexible model could invent lower fundamentals or explain away a genuinely played
upper note. Debounce cannot correct a consistently wrong pitch hypothesis.

## Next experiment and acceptance question

Choose one model form and freeze its settings/sweep before measurement. Compare against
F-003 on the same isolated controls and four-bar development passage used by the whitening
experiment. Include real octaves, weak inner chord tones, short notes, repeated notes,
release artifacts and silence, then confirm on fresh multi-preset material. Never feed
truth labels or the expected score into detection.

Seek recovery of true bass and mixed higher notes with fewer harmonic extras, preserved
coverage and acceptable cost/latency. Stop or revise if only the known sample improves or
if true octave notes are suppressed. Measure whitening alone and this model alone before
trying both together; any combined benefit belongs to a separate trial.
