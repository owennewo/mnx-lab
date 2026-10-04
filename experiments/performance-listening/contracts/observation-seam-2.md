# Observation seam 2 — explicit frame selection and a compute-inclusive clock

2026-10-04, experiment 037; **GPT-6.1-Sol (high) in Codex**.
Version **observation-seam@2**, replacing seam 1 for future producers only.
The separate [hand cases](../bench/oracle-events/observation-seam-2.json) require an
independent audit before any live-cursor verdict. Historical seam-1 measurements stand.
This version defines arithmetic, not a new listener or a claim of acoustic accuracy.

## Common representation and provenance

Pinned Basic Pitch 0.4.0 ICASSP 2022 ONNX model SHA-256:
`2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec`.
Keep float32 note/onset maps (88 bins, MIDI 21–108), contour (264 bins), confidence,
input hash, model identity, source commit and producer hashes. Times are seconds
from clip start. Every frame carries `audioTime`, `deliveryAt`, `availableAt`;
every decoded event carries `onset`, `end`, `availableAt`, MIDI and confidence.
`deliveryAt` is the nominal input prefix clock; `availableAt` includes production cost.

A **frame reduction** below threshold is `{midi:null, confidence:<maximum>,
kind:'unpitched'}`. It asserts neither an onset nor silence. A decoded **event** with
`midi:null` means an explicitly detected pitchless onset. This adapter emits no such
event; uncertainty never establishes a dead note. Frame and event records are typed
separately, so a null pitch cannot silently convert uncertainty into an onset.
Reduction chooses the largest note activation, inclusive threshold 0.3, lowest bin
on a tie, MIDI = 21 + bin. No score or actual-performance labels reach inference.

## Causal resampling and frame selection

Input samples have zero-based indices 0…M−1 at 48,000 Hz. Output sample j uses
p = j*320/147, k = floor(p), and linear interpolation of input indices k and k+1.
It **exists iff index k+1 has arrived**, i.e. k+1 < M or M ≥ k+2, even when p is
an integer and the right sample's interpolation weight is zero. This specifies an
index, never a count. No tail flush, HQ filter, future input or global normalization.
N is the number of existing resampled samples. Live model windows hold the latest
43,844 samples with left zero padding. Inference is scheduled at input-clock .1, .2,
.3… seconds, at the first delivered chunk boundary reaching that schedule; the
ordinary 48k/480 delivery hits them exactly. Finish adds no new live window.
An acoustic onset just after .1 can wait almost .1 s for the .2 window; the inference
cadence is a waiting bound, not a claim that any frame hears the onset.

Local frame j describes coordinate q = N−43844+256*j and audioTime = q/22050.
Edge0 permits j=0…171; edge15 permits j=0…156. Emit in increasing j only when
q ≥ 0, audioTime ≤ deliveryAt, and **q strictly exceeds the last emitted q**.
The watermark starts at −infinity, is retained between windows, advances for every
emitted frame (including unpitched), and never compares equality alone. Frames are
immutable; no retrospective re-emission. All frames from a call share its deliveryAt
and compute-inclusive availableAt. Watermark coordinates are integers, avoiding
float equality drift. Latest nominal gap is 68/22050 for edge0, 3908/22050 for edge15;
compute and waiting add to this but the model's receptive field is not proved here.

## Measured production and decision time

Use a monotonic wall timer; durations are unrounded seconds. Clip time zero is the
first scheduled input sample. The runner serializes processing on one lane. Initialize
that lane's previous completion F to the measured start/setup duration at time zero
(shared model loading outside the example is reported separately). For call k,
nominal delivery D_k = delivered input sample count / input sample rate, elapsed
production wall time C_k includes slicing/copying, resampling, window assembly, model
waiting/inference, reduction and chain work before emissions are returned:

`S_k = max(D_k, F_previous)`

`F_k = S_k + C_k`

Every frame emitted by call k gets availableAt = F_k. Runner-owned madeAt of **all**
returned live decisions is F_k; a listener cannot backdate it. This conservative
batch stamp includes processing after a frame was reduced. Backlog is F_k−D_k;
idle delivery gaps can clear it. Finish uses D = clip duration and the same recurrence,
including measured finish work; start emissions use measured initialization completion.
Offline frame/event availability is likewise clip duration plus its measured
whole-clip inference/decoding/assembly time, or later if a serialized lane is busy.
Caching may reuse musical observations, never pretend fresh compute was measured.

`refersTo` remains the nominal audio-delivery time addressed by the chain's position
statement, or an explicitly earlier retrospective time. Do not shift audioTime, onsets,
ends or refersTo by compute. Require 0 ≤ refersTo ≤ deliveryAt ≤ madeAt. A frame can
use delivered context through D_k, never future input through F_k. Deadlines read
madeAt against the actual distinguishing onset, so they include production and backlog.
These clocks model scheduled audio plus measured service, not microphone/device/UI
latency. The host's sustained cost ratio remains provisional and ≤0.25; no p99 gate.
All setup/feed/finish wall time remains in that cost denominator, even when no frame
or decision is emitted. Historical nominal-clock records cannot be relabelled as this.

Measured wall time varies across identical reruns. Prefix causality therefore checks
identical payloads/audioTime/refersTo and emitting delivery sample indices for the same
prefix under different futures; it excludes observed wall durations from equality.
Separately check the recurrence and causal sample access. Deterministic injected costs
in hand cases check exact madeAt arithmetic; they do not measure native runtime cost.
A future runner adopting this seam must retain per-call delivered sample count,
measured elapsed duration, computed completion, frames and decisions to audit both.

## Offline arithmetic, unchanged musical timestamps

Use the pinned official HQ whole-clip resampler, windows 43,844, hop 36,164, leading
pad 3,840 and zero tail padding. Remove raw frames 0…14 and 157…171, concatenate
142 frames/window, retain the **first** floor(L*86/22050) frames (discard surplus
at the tail), where L is the resampled original clip length before padding.
Raw stitched index i maps to window w=floor(i/142), raw frame 15+(i mod 142).
Its nominal grid time is `(256*i−188*w)/22050`.

Preserve upstream decoded time
`t(i) = i*256/22050 − floor(i/172)*(188/22050 + .0018)`.
Decode onset and end frame indices by this same t, not by adding note duration to an
onset or applying the live grid. Keep decoder thresholds onset .5/frame .3, 11-frame
minimum, inferred onsets/melodia, onset-then-MIDI ordering and no score filtering.
These upstream DSP/decoder algorithms are pinned by source/model, not fully reproduced
by a hand timing oracle. Frames' nominal coordinates are not physical attack labels.

At i=142 the upstream axis is 188/22050 (8.526 ms) later than the nominal grid;
at i=172 it is 1.8 ms earlier; i=344 exercises two correction terms and another window.
Carry the exact difference for any compared index; the audit's roughly −1.8 to +8.5 ms
is illustrative, **not a uniform bound for arbitrarily long recordings**: the slopes
differ slightly. First-window offline/live parity remains unreachable by these rules
(different resamplers and padding, N=40004 is not an inference boundary).

## Oracle scope and adoption

The [separate JSON cases](../bench/oracle-events/observation-seam-2.json) state inputs,
hand arithmetic and expected answers; [its freeze](../bench/oracle-events/freeze-observation-seam-2.json)
pins bytes before implementation. Rational objects in expected values mean numerator
/ denominator; numerical comparison tolerance is 1e-12 seconds, exact for integers,
IDs, null and booleans. This is validation precision, not a new acoustic tolerance.
An independent session rederives every new case from this file before any cursor
judgement. Case agreement by this author and its implementation is not that audit.

No frozen listener/runner is edited here. A future separately versioned producer/runner
must actually propagate these clocks before claiming seam-2 evidence. The chain remains
monophonic, refuses adjacent identical pitches, and has no chord/dead-note claim.
