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

## Results

**Assessment meets D1's continuation rule on three of four development guitars.**
Every correctly played guitar note is matched, and every interval is reported within
its approved tolerance, both clean and with one hesitation. Martin's wrong-score
controls fail: the model supplies a spurious low G2, and the unchanged exact-pitch
aligner reports that isolated note as played in w2. No promotion or stage-4 pass is
claimed. The live spike remains exploratory pending an independent seam audit.

### Assessment, including controls

| Sound | Clean performances / controls passing | Hesitation performances / controls passing | Correct performance notes | Intervals within tolerance | Continuation criterion |
|---|---|---|---|---|---|
| Tone.js acoustic | 8/8; 16/16 | 40/40; 80/80 | 288/288 | 240/240 | Holds |
| Martin | 8/8; 12/16 | 40/40; 60/80 | 288/288 | 240/240 | Fails controls |
| Spanish | 8/8; 16/16 | 40/40; 80/80 | 288/288 | 240/240 | Holds |
| Fender | 8/8; 16/16 | 40/40; 80/80 | 288/288 | 240/240 | Holds |
| Frozen sine sweep | 388/388; 776/776 | Included in complete sweep | 4304/4304 sounded; 32/32 omissions found | 3916/3916 | Informational, not the guitar verdict |

All guitar performance assessments have zero false findings; every digital-silence
assessment rejects. The 24 Martin wrong-score failures are four clean s2 examples and
twenty s2 hesitations, one false score-note claim each. Martin s1's wrong-score controls
pass. Controls remain excluded from pooled finding rates, as the approved rule requires;
their individual failures decide their control result and are never hidden in the pool.

Maximum absolute interval errors: clean/hesitation acoustic 37.174/36.644 ms,
Martin 22.863/28.390 ms, Spanish 26.834/35.890 ms, Fender 31.732/26.318 ms. Those
errors satisfy the duration-dependent tolerance, not a blanket 30 ms gate.
The four development sample sets are the timbre units; their many correlated renders
are development coverage, not independent samples of population reliability.

### The Martin control diagnosis

In all four clean Martin s2 examples, the decoded B4 attack also carries a G2
(MIDI 43), at confidence .376–.400 and duration .255–.313 s. A low G-sharp2 also
appears alongside the last C5; w2 has no such pitch, so it is skipped. The spurious G2
is w2's second score event and the unchanged `alignPitches` accepts it in isolation.
The wrong-score report claims one note, no interval and no overall tempo. That fails
`claims`, while `tempo` passes. The same failure recurs across s2's twenty hesitations.
These are model observations, not notes actually rendered: the sample schedule remains
B4/C5 at those attacks. No decoder threshold was fitted on this evidence.

The independent exact-stimulus-token diagnostic passes all 32 clean guitar assessments
through the unchanged chain. This privileged-input check isolates the front end from
score compilation/report arithmetic; it is not end-to-end listening evidence or a
proof of which decoder change will repair the hallucination. The raw maps and decoded
records are preserved for that next question. It does not repair the present verdict.

### The sine comparison and unchanged incumbent

Basic Pitch's offline assessments unexpectedly also clear the complete frozen sine
suite: no false findings, all sounded notes matched, and every omission found.
Slow flags are 88/91 and fast flags 60/66, both above the shared 90% recall gate,
with zero false alarms. The incumbent's previously recorded counts are 89/91 and
64/66; this front end loses some boundary flags. Maximum interval error is 42.571 ms,
still within each interval's tolerance. A sine assessment pass says nothing about a
causal cursor, wrong/dead-note positives, polyphony or recordings through a microphone.

At this batch end, g034's whole incumbent/baseline sweep is reused with 177 current
TypeScript producer hashes verified and 8,207 cited artifacts checked transitively.
Every frozen input hash and equal-ID example is checked, and all 1,164 expected IDs
match the cited incumbent results. ONNX is an added development dependency used only
by the challenger; no existing producer was edited. The existing incumbent, baselines,
suite states, sentinels, retired-set list, evaluators and historical verdicts remain
unchanged. This is verified reuse, not a fresh incumbent comparison.

### Implementation and timing limits to preserve for review

The pre-registration's wording about retaining “two-frame offline confirmation” needs
clarification against its prescribed official decoder: there is no additional legacy
sine-token confirmation filter after decoding. The offline front end uses Basic Pitch's
11-frame minimum-length decoder; the live path retains three-frame pitch confirmation.
The score event compilation, live stay/skip cost transitions, exact-pitch offline
alignment and assessment arithmetic are preserved. This record does not claim identical
front-end tokenization or note-end estimates to the incumbent.

Live `availableAt` uses the existing runner's input delivery clock. The native worker
runs synchronously inside the measured feed call, so its CPU time and backlog are
reported by the runner, but the runner does not add that wall time to `madeAt`. Thus
cursor delays below are nominal audio-delivery delays; they are not measured physical
microphone-to-feedback latency. The seam audit should explicitly review this convention.
All offline activation maps are retained; the live record retains emitted frame times,
selected pitch/confidence and decisions, with full native map tensors retained for the
parity sample from each unique clean audio input, rather than every rolling window.

### Live spike: observations, deadlines and cost

| Policy | Performance cursor comparisons passing | Controls rejecting | Events within 200 ms | Nominal maximum delay | Prefix checks | Cost comparisons passing |
|---|---|---|---|---|---|---|
| Edge0, no right trim | 32/32 | 64/64 | 192/192 | 138.105 ms | 576/576 | 0/96 |
| Edge15, withhold 15 frames | 0/32 | 64/64 | 58/192 | 300 ms | 576/576 | 0/96 |

Untrimmed frames have no ahead or wrong exposure, with 100% on-event time under the
instrument's grace/answerability rules. Trimmed frames have zero ahead, but 5.380 s
of wrong exposure across performance examples and minimum on-event fraction 90.352%.
Every trimmed performance misses the first event's deadline: it is first acquired at
300 ms. Later events sometimes meet their deadlines; the table counts them rather
than treating a late first acquisition as failure to hear the whole piece.
These are exploratory comparisons, not an audited live-cursor pass.

| Provisional host cost | Edge0 | Edge15 | Shared gate |
|---|---|---|---|
| Sustained ratio, range | .4063–.5633 | .4614–.5653 | ≤.25 |
| Chunk p99, range | 43.973–72.220 ms | 49.095–66.355 ms | ≤10 ms |
| Maximum backlog | 96.664 ms | 70.909 ms | Reported |

Host: Intel Core i7-8750H, Node v22.22.1, CPU execution with one intra/inter-op thread.
Shared native model load was 207.934 ms, reported separately from per-example
initialization/chunk/finish cost. Model predictions every 100 ms repeatedly compute
almost the same two-second window; this measured implementation is expensive despite
its nominal cursor accuracy. The experiment does not demonstrate a production live
implementation, quiet-room rejection, microphone latency or chord following.

On identical saved window tensors, Python and Node model maps agree in **39/39**
checks: maximum absolute error **3.874302e-7**, below the fixed 1e-5 parity criterion.
These are first-window samples for each unique clean audio input, including silence,
not a claim that the rolling live pipeline equals official HQ-resampled, stitched
whole-clip inference. Different preprocessing/context and decoding remain explicit.

### Execution and reproducibility

[g035-challenger-basic-pitch](../runs/g035-challenger-basic-pitch/summary.json) ran once,
at `6db69b427b8a25f7f5d0ad0febae3fc81bb78a1d`, pinned by
`g035-challenger-basic-pitch-source`. Elapsed **3,776.219 s** (62.94 minutes).
No failed attempt, technical rerun or tuned version. The full first exploration is
far beyond the routine two-minute aim: the live phase repeats each example seven times
for its base record and six altered-future checks. The independent process review
should address economical reproducible execution before another such spike; unchanged
observations may be reused by hash while fresh uncached runs still measure cost.
No evidence is retired on this result.

Pre-registration `b87a4c16` reached main before stimulus/producer code or measurements;
its text above is unchanged. The existing guitar-nn sources were committed without
content changes at `f2f8e2fd628f4847cbfa771264e67304549441c4`. Its locked environment,
model, source snapshots and official decoder defaults were checked before inference.
712 unique audio hashes yielded all 1,740 assessments; every private observation and
evaluation was written and hashed as measured. Public shape was dry-assembled before
model measurement; the completed summary is **152,559 bytes**, below the size target.

Rendered guitar WAVs persist outside the worktree. The frozen manifest records 43
source-sample provenance paths inside this checkout; every one is tracked and can be
recovered at the source tag using its repository `public/samples/…` path and recorded
SHA-256 after retirement. Tone.js source samples already live in the persistent private
sample directory. Score paths remain relative, so rendered examples outlive the worktree.

| Artifact | Path / SHA-256 |
|---|---|
| Guitar set | `/home/williao/dev/mnx-listening-data/contract2-challenger-guitar-v1/manifest.json`; `7c0537d08b57333b3df4c9ac82cc4f26678dcaebbf48ac72d3a72e2dca502055` |
| Assessment record index | `/home/williao/dev/mnx-listening-data/diagnostic-runs/g035-challenger-basic-pitch/results.json`; `d36b5c2a3a74330516b9ae1f72c3861e99304699f1fef996d6c723fe78ae7713` |
| Live record index | Same run directory, `live-results.json`; `3275d5ee65bb612e473b75d49f016ca1dfd24cc44e847f5045bc72f4434bb169` |
| Runtime parity | Same run directory, `parity.json`; `0af10cd810804296e82dea4cf4acfd5481c21ce47c10a0a686447bcd0471ee8e` |
| Pinned Python identity | Same run directory, `observations/identity.json`; `972f52ebd89465f32d9e5f1d67dd5ea3f96dd3257a4d5d1c1972629ce7fa205e` |
| Public summary | `6c63aaf66aa3e830167d40bcab3bec76b952469e36e714db179b38c96feecd2f` |

## Against the exploration budget

Numbered predictions were explicitly replaced by the authorized first-exploration
budget. These rows assess its commitments rather than invent predictions afterwards.

| Commitment | Outcome | Evidence / limit |
|---|---|---|
| One fixed candidate, two live policies, no fitting | Held | Published decoder defaults; no tuned version or rerun |
| Full declared assessment sets and controls | Held | 576 guitar +1,164 sine examples; every per-example verdict retained |
| Independent instruments, unchanged incumbent | Held | Current audited evaluators/gates; verified g034 reuse; no suite state changed |
| In-process live cost and causality | Held, exploratory | 192 records, 1,152 prefixes; cost fails for both policies; availability-clock convention awaits audit |
| Runtime parity | Held within sampled scope | 39 same-input tensor checks; max error 3.874302e-7 |
| Legacy two-frame offline confirmation phrase | Qualified method wording | Prescribed upstream 11-frame decoder used; no second sine-token filter; exact downstream alignment/report logic preserved |
| Formal live/guitar-stage verdict | Not answerable here | Seam audit and recorded-guitar gates still required |

## Decision

**D1 applies:** valid complete measurements, with clean guitar assessment gates and
controls satisfied on **three of four** development sources. The contract's fixed rule
justifies a second challenger experiment. Martin remains a resolved control failure;
D1 does not turn it into a pass. Neither live policy passes the complete cursor/cost
requirements, and its cursor numbers await the independent seam timing audit.
No promotion, stage-4 pass, qualification or Studio integration is claimed.

### Resulting stopping count, budgets and evidence access

Challenger exploration budget **spent once**; **one** challenger development version
and **one** comparison, with two preregistered exploratory live policies. Its separate
stopping count now starts at **0**; the first exploration was exempt and D1 permits
continuation. Main track unchanged: **0** consecutive failing versions, **three**
development versions, **nine** completed comparisons. Together the tracks have four
development versions and ten completed comparisons; no qualification version or slot
has been spent. All six qualification versions/twelve assessment slots and all
reserved/final access remain unused; held-out guitars unused, Winner bars 5–8 unexamined.
The last fresh incumbent full sweep remains g034, verified and cited at this batch end;
the next remains due no later than 039. No set, sentinel or suite state changes.

**Batch closes at 1 of 1.** The goal yielded usable assessment observations on three
sources and identified a repeatable fourth-source control failure, plus a costly
accurate untrimmed live spike and a late trimmed one. Next is an independent audit of
**observation-seam@1** and its producer timing, then the separate batch process review.
This author audits neither and runs no next experiment.

## Next

First, audit [observation-seam@1](../contracts/observation-seam-1.md), including
availability versus wall-clock cost, resampling and padding, every hand timing case,
and the explicitly limited parity sample. The process review should also assess the
offline-confirmation wording and this run's excessive iteration time.

The next challenger question is a bounded front-end/decoder repair for Martin's
spurious low-pitch control claims, preserving the other sources and all earlier
assessments. Any fitted decoder thresholds need separate development calibration
examples; these scored renders cannot train their own passing threshold. Live cost is
a separate problem: unchanged large-window inference at 100 ms is not within budget.
The main track's next wrong-note/w1 question remains unchanged.

Direction of travel: the observation maps and exact-pitch offline interval accounting
look useful beyond sines, but the current monophonic reduction, adjacent-pitch refusal
and exact-match chain do not establish chords, repeated articulations, wrong/dead-note
positives or noisy recordings. Training a better model is not warranted by this single
experiment alone; first separate decoder ghosts, sequence acceptance and streaming cost.

**Awaiting the user:** decide whether this seam should become a progression amendment,
and approve evidence-based recorded-guitar gates before a formal stage-4 claim. R10's
standing sentinel tie-break/pool and baseline-sweep decisions remain open. Qualification
and Studio product decisions remain future choices. The timing audit and process review
are work for separate sessions, not approvals this author can supply. No questions
were asked; all pending decisions are recorded here and in the research log.

## Attribution

Designed, implemented, executed and recorded by **GPT-6.1-Sol (high) in Codex**.
All 500 bench tests and the type check passed before the source commit. The landing
gate must pass on the final rebased tree before fast-forward/push and retirement.
The pre-registration is preserved verbatim; existing listener/evaluator/oracle/source
score bytes and historical verdicts were not edited.
