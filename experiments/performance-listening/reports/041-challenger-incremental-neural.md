# 041 — Incremental neural inference and seam 4

## Pre-registration

2026-10-05. **GPT-6.1-Sol (high) in Codex**. Experiment 041, challenger track,
run 5 of 8 in the sampled-guitar promotion batch. Questions 30 and 36 together,
as the user's 2026-10-05 direction in the research log authorizes. Exactly one new
live producer, basic-pitch-chain@3; the @2 offline component stays frozen.

### Question and alternatives

Can restricting the neural convolutions to newly selected frames plus their temporal
context lower sustained cost below .25 without changing those frames, while seam 4
resolves the seam-3 audit's disagreement, ambiguities and uncovered state/cost rules?
Global normalization prevents retaining old normalized activations unchanged. A
new-frame neural path can instead recompute the pinned full-window CQT/normalization
and crop only after normalization. This preserves global extrema but may leave DSP
as the dominant cost. Neural crop context/padding or float32 convolution differences
may also change selected activations. Full maps versus selected cropped maps on the
same tensors distinguish these explanations; per-call timings distinguish cost from
cadence/acoustic latency. This is incremental neural output computation, not incremental
CQT, and never reuses stale normalized activations.

### Method and evidence

1. Land this report, observation-seam@4, its separate hand file/freeze and bounded
source note before implementation checks or inference. Preserve all earlier seams,
oracles, listener/runner/evaluator versions, suite states and historical records.
The independent seam-4 audit is the next session's work: **no formal cursor, guitar
stage, qualification or promotion verdict in 041**.
2. Transform the pinned ONNX graph without changing weights: recompute full-window
CQT/global normalization, slice the time dimension before the neural convolutions,
retain ten frames of left context (longest onset branch radius 10) and the original
right boundary, and make downstream temporal reshapes dynamic. Select only frames
per the strict watermark/cadence rules, including unpitched frames. Compute all three
maps for the cropped context; discard context outputs. No fitted threshold, score
filter, new decoder or chain transition. Score-blind backend arguments are tensor and
selected local-frame indices. Freeze graph/source hashes; exclude shared loading only
with its measured value reported. Full-window DSP is explicitly still recomputed.
3. Validate every new frozen hand case and inherited cases in their declared layers.
Check once-only interpolation across chunks/eviction, fresh populated reset, start
and emission-free finish/empty-feed accounting, paired prefix clocks, irregular
scheduling, invalid times/lengths and offline boundary/tail geometry. Hand arithmetic
is frozen independently of listener output. Native adoption checks retain full tensors,
map shapes/provenance and comparisons, not scalar-oracle claims about HQ DSP/decoder.
4. Measure **all 576** frozen contract2-challenger-guitar-noise-v1 examples: 192 correct
clean/hesitation performances, 192 w2 and 192 fixed pink-noise controls, all four
development guitars. Fresh live wall timers include per-example setup, every feed
(including slicing/resampling/copy/wait/reduction/chain and empty calls) and live finish.
Use 48 kHz/480 delivery, edge0, unchanged chain logic, serial compute-inclusive stamps
and audio-duration denominator. Keep nominal refersTo and chain clocks independent of
compute. Retain/hash each per-example call/frame/decision trace immediately. Report
following2 measurements and existing thresholds as exploratory comparisons only.
5. On the first, middle and last eligible window of each unique audio hash, compare
cropped maps with the frozen NativeModel on the identical tensor. Report exact float32
identity, maximum absolute difference, diagnostic atol 1e-6/rtol 0, and exact MIDI/kind
selection. That diagnostic tolerance is a numeric comparison, **not permission to
loosen a contract or award a cursor pass**; any difference remains visible for audit.
Reference inference is outside candidate cost. Native causality: for every example,
replay three delivered prefixes (25/50/75%, rounded down to chunks), comparing ordered
frame/decision payloads and delivery indices, with zero and alternating future tails
in input buffers; wall stamps excluded. Fresh replay service times retained. Inputs to
feed are bounded chunks only; no labels/future buffer reach model or chain.
6. Verify audio/score/label hashes and relevant producer/adapter/source hashes before
reuse of @2 offline assessments and incumbent records. Rerun nothing whose unchanged
records already establish it. The incumbent and frozen baselines stay unchanged; no
shared harness source changes. There are no passed guitar substages/sentinels. This
exploratory producer experiment makes no guitar stage claim, so the amended full-sweep
obligation begins with the later stage claim. Sines, held-out guitars, reserved/final
evidence and Winner bars 5–8 are not run.
7. Guarded runner requires committed clean code, unchanged landed pre-registration,
HEAD tag g041-challenger-incremental-neural-source, unused private/public IDs and dry
public assembly before measurement. Primary g041-challenger-incremental-neural;
one infrastructure-only rerun g041a-challenger-incremental-neural. Failures before
measurement record zero completed examples; mid-run failures retain all completed
hashed evidence. Record-writing-only failures repair writing without remeasurement.
No refusal after measurement for summary size, no tuning within the run.

### Predictions and contradictions

1. All new cases and unambiguous inherited cases agree in their explicitly declared
representation layers; zero discrepancies. Any mismatch contradicts instrument agreement.
2. Every sampled native selected map differs by at most 1e-6 absolute with exact
MIDI/kind reduction and selected coordinates; cropped neural input uses fewer than
172 time frames on ordinary cadence. Any larger error, selection mismatch or full
neural window contradicts the crop hypothesis. Exact byte identity is separately
reported and is not presumed by a tolerance comparison.
3. All 576 exploratory live comparisons meet cost ratio .25 and their cursor/control
thresholds, including every .2-second event deadline. Any example exceeding cost,
missing a deadline or falsely following contradicts this performance prediction.
4. All 3456 native prefix comparisons agree, all relevant reused evidence verifies,
and all 576 @2 assessments retain their recorded pass; no held-out/reserved access.
Any payload/provenance mismatch contradicts integrity/causality or valid reuse.

### Decision rules fixed now

- D1 implementation-compatible, pending audit: complete valid measurement; cases,
prefixes and provenance agree, native selected maps meet the diagnostic comparison
and exact selection, every exploratory live cost/cursor/control comparison clears.
Carry the frozen producer to independent seam-4 audit, then question 31's formal stage
claim. No pass/promotion awarded here.
- D2 resolved limitation: complete valid measurement with any hand-case, native parity,
selection, exploratory live cost/cursor/control or prefix discrepancy. Preserve and
localize it, with no second version/tuning in 041. Independent seam-4 audit still next;
rank the measured limitation before stage/held-out work. The batch may continue within
the stopping rule, with a separately pre-registered repair.
- D3 infrastructure/inconclusive: unresolved execution/integrity failure, incomplete
measurement or observations outside D1/D2 closes the batch. Diagnose before the single
technical rerun. Post-measurement record failures preserve/repair completed evidence.

### Carried-over state and preflight

From [040](040-challenger-streaming-state.md#resulting-stopping-count-budgets-and-evidence-access),
unchanged by its independent audit: main stopping 0, 3 versions/11 comparisons;
challenger stopping 1, 2 versions/3 comparisons, exploration spent. This adds one live
version/comparison; conservatively charge one uncleared version even if exploratory
comparisons all clear, since the independent audit/formal stage judgment is still due.
Thus resulting challenger count 2, 3 versions/4 comparisons unless execution never
measures the version. Qualification 6 versions/12 slots unused; held-out, reserved/final
and Winner 5–8 untouched. Batch 5 of 8; no user decision or contract/gate relaxation.

Preflight: only main checked out, no 041 report/archive/private ID or owner; own
listening-041 worktree and one npm ci. FFmpeg, pinned Python/model, guitar/noise inputs
and earlier private records accessible. Isolated ONNX 1.17 graph utility installed
under /tmp, leaving pinned Python dependencies unchanged; output permission checked
before measurement. Initial attempts found no pip/python executable; uv supplies the
isolated tooling, no measured run or rerun spent. User directions:

> Your model and tool: GPT-6.1-Sol (high) in Codex.

> You cannot ask the user questions: record anything that needs them in your report and the research log.

This session lands and retires its worktree, then stops after exactly experiment 041.
