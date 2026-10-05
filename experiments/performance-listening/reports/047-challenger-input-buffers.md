# 047 — Reuse streaming input and model-window buffers

## Pre-registration

2026-10-05. **GPT-6.1-Sol (high) in Codex**. Allocation batch run 1 of at most
3, question 49 (input/window reuse), following the user's accepted recommendation in
[the current batch](../RESEARCH_LOG.md#current-batch-allocation-optimizations-at-most-3-experiments).
Exactly one new live implementation variant, `basic-pitch-chain@4-input-buffers`, whose
only change from frozen @3 is storage reuse in the score-blind streaming input kernel.
No formal stage claim, new oracle, numerical gate, assessment policy or promotion.
043/045 D2 and 046 D3 stand; historical stall reproduction is not a prerequisite and
allocation savings never imply a historical stall repair.

The launching direction is:

> You cannot ask the user questions: record anything that needs them in your report and the research log.

### Question and alternatives

Can raw-input and inference-window buffer reuse remove the kernel's explicit recurring
array allocations while preserving every float32 input, inference cadence, watermark,
selected frame and live non-wall payload? Alternatives include stale leading padding,
wrong interpolation neighbors after compaction/growth, altered operation ordering,
and scratch-buffer aliasing into a delayed consumer. Fixed byte equality distinguishes
numerical drift; full native payloads distinguish an unsafe integration. Existing
IncrementalModel041.predict synchronously copies into shared storage and waits for the
worker before returning, so the new window is borrowed only until the next feed/reset;
no consumer may retain it as an immutable snapshot. Existing frozen modules are untouched.

### Method and evidence

1. Land this pre-registration before execution, with the landing gate completed before
fast-forward/push. Add StreamingInput047 and execute047 separately; retain @3, execute043,
IncrementalModel041, ONNX graph/normalization, chain and all evaluators unchanged. Reuse
raw float32 capacity with in-place compaction and growth only when needed; reuse one
43844-sample contiguous model window with identical padding/ring traversal. Leave feed
chunk slicing, neural output copies, DSP, timing scope and inference frequency alone.
2. Complete kernel comparisons on all 576 manifest-order examples of frozen
contract2-challenger-guitar-noise-v1: 192 performances and 384 paired quiet-noise/w2
controls, all four development guitars, clean and silent hesitation. On every 480-sample
feed compare request presence, samples/generated/nextSamples/watermark/retained counts,
selected indices/coordinates and every model-window byte. Apply the same watermark
advance as native emission. Independently count existing explicit raw-array slice results
(number and retained elements) and model-window allocations (number and bytes), and
candidate capacity allocations (number and bytes, by raw/ring/window), growths and peak
raw capacity. These are exact source-operation/capacity counts, not total V8/native
allocation traffic, heap residency, RSS, GC pressure or allocator bookkeeping. Use
object identity to observe window reuse, not counters alone.
3. A bounded synthetic compatibility suite uses float32 sawtooth inputs including
negative zero, empty/singleton feeds, irregular deliveries, oversized feeds, initial
padding, multiple ring wraps, reset and finish. Invalid nonfinite inputs must reject
before mutating state. This is comparison with the existing audited kernel, not a new
instrument/oracle or a changed seam contract. Behavioral tests cover growth/compaction,
reset isolation and borrowed-window lifecycle. Native source assumptions are reviewed
against the synchronous shared-memory copy/wait path and primary ECMAScript/Node docs.
4. Fresh native @4 on every one of the same 576 examples, comparing ordered non-wall
payloads and request tensor hashes to hash-verified 041/045 records. The complete old
native implementation and inputs are unchanged by hash, so reuse those outputs rather
than spending a second full inference pass. Every example gets a bounded half-prefix
replay with changed future backing bytes; first performance per guitar/substage gets
two full zero/alternating-future replays (592 prefix executions). Compare prefix payloads
with wall stamps excluded exactly as prefixEqual3 defines. No fresh offline policy or
alignment is needed: verify/cite 039 assessment artifacts and unchanged producers by
hash. Existing audited following/assessment gates and service costs may be reported
informationally, never as a new stage pass. This complete resource/parity workload is
expected to exceed the routine two-minute aim; no stage/baseline sweep is claimed.
5. Sources, model graph, frozen manifest/audio/scores, prior records and assessment
artifacts are hash-checked. New runner refuses dirty/uncommitted code, pre-registration
not already on origin/main, missing matching source tag and used IDs. Primary
`g047-challenger-input-buffers`; one diagnosed infrastructure-only repeat
`g047a-challenger-input-buffers`. Dry public assembly precedes measurement; each private
example and prefix is written/hashed when completed. Detail stays private. Public summary
pins source commit, sources and artifacts; read-only verification resolves tracked paths
at the source commit after retirement. Size excess is reported, never discards measurement.
6. Verify timing host conditions, without stopping any other session: own observed Dave
pane/session only working, load1 <2 at start; persist inventory/load at least every 30 s
(20-s boundary trigger), no competing working agent, no two successive loads >4, no
unreadable/lost inventory or >30-s gap. Violation is invalid/infrastructure. Costs remain
provisional and diagnostic; no stall/wall service is removed from the clocks. A complete
valid unfavorable measurement is never repeated. No held-out/reserved/final, sines,
Winner 5–8, microphone or Studio evidence is accessed.

### Numbered predictions and contradictions

1. All 576 kernel comparisons and synthetic deliveries have exact request/state/window
byte equality. Any mismatch contradicts this and blocks retention.
2. Candidate allocates one model-window backing buffer per execution rather than one
per request: at least 95% fewer explicit model-window allocated bytes over the complete
576 primary inputs. It performs zero per-feed raw-array slices; recurring explicit
raw-array objects disappear, with bounded capacity (<= 1024 samples on regular feeds).
Any smaller reduction, residual slices or unbounded regular capacity contradicts it.
3. All 576 complete live payloads/request hashes match frozen @3; all 592 prefix checks
agree and all 576 reused offline artifacts/producers verify. Any difference contradicts
numerical/causal/integration parity. Timing equality is neither expected nor required.
4. Complete per-example/call/resource/source/artifact/host records survive read-only
verification. Missing/incomplete provenance, invalid host or writer loss contradicts
this prerequisite; a timing improvement alone cannot rescue it.

### Decision rules fixed now

- **D1 retain resource variant:** complete valid parity/provenance and prediction 2's
allocation reduction. Retain the separately named storage variant as the parent for
batch run 2 (unused neural output copies). No historical repair, stage pass or new
formal claim follows. Timing direction is descriptive, with no speed acceptance gate.
- **D2 valid negative:** complete valid evidence with a resolved allocation shortfall,
or explained parity incompatibility requiring semantics outside this frozen method.
Reject adoption, preserve variant/evidence and close the batch if parity cannot be
preserved; an allocation shortfall alone permits the next independent candidate against
the unchanged predecessor. Never tune on a valid result and redraw it.
- **D3 inconclusive/infrastructure:** incomplete/integrity/host failure or unresolved
parity discrepancy closes the batch. At most one diagnosed technical repeat is allowed
before/mid measurement, preserving zero/every completed artifact respectively. A failure
only in final record writing is repaired from saved measurements without inference.
A parity implementation defect discovered before executing the committed data run may
be corrected within the fixed storage method; after a valid measured parity failure,
apply D2/D3, do not rerun a tuned listener under this number.

### Carried state, budgets and preflight

[046's resulting state](046-challenger-full-workload-trace.md#resulting-stopping-count-budgets-and-evidence-access)
carries main stopping 0, 3 versions/11 comparisons; challenger stopping 2,
3 versions/6 comparisons, exploration spent. This resource experiment adds one live
implementation version and one development parity/resource comparison; it does not
attempt or clear the lowest open formal substage, so stopping count stays 2 rather than
silently resetting or claiming a third stage failure. Qualification 6 versions/12 slots
unused, protected evidence untouched. 047 technical repeat starts unused; 041 spent,
043–046 unused. Incumbent, suite, sentinels, oracles and gates remain unchanged.

Only main existed at pickup, no experiment owner; 047 unused in report registry,
archive and private runs. Own listening-047 worktree; npm ci once, FFmpeg available,
required frozen private data readable and private write preflight required before run.
Read-only Herdr inventory identifies own working Dave pane w4:pA; other panes idle/done,
load1 1.33 at preflight, rechecked after gates. Landing, one experiment, retirement and
stop are mandatory. Primary sources: ECMAScript TypedArray copyWithin/slice semantics
and Node worker_threads shared-memory documentation; a bounded research note records
why reuse is safe only for the observed synchronous consumer.
