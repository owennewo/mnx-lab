# Streaming state 040 — bounded primary-source check

2026-10-05; **GPT-6.1-Sol (high) in Codex**. Question: what can be cached without
changing the pinned Basic Pitch observation semantics?

[Spotify model at 9991303](https://github.com/spotify/basic-pitch/blob/9991303bba609a3b93089d13ec80d1d495083596/basic_pitch/models.py)
constructs CQT, then NormalizedLog, then convolutional branches. The pinned installed
[signal source](https://github.com/spotify/basic-pitch/blob/9991303bba609a3b93089d13ec80d1d495083596/basic_pitch/layers/signal.py)
uses extrema across frequency and time in NormalizedLog. The remote raw signal fetch
failed, so its exact body was read from the already-pinned local package; native
source provenance is recorded by hash in the run, not inferred from the failed fetch.
[Official inference](https://github.com/spotify/basic-pitch/blob/9991303bba609a3b93089d13ec80d1d495083596/basic_pitch/inference.py)
iterates windows over the leading-padded audio and zero-pads each short tail.

Inference: old normalized neural features are not necessarily reusable when new
context changes window extrema. A new-only neural backend must account for this,
CQT alignment/edge context and downstream receptive fields. This does not prove that
cropping downstream convolutions or caching pre-normalization DSP cannot be efficient;
no such native intervention is tested in040. Incremental input resampling and a bounded
ring are independent of this issue and can preserve frozen whole-window input tensors.
The oracle/state producer is the prerequisite before judging a changed live backend.
No training, transfer, guitar accuracy or device-cost claim follows from this check.
