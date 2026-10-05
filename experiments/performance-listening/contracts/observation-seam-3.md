# Observation seam 3 — streaming lifecycle and explicit cost accounting

2026-10-05, experiment 040; **GPT-6.1-Sol (high) in Codex**.
Version **observation-seam@3**. Inherits all [seam 2](observation-seam-2.md) rules,
except the clarifications below. Historical producers and verdicts are unchanged.
The separate [new hand cases](../bench/oracle-events/observation-seam-3.json)
and all 36 inherited cases require an independent audit before any listener verdict.

## Cost and decision ownership

Sustained cost ratio is **(per-example setup + sum of every feed call's elapsed wall
seconds + finish elapsed wall seconds) / input audio duration seconds**. These times
are the numerator, correcting seam 2's erroneous word “denominator”. Include calls
that emit nothing and all copies, resampling, model waiting, reduction and chain work
inside each measured call. Count each operation once. Include finish even with no
emissions. Shared model loading outside the example is reported separately, never
silently discarded: no cold-start/device claim follows from its exclusion. The
approved ratio gate is inclusive at .25; zero-length audio has no ratio and is refused.
No rounding before comparison. Timers, serialized completion recurrence and backlog
remain seam 2's. This clarifies the existing work/audio measure, not a new gate.

Runner-owned madeAt overwrites any same-named field returned by a backend or listener.
Keep retrospective refersTo unchanged; reject nonfinite or negative times and
refersTo > deliveryAt. Start emissions refer to time zero and get measured setup
completion. Start clears all input, resampler, cadence, watermark, clock, history
and cost state for the next example. Finish advances the lane with its measured
service, stamps returned emissions and appends history without revising old entries;
it invokes no live inference or resampler tail flush. Offline work queued behind
previous completion uses max(duration, previous completion) + service.

## Streaming input and scheduling

Keep only the latest 43844 float32 resampled samples in a ring and the input neighbor
needed by the next interpolation. Generate each existing output sample exactly once,
using seam 2's right-index rule and linear weights, then round it to float32 exactly
as the frozen NativeModel input tensor does. Old input samples can be evicted after
that next neighbor is known; index coordinates remain global. At inference, expose
latest-window contents in chronological order with zero left padding, never future
samples. Backend requests contain the input tensor and nominal sample count only;
no score or performance label is an inference argument.

The next scheduled input index starts at 4800. At the first delivered chunk boundary
that reaches it, infer **once**, using that delivered prefix, and advance next to the
first multiple of 4800 strictly greater than the delivered count. Multiple missed
boundaries are consumed, not replayed as duplicate same-prefix windows. This extension
makes irregular chunks explicit; normal 480-sample delivery is unchanged. Finish never
flushes a partial cadence. Every emitted q, including an unpitched one, advances the
strict integer watermark. A fresh start restores a null watermark (negative infinity).

This is an input/state streaming kernel with an injected backend, **not a claim of
incremental neural inference**. A backend returning the pinned whole-window maps
still computes the whole model. Neural optimizations must independently establish
map/selection equivalence before using these rules to judge a listener.

## Prefix comparison

Compare records whose **emitting delivery sample index** is at or before the common
prefix; equal ordered payloads, audioTime, refersTo and delivery indices are required.
Exclude measured elapsed seconds, completion, madeAt and availableAt from equality.
Do not select by madeAt: otherwise slower identical processing can lose prefix
records. A changed payload or emitting delivery index fails. Separately verify each
run's completion recurrence and delivered sample access. This exclusion permits
wall-time variation, never audioTime or payload variation. No aggregate pass can
substitute for fresh native costs.

## Offline and representation details

Offline length L is nonnegative integer original resampled length. Leading pad3840
makes total L+3840. Windows start at each multiple of36164 strictly below that total:
count ceil((L+3840)/36164). Each input has43844 samples and zero tail padding. Retain
floor(L*86/22050) output frames, including nonintegral products, and use seam2's
upstream endpoint/long-axis formula, with no uniform offset bound.

Maps are float32, note/onset88 bins and contour264 bins per frame. Physical float32
confidence is compared against .3; ties use the lowest bin. Decoded events sort by
onset then MIDI and preserve confidence/end without score filtering. Null reduced
frame means uncertain pitch; this backend emits no detected pitchless event and no
dead-note assertion. Decoder defaults and @2's fixed offline monophonic mask remain
unchanged; this seam does not introduce a neural or decoder intervention.

## Coverage boundaries and adoption evidence

| Obligation from audit 2 | Hand coverage or explicit adoption boundary |
|---|---|
| Cost/setup/empty/finish/shared load | K1–K4, S5 and inherited C1–C7; all feeds count even empty |
| Prefix with variable wall time, backdating/refersTo | F1–F3, D1–D3 and S5 |
| Irregular cadence, eviction, no finish flush/reset | S1–S5; S5 freezes zero model calls before cadence and immutable history |
| Unpitched watermark | S4 and inherited L1–L6 |
| Fractional/minimal interpolation | I1–I4; inherited R0–R7; no-flush S5 |
| Offline fractional length, windows/tail, busy clock, long axis | O8–O11; inherited O1–O7/C3/C7; equal pad is not resampler parity |
| Float32 shape, pitch/null/event ordering | P6, E1–E2 plus inherited P1–P5/T8; dimensions/provenance must be checked in actual backend adoption |
| HQ DSP, full official decoder, model/source hashes | Pinned algorithms, not scalar-oracle reimplementations. Native adoption must verify model/environment/source/input hashes and maps/events against the frozen producer; gates .5/.3/min11/inferred/Melodia are unchanged |
| Musical-cache reuse versus fresh cost | Existing source/input/adapter hash rule; reuse cannot count as fresh timing. Per-call delivery/service/frames/decisions must be retained and hashed in every measured native run |
| Score blindness/causal sample access | Backend signature contains no score/labels; adopted runner must validate bytes and prefix tests on its measured inputs |
| Chords/adjacent pitches/transition logic | Frozen listener refusal/behavior, outside this timing oracle; no chord/dead claim or invented oracle verdict |

N1/N2 use already-computed log-power values solely to demonstrate the nonlocal
min/max dependency. They are not ONNX map parity or native runtime evidence.
The pinned NormalizedLog layer reduces across frequency **and time**; a change in
window extrema can alter retained normalized features. Exact neural caching therefore
needs recomputed normalization/context, not simply retaining old normalized frames.
This does not prove efficient inference impossible.

Expected rational objects mean numerator/denominator; case comparison precision is
1e-12 seconds, exact integers/IDs/null/booleans as in seam2. Frozen answers never change
in response to implementation results. Independent audit grants no native timing,
acoustic accuracy, or stage verdict by itself.
