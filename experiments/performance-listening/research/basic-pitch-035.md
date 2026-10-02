# Basic Pitch 035 — bounded source refresh

2026-10-02; GPT-6.1-Sol (high) in Codex. Question: which parts of the official
model/decoder can be reused unchanged, and what timing is lost by window trimming?

Primary sources checked:

- [Spotify inference source at 9991303](https://github.com/spotify/basic-pitch/blob/9991303bba609a3b93089d13ec80d1d495083596/basic_pitch/inference.py):
  22.05 kHz windows, leading half-overlap padding, removal of 15 output frames per
  edge, and ONNX output-name mapping. Locally retained source bytes in guitar-nn
  agree with its provenance pin. The official method is offline; its trim does not
  establish a causal 200 ms cursor.
- [Spotify decoder at the same commit](https://github.com/spotify/basic-pitch/blob/9991303bba609a3b93089d13ec80d1d495083596/basic_pitch/note_creation.py):
  default threshold and minimum-length decoding, plus the model_frames_to_time
  correction. It supplies observed note times, not score alignment. Applying those
  times to generated performance intervals is our experiment, not an upstream claim.
- [ONNX Runtime session options](https://onnxruntime.ai/docs/api/js/interfaces/InferenceSession.SessionOptions.html):
  CPU execution/thread configuration. One-thread settings avoid treating parallel
  CPU oversubscription as model cost; identical input tensors measure Python/native
  numerical parity separately from preprocessing or causal accuracy.

Inference: untrimmed recent frames may reduce availability delay but lose context;
using 15 frames delays the latest nominal coordinate by about 177 ms before delivery
quantization and confirmation. Only measured event deadlines can say whether either
is usable. Digital-zero rejection says nothing about quiet room noise. No dataset,
training-overlap or generalization claim is imported from the other repository.
