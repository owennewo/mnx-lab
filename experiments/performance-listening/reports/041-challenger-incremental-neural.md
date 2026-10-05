# 041 — Incremental neural inference and seam 4

## Pre-registration

2026-10-05. **GPT-6.1-Sol (high) in Codex**. Experiment 041, challenger track,
run 5 of 8 in the sampled-guitar promotion batch. Questions 30 and 36 together,
as the user's 2026-10-05 direction in the research log authorizes. Exactly one new
live producer, basic-pitch-chain@3; the @2 offline component stays frozen.

### Question and alternatives

Can restricting the neural convolutions to newly selected frames plus their temporal
context lower sustained cost below .25 without changing those frames, while seam 4
resolves the seam-3 audit's disagreement, ambiguities and uncovered state/cost rules?
Global normalization prevents retaining old normalized activations unchanged. A
new-frame neural path can instead recompute the pinned full-window CQT/normalization
and crop only after normalization. This preserves global extrema but may leave DSP
as the dominant cost. Neural crop context/padding or float32 convolution differences
may also change selected activations. Full maps versus selected cropped maps on the
same tensors distinguish these explanations; per-call timings distinguish cost from
cadence/acoustic latency. This is incremental neural output computation, not incremental
CQT, and never reuses stale normalized activations.

### Method and evidence

1. Land this report, observation-seam@4, its separate hand file/freeze and bounded
source note before implementation checks or inference. Preserve all earlier seams,
oracles, listener/runner/evaluator versions, suite states and historical records.
The independent seam-4 audit is the next session's work: **no formal cursor, guitar
stage, qualification or promotion verdict in 041**.
2. Transform the pinned ONNX graph without changing weights: recompute full-window
CQT/global normalization, slice the time dimension before the neural convolutions,
retain ten frames of left context (longest onset branch radius 10) and the original
right boundary, and make downstream temporal reshapes dynamic. Select only frames
per the strict watermark/cadence rules, including unpitched frames. Compute all three
maps for the cropped context; discard context outputs. No fitted threshold, score
filter, new decoder or chain transition. Score-blind backend arguments are tensor and
selected local-frame indices. Freeze graph/source hashes; exclude shared loading only
with its measured value reported. Full-window DSP is explicitly still recomputed.
3. Validate every new frozen hand case and inherited cases in their declared layers.
Check once-only interpolation across chunks/eviction, fresh populated reset, start
and emission-free finish/empty-feed accounting, paired prefix clocks, irregular
scheduling, invalid times/lengths and offline boundary/tail geometry. Hand arithmetic
is frozen independently of listener output. Native adoption checks retain full tensors,
map shapes/provenance and comparisons, not scalar-oracle claims about HQ DSP/decoder.
4. Measure **all 576** frozen contract2-challenger-guitar-noise-v1 examples: 192 correct
clean/hesitation performances, 192 w2 and 192 fixed pink-noise controls, all four
development guitars. Fresh live wall timers include per-example setup, every feed
(including slicing/resampling/copy/wait/reduction/chain and empty calls) and live finish.
Use 48 kHz/480 delivery, edge0, unchanged chain logic, serial compute-inclusive stamps
and audio-duration denominator. Keep nominal refersTo and chain clocks independent of
compute. Retain/hash each per-example call/frame/decision trace immediately. Report
following2 measurements and existing thresholds as exploratory comparisons only.
5. On the first, middle and last eligible window of each unique audio hash, compare
cropped maps with the frozen NativeModel on the identical tensor. Report exact float32
identity, maximum absolute difference, diagnostic atol 1e-6/rtol 0, and exact MIDI/kind
selection. That diagnostic tolerance is a numeric comparison, **not permission to
loosen a contract or award a cursor pass**; any difference remains visible for audit.
Reference inference is outside candidate cost. Native causality: for every example,
replay three delivered prefixes (25/50/75%, rounded down to chunks), comparing ordered
frame/decision payloads and delivery indices, with zero and alternating future tails
in input buffers; wall stamps excluded. Fresh replay service times retained. Inputs to
feed are bounded chunks only; no labels/future buffer reach model or chain.
6. Verify audio/score/label hashes and relevant producer/adapter/source hashes before
reuse of @2 offline assessments and incumbent records. Rerun nothing whose unchanged
records already establish it. The incumbent and frozen baselines stay unchanged; no
shared harness source changes. There are no passed guitar substages/sentinels. This
exploratory producer experiment makes no guitar stage claim, so the amended full-sweep
obligation begins with the later stage claim. Sines, held-out guitars, reserved/final
evidence and Winner bars 5–8 are not run.
7. Guarded runner requires committed clean code, unchanged landed pre-registration,
HEAD tag g041-challenger-incremental-neural-source, unused private/public IDs and dry
public assembly before measurement. Primary g041-challenger-incremental-neural;
one infrastructure-only rerun g041a-challenger-incremental-neural. Failures before
measurement record zero completed examples; mid-run failures retain all completed
hashed evidence. Record-writing-only failures repair writing without remeasurement.
No refusal after measurement for summary size, no tuning within the run.

### Predictions and contradictions

1. All new cases and unambiguous inherited cases agree in their explicitly declared
representation layers; zero discrepancies. Any mismatch contradicts instrument agreement.
2. Every sampled native selected map differs by at most 1e-6 absolute with exact
MIDI/kind reduction and selected coordinates; cropped neural input uses fewer than
172 time frames on ordinary cadence. Any larger error, selection mismatch or full
neural window contradicts the crop hypothesis. Exact byte identity is separately
reported and is not presumed by a tolerance comparison.
3. All 576 exploratory live comparisons meet cost ratio .25 and their cursor/control
thresholds, including every .2-second event deadline. Any example exceeding cost,
missing a deadline or falsely following contradicts this performance prediction.
4. All 3456 native prefix comparisons agree, all relevant reused evidence verifies,
and all 576 @2 assessments retain their recorded pass; no held-out/reserved access.
Any payload/provenance mismatch contradicts integrity/causality or valid reuse.

### Decision rules fixed now

- D1 implementation-compatible, pending audit: complete valid measurement; cases,
prefixes and provenance agree, native selected maps meet the diagnostic comparison
and exact selection, every exploratory live cost/cursor/control comparison clears.
Carry the frozen producer to independent seam-4 audit, then question 31's formal stage
claim. No pass/promotion awarded here.
- D2 resolved limitation: complete valid measurement with any hand-case, native parity,
selection, exploratory live cost/cursor/control or prefix discrepancy. Preserve and
localize it, with no second version/tuning in 041. Independent seam-4 audit still next;
rank the measured limitation before stage/held-out work. The batch may continue within
the stopping rule, with a separately pre-registered repair.
- D3 infrastructure/inconclusive: unresolved execution/integrity failure, incomplete
measurement or observations outside D1/D2 closes the batch. Diagnose before the single
technical rerun. Post-measurement record failures preserve/repair completed evidence.

### Carried-over state and preflight

From [040](040-challenger-streaming-state.md#resulting-stopping-count-budgets-and-evidence-access),
unchanged by its independent audit: main stopping 0, 3 versions/11 comparisons;
challenger stopping 1, 2 versions/3 comparisons, exploration spent. This adds one live
version/comparison; conservatively charge one uncleared version even if exploratory
comparisons all clear, since the independent audit/formal stage judgment is still due.
Thus resulting challenger count 2, 3 versions/4 comparisons unless execution never
measures the version. Qualification 6 versions/12 slots unused; held-out, reserved/final
and Winner 5–8 untouched. Batch 5 of 8; no user decision or contract/gate relaxation.

Preflight: only main checked out, no 041 report/archive/private ID or owner; own
listening-041 worktree and one npm ci. FFmpeg, pinned Python/model, guitar/noise inputs
and earlier private records accessible. Isolated ONNX 1.17 graph utility installed
under /tmp, leaving pinned Python dependencies unchanged; output permission checked
before measurement. Initial attempts found no pip/python executable; uv supplies the
isolated tooling, no measured run or rerun spent. User directions:

> Your model and tool: GPT-6.1-Sol (high) in Codex.

> You cannot ask the user questions: record anything that needs them in your report and the research log.

This session lands and retires its worktree, then stops after exactly experiment 041.

## Results

**D1: implementation-compatible exploratory evidence, pending independent seam-4 audit.**
The cropped neural backend preserves every sampled selected map exactly and every
fresh live comparison clears on the development guitars. This author grants no formal
cursor/stage verdict. The first attempt's incomplete setup timing is invalid for cost;
the one technical rerun resolves it without changing the neural graph or listener policy.

### Both outputs and every control

| Guitar | Substage | Cursor comparisons clearing: performance / w2 / noise | Cost comparisons clearing | Maximum work/audio ratio |
|---|---|---|---|---|
| tonejs-acoustic | clean | 8/8 / 8/8 / 8/8 | 24/24 | 0.1639 |
| tonejs-acoustic | hesitation | 40/40 / 40/40 / 40/40 | 120/120 | 0.1662 |
| martin | clean | 8/8 / 8/8 / 8/8 | 24/24 | 0.1715 |
| martin | hesitation | 40/40 / 40/40 / 40/40 | 120/120 | 0.1732 |
| spanish | clean | 8/8 / 8/8 / 8/8 | 24/24 | 0.1648 |
| spanish | hesitation | 40/40 / 40/40 / 40/40 | 120/120 | 0.1713 |
| fender | clean | 8/8 / 8/8 / 8/8 | 24/24 | 0.2028 |
| fender | hesitation | 40/40 / 40/40 / 40/40 | 120/120 | 0.2355 |

All **576** fresh live comparisons clear, including every control; all
**1,152** performance events meet their .2-second compute-inclusive deadline.
All **576** unchanged @2 assessment is cited by verified source/input/label/artifact
hash, retaining its recorded pass, all 1,152 notes and 960 intervals, with no false
finding. Those are reused offline musical observations, not fresh offline cost.
The incumbent's unchanged guitar/noise records are verified beside this evidence;
036 remains its performance failure. No incumbent, baseline, evaluator, gate, suite
state or sentinel changes, and no sine/held-out/reserved/real-clip execution.

| Measured cost / delay, corrected g041a | Result |
|---|---|
| Cost ratio, minimum / median / maximum | 0.1361 / 0.1527 / 0.2355 |
| Total candidate work / audio | 548.518 s / 3506.493 s; ratio 0.1564 |
| Event delay, median / p95 / p99 / maximum | 110.214 / 149.502 / 153.573 / 156.324 ms |
| Shared candidate model load (outside examples) | 0.201 s |
| Reference model load (diagnostics only) | 0.150 s |
| Saved setup/feed/finish clock recurrences checked | 352,008; all agree |

Delay is from each actual distinguishing performance onset to the cursor decision's
serialized measured completion. It includes compute and backlog; it is not a microphone,
audio-driver, UI or target-device measurement. Cost is provisional to the recorded host. Fender
reaches 0.2355, leaving only 0.0145 below the 0.25 limit; this is not a
target-device margin guarantee.
The corrected timer starts before per-example state allocation, compilation/reset and
all live work. Reference inference, per-example evidence writing and evaluation are
outside candidate service, and are never counted as listener work. Every delivered feed, including emission-free calls,
and live finish is timed; no final resampler/model flush occurs. The @2 offline component
is assessed from its frozen evidence, separately from this live finish.

### Native implementation and oracle evidence

| Check | Result |
|---|---|
| New physical/state hand cases | 51/51 agree |
| Declared inherited seam-2 and seam-3 cases | 62/62 agree; historical S5/O11 replaced by complete fixtures |
| Native selected-map parity windows | 702/702 byte-identical, all three maps; maximum absolute difference 0 |
| Exact MIDI/kind and selected coordinates | Every sampled window agrees |
| Native prefix payload comparisons | 3456/3456 agree |
| Offline assessments reused after hash checks | 576/576 |
| Pre-measurement artifact checks | 1,485 |
| Per-example record hashes and clocks checked after measurement | 576/576; all frame coordinates, watermark order and owned stamps agree |

Ordinary new-frame neural calls use **19 rather than 172 time frames**, including ten
frames of left context: about **89% less neural time extent**. CQT and its whole-window
global normalization are still recomputed; no old normalized activations are cached.
The three map branches keep original weights and right-boundary padding. The frozen
whole model runs on the identical tensor at first/middle/last windows of every unique
audio hash (234 inputs, 702 windows). These are sampled equivalence checks, not a claim
of exhaustive parity over every possible signal. The crop's dependency argument and
explicit float32/state cases remain for independent audit.

The audit's I3 rounding discrepancy is represented physically by bits; S5 supplies
all lifecycle and second-start inputs; O11/O12 distinguish prior next=91200 from 86400;
N1/N2 state the toy formula and native formula separately; inherited abstract confidence
cases remain unchanged and physical cases supply exact float32 expectations. Populated
reset, pending-neighbor delivery, ring wrap/global indices, paired service clocks,
nonfinite/start rejection and exact-hop/zero/fractional offline geometry are frozen.
Author agreement is not an independent adequacy verdict. The noise controls retain
one fixed seed and their lower-register pitches; score rejection is not universal
silence detection or microphone robustness. HQ resampling/full official
decoding and musical transition/refusal behavior remain pinned separate obligations,
not scalar-oracle successes. No chord/dead/repeated-pitch capability is inferred.

### Two attempts, diagnosis and provenance

| Attempt | Outcome | Completed evidence |
|---|---|---|
| g041 | D3 invalid timer scope, deliberately stopped after diagnosis | 325 live records, 1,944 prefix checks, 5,986 retained hashed artifacts; no valid complete cost verdict |
| g041a, sole technical rerun | D1 compatible, pending audit | All 576 examples, 3,456 prefixes, 702 sampled native comparisons and 113 hand checks |

The original setup timer began just after construction of the state/chain objects.
That omitted per-example allocation, so favourable partial costs were not accepted.
All first-attempt evidence is retained and its source is tagged. The repair moves the
timer before construction, fixes summary grouping of noise-prefixed control IDs and
adds installed runtime/official-source checks. Two TypeScript inference annotations
were corrected. There is **no neural graph, weight, cadence, reduction threshold,
chain transition, offline policy, input or oracle change** between attempts. This is
an infrastructure repair under the pre-registered technical-rerun rule, not tuning.

Pre-registration **c0f09b94** reached main and was pushed before
implementation checks/inference. Original measured source **c196fe03** is pinned by
`g041-challenger-incremental-neural-source`; corrected source **1549385f** by
`g041a-challenger-incremental-neural-source`. Both tags are pushed on landing. The
runner requires clean committed code, unchanged landed pre-registration, source tag,
unused ID and dry public shape before measuring. Every live/prefix/parity/hand record
is written and hashed as completed. First-attempt public preservation indexes all
private evidence; no file/run ID is overwritten. No further rerun budget remains.

Corrected measurement: **2026-10-05T09:31:00.480Z–2026-10-05T10:08:35.456Z**, **2254.976 s**.
This exceeds the two-minute routine aim: all 576 examples, six fresh prefix replays
each and reference parity ran because this is a new native producer. The closing
review should assess how to keep later unchanged regression checks lean under the
source/input/adapter hash rule; no evidence is retired here. Public summary size:
**265,298 bytes**;
completed measurements were never refused for size.

The installed Python package versions match the retained identity/lock; official
inference/decoder/package snapshots match installed files; model SHA and external
repository commit/clean state, manifest, scores, audio, labels and relevant old/new
sources verify. Native ONNX runtime is pinned by npm lock and fresh worktree install; the Node
version is recorded with the host.
The graph record pins the unchanged source model and derived model. Shared frozen
producer bytes are unchanged, so existing baseline behavior is preserved by source
identity rather than unnecessary new baseline execution. No protected evidence is spent.

Focused frozen-case tests and bench TypeScript check pass after the repair. The
pre-registration gate passed 515 existing bench tests, 37 targeted root tests, static
checks and build. Final rebased landing gate is required separately and its log is
retained privately. The source tag preserves the measured tree if rebase rewrites it.

| Artifact | Path / SHA-256 |
|---|---|
| Corrected public summary | [g041a](../runs/g041a-challenger-incremental-neural/summary.json); `191c9bb99f17382402d5ecf3377bbacf7ff30d5404412d8937f864c28ca942e3` |
| Preserved invalid attempt | [g041](../runs/g041-challenger-incremental-neural/summary.json); `664aa89152adde4c190f31024c9d90f4cc282f5411758734191a144605a27a02` |
| Frozen seam-4 hand file | [oracle](../bench/oracle-events/observation-seam-4.json); `f631324dd192d9c008d9e27336a09ce1385a130a367e85add6152b9ade8e0167` |
| Corrected private result/parity indexes | `/home/williao/dev/mnx-listening-data/diagnostic-runs/g041a-challenger-incremental-neural/results.json`; `b50da8649969e46378ffe30778bd538855f294d8bd9ea2fa1357c00d09124ca4` |
| Post-measurement record/clock statistics | `/home/williao/dev/mnx-listening-data/diagnostic-runs/g041a-challenger-incremental-neural/statistics.json`; `cb35677c7eb39aa6865eb8e60b6e931bb24225c2464c1026ddfba2350f8f8289` |

Public summaries name and hash private per-example, per-prefix, per-map, per-hand-case,
source/graph and validation evidence. Detailed frames/calls/maps stay private. The
statistics utility reads existing records only; it runs no listener or evaluator.
It verifies 9,648 saved artifact hashes and the exact bytes of 2,779,920 selected
float32 values across all 702 windows. Its source SHA-256 is
`37ff52c006fc1fd3ca4aa6e617ee586a8aa466eca7d62f410b1cd3676054e80e`.

## Against the predictions

| # | Outcome | Reason |
|---|---|---|
| 1 | Held as author agreement | 51 new and 62 inherited cases agree in declared representation layers |
| 2 | Held where sampled | All 702 selected maps exactly equal; exact pitch/coordinates; ordinary neural extent 19<172 |
| 3 | Held as exploratory comparisons on corrected measurement | All 576 cost/cursor/control comparisons clear; all 1,152 event deadlines met; first-attempt cost rejected |
| 4 | Held within tested prefixes and frozen evidence | All 3,456 payload checks, verified reuse and 576 @2 assessment passes; no held-out/reserved access |

## Decision

**D1 applies to g041a.** The technical repair resolves g041's invalid timer scope.
Carry the frozen incremental producer to **independent observation-seam@4 audit**,
question 37. No formal cursor or guitar-stage pass, promotion, qualification or suite
change follows before that audit. The incumbent remains event-chain@3 and the offline
challenger component remains @2. This author starts no next experiment or audit.

### Resulting stopping count, budgets and evidence access

Main stopping **0**, **3 versions/11 comparisons**, unchanged. Challenger stopping
**2**, **3 versions/4 comparisons**, exploration spent: one new live version charged
conservatively because an exploratory result cannot clear the full formal substage.
The technical rerun is the same version/comparison and consumes the one rerun budget,
not another version. Qualification **6 versions/12 slots unused**. Held-out guitars,
reserved/final evidence and Winner 5–8 untouched; sines remain retired. No guitar-stage
claim/full-sweep obligation triggered. Batch **5 of 8 done**, continues after audit.

## Next

**Question 37: independent seam-4 audit**, deriving all 51 added/reworked cases and
sampling every inherited rule in its declared representation, before a formal cursor
judgment. Check adequacy of the native adoption boundaries, exact sampled maps,
new-frame context, full DSP normalization, timer scope, call traces and prefix rules.
Then question 31: formally evaluate the frozen candidate's guitar stage 1 and silent
hesitation, both outputs/all controls, under the audited seam and amended gates, with
unchanged incumbent evidence beside it. Only after that pass may question 32 use the
held-out guitars, once. Promotion remains the user's after the independent batch review.

**Awaiting the user:** no new decision from 041. Promotion, future microphone gates,
qualification, Studio choices and R10's standing sentinel/pool and baseline-sweep
questions remain theirs. No question was asked. The required audit is separate-session
work, not supplied by this author.

**Direction of travel.** Bounded causal input, distinct audio/delivery/completion clocks,
score-blind new-frame neural computation and unchanged event/interval accounting can
survive longer pieces and new sounds. Full CQT/global normalization still costs work;
monophonic strongest-pitch decoding/chain assumptions need separate development before
chords, adjacent identical pitches and microphone performances. These correlated
sampled renders establish neither independent instrument transfer nor human/device lag.

## Attribution

Pre-registered, implemented, executed and recorded by **GPT-6.1-Sol (high) in Codex**.
Independent seam-4 audit and closing process review remain other sessions' work.
