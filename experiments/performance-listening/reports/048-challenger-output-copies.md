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


## Results

**D1: retain `basic-pitch-chain@5-note-output` as a development resource variant.**
Removing unused live onset/contour bridge copies preserves every complete request note
tensor, input/crop, ordered live payload and causal prefix on the frozen development set.
Allocation batch advances to **2 of at most 3**. This establishes resource savings,
not historical stall repair, a formal stage pass or promotion; 043/045 D2 and 046 D3 stand.

| Measurement | Frozen @4 / full-output bridge | New @5 / note-only bridge |
|---|---:|---:|
| Complete examples (192 performances, 384 controls) | 576 | 576 |
| Fresh primary executions | 576 | 576 |
| Requests / complete neural frames returned | 34,848 / 662,112 | Identical |
| Complete note tensor hashes / input-crop-request identities | Reference | All agree |
| Explicit main-thread output slice result arrays | 104,544 | 34,848 |
| Explicit output slice backing bytes | 1,165,317,120 | 233,063,424 |
| Worker-to-shared-output copied bytes | 1,165,317,120 | 233,063,424 |
| Shared output backing capacity per model | 302,720 bytes | 60,544 bytes |
| Complete payload identities, also against 047 | Reference | 576/576 |
| Input-storage allocation identities against 047 | Reference | 576/576 |
| Candidate prefix executions / agreeing checks | Unchanged checker | 592/592 |
| Verified unchanged offline artifacts/producers | 039 reference | 576/576 |

Exactly **80% fewer bytes** at each targeted output-copy site: **932,253,696 bytes**
avoided in main-thread slice destinations, and the same reduction in worker shared-output
copy work. Slice result objects fall by **66.6667%** (69,696 objects avoided), and one
loaded model uses **242,176 fewer shared output bytes**. These are distinct operation/
capacity counts; they are not total V8/native allocation, resident memory, GC traffic or
allocator bookkeeping. The unchanged ONNX graph still computes all three result tensors
and recomputes full normalized DSP. Input/window/chunk allocation behavior is unchanged.

### Complete parity and output ownership

For every example, the unchanged parent and candidate are both measured fresh on the
same input, alternating which runs first by manifest ordinal. Every request's complete
returned note array hashes identically, including nonselected frames. All model-window
hashes, selected indices, crop begin/length and every non-wall payload agree with each
other and with hash-verified 047. Input-storage allocation objects agree with 047.
The note slices remain independent snapshots across later predictions; no shared view
or borrowed note-buffer lifetime is introduced.

All **576 bounded half-prefix** and **16 full changed-future** executions agree under
unchanged prefixEqual3. All four development guitars' clean/hesitation examples and
quiet-noise/w2 controls are included. Frozen offline @2 still uses all three maps;
its 039 observations, decoded events, artifacts and producing sources are verified and
cited rather than reselected or rerun. No observation definition, scalar oracle, chain,
offline policy, graph, normalization, inference cadence, gate or sentinel changes.
The behavioral note-only/throwing-unused-map compatibility test passes and confirms
that diagnostic hooks do not enter service clocks. Bench type checking passes.

### Timing, host and limits

| Informational primary service | Parent | Candidate |
|---|---:|---:|
| Service seconds / audio seconds | 518.181376 / 3506.493 | 513.876214 / 3506.493 |
| Weighted service/audio ratio | .147778 | .146550 |
| Median per-example ratio | .148281 | .143848 |
| Maximum per-example ratio | .185537 | .194327 |

These are paired diagnostic observations on this host, with both model sessions loaded
and fixed alternating execution order. Weighted/median candidate service is lower,
but its maximum is higher. There is no speed acceptance gate and this evidence does
not establish improved worst-case latency or ownership/removal of historical stalls.
All service, including start/feed/finish and any wall outlier, stays in the clocks;
reference work and diagnostic hashing remain outside candidate service. Candidate's
576 informational cursor/cost comparisons clear their existing thresholds, with maximum
event delay **.156427 s**; no formal claim is authorized by this resource result.

**69 valid quiet-host samples:** start load1 **1.60**, maximum **1.82**, maximum gap
**21.782679 s**; no competing working pane, two consecutive loads above 4, unreadable
inventory, lost own identity or over-30-second gap. This certifies the specified sampled
condition, not complete host exclusivity. One measurement,
**2026-10-05T20:29:58.855Z–2026-10-05T20:53:10.354Z**, **1391.498468 s**
(23.19 minutes). The complete paired resource/native/prefix workload
exceeds the routine two-minute aim; it is not a formal stage/baseline sweep.

### Integrity and read-only verification

Pre-registration **f847240b** reached main/origin after its landing gate passed, before
source commit/measurement. Tag **g048-challenger-output-copies-source** pins
**f6ed34d6**. The read-only verifier passes on its first execution, checking
**415 source hashes at that commit**, **3,609 distinct artifact hashes** and
**889,016 service intervals**, complete payload/request/note-hash equality, snapshots,
prefixes and exact independently reconstructed resource totals. Tracked paths resolve
at the pinned commit after retirement. Each execution was saved before proceeding;
no writer/reader repair, discarded measurement or inference repeat was needed.
Public summary is **131,916 bytes** (about 129 KiB), below the size target.

| Artifact | Path / SHA-256 |
|---|---|
| Public summary | [g048](../runs/g048-challenger-output-copies/summary.json); `77f50365ace383c44161d5839349ac0b5d15415fe2548005707695ad363df720` |
| Read-only statistics | `/home/williao/dev/mnx-listening-data/diagnostic-runs/g048-challenger-output-copies/statistics.json`; `d5ef5e58fcd81c1ab4293d8f5f364247a629a7e64fcefa91c556ad0def966296` |
| Per-execution note hashes, arrays/counts, live records, prefixes, host and validation | Private paths/hashes indexed in the public summary/results |

## Against the predictions

| # | Outcome | Evidence and limit |
|---|---|---|
| 1 | Held | 576 complete fresh note/request/payload pairs agree, also against 047; wall timing excluded as pre-registered |
| 2 | Held | Exactly 80% fewer slice/copy bytes and shared output capacity; three-to-one slice objects; targeted sites only |
| 3 | Held | 592/592 prefixes and 576/576 offline/input-storage identities; snapshots independent |
| 4 | Held | First read-only verification passes complete sources/artifacts/clocks/counts and 69 valid host samples |

## Decision

**D1 applies.** Retain the additive live note-output resource variant as the development
parent for the already approved, separately pre-registered full-DSP caching candidate.
No formal stage, speed gate, historical stall attribution, incumbent/suite/sentinel/oracle
change, held-out confirmation or promotion follows. The allocation batch stays open at
**2 of at most 3**; this session lands, retires and stops after exactly 048.

### Resulting stopping count, budgets and evidence access

Main stopping **0**, **3 versions/11 comparisons** unchanged. Challenger stopping
**2**, now **5 implementation versions/8 development comparisons**, exploration spent.
This resource comparison neither attempts/clears the lowest open formal substage nor
resets its stopping count or counts as a third failed stage attempt. Qualification
**6 versions/12 slots unused**. 048 technical repeat unused; 041 spent, 043–047 unused.
Held-out/reserved/final and Winner 5–8 untouched; sines retired. Incumbent, suite,
sentinels, oracles and gates unchanged.

## Next

A fresh experimenter takes the third approved candidate: whether full-DSP caching can
reduce measured work while preserving current global normalization, complete numerical
output and causal behavior. This experiment leaves full DSP recomputation intact. Any
cache that needs stale normalization or different output semantics is deferred, not
adopted. That question gets its own method/pre-registration; this author does not design
or execute it. An independent process review follows the batch's final run or early stop.

**Awaiting the user:** no new decision blocks that authorized resource question. The
standing guitar-faust pause/release decision remains with the user/parent; this session's
timing has finished, but the batch has one candidate remaining. A future formal claim,
held-out confirmation/promotion, microphone gates, qualification and Studio decisions
remain separate user directions. No questions are asked.

**Direction of travel.** The output-bridge savings can survive longer scores and other
sounds wherever the live consumer needs only note activations. Chords, pitchless/dead
notes or future onset/contour consumers may require another explicit transport, and this
variant gives no permission to delete their model outputs or offline observations.
The chain/strongest-pitch/chord and microphone limitations remain separate development.

## Attribution

Pre-registration, implementation, complete paired measurement, first read-only verification
and recording by **GPT-6.1-Sol (high) in Codex**. One numbered experiment, one measurement,
no technical/inference repeat. Independent batch process review is another session.
