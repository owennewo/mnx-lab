# F-001: pitch-associated spectral rises

Implementation loop. Protocol frozen before measurement, 2026-09-13.

F-000 is the unchanged harmonic scorer and two-frame activity gate from baseline.json.
F-001 optionally adds positive spectral change in the first six harmonics of each pitch
(three bins per harmonic, weighted 1/h), divided by current weighted magnitude.
A threshold crossing opens a short causal association window. New pitch events require
that window; continuing pitches may restart once per crossing. A refractory interval
also spans activity dropouts. This is a deliberately simple association heuristic:
shared harmonics can still implicate a ringing pitch. No ground truth enters detection.
The existing FFT, pitch scorer, event confidence and evaluator stay fixed.

The JSON freezes 12 configurations. Run all on audio-v1 evaluation cases, stream-256.
Rank by repeated/restrike pooled attack F1, then overall F1, then configuration ID.
Eligibility requires **both** repeated-note precision and recall to increase; overall
attack F1 and active-pitch F1 must lose at most 2 percentage points. The same 2-point
attack and active F1 limit applies separately to single notes, arpeggios and strums.
False accusations must not increase. Null metrics cannot satisfy a required gain.
Three counterbalanced timing passes follow warmup. Use median total processing time;
maximum allowed ratio 1.25. Matched-attack p95 may rise at most 25 ms, including the
common matched-truth population. Report recall and maximum backlog alongside latency.
Timing is local machine processing wall time, not a target-device CPU guarantee.

Choose the highest ranked eligible setting, or the highest ranked diagnostic setting if
none qualify (then disposition remains revise). Persist selection before held-out scoring.
New fixtures in fusion-heldout.mjs are frozen before the sweep; do not inspect their
results until selection is locked. Evaluate only that setting and parent on held-out audio.
Require the same overall, repeat, false-accusation and timing checks there; category
regressions are also shown. Never tune on the held-out results in this iteration.
Original audio-v1 remains the source of regression evidence; no regeneration.
An unsuccessful configuration does not disprove spectral onset detection as a family.
