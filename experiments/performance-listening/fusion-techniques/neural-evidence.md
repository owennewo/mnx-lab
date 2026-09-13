# Neural evidence

[Back to fusion log](../fusion-log.md)

- **ID:** neural-evidence
- **Role:** learned acoustic evidence and upstream note decoding.
- **Implementation:** [neural.mjs](../detectors/neural.mjs), Basic Pitch 1.0.1 / TF.js CPU.
- **Evidence:** measured offline; stream modes explicitly unsupported.
- **Disposition:** offline reference and candidate for further runtime/decoding experiments.

## Purpose and fit

Current adapter consumes an entire PCM recording and returns decoded note events. It does
not use our DSP temporal gate. A future fused use could consume frame/onset/contour evidence
or request delayed analysis, but neither interface is implemented. Evidence arriving late
cannot retroactively justify a confident earlier command.

## Configuration

| Parameter | Units / values | Availability | Tried | Interaction |
|---|---|---|---|---|
| `neural.onsetThreshold` | Upstream activation threshold | Existing config | 0.5 | Coupled to frame threshold and note decoder |
| `neural.frameThreshold` | Upstream activation threshold | Existing config | 0.3 | Affects note continuation and spurious events |
| `neural.minNoteFrames` | Model output frames | Existing config | 5 | Suppresses short candidates; may erase real short notes |
| Backend | TF.js backend | Fixed in adapter | CPU | Faster backends need separate cost/accuracy trials |
| Model/weights | Version + hashes | Fixed npm distribution | Basic Pitch 1.0.1, TF.js 3.21.0 | [Exact archived identities](../findings/reference-v1/summary.json) |
| Nominal model window | Seconds | Model implementation | About 2 | Processing speed and required context are separate constraints |
| Contour decoding | Enable/use policy | Not wired in our adapter | Not used | Bend fragments are not evidence of the model's full capability |

Final-event score filtering is a separate [confidence technique](confidence-gating.md),
not the same setting as the model's onset/frame thresholds.

## Timing and cost contract

Whole-file availability plus inference/postprocessing; model loading excluded from
steady-state measurements. No persistent causal stream adapter. CPU processing costs
2.55–2.92 times audio duration in the reference run; matched-attack p95 around 8 seconds.
This does not meet a live-listener requirement. It does not establish the cost of another
backend or model. Marginal fusion cost and worst-case invocation policy are unmeasured.

## Trial history

| Trial / date | Recipe + configuration | Inputs/evaluation | Observation | Decision / evidence |
|---|---|---|---|---|
| NE-001 · 2026-09-13 | `reference-v1`: Basic Pitch + upstream note decoder; CPU, settings above | Frozen reference audio and [model/runtime/config hashes](../findings/reference-v1/summary.json) | Attack F1 69.5/75.2/79.0% on archtop/nylon/piano; active F1 about 88%; slower than real time | Stronger offline reference; no live adoption; [table](../findings/reference-v1/table.md) |
| NE-002 · 2026-09-13 | Requested stream-256 and stream-2048 | Same matrix | 204 outcomes explicitly unavailable; no causal inference executed | Unsupported, not failed accuracy; [case records](../findings/reference-v1/cases.jsonl) |

## What works, what does not, what is unknown

Better cross-sound attack recovery than the two simple DSP pipelines, but false/delayed
and fragmented events remain. One dense chord yields all six pitches with two attacks
outside tolerance. Our decoder can split bends and invent extra events around re-strikes.
No evidence supports an always-running neural addition within a live CPU budget yet.

## Next experiment and acceptance question

Separate backend optimisation, decoder changes and model replacement into attributable
trials. Keep weights/inputs fixed for a backend comparison; record startup, sustained
processing and tail/backlog as well as accuracy. Then test whether available contours/onsets
improve events. A streaming proposal must explicitly bound future context; faster whole-file
inference alone is insufficient. Consider [selective analysis](selective-analysis.md) only
with a measured trigger/budget policy.
