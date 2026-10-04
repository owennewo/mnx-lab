# Quiet-noise 038 — bounded source check

2026-10-04; GPT-6.1-Sol (high) in Codex. Question 29: does a fixed quiet pink-noise
control trigger either unchanged listener?

- The installed FFmpeg 8.0.1-3ubuntu2 filter help exposes `anoisesrc`'s pink color,
  seed, sample rate and frame size. The runner pins the installed binary/version and
  exact invocation, verifies repeated raw generation, then freezes actual WAV hashes.
  [Official source at n6.1.1](https://raw.githubusercontent.com/FFmpeg/FFmpeg/n6.1.1/libavfilter/asrc_anoisesrc.c)
  shows a seeded generator followed by a seven-state pink filter. The web lookup of
  n8.0.1 was unavailable; the older source describes the family, not proof of the
  installed implementation's byte identity. Binary and output hashes provide that pin.
- [Pinned Spotify model source](https://raw.githubusercontent.com/spotify/basic-pitch/9991303bba609a3b93089d13ec80d1d495083596/basic_pitch/models.py)
  applies `signal.NormalizedLog` to the CQT before batch normalization. The installed
  0.4.0 `layers/signal.py`, lines 154–185, squares magnitudes, logs power with a 1e-10
  floor, subtracts each example's minimum across time/frequency, and divides by the
  maximum offset with divide-no-nan. Its path/hash is pinned by this run. The web
  fetch of that signal file was unavailable; the local primary source was read.

Inference: absolute quietness is not a guaranteed model rejection rule because its
representation rescales the spectral contrast within each window. Noise can still
produce no note activation, or notes outside the handed score; only decoded events
and supported score claims distinguish those outcomes. This experiment does not
ablate normalization, so it cannot establish that normalization causes a false claim.
The −60 dBFS level is the user's fixed control, never a fitted threshold.
