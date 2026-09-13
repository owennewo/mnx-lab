# Temporal event tracking

[Back to fusion log](../fusion-log.md)

- **ID:** temporal-events
- **Role:** shared DSP framing, persistence gate and note-event construction.
- **Implementation:** [stream.mjs](../detectors/stream.mjs), `StreamingDetector` / `detectDSP`.
- **Evidence:** measured inside harmonic/template pipelines; not isolated by ablation.
- **Disposition:** existing baseline machinery; candidate for revision, not a proven fused tracker.

## Purpose and fit

Accepts chunks and a per-frame pitch scorer. Turns persistent coefficients into events.
Provides ongoing state around [harmonic](harmonic-evidence.md) or
[template](recorded-templates.md) evidence. Neural decoding currently bypasses it. An optional
[attack technique](attack-restrike.md) supplies re-strike evidence with the fixed harmonic
scorer in F-001; it is experimental and is not enabled in baseline runs. Dropout bridging, hysteresis and bend identity tracking are not implemented.

## Configuration

| Parameter | Units / values | Availability | Tried | Interaction |
|---|---|---|---|---|
| `sampleRate` | Hz | Existing config | 22050 | Must match recorded audio and compatible detector input |
| `fftSize` | Samples, FFT-supported power of two | Existing config | 4096 | 185.8 ms context; changes frequency resolution and template/bin assumptions |
| `hopSize` | Samples | Existing config | 256 | 11.6 ms evidence spacing; affects persistence duration and processing cost |
| `streamChunks` | Samples per delivery | Existing replay config | 256, 2048 | 11.6/92.9 ms chunk delivery; separate from analysis window/hop |
| `activityThreshold` | Spectral coefficient | Existing config | 0.22 | Not a probability; shared entry/exit threshold |
| `minFrames` | Consecutive qualifying frames | Existing config | 2 | Suppression versus attack delay/short-note loss |
| `rmsFloor` | Window RMS amplitude | Existing config | 0.0001 | Silence floor interacts with quiet notes and the trailing window |
| Exit threshold / gap allowance | Coefficient / milliseconds | Proposed knobs | Unchosen; not implemented | Must test rests, muted notes and true re-strikes |

## Timing and cost contract

Ring buffer receives only arrived audio. Estimates positions at the window centre; records
first confirmed decision sample. Event end and peak confidence may grow later. New detector
instance resets state per recording; production seek/dropout reset policies are untested.
Changing delivery chunks preserves the musical output in current tests but changes emission
time. Replay adds measured serial processing/backlog; no microphone, UI or browser timing.
No isolated marginal processing cost measured for this layer.

## Trial history

| Trial / date | Recipe + configuration | Inputs/evaluation | Observation | Decision / evidence |
|---|---|---|---|---|
| TE-001 · 2026-09-13 | Both DSP pipelines, reference settings; offline/256/2048 chunks | [Frozen run](../findings/reference-v1/summary.json) | Matching musical results across modes; larger chunks increase availability delay | Retain causal replay controls; benefit of this gate alone unresolved |
| TE-002 · 2026-09-13 | Focused reading of the same reference run: archtop templates + gate, `restrike-no-gap` | [Per-case outcomes](../findings/reference-v1/cases.jsonl) | All active pitch sets correct; only 1/3 attacks matched | Pitch continuity is insufficient for re-strikes; investigate attack evidence |
| TE-003 · 2026-09-13 | F-001 pitch-associated attack gate, frozen 12-setting sweep | [AR-001/002](attack-restrike.md) | Repeat attacks improve at ~5% extra processing, but hard onset gating loses sustained/polyphonic coverage | Revise: separate ongoing pitch presence from attack decisions; retain F-000 default |

## What works, what does not, what is unknown

Causal-prefix and chunk-invariance [tests](../detectors/stream.test.mjs) check mechanics,
not musical accuracy. A single threshold can flicker; persistence can merge strikes.
Peak final confidence may depend on future samples. Independent effects of thresholds,
window length and scorer are not measured. Current frame/event timing must not be
silently changed while comparing algorithms.

## Next experiment and acceptance question

Hold the pitch scorer and audio fixed, add attack evidence or change one persistence rule,
and compare with/without it. Test repeated notes, short notes, gaps, releases, bends and
quiet chord tones together. Record parameter combinations in frames AND milliseconds;
require fewer false/missed attacks without hiding the loss through greater abstention or
unacceptable delay. Choose the device/cost budget before accepting a fusion recipe.
