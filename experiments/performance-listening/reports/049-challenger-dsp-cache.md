# 049 — Exact DSP-cache eligibility at the frozen cadence

## Pre-registration

2026-10-05. **GPT-6.1-Sol (high) in Codex**. Allocation batch run 3 of at most
3, question 51, following [048](048-challenger-output-copies.md) and the user's
[current direction](../RESEARCH_LOG.md#current-batch-allocation-optimizations-at-most-3-experiments).
One bounded feasibility/resource experiment; no listener version is presumed. Parent
is `basic-pitch-chain@5-note-output`. No new oracle, graph, normalization, cadence,
numerical tolerance, formal stage claim or protected-evidence access. Historical
043/045 D2 and 046 D3 stand. Resource eligibility never attributes historical stalls.

The launching direction is:

> You cannot ask the user questions: record anything that needs them in your report and the research log.

### Question and alternatives

Can an exact full-window DSP memo or ordinary reuse of previously computed CQT time
columns save any DSP calls at the current cadence without changing semantics? Raw audio
overlap alone is insufficient: the pinned graph's highest CQT octave convolves on a
256-sample stride relative to each model window. The unchanged streaming kernel advances
2205 resampled samples per regular 100-ms inference. Its window-relative frame grid thus
moves. A same-coordinate temporal cache needs both overlap and matching stride phase;
a whole-DSP cache needs an identical complete float32 input. Global normalization must
still use the current complete window; caching normalized columns from another window
is excluded by the existing seam. Alternative explanations are repeated complete tensors,
a different actual delivery shift, same-phase overlapping older requests, incorrect
collector arithmetic, or a source/provenance defect. Complete native request hashes from
048 distinguish collector differences without repeating unchanged neural inference.

This tests two conservative cache opportunities, not all conceivable DSP implementations.
It does not test a content-addressed cache of equal primitive patches (for example zeros),
a multi-phase filter-bank rewrite, or new arithmetic kernels. Failure here means ordinary
window/column reuse is deferred; it is not a mathematical impossibility theorem about DSP.

### Method and evidence

1. Land this pre-registration after the completed landing gate, before executing the
committed guarded collector. Preserve all frozen modules and parent outputs. Inspect the
pinned ONNX graph without inference, recording CQT convolution weights/shapes/strides,
normalization nodes and graph/model hashes. Consult bounded primary ONNX Conv and pinned
Spotify NormalizedLog sources; separate operator facts from local phase inference.
2. All 576 frozen manifest-order development-guitar/noise examples, every performance and
quiet-noise/w2 control. Run unchanged StreamingInput047 on regular 480-sample deliveries,
apply unchanged selectedFrames/watermark updates, and retain every complete tensor SHA-256,
sample/generated count, selected indices and crop. Compare every request with the fresh
048 candidate records by hash and order. Count exact byte equality with the previous input
(snapshot before next borrowed-window mutation); additionally count phase-compatible
older requests whose raw model windows still overlap. Input length stays 43844; CQT hop
is checked against the pinned graph as 256. Potential column reuse is a necessary-coordinate
count only, never a claim that boundaries/decimation/normalization are safe to reuse.
3. Count whole-DSP misses/hits independently from the ordered complete input hashes;
record input comparisons and bounded previous-input snapshot bytes. A hit would skip the
same deterministic full DSP call; a miss saves none. No runtime model cache is adopted
without numerical/native proof. If the census finds any opportunity, record its extent
and defer implementation/parity rather than silently expanding this experiment. Record
collector wall time as instrumentation cost only; no listener cost/deadline or speed claim.
4. Verify/cite all 048 primary complete note/live records and its 592 causal prefix
records and unchanged 039 offline artifacts/producers by hash. No listener source, graph,
adapter or input has changed, so do not repeat those unchanged outputs. This census is
not a listener evaluation, a new oracle or a formal stage/baseline sweep. Reconstruct
the saved complete request identities in a documented read-only verifier resolving
tracked sources at the tagged commit after retirement. Independently reconstruct hit,
phase/overlap and resource counts from saved request rows. Dry public assembly precedes
measurement; save each example immediately, private detail with paths/hashes. Summary
size excess is reported, never discards measured results.
5. Guard dirty/uncommitted sources, unlanded pre-registration, source tag mismatch and
used IDs. Primary `g049-challenger-dsp-cache`; one diagnosed infrastructure-only repeat
`g049a-challenger-dsp-cache`. Private write/read/FFmpeg preflight first. This is non-timing
eligibility work: record host inventory/load at start/end, but do not claim formal quiet
host conditions or execute a timed listener. No held-out/reserved/final, sines, Winner
5–8, microphone or Studio access. No question is asked.

### Numbered predictions and contradictions

1. All 576 complete request traces equal 048's fresh candidate tensor hashes, counts,
indices and crops. Any difference contradicts the collector/provenance prerequisite.
2. Complete consecutive tensor equality gives zero full-DSP memo hits on these inputs:
zero DSP calls and zero DSP tensor work avoided. Any identical pair contradicts it.
3. Every regular adjacent request advances 2205 resampled samples; no prior overlapping
request shares the 256-sample CQT phase. 2205 and 256 are coprime; their first matching
phase is 256 requests/564480 samples apart, beyond the 43844 window. A different shift
or phase-compatible overlapping request contradicts this explanation.
4. All cited complete primary/prefix/offline artifacts and producers verify; saved
records/sources/resource counts survive read-only verification. Any unresolved integrity
or writer loss contradicts the prerequisite. No new live parity or speed is predicted.

### Decision rules fixed now

- **D1 opportunity, implementation deferred:** complete valid evidence finds nonzero
exact memo hits or phase-compatible overlapping columns. Record the bounded opportunity,
but retain no cache without complete native parity; close this final batch run and advise
a separately authorized implementation. No favorable redraw or cache tuning here.
- **D2 valid negative:** complete valid evidence finds zero opportunities at both sites.
Reject this ordinary full-window/time-column cache method; retain unchanged @5. The
approved three-candidate batch closes with its independent process review due. Changing
cadence, normalization or arithmetic is not adopted. Broader methods remain untested.
- **D3 inconclusive/infrastructure:** incomplete/provenance/collector discrepancy closes
the batch. One diagnosed technical repeat before/mid measurement preserves completed
records. Record-only writer/reader failure is repaired from saved measurements without
re-collecting; do not redraw a valid result. Unexpected resolved shift data still takes
D1 or D2 by the measured opportunities, with prediction 3 contradicted explicitly.

### Carried state, budgets and preflight

[048 resulting state](048-challenger-output-copies.md#resulting-stopping-count-budgets-and-evidence-access):
main stopping 0, 3 versions/11 comparisons; challenger stopping 2, 5 implementation
versions/8 development comparisons, exploration spent. This adds a development resource
comparison, no listener version unless a later experiment builds one; stage stopping
stays 2. Qualification 6 versions/12 slots unused. 049 technical repeat starts unused;
041 spent, 043–048 unused. Incumbent, suites, sentinels, oracles/gates and protected
access unchanged. Only main existed at pickup; 049 unused in report/archive/private IDs.
Own listening-049 worktree and npm ci once; FFmpeg/frozen private inputs available;
private write preflight required. Required model-inspection onnx tooling is the same
/tmp/listening-041-tools used by 041, not an altered inference environment. Read-only
inventory shows own Dave working and other panes idle/done; no timing claim is planned.


## Results

**D2: reject ordinary full-window and same-grid CQT-column reuse at this cadence.**
The complete eligibility census finds no reuse at either tested site. Keep
`basic-pitch-chain@5-note-output` unchanged, retaining 047/048's proven resource
improvements. The approved allocation batch closes at **3 of 3**, with independent
process review due. No cache, listener version or formal stage claim was introduced.

| Measurement | Result |
|---|---:|
| Development examples, all guitars and controls | 576 |
| Regular input feeds / complete model-window requests | 350,856 / 34,848 |
| Exact request traces matching fresh 048 native records | 576/576 |
| Adjacent request shifts | 34,272, all 2,205 samples |
| Exact consecutive complete-window memo hits | 0 |
| Prior request pairs with overlapping raw windows | 552,672 |
| Same-CQT-phase pairs among those overlaps | 0 |
| Full-DSP calls eligible to avoid through the tested memo | 0 |
| Cited complete native primaries / causal prefix executions | 576 / 592 |
| Verified unchanged offline examples | 576 |
| New native inference calls / listener versions | 0 / 0 |

Each development guitar contributes 1,272 clean/control requests and 7,440
hesitation/control requests; all eight guitar/substage groups have zero memo hits
and zero phase-compatible overlaps. The exact whole-input comparison includes
float32 representation, with a bounded previous-input snapshot; it does not rely
on similar sounds or hash equality alone in the collector.

### Why overlap does not suffice

The pinned ONNX graph confirms the highest-octave CQT convolution uses a 256-sample
stride and a 256-sample kernel relative to each input window. The collector observes
a 2,205-sample shift at every adjacent regular request. Since those numbers are
coprime, the same phase returns after **256 requests**, **564,480 samples**
(**25.6 seconds**), beyond the **43,844-sample** input window (about **1.988 seconds**).
Only the previous 19 regular request windows can overlap the current one, and none
has the same stride phase. This is an explanation of the measured necessary-coordinate
failure, not native output parity for a rewritten DSP pipeline.

Global log-power extrema remain current-window operations. Earlier normalized values
cannot simply be carried forward when those extrema move. Caching pre-normalization
CQT would address that issue in principle, but ordinary same-grid temporal reuse has
no eligible overlapping columns here. Matching phase would still not prove that
reflection boundaries, octave decimation or float32 operation order are identical.

**Scope of the negative:** consecutive full-window memoization and previous same-grid
CQT-column reuse. Equal-content primitive patches (including padding/silence), a
multi-phase filter bank, partial-octave caching and a different DSP execution algorithm
were not implemented or measured. Some of those may preserve the current semantics;
this experiment does not prove all DSP caching impossible. Changing cadence or input
alignment to manufacture same-grid overlap is outside this frozen method and was not
adopted. No numerical contract was loosened to obtain an optimization.

### Parity, resources and cost boundaries

Every collected complete tensor hash, delivery count, selected index and crop agrees
with 048's fresh candidate request trace. Complete 048 native note/live records and
592 prefix executions, plus unchanged 039 offline artifacts, are verified and cited.
No producing listener/graph/adapter/input bytes changed. This is source/trace identity
and reuse of existing output evidence; it is **not new native cache parity**, because
no runtime cache was adopted. No new assessment, deadline or stage result is claimed.

The census allocates one **175,376-byte** previous-input snapshot per example and
copies **6,111,502,848 bytes** into those snapshots across its complete requests. This
is measurement instrumentation, not an optimization or listener allocation change.
Zero eligible memo hits implies zero whole-DSP calls saved by the tested memo; no new
native MAC count, total allocator, GC, heap, cost ratio or speed measurement is claimed.
Start/end inventory and load are recorded; this non-timing census claims no sampled
formal quiet-host condition. Listener service clocks are not run or redrawn.

One measurement, **2026-10-05T21:05:19.323Z–2026-10-05T21:06:00.131Z**, **40.805265 s**.
No technical repeat, reader correction or record loss. Source tag
**g049-challenger-dsp-cache-source** pins **85b42905**; pre-registration **c1d62c3d**
reached main/origin after its completed gate and before source execution. The first
read-only verifier passes **418 tracked source hashes**, **3,038 artifact hashes**,
all complete trace/citation identities and independently reconstructed hit/phase counts.
The public summary is **96,968 bytes** (about 95 KiB). Source resolution works at the
pinned commit after retirement; the verifier never runs inference or the collector.

| Artifact | Path / SHA-256 |
|---|---|
| Public summary | [g049](../runs/g049-challenger-dsp-cache/summary.json); `29c0630f79d787f1ec3218619189d5aa219d5cf10db97df1dc7f9fdfa28de966` |
| Read-only statistics | `/home/williao/dev/mnx-listening-data/diagnostic-runs/g049-challenger-dsp-cache/statistics.json`; `13ede1adc313498d5551843b7d0ab78ff82da591875964c02b29940a50cf187f` |
| Per-example request/cache counts, graph inspection and cited native/prefix/offline evidence | Private paths/hashes indexed in summary/results/validation |

## Against the predictions

| # | Outcome | Evidence and limit |
|---|---|---|
| 1 | Held | All 576 complete request traces match the fresh 048 candidate records |
| 2 | Held | No identical consecutive input window, no eligible full-DSP memo call saved |
| 3 | Held | Every adjacent shift is 2205; no same-phase overlapping prior pair; necessary coordinate condition only |
| 4 | Held | First read-only verification passes complete saved records, sources and cited outputs; no inference repeat |

## Decision

**D2 applies.** Reject this ordinary full-window/time-column reuse method on the valid,
complete negative evidence. Retain unchanged @5, with no new implementation version,
cache adoption, gate, oracle, sentinel, incumbent, formal claim, protected access or
historical-stall attribution. The batch has completed its three approved candidates:
input reuse and unused-output copies retained; these DSP-cache methods deferred.
A different bounded cache design would need a new direction and pre-registration.
This session lands, retires and stops after exactly 049; the independent process
review is another session's work.

### Resulting stopping count, budgets and evidence access

Main stopping **0**, **3 versions/11 comparisons** unchanged. Challenger stopping
**2**, **5 implementation versions/9 development comparisons**, exploration spent.
No listener version was built; the eligibility comparison is not an attempt to clear
the lowest open formal substage, so its negative result neither increments nor resets
the stage stopping count. Qualification **6 versions/12 slots unused**. 049 technical
repeat unused; 041 spent, 043–048 unused. Held-out/reserved/final and Winner 5–8
untouched; sines retired. Incumbent/suite/sentinels/oracles/gates unchanged. No full
formal stage/baseline sweep or new approval is claimed by this resource census.

## Next

Independent closing process review of **047–049** comes first. It should check each
optimization's scope/parity and the bounded nature of this negative result, including
that existing native outputs were cited unchanged rather than described as fresh
cache output. The user then decides whether to authorize a fresh formal comparison
of retained @5, redirect resource work, or investigate a broader contract-preserving
DSP method. None follows automatically from allocation savings or zero cache hits.

**Awaiting the user:** that direction after review, and the standing guitar-faust
pause/release decision now that this batch's work is finished. A future formal claim,
held-out confirmation/promotion, microphone gates, qualification and Studio product
decisions remain separate. No question was asked and no protected evidence was opened.

**Direction of travel.** The two retained storage/bridge improvements can survive
longer scores wherever the synchronous live consumer remains note-only. Current
normalization and moving-window CQT geometry still govern any DSP reuse, including
on chords and real audio. Content-specific memo gains on simple silence would need
separate evidence before generalizing to those sounds; chain/strongest-pitch and
microphone limitations remain independent work.

## Attribution

Pre-registration, complete census, first read-only verification and recording by
**GPT-6.1-Sol (high) in Codex**. One numbered experiment, one measurement; no native
inference, technical rerun or independent review supplied by this author.
