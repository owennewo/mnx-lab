# 040 — Streaming state and the complete compute-inclusive seam

## Pre-registration

2026-10-05. **GPT-6.1-Sol (high) in Codex**. Experiment040, challenger track,
run4 of6 in the sampled-guitar promotion batch. Instrument and producer-state work,
not a listener version or acoustic comparison. Question30's prerequisite34 is resolved
first, in the streaming producer it governs, because a new seam requires independent
audit before judging its listener. This run builds an injected-backend streaming
input/state kernel; **incremental neural inference and its native cost remain open**.

### Question and alternatives

Can the streaming kernel preserve frozen causal model inputs/frame selection while
closing every gate-relevant seam-2 audit gap? Wrong alternatives include replaying
missed cadence boundaries, using an unpitched frame without advancing the watermark,
selecting prefix decisions by measured madeAt, retaining caller-supplied backdating,
and dividing audio by work. Separate hand cases distinguish them. Whole-window
normalization also makes simple reuse of old normalized neural activations suspect;
two hand inputs distinguish a changed global maximum from a local-only operation.
This diagnostic is not a proof that an efficient Basic Pitch backend is impossible.

### Method and evidence

1. Land this report, observation-seam@3, its separate frozen28-case hand file and
source note before implementation checks. Preserve seam2, its36 cases, all frozen
listeners/runners/evaluators and historical records. Independent audit is next;
this author neither performs it nor claims any cursor verdict.
2. Implement a new score-blind injected-backend stream: causal neighbor interpolation,
float32 ring of latest43844 samples, once-per-delivered-prefix cadence, carried integer
watermark, serialized completion/stamp/history and explicit work/audio cost. No score
or labels reach the backend. Test production using deterministic injected maps/costs,
not native inference; keep every new and inherited case result privately by hash.
3. Compare tensors and selected q with frozen native.ts over a six-second synthetic
ramp prefix in ordinary480-sample chunks and a fixed irregular partition. Check
per-sample once-only generation, bounded retained storage, reset/no-finish-flush and
future-prefix payload invariance. These are state/adapter checks, not guitar listener
measurements. No new backend, neural weights, decoder setting or live chain version.
4. Freeze explicit coverage boundaries for pinned HQ DSP, full decoder internals,
source/model provenance, native timing and acoustic behavior, as audit2 requests.
Synthetic normalization inputs characterize a dependency, not native map parity.
No guitar stage is claimed, so no active acoustic suite or full sweep is due. There
are no passed guitar substages; sines are retired and never run; incumbent/baseline
historical sources and records stay byte-identical.
5. Runner requires committed clean code, unchanged preregistration already on
origin/main, unused ID and HEAD tag. Primary g040-challenger-streaming-state; one
infrastructure-only rerun g040a-challenger-streaming-state. Dry-assemble public shape
before checks, immediately persist/hash each completed check. Before-measurement
failure preserves error with zero measurements; mid-run failure preserves completed
records. Record-only failure repairs writing without remeasuring. Never refuse a
completed measurement solely for public-summary size.

### Predictions and contradictions

1. All28 new and36 inherited hand cases agree, zero disagreements. Any discrepancy
contradicts instrument agreement; frozen answers are not tuned to code.
2. Both input partitions produce identical float32 tensors/q to the frozen causal
producer at every eligible call; each resampled sample is generated once and retained
state is bounded. Any mismatch contradicts exact input/state reuse.
3. Six wrong-rule families (reciprocal cost, omitted empty work, backdating, wall-based
prefix selection, cadence replay, pitch-only watermark) are separated by their cases.
Any undetected family contradicts coverage sensitivity.
4. N1/N2 change the retained normalized middle feature from .5 to .25; all protected
sources/records remain unchanged, no native/listener/held-out/reserved access. Any
violation contradicts the stated diagnostic scope/integrity.

### Decision rules fixed now

- D1 agreement pending audit: all cases, state parity and probes agree, protected
bytes unchanged. Freeze seam3 for independent audit, then return to question30's
native neural optimization and evaluation. No full-stage, native-cost or cursor pass.
- D2 resolved mixed: complete valid check with any case/state/probe discrepancy.
Preserve frozen answers/discrepancies; independent audit still next. No tuning/new
listener in040. The batch may continue with a separately registered resolution.
- D3 infrastructure/inconclusive: unresolved failures or observations outside D1/D2
close the batch. Diagnose before the single technical rerun; failures only in record
writing repair the record without rerunning completed measurements.

### Carried-over state and preflight

Unchanged from [039](039-challenger-dominant-pitch.md#resulting-stopping-count-budgets-and-evidence-access):
main stopping0,3 versions/11 comparisons; challenger stopping1,2 versions/3 comparisons,
exploration spent. Instrument/producer-state checks add no version/comparison/stopping
charge. Qualification6 versions/12 slots unused; held-out guitars, reserved/final
and Winner bars5–8 untouched. No guitar stage claim; sweeps start at the first claim.

Only main was checked out; no040 report/archive/private-run owner or ID exists.
Own worktree listening-040; dependencies installed once. FFmpeg, pinned Python/model
and prior private evidence readable. Private output access must be checked before
measurement. Exact identity and session direction are preserved:

> Your model and tool: GPT-6.1-Sol (high) in Codex.

> You cannot ask the user questions: record anything that needs them in your report and the research log.

No questions are asked; any needed user decision goes in results and the research log.
This session lands, retires its worktree and stops after exactly this experiment.
