# Observation seam 4 — physical representation and complete state fixtures

2026-10-05, experiment 041; **GPT-6.1-Sol (high) in Codex**.
Inherits [seam 3](observation-seam-3.md) and its inherited seam 2, except the explicit
clarifications below. Separate [hand cases](../bench/oracle-events/observation-seam-4.json)
are frozen before implementation; independent audit is required before cursor judgment.
Earlier definitions/cases/verdicts are historical and never rewritten.

## Representation and numerical comparison

Streaming interpolation uses p=j*48000/22050, k=floor(p), f=p-k and
x[k]*(1-f)+x[k+1]*f in binary64, then IEEE-754 binary32 round-to-nearest ties-to-even
at tensor storage. Both neighbors must exist even at integral p. The new I3 expected
sample is binary32 bits 0x41479e7a, equivalently 13082234/1048576; its pre-storage
rational 1834/147 is explanatory arithmetic only. Compare physical sample bits exactly.

Inherited `pitch` cases P1–P5 explicitly test abstract binary64 supplied activations;
no float32 conversion occurs in that operation. Inherited seam-3 `values` I3 explicitly
tests the pre-storage helper, not the tensor. New `floatPitch` cases cast all supplied
activations to binary32 before reduction; preserve the physical winning confidence.
Physical expectations use `f32Bits` objects, converted from the stated hexadecimal
IEEE bits, never silently compared as abstract decimals. Confidence/sample comparison
is exact bits for these cases; times/rational arithmetic use 1e-12 seconds; IDs,
integers/null/booleans exact. This resolves inherited abstraction without changing
historical answers. Native activation diagnostics use absolute tolerance 1e-6, rtol0,
and separately report bit identity and exact MIDI/kind; diagnostics grant no stage pass
and do not erase float32 differences.

## Scheduling, normalization and live chain clock

At a delivery M infer iff M >= next; then next=4800*(floor(M/4800)+1). `scheduled`
depends on the prior next/delivery history, not on M being a multiple of4800. N40004
at M87084 can be a first irregular inference boundary (next86400), but not when next
is91200. Equal padding is only geometry; HQ versus linear resamplers still differ.
This replaces the inherited unconditional inference-boundary impossibility claim.

The scalar normalization operation is a **toy diagnostic on already-computed log
powers**: (x-min)/(max-min), or all zero for a constant vector. It is not the pinned
DSP implementation. The native pinned NormalizedLog computes logPower=10*log10(x²+1e-10),
subtracts its minimum across frequency and time, divides by the maximum offset (zero
when zero), in the graph's float32 operation order. Native inference must recompute
these global extrema before cropping; hand toy numbers establish no native parity.

Frame/decision availableAt/madeAt equal the entire measured call completion, but the
unchanged live chain's clock/refersTo remain deliveryAt. It cannot read compute-inclusive
time as if more audio arrived. Start decision refersTo must equal0. All actual times,
service and previous completion must be finite and nonnegative; future refersTo is
rejected. Nonfinite values in JSON inputs are represented by `special: NaN/Infinity`.
Cost work includes start, all feeds (including emission-free/zero-length calls) and
finish. Shared load is separate. Finish has no resample/model tail flush; old records
are immutable. Reset clears populated ring, pending neighbor, counters, cadence,
watermark, history, clock/work, but does not unload the shared model.

## Hand state fixture operations

`lifecycle4` inputs supply setup/start emissions, an ordered feed list (chunks of actual
48k input, measured service, optional frame maps/decision emissions), finish service/
emissions and the second setup/emissions. Report all completion times, model-call
count, work/cost, unchanged old history and reset state. A `ramp` chunk means its input
sample value equals its global 48k input index; it is not a resampled-index ramp.
Reduced frames use an all-zero172x88 map where stated; every null frame moves watermark.

`chunkTrace` feeds explicit chunk arrays, recording generated count, newly generated
physical samples, retained input neighbor/global offset and next output j each time.
Ring probes supply M input ramp samples, ordinary chunks specified, and record global
generated count, retained input/ring sizes, model-window start and first/last binary32
values, plus exact equality to one-prefix interpolation. Eviction never resets global
indices; each j is generated once. A `prefixTrace` pair supplies every delivery/service
and emission, then selects records by emitting input index <= cutoff; each clock
recurrence is checked separately and variable completion stamps excluded from equality.

Offline length must be a nonnegative safe integer; zero length still has the leading
3840 padding (one window, zero retained outputs). Windows at each multiple36164
strictly below L+3840; exact-hop equality excludes a new window. `offlineTensor` uses
an explicit small ramp L (values0..L-1), leading3840 zeros, window43844, hop36164 and
zero tail; record each window's global start, zero-tail count and nonzero boundary
probes. It checks construction geometry, never HQ resampling equivalence.

## Native adoption checklist and boundaries

The native backend takes only the causal float32 window and selected local indices.
Pinned graph/weights remain unchanged except insertion of a temporal slice after
global normalization and dynamic temporal reshapes downstream. The longest neural
branch has ten frames of context on each side; include it, clipping to original
window boundaries, and emit no context output. Keep original right boundary padding.
All three selected maps must be compared against the frozen whole model on identical
tensors; retain inputs/maps/hash/shape and float32 discrepancies. Full CQT/DSP is still
recomputed, so this is incremental neural output computation, not incremental DSP.
No stale normalized/neural activations may be reused merely because raw context agrees.

Native adoption must retain source/model/environment/runtime/graph/input hashes;
per-call input count, input-tensor hash, selected indices/q, measured elapsed service,
completion, all frames and decisions; native prefix payload checks; separate shared
loading and candidate-only fresh cost. Reference comparisons must never enter candidate
service cost. Start includes score compilation and reset; feed includes input slicing,
all copies/waits/resampling/DSP/neural/reduction/chain; live finish is measured and emits
no new live inference. Offline @2 component records can be cited only when all relevant
sources, adapter, input/label and artifacts verify unchanged. This is not fresh offline
cost. Global timestamps describe scheduled audio plus host compute, never microphone/UI.

HQ DSP, official decoder defaults/internals, acoustic onsets and listener transitions/
refusals remain pinned-producer/native adoption obligations, not claimed covered by a
scalar timing oracle. 041 must validate its native backend and disclose remaining
coverage. The audited event oracle/gates remain unchanged. Monophonic refusal,
three-frame confirmation and no chord/dead capability are unchanged listener behavior.
