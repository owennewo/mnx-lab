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
| TE-004 · 2026-09-13 | F-002 additive, two-frame-confirmed re-strikes | [AR-003/004](attack-restrike.md) | All 168 cases retain exact parent events and active-pitch counts; repeat gains but extra false attacks | Preserve this contract in the next experiment; improve attribution |
| TE-005 · 2026-09-13 | F-003/F-004 attribution filters | [PA-001…004](pitch-attribution.md) | Exact parent events/presence survive every case; new filters act only on pending extra attacks | Preserve contract; no added temporal confirmation delay |

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

## Reading the current listener as a sequence of frames

These numbers describe the current DSP listener, not every pitch-detection family:

- **Audio sample rate:** 22,050 waveform measurements per second. One sample cannot
  identify a musical pitch; it is one amplitude measurement.
- **Analysis window:** 4,096 samples = 185.76 ms of recent audio (zero-padded at startup).
- **Analysis hop:** 256 samples = 11.61 ms, or 86.13 pitch-evidence frames per second.
  Adjacent windows share 93.75% of their samples; agreement is correlated evidence.
- **Frame output:** evidence for multiple candidate pitches, not one winning note and
  not a calibrated probability. The current dictionary covers MIDI 40–88.
- **Confirmation:** two consecutive coefficients at least 0.22 confirm a parent pitch
  event. The second qualifying frame is 11.61 ms after the first; the reported start is
  the first frame's timestamp. It is not two non-overlapping 186 ms observations.
- **Continuation/end:** qualifying frames extend the event. One frame below threshold
  removes its active state; no gap allowance or separate exit threshold exists yet.
- **A new strike on an existing pitch:** F-003 separately checks positive spectral
  change, recent pitch association and neighbour attribution, then requires two frames
  for the added re-strike. The 90 ms spacing guard applies to this attack machinery;
  it is not a universal minimum gap between all parent pitch events.

Analysis time, evidence availability and delivery time are distinct. A frame's timestamp
is the centre of the trailing window, about 93 ms behind its latest audio. With 256-sample
chunks, confirming a parent event on the next frame puts its initial emission about
104 ms after its *reported* start, before processing cost. This is not a fixed latency
from the physical attack: threshold crossing and timestamp error vary. Bigger delivery
chunks can batch several frames and add delay without changing their musical estimates.
UI/cursor refresh rate is another independent choice; the bench has no live cursor.

For illustration, successive frame scores `0.10, 0.24, 0.30, 0.27, 0.18` yield
`absent, tentative, confirmed, continuing, dropped` with current settings. Increasing
confirmation can reject brief flicker but cannot fix a wrong octave persisting across
many frames. Window length, hop, confirmation and dropout tolerance are separate knobs.

The proposed [whitening](spectral-whitening.md) changes input evidence before scoring;
[flexible harmonic modelling](flexible-harmonic-model.md) changes scoring itself. Their
initial experiments hold the frame and event rules fixed so improvements are attributable.
