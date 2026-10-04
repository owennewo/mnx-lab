# Observation clock 037 — bounded primary-source check

2026-10-04; GPT-6.1-Sol (high) in Codex. Question 27 only; no model training,
threshold search, dataset inspection or acoustic experiment.

The [pinned Spotify inference source](https://github.com/spotify/basic-pitch/blob/9991303bba609a3b93089d13ec80d1d495083596/basic_pitch/inference.py)
removes half-overlap frames, flattens windows and keeps the prefix up to the original
length's frame count: surplus is discarded from the tail. Its window hop subtracts
30 analysis hops; input has half-overlap leading padding. This is offline processing.
The [0.4.0 constants](https://github.com/spotify/basic-pitch/blob/v0.4.0/basic_pitch/constants.py)
define annotation FPS by integer division of sample rate by FFT hop (86, not 86.13).
These pin seam 2's offline trim cases; they do not define a causal availability clock.

The [pinned note creation source](https://github.com/spotify/basic-pitch/blob/9991303bba609a3b93089d13ec80d1d495083596/basic_pitch/note_creation.py)
maps both onset/end frame indices through model_frames_to_time, with the historical
172-frame correction and the 0.0018-second term. MIDI offset is 21. The official decoder
is more complex than a timing oracle, so seam 2 claims arithmetic coverage only.

Local inference: the stitched axis and the 142-frame window grid have slightly different
slopes as well as different step points. The audit's approximately −1.8 to +8.5 ms is
useful on short examples, not an all-length bound. Keep the exact per-index difference.
Serial completion max(delivery, previous completion)+measured elapsed time is our
compute-inclusive convention, derived from the approved contract amendment; it is not
an accuracy or latency claim from Spotify. No microphone/UI/device latency is measured.
