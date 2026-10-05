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
