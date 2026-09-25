# Recorded templates

[Back to fusion log](../fusion-log.md)

- **ID:** recorded-templates
- **Role:** acoustic pitch evidence from recorded exemplars.
- **Implementation:** [spectral.mjs](../detectors/spectral.mjs), template dictionary/scorer.
- **Evidence:** measured with shared DSP tracking; no isolated ablation.
- **Disposition:** parked for general instrument-independent use; retained as a diagnostic baseline.

## Purpose and fit

Decomposes spectra using isolated archtop note templates. Outputs coefficients to
[temporal events](temporal-events.md). Template inputs are separate training recordings;
test chords and actual labels never train the dictionary. Shares the frontend with
[harmonic evidence](harmonic-evidence.md), so both incur overlapping work and correlated
errors if combined; neither extra cost nor fusion gain has been measured.

## Configuration

| Parameter | Units / values | Availability | Tried | Interaction |
|---|---|---|---|---|
| `templatePreset` | Pack ID | Existing config | `guitar` (archtop) | Current renderer creates training fixtures only for this preset |
| `templateIterations` | Solver sweeps | Existing config | 32 | More iterations cost more; accuracy benefit unmeasured |
| `midiMin`, `midiMax` | MIDI semitones | Existing config | 40, 88 | Requires every corresponding isolated template |
| Averaging interval | Seconds into recording | Fixed in code | 0.45–0.75 | Primarily sustain, not a time-varying attack model |
| Template velocity | Normalised velocity | Fixed in fixture generator | 0.65 | Sample layer/timbre; not a universal volume calibration |
| Shared frontend/gate | See temporal events | Existing config | Reference-v1 values | Changes require rebuilding compatible templates |

## Timing and cost contract

Shared streaming window; dictionary building/loading excluded from steady-state results.
Pipeline stream processing is roughly 0.08–0.09 times audio duration on the recorded CPU.
No calibration interaction, adaptive dictionary or time-varying templates implemented.

## Trial history

| Trial / date | Recipe + configuration | Inputs/evaluation | Observation | Decision / evidence |
|---|---|---|---|---|
| RT-001 · 2026-09-13 | `reference-v1`: archtop templates + temporal events; configuration above; three modes | 49 training notes; evaluation archtop, held-out nylon/piano; [archived config and hashes](../findings/reference-v1/summary.json) | Attack F1 56.6/30.3/34.4%; active F1 79.6/53.0/41.2%; stream-256 matched p95 192/182/146 ms | Familiar-source advantage, weak transfer; [table](../findings/reference-v1/table.md) |

## What works, what does not, what is unknown

Archtop re-strikes retain the active pitch but merge attacks. Changing timbre substantially
reduces accuracy before microphones/rooms enter the experiment. This is a failure of this
configuration to generalise, not a proof that every template method fails. User-calibrated
or adaptive templates remain untested. No evidence justifies adding this alongside another
estimator in the fused listener.

## Next experiment and acceptance question

Keep the existing baseline runnable. Revisit only for a deliberate personalisation
experiment or a clearly specified missing capability. Such a trial must record calibration
burden, sample/dictionary identity, changed recording conditions and incremental CPU/memory
cost. Richer templates alone are not a chosen next task.
