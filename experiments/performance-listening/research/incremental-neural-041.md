# Incremental neural output computation — 041

2026-10-05. **GPT-6.1-Sol (high) in Codex**. Bounded question: can the pinned model
compute newly emitted neural outputs without stale global normalization?

[Spotify model source](https://github.com/spotify/basic-pitch/blob/9991303bba609a3b93089d13ec80d1d495083596/basic_pitch/models.py)
and the pinned installed signal.py place global NormalizedLog between CQT and
convolutional branches. The remote model page failed to open; the pinned local ONNX
and installed signal source were inspected statically, with hashes retained by the
run. No inference was run to choose a method. NormalizedLog squares magnitudes,
adds1e-10, converts to dB, subtracts global frequency/time minimum and divides by
maximum offset with zero handling. The graph's neural temporal kernel radii sum to
9 for note,10 for onset (contour1+2, note3+3, onset1). They use unit temporal stride
and symmetric zero padding; harmonic stacking shifts frequency only.

[ONNX graph extraction documentation](https://onnx.ai/onnx/api/utils.html) describes
subgraphs bounded by tensor inputs/outputs; local ONNX1.17 utility is pinned separately
from the untouched Basic Pitch environment. The chosen intervention instead inserts
a time Slice after global normalization and makes the neural temporal reshapes dynamic,
retaining the whole DSP and original weights. This is a local inference from graph
dependencies, not published evidence that it meets a guitar latency/cost gate.

Alternative explanation: CQT already dominates work, so neural cropping may preserve
outputs but still exceed .25. Float32 kernels and crop padding may alter outputs even
with adequate receptive context. Identical-tensor comparisons and fresh per-call
measurements resolve those alternatives. No caching of old normalized activations,
training, score-aware crop or held-out selection is introduced. The seam-4 audit is
independent-session work; diagnostic tolerance never supplies a formal listener pass.
