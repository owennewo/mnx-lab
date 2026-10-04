# 037 — Settle the observation seam and count compute in its clock

## Pre-registration

2026-10-04. **GPT-6.1-Sol (high) in Codex**. Experiment 037, challenger track,
run 1 of 6 in the sampled-guitar promotion batch. This is instrument work, not a
listener version or a listener comparison.

### Question and why

Question 27: can **observation-seam@2** resolve audit 1's sample-index and emitted-time
ambiguities, cover its uncovered arithmetic, and define a compute-inclusive clock
under the approved amendment? Independent audit is the next session's work; this
experiment can establish implementation agreement with a frozen hand oracle only.

The frozen producer uses the index interpretation and a strictly increasing frame
watermark. The alternative interpretations coincide in T1–T3 but differ at 321 input
samples and the second inference batch. Distinguishing cases, rather than another
performance run, settle which interpretation is being specified. A nominal clock
can understate latency; adding only the current call's wall time can also understate
it when earlier calls leave backlog. Serial completion-time cases distinguish those
clocks. No thresholds, listener parameters, decoder or assessment rules change.

### Method and evidence

1. Land this pre-registration, the new versioned seam and a **separate frozen hand-case
   file** before implementation checks run. Hand answers are derived from the rules,
   without running any listener. Freeze cases by SHA-256. Preserve seam 1 and all
   previous oracle, listener, runner and evidence bytes.
2. Add pure observation-seam@2 arithmetic helpers in a new module and a dedicated
   validator/runner. Exercise all frozen cases, including both edge policies, the
   sample-index boundary, two successive batches, equality at the watermark,
   compute/backlog/initialization/finish, pitch selection and ties, offline trimming
   and stitched indices 142, 172 and 344. No model inference or acoustic evaluation.
3. Validate against seam 1's existing resampling/grid helpers on the hand inputs;
   verify frozen producer and historical public-run hashes. No existing shared
   harness module is edited, so its recorded baseline behavior is preserved by byte
   identity. No sine set runs: the amendment retires them. No guitar stage is claimed,
   so no active listener suite or full sweep is due in this instrument run.
4. Include wrong-rule probes for index-as-count, equality-only emission filtering,
   omitted compute, omitted backlog, last-bin tie selection, below-threshold acceptance,
   exact-hop offline trim, and missing stitched reset. Each must disagree with a
   distinguishing hand case. These are sensitivity checks, not listener variants.
5. Runner refuses an uncommitted tree, unlanded/changed pre-registration, untagged
   source commit or existing run ID. Primary **g037-challenger-observation-seam**;
   one infrastructure-only technical rerun **g037a-challenger-observation-seam**.
   Dry-assemble the public record before measuring. Write/hash each private case result
   immediately; keep detailed arithmetic privately and pin every source/input in the
   public summary. Tag and push `<run-id>-source` when landing.
6. Bounded research rechecks the pinned upstream inference/constants/decoder sources
   for trim direction, frame count and note-time conversion. Those are upstream
   facts; the causal delivery/compute clock is our convention, not an upstream claim.
   Record the known offline-versus-live grid offset, not a parity claim.

### Numbered predictions and contradictions

1. Every frozen hand case agrees with the new arithmetic helpers (zero disagreements).
2. Existing resampling/grid code agrees with its applicable hand cases; both ambiguous
   alternatives disagree on their separating inputs, not on the historical T1–T3.
3. All eight wrong-rule families are detected by at least one hand case.
4. Every existing producer, oracle, suite and historical public run is byte-identical;
   zero listeners executed, zero stages promoted, zero held-out/reserved accesses.

Any disagreement contradicts prediction 1 or 2; an undetected family contradicts 3;
any changed protected byte or listener/evidence access contradicts 4. Implementation
agreement is insufficient to assert an independent audit or a live pass.

### Decision rules fixed now

- **D1 agreement pending audit:** complete valid measurement, all cases agree,
  eight probes detected, legacy checks agree and protected bytes unchanged. Freeze
  seam 2 for independent audit; no cursor verdict is permitted before it agrees.
- **D2 mixed:** complete measurement with any hand disagreement or missed probe.
  Preserve the answers and discrepancy; independent audit remains next. Do not
  tune the oracle into agreement or reinterpret a historical verdict.
- **D3 infrastructure/inconclusive:** before measuring, preserve the error with zero
  cases and diagnose before the one technical rerun; during measuring, preserve every
  completed hashed case. If only final record writing fails, preserve measurements and
  repair the writer without remeasurement. Unresolved infrastructure or observations
  fitting no branch are inconclusive and close the batch. A protected-byte violation
  stops measurement, is recorded as infrastructure, and is repaired before any rerun.

### Carried-over state and preflight

Stopping and budgets unchanged from [036's resulting state](036-incumbent-guitar.md#resulting-stopping-count-budgets-and-evidence-access):
main 0 consecutive failed versions, 3 versions/10 comparisons; challenger 0,
1 version/1 comparison, exploration spent. Qualification 6 versions/12 slots unused;
held-out guitars, reserved/final evidence and Winner bars 5–8 untouched. The amendment
retires every sine set and replaces the old sweep-by-039 obligation with guitar sweeps
from the first guitar-stage claim; this instrument run makes none.

Preflight: only main checked out, reports/ledger/archive/private run directories have
no 037 owner or ID; worktree `listening-037`, dependencies installed once. ffmpeg,
private g035/g036 records and upstream sources are readable. Private output access
is checked before measurement. No model/audio file is needed for hand arithmetic.
The user directs:

> Your model and tool: GPT-6.1-Sol (high) in Codex.

> You cannot ask the user questions: record anything that needs them in your report and the research log.
