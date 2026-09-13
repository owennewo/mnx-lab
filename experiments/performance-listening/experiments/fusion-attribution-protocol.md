# F-003: neighbouring-pitch competition for additional attacks

Implementation loop. Frozen before measurement, 2026-09-13.

Keep F-002's scorer, FFT, spectral-rise feature, .15 threshold, 90 ms refractory, 35 ms
association and two-frame confirmation fixed. Only additional attacks must have a current
scorer coefficient >= R times the larger immediate semitone neighbour coefficient.
Try R=1 and 1.5. Apply the same test at candidate creation and on each confirmation frame;
a failing pending candidate is discarded, without refunding its consumed crossing.
Emitted events continue following their parent. Parent events/pitch presence never change.
This is deliberately limited competition, not a new pitch estimator or a probability test.

Run F-000, both F-003 settings and an unchanged F-002-01 diagnostic reference on 168
previous recordings; three counterbalanced timing passes after warmup. The reference is
not eligible for selection. Retain all existing F-002 acceptance rules against F-000,
including no extra false accusations and exact parent events/pitch presence. Rank eligible
settings by repeat F1, overall attack F1, then ID; if none pass, lock the best diagnostic
setting with disposition revise. Report its change relative to F-002 as well.

Lock selection before the fresh v3 set (42 recordings, including repeated adjacent
semitone dyads with balanced and quiet voices). Run only selected, reference and F-000
there. No retuning after seeing held-out results. Existing fixture families map second
and dyad re-strikes to the repeated category; this makes the close-interval risk visible.
No latency gate per category is implied: pooled and common-match p95 <=25 ms increase,
median processing <=1.25x F-000, attack/active F1 regressions <=2 points in existing required
categories. Keep/revise are both valid. Synthetic recordings only; target device unselected.
