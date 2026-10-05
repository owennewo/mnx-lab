# 048 — Stop copying unused live neural outputs

## Pre-registration

2026-10-05. **GPT-6.1-Sol (high) in Codex**. Allocation batch run 2 of at most
3, question 50, following [047](047-challenger-input-buffers.md) and the user's
[current direction](../RESEARCH_LOG.md#current-batch-allocation-optimizations-at-most-3-experiments).
Exactly one additive live resource version, `basic-pitch-chain@5-note-output`, over
`basic-pitch-chain@4-input-buffers`. The only change is removing explicit copies of
unused onset/contour outputs across the live native-worker bridge. No new instrument,
formal stage claim, normalization, inference-frequency, graph, assessment or gate change.
043/045 D2 and 046 D3 remain. Resource savings do not attribute or repair historical stalls.

The launching direction is:

> You cannot ask the user questions: record anything that needs them in your report and the research log.

### Question and alternatives

Can this live bridge copy only the consumed note map, preserving every note activation,
model input/crop, non-wall live payload and causal prefix, while reducing explicit
float32 destination allocations and shared-output copy work? Alternatives are a wrong
output name/offset, crop-length disagreement, stale output, or ownership aliasing between
requests. Fresh full-array note hashes distinguish numerical differences; repeated calls
and complete live/prefix comparisons distinguish bridge/lifecycle errors. The frozen
execute047 consumes only `note`. Offline @2 still consumes all three maps and is untouched.
The ONNX graph continues computing and returning all three outputs; this method removes
bridge copies only, with no claim to remove neural/native output allocation or DSP work.
The seam's three-map 041 adoption comparison stands with its original evidence; this
internal live transport optimization changes no observation definition or offline map.

### Method and evidence

1. Land this pre-registration after its completed landing gate, before executing any
experiment. Add IncrementalModel048/worker048, leaving every frozen predecessor unchanged.
Use one 172x88 float32 shared output, copy only StatefulPartitionedCall:1 (note) from the
unchanged ONNX result, and return a fresh note slice plus unchanged begin/length. Preserve
input/signal/synchronous wait, full-window DSP/normalization, crop/context and neural work.
Use execute047 unchanged with a structurally note-only compatible backend type; no live
service-boundary changes. Note slices remain independent snapshots, never borrowed views.
2. All 576 manifest-order frozen development-guitar/noise examples: 192 clean/hesitation
performances and 384 quiet-noise/w2 controls across all four development guitars. For each
example, run the unchanged parent fresh and save its complete request note hashes, live
payloads, services and explicit copy counts; then run the candidate fresh on the same
input. Compare every request's complete note bytes by SHA-256 (not selected bins only),
input hashes/crop/indices, and every ordered non-wall payload. Also compare both with
hash-verified 047 outputs. Fresh reference work is outside candidate service, performed
serially, and never subtracted from the candidate clock. Alternate parent/candidate order
by manifest ordinal to expose, without claiming to eliminate, order effects. Save each
completed execution before proceeding; bound detailed evidence to the current example.
3. Exact targeted counts derived independently from measured request lengths and native
returned array lengths: shared-output backing bytes per model; per-request main-thread
slice count/bytes; worker shared-output copied float32 elements/bytes. Parent: 440 bins per
neural frame, three fresh slices; candidate: 88 bins, one fresh slice. Measure every returned
array's length/byteLength and note snapshot independence. These counts exclude ONNX tensors,
V8/native allocator traffic, GC/RSS and input/kernel/chunk allocations. Retain a behavioral
compatibility test with throwing unused-map accessors and unchanged synthetic service clocks;
native complete runs exercise varying crops and the real bridge.
4. Candidate bounded half-prefix replay for every example with changed future backing
bytes; first performance per guitar/substage also two full zero/alternating-future replays:
592 prefix executions. Use unchanged prefixEqual3, excluding wall stamps; no new oracle.
Offline assessment artifacts/producers are unchanged and verified/cited from 039. Current
audited following/cost gates are informational, never a formal stage claim. Full resource
parity is expected to exceed the routine two-minute aim; no stage/baseline sweep is claimed.
5. Source/model/graph/input/label/reference/offline artifacts are hash-verified. Runner
refuses dirty/uncommitted sources, unlanded pre-registration, missing source tag, and used
run IDs. Primary `g048-challenger-output-copies`; one diagnosed infrastructure-only repeat
`g048a-challenger-output-copies`. Dry public assembly before measurement; each primary and
prefix gets a private path/hash as completed. Summary pins commit, experiment-relative
source paths and private records. Read-only verifier resolves tracked sources at the tag's
commit after retirement, rechecks complete hashes/clocks/counts/parity and preserves any
reader failure. Oversized summaries are reported, never discard completed measurement.
6. Quiet-host preflight and inventory/load sampling follow 047: identify own observed Dave
pane/session, no other working agent, load1 <2 at start; sample at least every 30 s (20-s
boundary trigger), reject unreadable/lost inventory, >30-s gap, competing working pane,
or two consecutive loads >4. Costs/timing provisional and diagnostic, including all setup,
feed and finish service without removing stalls. No held-out/reserved/final, sines,
Winner 5–8, microphone or Studio access. Consult bounded primary language/shared-memory
sources and local consumers; document what the counts establish and what they do not.

### Numbered predictions and contradictions

1. All 576 fresh pairs have exact complete note tensor hashes and request/input/crop/index
identities, and both match all 047 non-wall payloads. Any difference contradicts parity.
2. Candidate reduces explicit main output slice bytes and worker shared-output copied bytes
by exactly 80% on the complete primary workload; slice result objects fall from three to
one per request. Shared output capacity falls from 302720 to 60544 bytes per loaded model.
Any smaller reduction/residual unused-map copy contradicts the resource prediction.
3. All 592 candidate prefix checks agree; all 576 unchanged offline records/producers
verify. Any difference contradicts integration/causality or provenance. Unchanged @4 input
buffer allocation counts are preserved; no accidental second optimization is accepted.
4. Complete source/artifact/host/per-request/service/count records survive read-only
verification. Any missing measurement, invalid host, writer loss or unresolved discrepancy
contradicts this prerequisite. Timing equality/improvement is not predicted or required.

### Decision rules fixed now

- **D1 retain resource variant:** complete valid parity/provenance and prediction 2's exact
resource reduction. Retain additive @5 as the development parent for independently
pre-registered contract-preserving DSP caching, batch run 3. No formal claim or stall repair.
- **D2 valid negative:** complete valid evidence with a resolved resource shortfall or
explained parity incompatibility that requires semantics outside this method. Reject the
variant. A resource shortfall alone permits candidate 3 against the unchanged predecessor;
unresolvable parity incompatibility closes the batch. Never tune and redraw a valid result.
- **D3 inconclusive/infrastructure:** incomplete/integrity/host failure or unresolved parity
closes the batch. One diagnosed technical repeat allowed before/mid measurement, preserving
all completed records. Final writer/reader defects are repaired from saved measurements
without inference. Pre-data-run implementation defects may be corrected within the fixed
copy-removal method; after valid measured parity failure apply D2/D3, never tune and rerun.

### Carried state, budgets and preflight

[047 resulting state](047-challenger-input-buffers.md#resulting-stopping-count-budgets-and-evidence-access):
main stopping 0, 3 versions/11 comparisons; challenger stopping 2, 4 implementation
versions/7 development comparisons, exploration spent. This adds one resource implementation
version/comparison; it does not attempt or clear the lowest open formal substage, so stage
stopping stays 2. Qualification 6 versions/12 slots unused. 048 repeat starts unused;
041 spent, 043–047 unused. Incumbent, suites, sentinels, oracles/gates and protected access
unchanged. Only main existed at pickup; 048 unused in report registry/archive/private runs.
Own listening-048 worktree and npm ci once; ffmpeg/frozen private inputs available, write
preflight required before measurement. Inventory has own Dave w4:pA working; other panes
idle/done, load1 1.40 at preflight, rechecked after gates. No user question is asked.
