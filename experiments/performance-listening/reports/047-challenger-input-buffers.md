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


## Results

**D1: retain `basic-pitch-chain@4-input-buffers` as a development resource variant.**
The separately versioned storage kernel removes recurring explicit allocations at its
targeted sites with exact complete-corpus numerical and live-output parity. This is
allocation evidence, not a historical stall repair or a new formal stage pass.
The allocation batch advances to **1 of at most 3**; 043/045 D2 and 046 D3 stand.

| Measurement | Frozen input kernel / outputs | New storage variant |
|---|---:|---:|
| Complete development examples (192 performances, 384 controls) | 576 | 576 |
| Kernel feeds / model-window requests | 350,856 / 34,848 | Identical |
| Float32 tensor bytes and request/state comparisons | Reference | All agree |
| Explicit model-window backing allocations | 34,848 | 576 |
| Explicit model-window backing bytes | 6,111,502,848 | 101,016,576 |
| Per-feed raw-array slice result objects | 350,856 | 0 |
| Retained elements in those regular-feed slice results | 0 | 0 |
| Raw float32 capacity bytes allocated across primary executions | Ordinary JS backing traffic unmeasured | 1,110,528 |
| Regular-feed growths / maximum raw capacity | Not applicable | 0 / 482 samples |
| Native payload identities against each of 041 and 045 | Reference | 576/576 each |
| Native request hash/crop/index identities against both records | Reference | 576/576 |
| Prefix executions / agreeing checks | Same prescribed method | 592/592 |
| Verified unchanged offline assessment artifacts and producers | 039 reference | 576/576 |

**98.347107% fewer explicit model-window backing bytes:** 6,010,486,272 bytes avoided
across these 576 primary executions, with one borrowed contiguous window per execution.
The existing resampled ring still allocates 101,016,576 bytes in total in both kernels;
its size is unchanged. The new raw buffers add 1,928 bytes per execution. Ordinary JS
array backing growth from the old push operations, small objects, delivery chunk slices,
neural output copies, ONNX/native allocation and allocator bookkeeping are outside
these counts. In particular, zero retained slice elements does not mean zero allocation:
regular 480-sample feeds produce a new empty slice result object every time. Irregular
inputs exercise retained neighbors and compaction separately.

### Compatibility, causality and timing

The six synthetic delivery cases include empty/singleton/two-neighbor input,
cadence tail, irregular feeds with repeated wraps and oversized feeds with growth.
They preserve every checked tensor byte, state count, cadence and selected coordinate.
Reset clears old ring/window content without changing buffer identity; borrowed-window
mutation is observed as specified, while the caller-owned snapshot remains independent.
NaN and both infinities reject before state mutation. Injected map/watermark reduction
agrees in the behavioral test. The native consumer copies into its fixed shared input
and waits for completion before the next feed, so scratch reuse is safe on this path.

Every one of 576 native executions agrees with both frozen complete live payloads,
including float32 confidence values; every native request tensor hash and crop agrees.
The 576 bounded half-prefix and 16 full zero/alternating-future executions all agree.
No offline policy or alignment is changed or newly selected: 039's complete artifacts
are verified and cited with unchanged producing sources.

Informational service totals are **507.992596 s / 3506.493 s** of audio, weighted
ratio **.144872**, median per-example **.141518**, maximum **.167578**. All 576
informational cursor/cost comparisons clear their existing thresholds, maximum event
delay **.154331 s**. These clocks include all setup/feed/finish service and no stall is
removed. There is no fresh paired timing of the old kernel, no pre-registered speed
gate and no formal claim: these numbers neither identify the historical stall cause
nor establish a cross-session or production-speed improvement.

**44 valid quiet-host samples:** start load1 **1.79**, maximum **1.85**, maximum gap
**21.912056 s**, no competing working pane, no two consecutive loads above 4 and no
unreadable inventory. Own observed Dave pane/session is pinned; the stale duplicate is
checked separately. This is the specified sampled condition, not full host exclusivity.
One measurement, **2026-10-05T19:59:41.760Z–20:14:16.710Z**, **874.950086 s**
(14.58 minutes). This deliberately complete resource/parity workload exceeds the
routine two-minute aim; it claims no stage/baseline sweep.

### Integrity and record-only corrections

Pre-registration **fd70e954** reached main/origin after its gate passed, before source
commit and execution. Source tag **g047-challenger-input-buffers-source** pins
**200237e1**. The final read-only verifier checks **410 source hashes at that commit**,
**4,192 artifact hashes**, **537,008 service intervals**, exact request hashes,
complete payload identities, prefix equality and explicit allocation aggregates.
Tracked-source resolution uses the pinned commit and experiment-relative paths and
remains valid after worktree retirement. Final public summary is about 125 KiB.

Two record/reader defects were corrected after completed measurement, without changing
any measurement or running inference again. The writer initially emitted repository-
relative source keys, whereas the shared exporter expects experiment-relative keys.
The raw writer summary is preserved and hashed; final assembly changes key spelling
only, with every source hash value and measurement unchanged. The writer's convention
is corrected for reproducibility. The first read-only verifier then tried to parse a
hash-verified binary masked NPZ as JSON and raised UnicodeDecodeError; its failure is
preserved. The reader now hashes that binary without parsing it. Both later read-only
verifications pass. Neither correction spends the technical repeat or changes D1.

| Artifact | Path / SHA-256 |
|---|---|
| Final public summary | [g047](../runs/g047-challenger-input-buffers/summary.json); `1c3530a9a5bcf6c3d6624bcc9e77ea18c2144abe0a26b6b709e234eeedb4bb6e` |
| Final read-only statistics | `/home/williao/dev/mnx-listening-data/diagnostic-runs/g047-challenger-input-buffers/statistics-final.json`; `d88698adffbc4ea67811c1825d3723fa7007af5a9191a75a346b02d3cede7120` |
| Raw writer, assembly correction and failed first verification | Private paths/hashes named in final summary; no measurement rerun |
| Detailed kernel/native/prefix/host records | Private paths/hashes named in final summary/results |

## Against the predictions

| # | Outcome | Evidence and limit |
|---|---|---|
| 1 | Held | All 576 corpus kernel comparisons and six synthetic cases preserve exact bytes/state/requests; reset and invalid-input probes agree |
| 2 | Held | Window backing bytes decrease 98.347107%, no per-feed raw slices, no regular growth, raw capacity 482; exact targeted counts only |
| 3 | Held | 576/576 payload/request identities against both frozen runs, 592/592 prefixes, 576/576 offline records/producers verified |
| 4 | Held after record-only correction | Complete tagged sources, saved measurements and valid host pass read-only verification; raw writer and reader failure retained, no inference repeat |

## Decision

**D1 applies.** Retain the additive storage-only resource variant and its measured
allocation savings, with exact output/causality parity over the complete development
set. Batch run 2 may evaluate the independently authorized unused onset/contour-copy
change against this variant. No new oracle, gate, sentinel, incumbent, stage pass,
stall attribution, protected evidence, formal claim or promotion is introduced.
This session lands, retires and stops after exactly 047.

### Resulting stopping count, budgets and evidence access

Main stopping **0**, **3 versions/11 comparisons** unchanged. Challenger stopping
**2**, now **4 implementation versions/7 development comparisons**, exploration spent.
This version is a resource/parity comparison, not an attempt to clear the lowest open
formal substage; its D1 neither resets the stage stopping count nor counts as a third
failed stage version. Qualification **6 versions/12 slots unused**. 047 technical
repeat unused, 041 spent, 043–046 unused. Held-out/reserved/final and Winner 5–8
untouched; sines retired. No incumbent/suite/sentinel/oracle/gate change.

## Next

Within the already approved allocation batch, a fresh experimenter evaluates copies
of unused onset/contour outputs as a separate version, with its own fixed method,
output parity and allocation/work evidence. Full DSP caching remains the third,
more involved candidate, only if current normalization and numerical contracts can
be preserved. This experiment supplies no authority for a fresh formal stage claim.
An independent process review follows the batch's last experiment or an early stop.

**Awaiting the user:** the standing guitar-faust pause/release decision remains theirs;
this session's timing is complete, but the approved batch still has timing work.
A future formal claim, held-out confirmation/promotion, microphone gates, qualification
and Studio product decisions remain separate user directions. No question is asked;
none of these blocks the next authorized resource experiment.

**Direction of travel.** Exact input arithmetic and bounded reusable storage can survive
longer scores and additional sounds without changing the model's normalization.
This synchronous borrowed-window lifecycle must be reviewed before any asynchronous
integration. Strongest-pitch masking/event-chain limitations on chords, repeated pitches
and real microphone audio remain separate development work.

## Attribution

Pre-registration, implementation, complete measurement, verification, record-only repairs
and recording by **GPT-6.1-Sol (high) in Codex**. Independent closing process review
is another session. One numbered experiment; no measurement/technical rerun.
