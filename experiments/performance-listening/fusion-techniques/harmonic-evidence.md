# Harmonic evidence

[Back to fusion log](../fusion-log.md)

- **ID:** harmonic-evidence
- **Role:** acoustic pitch evidence; analytical multi-pitch baseline.
- **Implementation:** [spectral.mjs](../detectors/spectral.mjs), harmonic dictionary/scorer.
- **Evidence:** measured with shared DSP event tracking; no isolated ablation.
- **Disposition:** candidate; not adopted into a fused recipe.

## Purpose and fit

Explains a spectrum through idealised harmonic patterns and greedy residual subtraction.
Consumes FFT magnitudes/RMS; emits per-pitch coefficients to
[temporal events](temporal-events.md). No score or actual-note labels are inputs. Potential
siblings include other analytical multi-F0 estimators; this simple implementation does
not stand for the entire family.

## Configuration

| Parameter | Units / values | Availability | Tried | Interaction |
|---|---|---|---|---|
| `midiMin`, `midiMax` | MIDI semitones | Existing config | 40, 88 | Search range; out-of-range evidence is unavailable |
| `maxPolyphony` | Pursuit iterations | Existing config | 6 | Caps greedy selections, not proof of six distinguishable strings |
| Harmonic count | Partials | Fixed in code | Up to 12 below Nyquist | Interacts with spectral resolution and instrument spectrum |
| Harmonic weights | Relative amplitude | Fixed in code | 1/h | A modelling assumption, not learned guitar timbre |
| Gaussian width | FFT bins | Fixed in code | 0.8 | Coupled to FFT size and sample rate |
| Shared frontend/gate | See temporal events | Existing config | [Reference configuration](../findings/reference-v1/summary.json) | Raw scores and event output both depend on it |

Proposed changes to fixed assumptions require explicit implementation/configuration and
new trial records. The [current config](../experiments/baseline.json) is not an immutable
record of future settings.

## Timing and cost contract

Uses the shared trailing-window stream; see [temporal events](temporal-events.md).
No model load; dictionary construction is outside measured steady-state time. Reference
stream processing was roughly 0.06–0.08 times audio duration on the recorded CPU. That is
whole-pipeline elapsed processing, not this scorer's isolated marginal cost.

## Trial history

| Trial / date | Recipe + configuration | Inputs/evaluation | Observation | Decision / evidence |
|---|---|---|---|---|
| HE-001 · 2026-09-13 | `reference-v1`: harmonic + temporal events; settings above; offline, stream-256, stream-2048 | Frozen reference audio; archived config/code hashes; 100 ms attack tolerance | Archtop/nylon/piano attack F1 30.2/25.0/28.8%; stream-256 matched p95 122/147/99 ms | Keep as cheap baseline; noisy event output; [table](../findings/reference-v1/table.md), [per-case evidence](../findings/reference-v1/cases.jsonl) |

## What works, what does not, what is unknown

Measured processing is compatible with further live experiments on this machine. Many
unmatched attacks remain, including release/transient artifacts; no evidence yet isolates
which failures belong to spectral estimation versus event grouping. Quiet wrong inner
notes and dense chords can be missed. No microphone transfer or fusion benefit established.

## Next experiment and acceptance question

Hold the scorer fixed while testing attack/event improvements, then consider alternative
harmonic models on a held-out set. Require fewer false/missed attacks at matched coverage
and an acceptable marginal cost. Optimising an already cheap implementation is secondary
to demonstrating useful evidence. Do not tune FFT size independently of the bin kernel.
