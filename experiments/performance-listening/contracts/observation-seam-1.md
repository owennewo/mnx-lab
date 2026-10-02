# Observation seam 1 — Basic Pitch audio time and availability

2026-10-02, experiment 035; **GPT-6.1-Sol (high) in Codex**.
Version **observation-seam@1**. Not a new evaluator or a progression amendment.
Timing hand cases below require an independent audit before a live-cursor verdict.

## Common shape

Model: Basic Pitch 0.4.0 ICASSP 2022 ONNX, SHA-256
`2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec`.
Every artifact names input/audio hash, source commit, producer hashes and model identity.
Maps are float32 note/onset (88 bins, MIDI 21–108) and contour (264 bins), in [0,1].
Each frame has `audioTime`, `availableAt`, and confidence; each decoded event has
`onset`, `end`, `availableAt`, `midi`, confidence. Times are seconds from clip start.
`midi:null` represents a pitchless onset, distinct from no observation. This model
adapter emits no such onset: lack of a pitch is uncertainty, never an asserted dead
note. Arrays retain all maps; the live monophonic reduction selects the highest note
activation at threshold .3, ties by lowest bin, or null below threshold.
No score, label or injected-error recipe reaches model inference or decoding.

## Offline producer

Pinned official `run_inference`, Librosa HQ resampling to 22,050 Hz. Input windows
43,844 samples, hop 36,164, leading zero pad 3,840; tail pad zeros. Output 172 frames;
15 removed from each end, concatenate 142/window and trim to floor(length*86/22050).
Stitched frame i uses the upstream decoder time:
`i*256/22050 - floor(i/172)*offset`, where
`offset = (256/22050)*(172-43844/256) + .0018`.
This historical formula is preserved, including its unusual reset every 172 stitched
frames; no claim that it is an exact physical frame centre. Offline every frame and
event is available only at the end of the complete clip. Raw NPZ stores its explicit
frame-time axis; availability is the clip duration in the paired hashed JSON.
Official decoder defaults: onset .5, frame .3, minimum 11 frames, inferred onsets,
melodia. Events sorted by onset then MIDI before alignPitches; no score filtering.

## Live producer

48,000 Hz/480 samples, runner owns `madeAt`. Output sample j is the linear
interpolation at `p=j*48000/22050`; it exists only when floor(p)+1 is delivered,
including the exact-integer case. No future sample, tail flush, HQ filter or global
normalization. Float32 model input is the latest 43,844 causal resampled samples,
zero padded on the left. ONNX runs every .1 s at the next chunk boundary, CPU with
one intra/inter-op thread, in a worker in the same process; synchronous wait cost is
included by executeSeam. Model weights and model session are shared across examples,
load cost separately reported; resampler/listener state is always fresh.

For resampled prefix length N, window start = N−43844. Local output frame j describes
`audioTime = (N−43844 + 256*j)/22050`, a nominal analysis-grid coordinate.
No upstream stitched-time correction applies to rolling windows. Edge0 uses j=0…171;
edge15 uses j=0…156. Negative times and times already emitted are discarded; every
frame is immutable, available at the current input clock. Thus a frame near the right
edge can still use all delivered context, but never context after `availableAt`.
The two policies have equal compute; their frames differ in withheld recent audio.
Last possible frame's nominal gap is `(43844−171*256)/22050 = 68/22050` for edge0,
and `(43844−156*256)/22050 = 3908/22050` for edge15. Quantized inference adds up to
100 ms of waiting; confirmation adds frames; model context effects may add more.
These are frame-coordinate gaps, not measured acoustic latency or a receptive-field
proof. Prefix invariance and actual event deadlines are separately measured.

The incumbent's three-consecutive-frame live confirmation and stay/skip transition
costs are copied unchanged. Support is refreshed at observation delivery clock, as in
the incumbent; position refersTo and runner madeAt use that clock. Multiple frames
can arrive in one batch; they all carry the same availability. At finish the offline
assessment uses independently decoded whole-clip events; live history stays intact.
The model sees polyphonic maps, but this chain still refuses polyphonic and adjacent
identical-pitch scores. No chord/re-articulation capability is claimed by this seam.

## Hand-worked timing cases for the independent auditor

| Case | Input | Expected arithmetic |
|---|---|---|
| T1 | 480 input samples delivered at .01 s | j=0…220 exist: j=220 needs floor(220*320/147)+1=479 <480; j=221 needs482, unavailable; N=221 |
| T2 | 4800 samples delivered at .1 s | j=0…2204 exist, N=2205; start −41639; edge0 j171 time .096916100 s, edge15 j156 −.077233560 s; edge0 emits j163…171, edge15 emits none |
| T3 | 48000 samples delivered at 1 s | N=22050; start −21794; edge0 j171 time21982/22050=.996916100 s; gap .003083900 s; edge15 j156 time18142/22050=.822766440 s; gap .177233560 s |
| T4 | edge15 frame j156 in T3 | availableAt=1 s, audioTime=.822766440 s; it may use audio through1 s, never beyond; madeAt=1 s even if retrospective refersTo were earlier |
| T5 | first offline window and stitched frame0 | raw frame15; leading pad3840, so nominal raw coordinate(15*256−3840)/22050=0; official stitched frame0 time0; offline availableAt=clip duration |
| T6 | offline stitched frame172 | offset=(188/22050)+.0018=.010326077097505668 s; time=172*256/22050−offset=43844/22050−.0018=1.986590023 s |
| T7 | same prefix, altered future after sample48000 | all live emissions made at ≤1 s must equal; offline events may change and are not causal |
| T8 | pitched bins below .3 with an onset-map peak | midi null indicates no pitched observation; no decoded pitchless onset is asserted; no dead verdict follows |

Audit should report all ambiguities rather than infer acoustically exact timing.
