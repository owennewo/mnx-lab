# F-002: pitch coverage fixed; attack attribution still needs revision

Implementation loop · 2026-09-13. **Decision: revise. F-000 remains the default.**

This isolates one integration change at the fixed F-001-01 settings: threshold .15,
refractory 90 ms, association 35 ms. Re-strikes are additional two-frame-confirmed events
within existing parent tracks. They cannot gate, close or extend parent pitch presence.
There was one candidate, no parameter sweep and no retuning.

Three counterbalanced passes measured 132 regression recordings (both prior sets).
Disposition was locked before scoring 36 new recordings on the same three sample packs.
All 132 archived parent outputs match, and **all 168 candidate cases preserve every parent
event and exactly the same active-pitch TP/FP/FN**. Each extra event is contained in a
parent interval of that pitch. This fixes F-001’s coverage regression by construction.

| Measure | Development parent → F-002 | Held-out parent → F-002 |
|---|---|---|
| Repeat precision | 9.7% → 16.7% | 12.2% → 20.2% |
| Repeat recall | 41.7% → 83.3% | 36.7% → 73.3% |
| Repeat F1 | 15.7% → 27.9% | 18.3% → 31.7% |
| Overall attack recall | 71.3% → 78.8% | 61.5% → 78.1% |
| Overall attack F1 | 25.8% → 27.9% | 21.3% → 26.0% |
| Active-pitch F1 | 59.5% → 59.5% | 53.7% → 53.7% |
| False accusations | 1228 → 1242 | 397 → 406 |
| Missed unexpected attacks | 3 → 3 | 0 → 0 |
| Unassessed target attacks | 104 → 80 | 39 → 23 |

Development adds 24 true attack matches and 14 false positives; held-out adds 16 and 9.
All category F1, CPU and latency checks pass. The unchanged **no increase in false
accusations** rule fails on both splits. This is an improved candidate, not an accepted
assessment algorithm; overall precision remains low. Wrong-note tests here are small and
synthetic. No microphone or unseen-instrument claim is supported.

## Cost and latency

| Measure | Development parent → F-002 | Held-out parent → F-002 |
|---|---|---|
| Extra processing (median of three totals) | +5.30% | +5.64% |
| Matched attack p95 | 153.64 → 152.48 ms | 170.09 → 168.50 ms |
| Maximum replay backlog | 4.55 → 2.36 ms | 1.60 → 2.03 ms |
| Common matched-truth p95 | 153.64 → 153.67 ms (229 attacks) | 170.09 → 170.12 ms (59 attacks) |

Common-match timing is essentially unchanged. Held-out repeat-only p95 increases
79.1 → 120.5 ms as more attacks enter the matched population; do not call re-strikes
universally faster. The frozen 25 ms latency gate applies to pooled/common matches.
The 25% processing budget passes on this local Node replay. Startup, microphone, browser
and display costs are excluded. First-pass timings supply latency/backlog; processing
uses the median of three complete passes. A target device is still unselected.

## Error diagnosis and next experiment

Among unmatched additional re-strikes, **12/14 development and 7/9 held-out events use
pitches never played in those recordings**. Neighbouring semitones are common; the first
regression set also contains octave/high-harmonic mistakes. Two held-out extras are
duplicate attacks on the played pitch. [Exact cases](attack-diagnostics.json) preserve
this diagnosis. It concerns additional re-strikes, not the parent’s much larger error set.

The evidence suggests the local spectral rise can be shared by an erroneous pitch track.
That explanation is an inference; this trial isolates integration, not the cause of every
spectral mistake. Preserving the parent also preserves its erroneous pitch hypotheses.

**Next:** retain the pitch-preservation contract and test more selective pitch attribution
for additional attacks. Check whether competing neighbouring-pitch evidence can reject
false re-strikes without erasing real close-interval chords or quiet notes. Treat repeated
trigger suppression on the same pitch as a separate knob. Freeze the next protocol and
new held-out cases first; these v2 cases are now regression evidence.

## Evidence

- [Frozen protocol](../../experiments/fusion-restrike-protocol.md) and [configuration](../../experiments/fusion-restrike.json).
- [Development summary](development-summary.json) and [held-out summary](heldout-summary.json), including per-category/preset counts and all timing passes.
- [Selection lock](selection.json), [decision](decision.json), and [measured source/configuration provenance](provenance.json).
- Case JSONL retains both event streams; manifests retain original audio hashes and source manifests.
- Full outputs and immutable WAVs remain under `output/fusion-restrike-v1` and `output/audio-fusion-heldout-v2`.
