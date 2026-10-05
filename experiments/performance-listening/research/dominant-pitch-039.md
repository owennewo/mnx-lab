# Dominant pitch 039 — bounded decoder source check

2026-10-05; GPT-6.1-Sol (high) in Codex.

The [pinned Spotify decoder](https://github.com/spotify/basic-pitch/blob/9991303bba609a3b93089d13ec80d1d495083596/basic_pitch/note_creation.py)
uses predicted/inferred onset peaks at onset_thresh, extending them while frame energy
persists; its optional Melodia branch also decodes remaining frame energy without
requiring a predicted onset. Both branches retain the minimum-length rule. Local
installed source was read beside the published pinned source; provenance is verified
by the runner against the original run. The API permits disabling Melodia but that
alone does not remove onset-qualified ghosts.

The preserved Martin s2-45 model maps give G2 maximum onset .5364, exceeding .5.
Its decoded G2 confidence is .3984 beside B4 .8354. These are development traces,
not independent calibration evidence. **Inference:** a frame-local strongest-pitch
mask may suppress the weaker concurrent ghost while preserving the true monophonic
line; attack transients and decay crossings are alternative explanations for failure.
This mask is our listener policy, not a published Spotify claim. No thresholds are
fitted, no chord or live timing result is imported, and the model/decoder stay pinned.
