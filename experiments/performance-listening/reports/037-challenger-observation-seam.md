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

## Results

**D1: seam-2 implementation agreement, pending independent audit.** All 36 frozen
hand cases agree, all eight wrong-rule families are detected, and the existing
resampler/grid agrees on its 14 applicable cases. No listener, model inference or
acoustic performance is run. This establishes a specification and its arithmetic
helpers; it does not establish guitar latency, cost or a cursor pass.

| Hand-case group | Cases agreeing / total | What it distinguishes |
|---|---|---|
| R0–R7: resampling and interpolation | 8/8 | At M=321, output j=147 does not exist; at M=322 it does, even though its right interpolation weight is zero |
| L1–L6: frame batches and watermark | 6/6 | Second edge0 batch emits nine strictly new frames, not seventeen overlapping frames; all share completion availability |
| W1–W3: cadence and waiting | 3/3 | Exactly the .1-second delivery boundary is eligible; an onset just after it can wait 99.999 ms for the next batch |
| C1–C7: compute, backlog, start/finish/offline | 7/7 | Actual completion, rather than nominal delivery or only the current call's cost |
| P1–P5: reduction and null meaning | 5/5 | Maximum activation, lowest-bin tie, inclusive threshold, MIDI endpoints; no-pitch frame is neither an onset nor silence |
| O1–O7: trim and offline axis | 7/7 | Keep the prefix, discard surplus tail, preserve the historical reset formula for both note endpoints |
| **Total** | **36/36** | **No frozen answer changed** |

| Alternative rule | Distinguishing case | Observed separation |
|---|---|---|
| Sample requirement interpreted as a count | R1 | 148 samples incorrectly exist instead of 147 |
| Discard only equal emitted times | L2 | Seventeen frames instead of nine on the .2-second edge0 batch |
| Omit compute | C1 | 100 ms instead of 145 ms completion |
| Omit backlog | C3 | 260 ms instead of 300 ms completion |
| Last bin wins a tie | P2 | MIDI 62 instead of 60 |
| Accept below-threshold pitch | P5 | MIDI 60 instead of an unpitched frame |
| Trim using exact analysis-hop FPS | O1 | 5,167 retained frames instead of 5,160 on a 60-second clip |
| Omit stitched resets | O6 | No two-term correction at frame 344 |
| **Sensitivity** | **8/8 families detected** | **These are wrong-rule probes, not listener comparisons** |

### What it shows about lag

The new convention uses `completion = max(delivery, previous completion) + elapsed`
on one serialized processing lane. Frame availability and decision madeAt use that
completion; audio timestamps and refersTo retain their musical meaning. C2 shows a
nominal 100 ms first-event decision becoming **201 ms** after 101 ms of compute,
which misses the approved 200 ms deadline. C3 shows why adding only this call's cost
is insufficient: a call delivered at 200 ms behind a 240 ms prior completion and
requiring 60 ms finishes at **300 ms**, not 260 ms. Idle gaps can clear backlog.
These are hand inputs, not new measurements of Basic Pitch inference speed.

The second-batch watermark cases resolve audit 1's ambiguity without changing the
frozen producer's reading. Both edge policies are covered. Offline frame 142 is
8.526 ms later on the upstream axis than on its nominal window grid; frame 172 is
1.8 ms earlier, and frame 344 is 3.6 ms earlier. Their slopes differ slightly, so the
auditor's approximate short-clip range must not become an all-length bound. The
[source note](../research/observation-clock-037.md) identifies the pinned upstream
trim and decoder arithmetic. No first-window offline/live parity is inferred.

### Provenance and validation limits

The run completed once, **2026-10-04 21:08:58–21:09:00 UTC**, in **1.907 s**,
at `726a8c320e2d5a969d7e33771e4a9b8e81052862`, tagged
`g037-challenger-observation-seam-source`. Pre-registration `c1fe83fa` had already
reached main and origin/main; the runner required its unchanged full text, committed
code, a clean tree, the source tag and a new run ID. Dry assembly preceded the cases;
each case's private record was written and hashed immediately. No infrastructure
failure or technical rerun of the numbered experiment occurred.

**390 protected files** are byte-identical to the tree before the pre-registration:
existing bench producers/tests/oracles/suite, listen interface, contracts, current and
archived public runs, model and audio sources. g035/g036 public summaries and **19
available private artifacts named directly in them** were checked by hash. This is
file-integrity evidence, not a fresh listener comparison or a transitive validation
of every private audio/model artifact. The existing baselines are preserved by source
and recorded-public-evidence identity; no retired sine examples were executed.

The **14 legacy checks** cover six resampling counts, two interpolation boundaries
and six grid cases. Two grid cases emit no frame and are vacuous as numerical grid
checks; the new oracle separately checks their empty-selection rule. Native inference,
HQ resampling quality, full decoder behavior, actual producer clock propagation,
receptive-field sufficiency and live prefix invariance remain untested here. Future
versioned producers/runners must adopt seam 2 and record measured per-call service
before any compute-inclusive cursor claim. Wall durations cannot be compared exactly
between reruns; the seam requires causal payload/delivery invariance separately.

| Artifact | Path / SHA-256 |
|---|---|
| Public summary, 14,218 bytes | [g037](../runs/g037-challenger-observation-seam/summary.json); `3012dc27edf075c8cb0e2bba473a246b3058bf3ea3d377e777787f9b138bdefe` |
| Frozen separate hand oracle | [seam-2 cases](../bench/oracle-events/observation-seam-2.json); `1a353ed0e56f4b2e3b765832c8b373d9147f02002238cab4efcc34d6fccddcac` |
| Detailed checks and protected-file hashes | `/home/williao/dev/mnx-listening-data/instrument-runs/g037-challenger-observation-seam/validation.json`; `7a9ded1f5b8b6f44c9baa2236fc2f17c8227daf0aea398da368fe1d0d673caf1` |
| Each case record | Same private directory, `case-<id>.json`; individual paths/hashes in the public summary |

The preregistration gate initially hit an unchanged legacy test's 5-second timeout
(the prefix-only test in online-time-warp@1); sequential execution and two workers also
hit it. Its nine tests passed in isolation, and the whole **503-test bench suite**
passed with **one Vitest worker**. Static checks/build passed. Main then moved for an
auditor-attribution update, requiring a rebase and another complete, passing one-worker
gate before pre-registration landed. These operational retries measured no listener
and spend no numbered-run rerun budget. Logs persist in the private run directory,
indexed by `landing-checks.json`. A staging command initially used the bench directory
with repository-relative paths; it was corrected before the committed numbered run.
Focused new/legacy adapter checks passed **7/7**, and the bench typecheck passed.
The final result commit must re-earn the landing gate on its final rebased tree.

## Against the predictions

| # | Outcome | Evidence |
|---|---|---|
| 1 | Held | 36/36 frozen hand cases agree; zero disagreements |
| 2 | Held within stated scope | 14 applicable legacy checks agree; count/equality alternatives separated by R1/L2, historical ordinary-prefix counts preserved |
| 3 | Held | All eight wrong-rule probes detected |
| 4 | Held | 390 protected files unchanged; zero listeners/stages/held-out or reserved access |

## Decision

**D1 applies.** Freeze observation-seam@2 for an independent audit. No listener version,
assessment rule, stage verdict, incumbent, sentinel or suite state changes. The new
clock is specified and hand-checked, not yet adopted by a measured live producer.
The author does not audit its own oracle. Question 27's implementation work is
answered; the audit is the challenger's highest open prerequisite.

### Resulting stopping count, budgets and evidence access

Unchanged from the pre-registration and 036: main stopping **0**, 3 versions/10
comparisons; challenger stopping **0**, 1 version/1 comparison, exploration spent.
Qualification 6 versions/12 slots unused; held-out guitars, reserved/final evidence and
Winner bars 5–8 untouched. No guitar stage claimed. Sine sets remain retired under
the amendment; guitar sweep obligations begin with the first guitar-stage claim.
Batch run **1 of 6 completed**; the batch continues after seam-2's independent audit.

## Next

**Independent observation-seam@2 audit**, from its new rules before reading the frozen
answers: all 36 cases, especially serial compute/backlog stamps, the two ambiguity
boundaries, shared batch availability, null semantics, offline endpoint mapping and
its exact grid difference. The auditor should explicitly identify any uncovered rule.
After agreement, return to question 29 (quiet-noise controls), then Martin's control
repair and streaming cost. This session stops after landing and retiring its worktree.

**Awaiting the user:** no new decision is required by this instrument result. Promotion,
future microphone-stage gates, qualification and Studio product choices remain the
user's future decisions; nothing here spends or substitutes for them. Existing R10
sentinel tie-break/pool and comparator-sweep questions remain recorded in the log.

**Direction of travel.** Explicit musical time versus availability and serialized
completion arithmetic should survive chords, more sampled guitars and real music.
The current monophonic reduction and chain restrictions will need further development;
a timing specification alone supplies no evidence that the model hears those inputs.

## Attribution

Pre-registered, hand cases frozen, implemented, run and recorded by
**GPT-6.1-Sol (high) in Codex**. Independent audit and process review are other sessions.
