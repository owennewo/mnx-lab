# Attack and re-strike evidence

[Back to fusion log](../fusion-log.md)

- **ID:** attack-restrike
- **Role:** pitch-associated acoustic attack evidence feeding temporal events.
- **Implementation:** optional [attack.mjs](../detectors/attack.mjs), enabled by `fusion`.
- **Evidence:** F-001 12-setting sweep and F-002 fixed re-strike-only revision; see trials below.
- **Disposition:** experimental; baseline remains the default.

## Purpose and fit

F-001 adds positive spectral change to the fixed harmonic scorer and two-frame activity
gate. For each MIDI pitch, sum positive bin changes across its first six harmonic
neighborhoods, weighted 1/h, and divide by current weighted magnitude. A rise crossing
opens a causal association window. An eligible pitch must still pass the existing scorer.
A new track requires an unconsumed crossing; a confirmed active track may restart on one.
This both gates initial attacks and permits re-strikes: their separate contributions are
not isolated by this trial. It is not evidence that all attack detectors behave alike.

## Configuration

| Parameter | Units | Availability | Tried | Interaction |
|---|---|---|---|---|
| `fusion.threshold` | positive rise/current magnitude | Configurable | 0.15, 0.30, 0.50 | Higher thresholds may erase soft attacks |
| `fusion.refractorySeconds` | seconds | Configurable | 0.09, 0.16 | Reject duplicates across score dropouts; can erase rapid notes |
| `fusion.associationSeconds` | seconds | Configurable | 0.035, 0.070 | Pitch evidence must arrive before this window expires |
| Harmonics / neighborhood | count / FFT bins | Fixed in implementation | Six / center ±1 | Overlapping harmonics can implicate another ringing pitch |
| Normalisation | dimensionless ratio | Fixed | Positive weighted change / current weighted energy | Relative change alone does not establish perceptual salience |
| Window / hop | samples | Inherited baseline | 4096 / 256 at 22050 Hz | Reuses existing trailing FFT; 185.8 ms context / 11.6 ms hop |
| `fusion.mode` | integration policy | Configurable | Absent: F-001 gating; `restrike-only`: F-002 | Re-strike-only cannot gate or close parent tracks |
| Strum grouping | — | Unimplemented | None | Individual pitch attacks remain independent |

Exact combinations and stable IDs are retained in the experiment provenance, including
failed settings. Other scorer and evaluator parameters remain in baseline.json.

## Timing and cost contract

Only arrived magnitudes enter the calculation; no additional FFT, future samples or truth
labels. A crossing is consumed when a candidate track starts, before two-frame confirmation.
It is not refunded if that candidate fails confirmation. Refractory state survives score
dropouts. A new detector resets all state. Release closes activity through the existing
threshold; no new gap bridging or hysteresis. A re-strike closes the prior event at the
new estimated start. Existing peak confidence remains retrospective and uncalibrated.

Measured processing covers per-chunk detection including the new feature. As for F-000,
instance/dictionary construction and final event mapping are excluded. Three counterbalanced
passes follow warmup. Latency/backlog use first-pass replay timings; aggregate latency and
the common matched-truth subset are both reported, with recall. These are local Node wall
times, not microphone/browser or target-device guarantees.

F-002 retains these feature parameters and confirmation timing, but removes the attack
prerequisite for parent pitch tracks. Additional events carry `kind: "restrike"`; they
require two score-qualified frames and stay within an existing confirmed parent track.
Their overlapping intervals preserve the parent's active-pitch union exactly. The parent
confidence/end/initial decision records are not altered. No production event API is implied.

## Trial history

F-001 follows the [frozen protocol](../experiments/fusion-attack-protocol.md) and
[parameter grid](../experiments/fusion-attack.json). Threshold, refractory interval and
association interval are swept together; this does not isolate any one knob's contribution.

| Trial / date | Recipe/configuration | Inputs/evaluation | Accuracy and cost | Decision |
|---|---|---|---|---|
| AR-001 · 2026-09-13 | F-000 versus F-001-01…12; full frozen grid | 102 audio-v1 cases; unchanged evaluator; three timing passes | Best diagnostic repeat recall 50% → 66.7%; precision 8.0% → 20.7%; +5.33% processing. Active F1 61.5% → 38.8%; all settings fail | Revise; [all trials and exact failures](../findings/fusion-attack-v1/README.md) |
| AR-002 · 2026-09-13 | Locked F-001-01: .15 / 90 ms / 35 ms | 30 newly held-out recordings, same sample packs; no retuning | Repeat recall 36.7% → 70%; precision 11.6% → 27.6%; +5.24% processing. Active F1 52.5% → 36.6%; strum attack F1 24.2% → 5.9% | Confirms need to revise; [selection/decision](../findings/fusion-attack-v1/decision.json) |
| AR-003 · 2026-09-13 | F-002-01, `restrike-only`, .15 / 90 ms / 35 ms | 132 regression cases; three timing passes | Exact parent coverage; repeat recall 41.7% → 83.3%, precision 9.7% → 16.7%; +5.30% processing; +14 false accusations | Revise attribution; [F-002 report](../findings/fusion-restrike-v1/README.md) |
| AR-004 · 2026-09-13 | Same fixed F-002-01, no retuning | 36 fresh held-out recordings | Exact coverage; repeat recall 36.7% → 73.3%, precision 12.2% → 20.2%; +5.64% processing; +9 false accusations | Still fails accusation gate; seven extras use never-played pitches |

The F-001 chosen setting is diagnostic, not an accepted default. Higher thresholds failed repeat
recall as well. A 70 ms association window did not rescue overall coverage. Reduced false
accusations also increased unassessed attacks. Common-match latency was essentially flat;
pooled lower latency does not mean every recovered re-strike was faster.

## What works, what does not, what is unknown

[Mechanics tests](../detectors/attack.test.mjs) cover sustain, refractory/association
expiry, a non-overlapping pitch rise, chunk invariance and immutable emitted starts.
They do not prove robust pitch association in chords. In particular, shared harmonics,
release envelopes and instrument transients can still cause false local rises.

## Next experiment and acceptance question

F-002 removes the coverage failure but retains incorrect pitch hypotheses from the parent.
Test more selective attribution of additional attacks, particularly competing neighbouring
pitches, with the exact pitch-preservation contract retained. Real close-interval chords
and quiet notes must survive. Same-pitch duplicate triggers are a separate question. Keep
parameters/splits frozen and report accusation counts with recall; do not relax the failed
gate retrospectively. [Diagnosis and exact cases](../findings/fusion-restrike-v1/README.md).
