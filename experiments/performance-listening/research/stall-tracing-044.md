# Bounded tracing research for 044

Read 2026-10-05 by GPT-6.1-Sol (high) in Codex.

- [Node performance hooks](https://nodejs.org/api/perf_hooks.html): GC entries expose
  startTime and duration; a PerformanceObserver delivers them asynchronously. Flush
  callbacks between examples before correlating monotonic intervals. They report a GC
  event, not which allocation caused it. Observer/profile overhead needs disclosure.
- [Linux 6.12 scheduler statistics](https://www.kernel.org/doc/html/v6.12/scheduler/sched-stats.html):
  /proc/pid/schedstat holds CPU nanoseconds, runqueue-wait nanoseconds and timeslices.
  Counters concern the named thread; worker threads need separate sampling. Runqueue
  wait is not all off-CPU time, and cumulative deltas cannot identify another process
  as a cause without concurrent activity evidence.

Local inference: per-service intervals plus GC overlap and runqueue deltas can separate
some collection and scheduler stalls from active CPU work. A quiet replay cannot prove
why 043 stalled, and GC overlap alone cannot assign allocation ownership. Those limits
are explicit in 044's fixed decision rules. No listener research or gate proposal.
