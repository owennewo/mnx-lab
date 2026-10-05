# 044 — Trace the no-inference service stalls

## Pre-registration

2026-10-05. **GPT-6.1-Sol (high) in Codex**. Question 41, run 8 of 10
in the reopened sampled-guitar batch. Exactly one diagnostic experiment, no listener
version, stage claim, oracle or gate change. The user directed this session:

> You cannot ask the user questions: record anything that needs them in your report and the research log.

> Your model and tool: GPT-6.1-Sol (high) in Codex.

### Question and alternative explanations

Can traces attribute 043's no-inference stalls to measuring-harness memory/work,
listener input/native work, collection, or scheduling? The unchanged payloads do not
attribute wall time. A quiet successful replay does not establish the historical
cause. The second contract amendment governs: harness attribution permits a fixed
harness then a separate fresh formal claim; listener attribution requires a new
listener version; no attribution stops the batch. Every original failed gate stands.

### Method and evidence

1. Land this pre-registration before execution. Primary run
`g044-challenger-stall-diagnosis`, one infrastructure-only rerun
`g044a-challenger-stall-diagnosis`. Clean committed source, landed immutable
pre-registration, source tag, unused IDs, and dry public record assembly required.
Read/verify the frozen manifest, graph and selected 043 records by hash. No private
held-out samples, reserved/final or Winner 5–8. Sines stay retired.
2. Fixed diagnostic panel: all 96 clean examples of the four development guitars
(s1/s2, four tempi, performances and both controls), plus the Fender s2/90/2000-ms
hesitation performance and its two paired controls. Thus 99 examples per arm,
including martin-w2-s1-99 and fender-h-s2-90-2000. Original manifest order, two arms
in order, once each; no repeats selected by outcome. This is a bounded diagnostic
panel, never a complete-set challenger evaluation or stage pass. No baselines,
offline assessments or guitar sweep: those belong to 045 if authorized by attribution.
3. Arm A runs execute043 in one process, retaining example records and performing
its original per-feed diagnostic hashes/copies after service and per-example writes.
Arm B runs an equivalent candidate service in a separate child process; evidence is
written/hashed by the parent between examples, with acknowledgement before the next.
Preallocate numeric service trace storage, omit per-feed evidence hashes and call/frame
object retention, retain candidate decisions and enough frame/decision payloads to
check structural identity. Candidate state/chain, chunk copy, interpolation/window,
model prediction, reduction/observation, start/reset and no-flush finish are identical.
This changes harness evidence allocation/writing only, never listener inputs or logic.
Shared model load is separate; all start/feed/finish service remains counted.
4. CPU profiling and runtime GC entries are recorded per arm, with monotonic service
start/end timestamps. Main-thread Linux schedstat counters are sampled at each service
boundary outside its timer; process CPU and heap/resource counters are recorded per
example. The parent samples host load, process CPU and per-thread scheduler counters
while each child runs. Profile/trace overhead is diagnostic, not production cost.
No other agent may execute work during measurement; check active processes before
and during, retain load samples and stop on observed competing agent work. Do not
kill another session. Frozen wall cost/deadline comparisons are informational on
this panel, never a stage verdict, and no CPU time replaces wall time.
5. A no-inference service >=100 ms is an attribution target (a diagnostic threshold,
not a changed gate). Examine every such target, all services >=50 ms and both original
failed inputs. GC overlap, main-thread runqueue wait, sampled stacks and CPU consumption
must distinguish explanations. Scheduler wait/GC overlap accounting are diagnostic
observations, not a new evaluator. A harness cause requires a reproduced target whose
trace links the delay to harness work/retained evidence, plus unchanged payloads in B
and removal of that traced cause; absence in B alone is insufficient. A listener cause
requires a target in B traced to candidate allocations/input/native work. GC alone
without allocation ownership, unexplained descheduling, profiler interference or
non-reproduction gives no attribution. Mixed causes not fully isolated are inconclusive.
6. Write/hash each example as measured; flush GC observations between examples.
Profiles and host traces stay private with hashes, public summary small. Failure before
measurement records zero completions; mid-run preserves each completed artifact.
Diagnose infrastructure before the sole technical rerun, without listener tuning.
A record-writing-only failure repairs assembly from saved records without rerunning.
Never refuse completed measurements for summary size.
7. Bounded primary-source research: Node perf_hooks documents GC entry startTime and
duration; Linux scheduler docs define schedstat CPU/runqueue nanoseconds. These support
trace interpretation only, not historic attribution. Record sources and limitations
in research/stall-tracing-044.md. No oracle or independent audit is supplied here.

### Predictions and contradictions

1. Both arms reproduce 043's ordered non-wall-time frame/decision payloads on 99/99
examples each. Any mismatch contradicts harness-only equivalence and blocks attribution.
2. At least one >=100-ms no-inference service recurs in A and >=80% of its wall time
is explained by GC overlap or scheduler waiting. No recurrence or insufficient trace
coverage contradicts this prediction, without identifying the original cause.
3. B has zero >=100-ms no-inference services. Any such service contradicts removal;
even a held prediction cannot alone establish harness causation.
4. Every example and measured start/feed/finish has CPU/GC/scheduler provenance,
parent evidence is outside B's process and clocks, no competing agent work is observed,
and every frozen candidate/model/input byte is unchanged. Missing traces, interference
or identity differences contradict the measurement prerequisite.

### Decision rules fixed now

- D1 harness attribution: complete valid panel and identity, reproduced trace meeting
method 5's harness-cause requirement, with its cause removed in B. Carry the isolated
harness and evidence to question 42, a separately pre-registered formal claim 045.
No stage pass or held-out use in this experiment.
- D2 listener attribution: valid reproduced B target traced to listener-owned work.
Stop the batch; next is a new listener version addressing that evidence, with gates
unchanged. No formal redraw or held-out run.
- D3 no attribution/inconclusive: no reproduced attributable target, ambiguous/mixed
ownership, competing work or incomplete/integrity failure. Stop at 8 of 10 and report
the missing evidence to the user. An infrastructure failure may consume the one
technical rerun; a valid quiet result may not. A writer-only repair retains measurements.

### Carried state and preflight

Unchanged from [043](043-challenger-guitar-stage.md#resulting-stopping-count-budgets-and-evidence-access):
main stopping 0, 3 versions/11 comparisons; challenger stopping 2, 3 versions/5
comparisons, exploration spent. Diagnostic work adds no version/comparison charge.
Qualification 6 versions/12 slots unused; held-out/reserved/final and Winner 5–8
untouched. No stage/sentinel change. 044 technical rerun unused, 041 spent, 043 unused.
The batch was reopened by the user's quoted direction in the research log and second
amendment; earlier closed verdicts stand. D3/D2 stop it; D1 leaves two runs.

Only main existed at pickup; no other numbered owner, and 044/run IDs unused in
committed records/archive/private runs. Own listening-044 worktree, npm ci once.
FFmpeg, private sources and graph accessible; private write/delete check passed.
Host quietness is rechecked after installs/gates finish, before measuring.
This author lands, retires and stops after exactly 044, whatever the outcome.

## Results

**D3: no attribution.** Both fixed arms completed with the frozen payloads intact,
but neither reproduced a no-inference stall. The evidence cannot establish the cause
of 043's failed comparisons. The batch closes at **8 of 10**. No formal redraw,
stage pass, held-out confirmation, promotion or listener change is authorized by this
outcome; 043's D2 and both failed gates remain recorded.

| Measurement | A: original evidence harness | B: isolated evidence harness |
|---|---:|---:|
| Examples measured / payloads identical to 043 | 99 / 99 | 99 / 99 |
| Start/feed/finish service intervals | 53,676 | 53,676 |
| No-inference services at least 100 ms | 0 | 0 |
| Largest no-inference service | 2.271145 ms | 2.336364 ms |
| All services at least 50 ms | 0 | 3, all inference feeds |
| Summed wall service / audio | 75.716086 / 534.415500 s | 80.611041 / 534.415500 s |
| Weighted service/audio | .141680 | .150840 |
| Maximum per-example cost ratio | .153945 | .290898 |
| Informational cost comparisons at most .25 | 99/99 | 98/99 |
| Main-thread GC events / maximum duration | 228 / 20.643610 ms | 252 / 3.012263 ms |
| V8 trace events | 1,361 | 1,606 |

No cost or stage pass is inferred from A. B's lower evidence retention does not produce
a general timing improvement: the quiet-noise Fender hesitation control exceeds the
unchanged cost threshold. Profiling overhead and the fixed A-then-B order prevent a
causal claim about the arms' aggregate difference.

### The original failed services

| Input / delivered samples | 043 service | A replay service | B replay service |
|---|---:|---:|---:|
| martin-w2-s1-99 / 62,880 | 291.435338 ms | .016604 ms | .027717 ms |
| fender-h-s2-90-2000 / 250,560 | 342.363455 ms | .015447 ms | .017995 ms |

These same delivery points still request no inference. Neither replay overlaps a GC
entry or records runqueue waiting at these points. This refutes recurrence in this
panel; it does not explain the historical stalls. The main-thread scheduler-counter
read around B's Martin call accumulates .121639 ms of CPU against a .027717-ms service:
counter snapshots bracket their own outside-timer reads, so sub-millisecond deltas are
coarse observations and are not substituted for wall service.

### Every service over 50 ms

| B input / samples | Wall service | Main-thread CPU | Main-thread runqueue wait | Main-thread GC overlap |
|---|---:|---:|---:|---:|
| noise-fender-h-s2-90-2000 / 81,600 | 53.449709 ms | 4.343433 ms | 0 | 0 |
| noise-fender-h-s2-90-2000 / 96,000 | 53.716181 ms | 4.039472 ms | .014440 ms | 0 |
| fender-w2-h-s2-90-2000 / 192,000 | 53.493120 ms | 3.289322 ms | 0 | 0 |

All three run neural inference. Main-thread profiles are dominated by the frozen
model's synchronous wait; separate worker profiles and V8 traces are retained.
The 200-ms worker scheduler snapshots cannot attribute a particular 53-ms wait to
native CPU versus worker descheduling. They supply no attribution of the original
no-inference stalls. B's noise control cost ratio is **.2908979355**; its unchanged
payload rejects the score, but rejection does not excuse cost. No observation is
subtracted, discarded or remeasured for a better result.

### Integrity, tracing and limits

The read-only verifier checked **356 artifact hashes** and reconstructed all
**107,352 service intervals**, summed setup/feed/finish costs and frame/decision
completion stamps. Every 198-example payload comparison with 043 agrees; the focused
injected-clock test also agrees on decisions, payloads and cost. Frozen candidate,
input kernel, graph, model adapter, baseline, evaluator and oracle sources were
hash-checked unchanged against 043. This is a harness diagnosis, not a fresh
altered-future causality verdict or complete two-output challenger evaluation.
043's causal evidence keeps its original scope; no stage claim reuses its wall times.

CPU profiles cover main, loader and inference-worker threads in both arms. Main GC
entries carry monotonic intervals; V8 traces supplement them. Scheduler counters are
captured outside each main-thread timer and all child-thread counters are sampled by
the parent. B writes no example evidence file: its parent writes and hashes each
result, acknowledges it, then permits the next example. Profile finalization is after
candidate services. Trace collection, IPC and numeric-trace storage remain diagnostic
overhead; these measurements are provisional to this host, not microphone/UI latency.

**844 host snapshots** were retained, with load rising from `0.52 / 0.79 / 0.83`
to `1.55 / 1.12 / .96` (one/five/fifteen minutes). Other persistent agent processes
exist. The monitor detected no competing session crossing its fixed five-CPU-tick
sample threshold; other sessions' maximum observed increment was two ticks, while
this session reached four and was excluded as an ancestor. This observes activity;
it cannot certify host exclusivity or rule out background desktop/kernel work.
Recorded host: Intel Core i7-8750H, 12 logical CPUs, Node v22.22.1, Linux
7.0.0-34-generic. Hardware/version metadata was collected after measurement and is
labeled that way in the assembled summary.

The panel includes every clean performance and paired controls on all four guitars,
and all three attachments of the failed Fender hesitation. It does **not** recreate
043's 576-example accumulation, retained full offline/live maps, six-implementation
sweep, or concurrent host history. GC events and smaller retained evidence in B do
not establish allocation ownership for an absent stall. The isolation code is an
experimental harness candidate, not an approved repair that unlocks 045.

One valid execution, **2026-10-05T17:04:47.334Z–17:07:36.795Z**, **169.458330 s**.
No infrastructure failure or technical rerun. Public summary **47,994 bytes**; the
initial writer summary is preserved privately, and the final attribution block was
assembled from its saved measurements and hash-verified statistics. No measured
example or trace was overwritten. Pre-registration **4fcd5276** reached main and
origin before execution; source **1f19e0df** is pinned by
`g044-challenger-stall-diagnosis-source`. The guard required clean committed source,
landed unchanged pre-registration, unused IDs and dry assembly. Development-only
command/path and type-annotation errors were fixed before this guarded run.

| Artifact | Path / SHA-256 |
|---|---|
| Public summary | [g044](../runs/g044-challenger-stall-diagnosis/summary.json); `a6416df461c13bd4fc9c9792a914b28b9b5403fe7bfa60265026af1b040a50ff` |
| Verified statistics | `/home/williao/dev/mnx-listening-data/diagnostic-runs/g044-challenger-stall-diagnosis/statistics.json`; `7ee1dd7aa66f37c52ed7c234ff0f0c34816e10822ed91ca8d281934527f32451` |
| Detailed examples, CPU/V8 traces and host samples | Private artifacts indexed and hashed in the public summary and its results/host files |

## Against the predictions

| # | Outcome | Reason |
|---|---|---|
| 1 | Held | 99/99 payload comparisons per arm agree with 043 |
| 2 | Contradicted | No 100-ms no-inference service recurred in A; no attribution target exists |
| 3 | Held, without a causal conclusion | B has zero 100-ms no-inference services; A also has none, and B has a separate inference cost failure |
| 4 | Held within observation limits | Every interval/example has traces, sources match, and B writes through its parent; no competing work detected by the monitor. Sampling cannot certify exclusive use or supply historical trace coverage |

## Decision

**D3 applies by non-reproduction and no attribution**, not an infrastructure failure.
Neither D1's traced harness cause nor D2's reproduced listener-owned no-inference
cause is established. The one technical rerun remains unused and cannot be spent on
this valid quiet result. The batch closes at 8 of 10; questions 42 and 32 remain
blocked. Every earlier verdict and gate stands. This author starts neither 045 nor
an audit or process review.

### Resulting stopping count, budgets and evidence access

Unchanged from 043: main stopping **0**, **3 versions/11 comparisons**; challenger
stopping **2**, **3 versions/5 comparisons**, exploration spent. Diagnostic arms add
no listener version or formal comparison. Qualification **6 versions/12 slots unused**;
held-out/reserved/final and Winner 5–8 untouched; sines retired. 044 technical rerun
unused, 041 spent, 043 unused. No stage, sweep, incumbent, sentinel or oracle change.

## Next

Independent process review of this stopped diagnostic continuation, by another
session. A future, separately pre-registered diagnosis could reproduce the full
original evidence-memory accumulation or obtain an attributable trace under a
representative longer quiet-host run. Those are advice, not an authorized extra
arm or a reason to redraw the formal claim. Keep both 043 failures and B's new
inference cost observation. A clean isolated run does not decide historical cause.

**Awaiting the user:** whether to reopen or redirect the stopped batch for broader
attribution evidence. 045 is not authorized by 044's result, and held-out confirmation
remains untouched. Promotion, future microphone gates, qualification and Studio
choices remain theirs. No question was asked; the need is recorded here and in the
research log.

**Direction of travel.** Causal input state, incremental neural computation and
separate support/completion clocks can survive more sounds and longer scores.
This measurement-harness isolation may help future tracing but has no proven
stall-removal result. Strongest-pitch masking and the event chain remain monophonic;
chords and real microphone performances require separate development.

## Attribution

Pre-registered, implemented, executed and recorded by **GPT-6.1-Sol (high) in Codex**.
Independent review remains another session's work.
