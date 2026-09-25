# Recognition diagnostic 1 — experiment 003, pre-run plan

Loop: implementation research. User direction: “lets try that”, responding to the
experiment 002 proposal to isolate recognition from alignment. Date: 2026-09-25.
This authorizes a diagnostic using supplied sync alignment, not another listener
version or a loosening of the following targets. Original contracts and runs remain
unchanged. No manual beat marking is required.

## Question and fixed conditions

Can either existing spectral representation discriminate the intended passage when
alignment is supplied? Use the exact frozen `winner-four-bars-sync-proxy-v1` set
from 002, both frozen spectral feature/template definitions, the same 48 kHz audio,
2048-sample window at 12 kHz after four-sample averaging, and the same analysis
cadence. Both representations use the original 1/16-quarter template grid and decay.
Reuse the recorded alignment research; no new web search or research question slot.
This is a component investigation of the failed algorithm question.

Reconstruct the features in a separate diagnostic module without editing frozen
candidate files. Before interpreting results, verify reconstructed similarity against
the saved candidate confidence on every available unclamped emitted analysis frame.
Require maximum absolute difference ≤0.000002 for each representation and a nonempty
comparison. Unit checks cover the window origin and known synthetic tones. Any failure
invalidates the diagnostic, not the old candidate run.

Supply the interpolated reference position at the **center of the past-only window**,
not its right edge. It is privileged approximate alignment, not an observed note time.
Measure every analysis frame from the first full window to the crop end. Report the
frame count and clock span. No adaptive crop or label change is permitted.

## Measurements fixed before running

For each representation report:

- Similarity at the nearest template to supplied position; accept uses the unchanged
  RMS >0.0001 and similarity ≥0.65 conditions.
- The highest similarity within ±0.25 quarter of supplied position: an optimistic
  local match that can choose a different cell each frame, not a causal tracker.
- The best same-piece competing template outside ±0.25 quarter, both globally across
  four bars and within the original nominal-tempo search corridor. Report strict wins,
  ties (within 1e-9) and losses of the optimistic local match against these competitors.
  Include competitor counts; an absent competitor is excluded from that comparison.
- The strongest Dust-score template inside the same nominal search corridor, scored
  against Winner audio. This is a deliberately permissive wrong-score competitor.
  Digital silence has RMS zero and is rejected regardless of similarity.
- Similarity quantiles and margins, including the frozen 0.65 accept/reject rates.
- A descriptive threshold frontier: test every distinct observed score and the next
  representable cutoff above each, plus 0 and above 1. Find the maximum optimistic
  local positive acceptance while *each* competing-control acceptance (local wrong
  position and Dust score) is ≤5%. This uses the same data to describe a ceiling for
  a single cutoff, not to fit, retain or propose a production threshold. Report ties
  and the selected cutoff; silence must remain rejected. No population interval.
- Fixed sensitivity offsets of −200, −100, 0, +100, +200 ms applied to window-center
  reference lookup. Use only frames whose shifted center lies inside the crop for
  every offset. Report nearest-template acceptance on this common subset. This
  diagnoses timing sensitivity; it does not correct the sync file or score.

The local “correct” band is approximate and may contain acoustically identical
alternatives outside its boundary. A competitor win is representation ambiguity,
not a demonstrated musician error. All frames belong to one reused performance.

## Predictions, interpretation and stop

Prediction: supplying alignment still leaves weak score-template similarity or
competing matches, especially for the register/harmonic revision. Contradiction:
≥95% nearest-position acceptance at 0.65 with ≤5% competitor acceptance would point
primarily to alignment. If a single cutoff reaches ≥95% optimistic local acceptance
and ≤5% on each competing control, confidence calibration remains a plausible next
candidate change. Otherwise prioritize representation/template discrimination before
another tracking revision. A sensitivity offset improving acceptance by ≥10 percentage
points flags timing/template phase for investigation; it never retroactively repairs
labels. Mixed outcomes remain mixed rather than forcing a single explanation.

Run once for both frozen representations, then stop and publish numbered report 003,
private frame evidence, resource use and the next action. No new listener versions,
no positive Dust run and no bar expansion. Conservatively charge two feature/set
assessments to contract 1 (four previously used → six of twelve); candidate versions
remain two of six. Cap this diagnostic at five CPU minutes within the remaining
two-hour total. Record failures and never erase budget history. The original
sync-proxy two-version sub-batch stays closed; this is the separately authorized
component diagnostic, not a third trial hidden inside it.
