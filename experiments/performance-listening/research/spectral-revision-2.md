# Spectral revision 2 — hypothesis before comparison

Loop: implementation research. Parent: `spectral-follower@1`; candidate:
`spectral-follower@2`. Development only under
[sync-proxy policy 1](../contracts/sync-proxy-development-1.md).

The first run rejects silence and the cross-piece control, but follows Winner less
reliably than the clock. Inspection of four past-only spectrum windows shows strong
harmonics and notes ringing over their successors. Pitch-class folding discards
register and lets a partial support an unrelated score pitch. This is a local
hypothesis, not independently established ground truth about the errors.

One focused revision: replace the twelve pitch-class bins with absolute MIDI bins
36–108, observed over 70–4000 Hz, and represent each score note by its first four
harmonics with weights 1, 0.65, 0.4, 0.3. Keep the score decay, window, delivery,
monotone alignment, tempo prior and 0.65 rejection threshold unchanged. The weights
are a declared simple model, not fitted to these recordings. The score representation
is not a transcription of the recording.

Prediction: register and expected partials improve positive following without losing
control rejection. Contradiction: no improvement on Winner, or a control falls below
its existing target. A better median among fewer position claims is not a pass.

Use the identical frozen Winner set, sync interpolation and evaluator; do not alter
anchors, crop, nominal tempo, tolerances or thresholds. This consumes the second and
last version in the predeclared two-version sub-batch. Close it after this comparison;
do not keep tuning on the clip. Positive Dust and longer excerpts require Winner to
meet all development targets. Formal retention still requires separate evidence.
