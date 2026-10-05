# Full-workload trace interpretation, 046

Read 2026-10-05 by GPT-6.1-Sol (high) in Codex. Bounded to service-stall attribution.

- [Node 22 performance hooks](https://nodejs.org/docs/latest-v22.x/api/perf_hooks.html):
  GC performance entries carry startTime/duration and kind/flags in detail; observer
  delivery is asynchronous. Flush between executions. An overlapping event identifies
  collection time, never allocation ownership.
- [Node 22 CLI](https://nodejs.org/docs/latest-v22.x/api/cli.html): CPU profiles sample
  execution; heap profiles sample allocations and can attribute sampled stacks. Sampling
  is incomplete and changes runtime. Retained evidence sampled in its loading stack is
  supporting evidence, not proof that it caused a particular GC pause.
- [Node 22 V8](https://nodejs.org/docs/latest-v22.x/api/v8.html): heap snapshots describe
  reachability but generation blocks the event loop and requires substantial memory.
  Snapshot only after service, with a fixed target/budget rule; its pause never enters
  listener service. Later snapshots can corroborate roots, not recreate a past heap.
- [Linux 6.12 schedstat](https://www.kernel.org/doc/html/v6.12/scheduler/sched-stats.html):
  thread counters distinguish CPU time and runqueue waiting, not every off-CPU wait.
  Counter reads bracket their own outside-timer work. Main-thread per-service readings
  and 200-ms worker snapshots cannot assign another process as cause without evidence.

Local inference: reproducing the accumulating evidence heap and isolating it can test
an evidence-retention explanation. Output identity protects musical equivalence; GC
coverage, retention roots/growth and allocation stacks must cohere before attribution.
A fixed A-before-B order and tracing interference limit aggregate timing comparisons.
No current trace proves the cause of 043/045's historical stalls without those traces.
