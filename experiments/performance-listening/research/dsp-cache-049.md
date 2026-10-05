# Exact DSP cache eligibility — sources for 049

2026-10-05, GPT-6.1-Sol (high) in Codex. Bounded question: does audio overlap
imply reusable pinned CQT columns under the unchanged request grid?

- [ONNX Conv operator](https://onnx.ai/onnx/operators/onnx__Conv.html), operator
  schema read 2026-10-05. Strides locate kernel applications relative to the input.
  This documents coordinate geometry, not float32 equality across rewritten kernels.
- [Spotify signal.py](https://github.com/spotify/basic-pitch/blob/main/basic_pitch/layers/signal.py),
  read 2026-10-05 and checked against the installed basic-pitch 0.4.0 source used
  by 041. NormalizedLog takes extrema across time/frequency after log power.
  Reusing a normalized column with old extrema therefore needs additional proof.
  The installed source and original ONNX graph, rather than drifting main, are pinned
  in 049's evidence. No external performance result is used as a local verdict.

Local graph inspection shows highest-octave CQT Conv temporal stride 256 and 256-wide
kernels, repeated decimation branches, then global ReduceMin/ReduceMax before neural
cropping. **Inference to test:** adjacent 2205-sample window movement changes stride
phase; same raw overlap is not same native CQT input coordinate. A 256-request phase
cycle exceeds the raw window. Boundary reflection/decimation make matching phase a
necessary condition, never sufficient native parity. Whole-input bit equality would
allow deterministic full-DSP memoization regardless of phase, so 049 counts it separately.
A negative census does not rule out equal-content primitive patches or a multi-phase
DSP implementation. Those methods would need their own operation/numerical evidence.
