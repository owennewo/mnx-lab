# Confidence gating and abstention

[Back to fusion log](../fusion-log.md)

- **ID:** confidence-gating
- **Role:** acceptance policy around detector/tracker observations.
- **Implementation:** [metrics.mjs](../evaluation/metrics.mjs) evaluates final-score curves;
  a decision-time fused gate is proposed, not implemented.
- **Evidence:** final-event threshold curves measured; no live acceptance or fusion ablation.
- **Disposition:** candidate; no universal accepted threshold.

## Purpose and fit

Allow uncertain evidence to remain unassessed. Consumes detector/tracker evidence and its
availability time; emits provisional/accepted/abstained observations. Different consumers
may eventually need different policies. Does not recover a missed note or prove correctness
from absence of an error. Agreement between correlated scorers is not automatically stronger
confidence.

## Configuration

| Parameter | Units / values | Availability | Tried / proposed | Interaction |
|---|---|---|---|---|
| `confidenceThresholds` | Raw final-event score | Existing evaluation config | 0, 0.3, 0.5, 0.7, 0.9 | Evaluation sweep; does not alter detector invocation or event emission |
| Live acceptance threshold | Detector-specific evidence | Proposed | Unchosen | Must use score actually available at decision time |
| Confirmation duration | ms | Proposed | Unchosen | Delay and coverage; not identical to DSP `minFrames` |
| Calibration mapping | Versioned fitted mapping | Proposed | None | Requires separate data; raw coefficients/activations are not probabilities |

## Timing and cost contract

Current curves filter completed events after analysis. DSP peak score and neural mean
activation can require later audio than the initial attack. Do not combine their threshold
precision with the earlier unfiltered latency. Current filtering saves no detector CPU;
a live gate's cost and any downstream savings are unmeasured. Track retained predictions
AND recall/unassessed targets to expose abstention costs.

## Trial history

| Trial / date | Recipe + configuration | Inputs/evaluation | Observation | Decision / evidence |
|---|---|---|---|---|
| CG-001 · 2026-09-13 | Prespecified final-event threshold grid on reference pipelines; same detections | [Archived curves, counts and settings](../findings/reference-v1/summary.json) | At 0.5: templates archtop precision/recall 95.6/53.1%, nylon 81.8/33.3%; neural archtop 91.0/87.7%, nylon 82.8/88.9% | Precision/coverage trade-off measured; no live threshold adopted |

All five tested values remain in the linked artifact, including settings that retain almost
nothing. The 0.5 row is illustrative, not an optimum selected for deployment.

## What works, what does not, what is unknown

Filtering improves some precision figures while discarding real attacks. Calibration,
transfer and decision-time confidence are unproven. Score values are not comparable across
detectors. Current curves do not establish a cheap, high-confidence live operating point.

## Next experiment and acceptance question

Record immutable evidence at each candidate decision/threshold crossing, then test a live
policy against the unchanged parent listener. Measure correct/false/missed/unassessed
attacks and emission delay together, on a frozen split. Require a useful accuracy/coverage
trade-off within an agreed budget; do not tune and validate calibration on the same cases.
