# 035 — Basic Pitch observations through the unchanged event chain

## Pre-registration

2026-10-02. **GPT-6.1-Sol (high) in Codex**. Experiment 035, run 1 of 1 of the
challenger batch. First exploration of avenue A2, under the delegated decisions in
[contract 2](../contracts/development-contract-2.md#the-challenger-track-basic-pitch-observations).
No numbered predictions: the one-off exploration budget replaces them.

### Question and alternatives

Can the pinned Basic Pitch model supply observations to the incumbent's unchanged
stay/skip chain and offline exact-pitch alignment, yielding correct note and timing
assessments on the four development guitars, with rejection of silence and a distant
wrong score? What happens on the frozen sine suite? Can an in-process live spike make
those observations available within 200 ms at acceptable cost?

This is ranked question 24 and the current batch's goal. Exact generated attacks
separate front-end errors from uncertain real sync (L1). Score-blind observations and
unchanged sequence alignment preserve the tests of L2/L3/L8. Fixed upstream thresholds,
with no fitting on these examples, avoid L4/L11's circular calibration. Decays and
held-note behavior remain measured rather than assumed (L5); no tempo prior is added
(L6). No reserved or real-player evidence is used.

Separate decoded pitch loss, onset-time errors and chain rejection using raw maps,
decoded events, alignment and per-example evaluator failures. Compare native model
outputs with the pinned Python implementation on identical tensors to separate runtime
parity from decoding and live context loss. Live edge policies 0 and 15 distinguish
using untrimmed recent frames from the upstream edge-trim delay; neither can claim a
live verdict before the independent seam audit. Digital silence tests only zero noise.

### Exploration budget, stage order and method

One experimenter session; one fixed candidate and two specified live observation
policies, no tuning after measurements. One technical rerun only, repairing infrastructure
without changing the model, decoder, chain, evidence or question. Primary run
**g035-challenger-basic-pitch**, technical rerun **g035a-challenger-basic-pitch**.
Land this pre-registration before generating evidence or running the model on it.
Commit all producers before measuring; require an unchanged pre-registration prefix
already on origin/main, a clean tree and a HEAD source tag `<run-id>-source`.

1. Pin Basic Pitch 0.4.0's ICASSP 2022 ONNX model at SHA-256
   `2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec`.
   Put the existing guitar-nn sources under git, changing no content, and cite that
   commit, its pinned environment and model/decoder hashes. Use the official Python
   offline inference/decoder with existing defaults (onset .5, frame .3, minimum
   11 frames, melodia enabled), no fitted thresholds. Preserve onset/note/contour maps
   and decoded events privately by hash. Observations are score-blind.
2. Freeze **contract2-challenger-guitar-v1**: sample-render@1, 48 kHz, −12 dBFS,
   the existing four development sample sources only: tonejs-acoustic, martin,
   spanish, fender. Stage order is clean s1/s2 at 45/63/90/99 first, then the existing
   full silent-hesitation set (one deviation). Re-render every performance of
   contract2-hesitation-v1, preserving its rendered note schedule, add paired zero
   silence and w2 controls, retain exact parent labels with changed audio provenance.
   Expected 48 performances and 96 controls per guitar: **576** examples. Recompute
   sample boundaries/validate labels and sample hashes; verify silence is all zero
   and wrong-score audio equals its parent. Sample boundaries are stimulus truth;
   acoustic attack within a recorded sample is a stated limitation, not a new oracle.
3. Assessment full sweep of all **1,164** unique frozen current sine examples from
   the suite record, with equal-ID checks, and all **576** guitar examples. No
   sentinels replace full sets for the challenger. Assess every example with the
   unchanged alignPitches and event-chain@3 note/interval/bar-summary logic, consuming
   decoded onset/pitch tokens instead of sinePitch. A new adapter/version leaves all
   incumbent sources frozen. Existing audited following2/assessment3/gates2/oracle4
   and approved numeric thresholds remain unchanged. Guitar numbers are comparisons
   against those thresholds, not a stage-4 pass: stage-4 gates still await approval.
4. Batch-end incumbent/baseline sweep cites g034 by hash only after checking producer
   and input hashes and referenced private records. Changed producers/inputs force
   rerun; new challenger modules do not change earlier producers. No incumbent suite
   state, sentinel or retirement changes. The sine result is reported as an
   out-of-distribution comparison and does not decide the guitar track.
5. New **observation-seam@1** states map/event audio time and availability time,
   confidence, pitchless-onset representation, model/source hashes, resampling,
   padding and frame arithmetic, including hand-worked timing examples. A separate
   session audits it after landing. No evaluator is added or revised here.
6. In-process native CPU live spike on all **96** clean guitar examples (eight
   performances and sixteen controls per guitar), through unchanged executeSeam
   at 48 kHz/480. ONNX runs in a worker in the same Node process, with synchronous
   completion included in runner chunk cost. Fixed one-thread CPU inference, rolling
   43,844-sample model windows every 100 ms, causal linear 48k→22.05k resampling,
   leading zeros; edge policies discard 0 or 15 right frames. Emit each new eligible
   frame once with its actual delivery availability. Retain the incumbent's two-frame
   offline/three-frame live confirmation and unchanged live cost transitions. Offline
   assessment uses the Python events separately. Compare native/Python predictions
   on identical window tensors (max absolute map error ≤1e-5 is parity, larger is
   diagnosed, never quietly accepted). Six future-prefix checks per live example;
   measure sustained ratio, chunk p99, backlog, load cost and observation delay.
   Cost is provisional on this host (i7-8750H, Node 22), not a Studio device verdict.
7. Write and hash each private observation and evaluation as measured; dry-assemble
   the public summary before measurements. Public record pins source commit/hashes,
   every per-example gate result, groups and private paths/hashes; large raw maps,
   decisions and note records stay private. Summary size is reported, never refused
   after measurement. Model audio-hash reuse within this run is allowed, including
   paired wrong scores; no label or score enters inference.

### Decision rules fixed before measurement

- **D1 continue:** valid complete measurement and the assessment gates, controls
  included, hold on clean stage-1 guitar examples of at least three of four sample
  sets. A second challenger experiment is justified. No promotion or stage pass is
  claimed here; live timing needs its audit and guitar gates their approval.
- **D2 component repair:** D1 fails, but concrete traces and an independent-input
  component diagnostic attribute failure to one component with a stated repair.
  Continue only with that repair as the next question, never claim the failed output
  passed. Pitch/onset/chain diagnoses without isolation are insufficient.
- **D3 stop track:** valid measurement, neither D1 nor D2. Report the limit and stop
  the challenger; incumbent remains unchanged.
- **D4 infrastructure:** before measuring, preserve failure and zero measurements;
  during measuring, preserve every completed hashed record; after measurement but
  during final writing, preserve measurements without a verdict until repaired.
  Diagnose before the single technical rerun. Unresolved infrastructure or evidence
  fitting no branch is inconclusive, closes the batch, and changes no suite state.

The session ends after this numbered experiment lands and its worktree retires.
The independent observation-seam audit is next, then the separate process review;
this author does neither. A seam/progression amendment, guitar gates and any product
or qualification decision are recorded for the user, never assumed.

### Carried-over stopping count, budgets and preflight

Main track unchanged from [034](034-missing-event-sweep.md#resulting-stopping-count-budgets-and-evidence-access):
stopping count **0**, three development versions, nine completed comparisons;
qualification's six versions/twelve slots and reserved/final evidence untouched,
Winner bars 5–8 unexamined. Full sweep g034, next due no later than 039, with g034
reused by hash at this batch end. Challenger exploration not previously spent;
its stopping count starts after this experiment. No promotion access is taken.

Preflight found only main checked out, no 035 report/run/ledger owner or archived
number; worktree listening-035 created, dependencies installed once. ffmpeg and the
pinned Python environment/model, frozen sets and private records are accessible.
Private writes use the existing authorized data root. The user specified this identity
and direction:

> Your model and tool: GPT-6.1-Sol (high) in Codex.

> You cannot ask the user questions: record anything that needs them in your report and the research log.
