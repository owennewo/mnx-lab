# 040 — Streaming state and the complete compute-inclusive seam

## Pre-registration

2026-10-05. **GPT-6.1-Sol (high) in Codex**. Experiment040, challenger track,
run4 of6 in the sampled-guitar promotion batch. Instrument and producer-state work,
not a listener version or acoustic comparison. Question30's prerequisite34 is resolved
first, in the streaming producer it governs, because a new seam requires independent
audit before judging its listener. This run builds an injected-backend streaming
input/state kernel; **incremental neural inference and its native cost remain open**.

### Question and alternatives

Can the streaming kernel preserve frozen causal model inputs/frame selection while
closing every gate-relevant seam-2 audit gap? Wrong alternatives include replaying
missed cadence boundaries, using an unpitched frame without advancing the watermark,
selecting prefix decisions by measured madeAt, retaining caller-supplied backdating,
and dividing audio by work. Separate hand cases distinguish them. Whole-window
normalization also makes simple reuse of old normalized neural activations suspect;
two hand inputs distinguish a changed global maximum from a local-only operation.
This diagnostic is not a proof that an efficient Basic Pitch backend is impossible.

### Method and evidence

1. Land this report, observation-seam@3, its separate frozen28-case hand file and
source note before implementation checks. Preserve seam2, its36 cases, all frozen
listeners/runners/evaluators and historical records. Independent audit is next;
this author neither performs it nor claims any cursor verdict.
2. Implement a new score-blind injected-backend stream: causal neighbor interpolation,
float32 ring of latest43844 samples, once-per-delivered-prefix cadence, carried integer
watermark, serialized completion/stamp/history and explicit work/audio cost. No score
or labels reach the backend. Test production using deterministic injected maps/costs,
not native inference; keep every new and inherited case result privately by hash.
3. Compare tensors and selected q with frozen native.ts over a six-second synthetic
ramp prefix in ordinary480-sample chunks and a fixed irregular partition. Check
per-sample once-only generation, bounded retained storage, reset/no-finish-flush and
future-prefix payload invariance. These are state/adapter checks, not guitar listener
measurements. No new backend, neural weights, decoder setting or live chain version.
4. Freeze explicit coverage boundaries for pinned HQ DSP, full decoder internals,
source/model provenance, native timing and acoustic behavior, as audit2 requests.
Synthetic normalization inputs characterize a dependency, not native map parity.
No guitar stage is claimed, so no active acoustic suite or full sweep is due. There
are no passed guitar substages; sines are retired and never run; incumbent/baseline
historical sources and records stay byte-identical.
5. Runner requires committed clean code, unchanged preregistration already on
origin/main, unused ID and HEAD tag. Primary g040-challenger-streaming-state; one
infrastructure-only rerun g040a-challenger-streaming-state. Dry-assemble public shape
before checks, immediately persist/hash each completed check. Before-measurement
failure preserves error with zero measurements; mid-run failure preserves completed
records. Record-only failure repairs writing without remeasuring. Never refuse a
completed measurement solely for public-summary size.

### Predictions and contradictions

1. All28 new and36 inherited hand cases agree, zero disagreements. Any discrepancy
contradicts instrument agreement; frozen answers are not tuned to code.
2. Both input partitions produce identical float32 tensors/q to the frozen causal
producer at every eligible call; each resampled sample is generated once and retained
state is bounded. Any mismatch contradicts exact input/state reuse.
3. Six wrong-rule families (reciprocal cost, omitted empty work, backdating, wall-based
prefix selection, cadence replay, pitch-only watermark) are separated by their cases.
Any undetected family contradicts coverage sensitivity.
4. N1/N2 change the retained normalized middle feature from .5 to .25; all protected
sources/records remain unchanged, no native/listener/held-out/reserved access. Any
violation contradicts the stated diagnostic scope/integrity.

### Decision rules fixed now

- D1 agreement pending audit: all cases, state parity and probes agree, protected
bytes unchanged. Freeze seam3 for independent audit, then return to question30's
native neural optimization and evaluation. No full-stage, native-cost or cursor pass.
- D2 resolved mixed: complete valid check with any case/state/probe discrepancy.
Preserve frozen answers/discrepancies; independent audit still next. No tuning/new
listener in040. The batch may continue with a separately registered resolution.
- D3 infrastructure/inconclusive: unresolved failures or observations outside D1/D2
close the batch. Diagnose before the single technical rerun; failures only in record
writing repair the record without rerunning completed measurements.

### Carried-over state and preflight

Unchanged from [039](039-challenger-dominant-pitch.md#resulting-stopping-count-budgets-and-evidence-access):
main stopping0,3 versions/11 comparisons; challenger stopping1,2 versions/3 comparisons,
exploration spent. Instrument/producer-state checks add no version/comparison/stopping
charge. Qualification6 versions/12 slots unused; held-out guitars, reserved/final
and Winner bars5–8 untouched. No guitar stage claim; sweeps start at the first claim.

Only main was checked out; no040 report/archive/private-run owner or ID exists.
Own worktree listening-040; dependencies installed once. FFmpeg, pinned Python/model
and prior private evidence readable. Private output access must be checked before
measurement. Exact identity and session direction are preserved:

> Your model and tool: GPT-6.1-Sol (high) in Codex.

> You cannot ask the user questions: record anything that needs them in your report and the research log.

No questions are asked; any needed user decision goes in results and the research log.
This session lands, retires its worktree and stops after exactly this experiment.

## Results

**D1: implementation agreement, pending independent seam-3 audit.** The streaming
input/state kernel preserves the frozen producer's model input tensors and coordinate
selection while specifying the audit's missing lifecycle/clock rules. Incremental
**neural** inference is not implemented or measured; question 30's .25 native-cost
and .2-second cursor gates remain unanswered. There is no listener or stage verdict.

| Check | Result |
|---|---|
| New frozen hand cases | 28/28 agree |
| Inherited seam-2 cases | 36/36 agree |
| Distinguishing wrong-rule families | 6/6 detected |
| Input-dependent synthetic future-prefix checks with different service times | 6/6 agree |
| Protected pre-existing files | 409/409 unchanged |
| Native inferences / listeners / held-out or reserved accesses | 0 / 0 / 0 |

| Six-second synthetic input partition | Generated samples | Byte-identical window tensors | Identical q selections | Maximum retained input / model samples |
|---|---|---|---|---|
| Regular480-sample chunks | 132,300 | 60/60 | 60/60 | 0 / 43,844 |
| Repeating1,321,1,4799,7000,13,480,20000 chunks | 132,300 | 29/29 | 29/29 | 1 / 43,844 |

Each resampled sample is generated once and rounded at the float32 tensor boundary.
The ring evicts old samples and preserves chronological window order; finish creates
no extra samples or window. The irregular partition consumes missed scheduled
boundaries in one latest-prefix call rather than replaying the same input. Regular
480-sample cadence is unchanged. Temporary storage also includes the incoming chunk,
window tensor and caller-owned input; the retained-state figures are not total process
memory or a native speed measurement.

### What the cases establish

Cost is now unambiguously **total per-example setup/feed/finish service divided by
input audio duration**, including empty calls. K1's .25 boundary passes, K2's .250001
fails, K3's same .25 seconds of work over two audio seconds gives .125. Shared model
load is explicit and separate; no cold-start claim follows. These are injected costs,
not measured Basic Pitch speed. D1 overwrites a caller's backdated madeAt=.001 with
completion=.145 while retaining retrospective refersTo=.08. Negative and future
refersTo values are refused. Start/finish/reset cases preserve old history, account for
empty finish service and start a fresh lane on the next example.

F1 selects records by their emitting delivered-sample index. Identical payloads with
madeAt=.145 versus .6 still compare equal; a changed pitch or delivery index fails.
The six synthetic producer probes use zero/alternating futures after 4800,9600,14400
samples, with .001 versus .02 seconds of injected feed service. They compare9,18,27
pitched prefix frames respectively and all agree. Unlike the prior noise-only probes,
payloads are input-dependent and pitched, but this remains a synthetic backend check,
not proof of native model or live-chain causality.

The window shape hand cases check the mathematical projection rule; the89 actual
byte comparisons establish its ring implementation on the two specified partitions.
Inherited cases exercise unchanged seam-2 helpers, not acoustic or native backend
behavior. Event sorting/null and float32 examples exercise adapter arithmetic; they do
not independently reproduce the official decoder. The seam's coverage table explicitly
leaves full pinned DSP, all backend maps/shapes, artifact provenance, listener refusal
and chain behavior to validation in native adoption. The next auditor must decide
whether these boundaries and cases adequately cover the rules before listener judgment.

### The neural-caching constraint

The [bounded source check](../research/streaming-state-040.md) identifies per-window
normalization over both time and frequency. N1's already-computed log-power vector
[0,1,2] normalizes to[0,.5,1]; changing its maximum to4 normalizes the retained middle
value to.25. Thus **unchanged raw context does not guarantee unchanged normalized
features**. This contradicts simple retention of old normalized neural activations,
not the possibility of an efficient backend. Recomputing extrema/context, caching
pre-normalization DSP or cropping downstream convolutions remain hypotheses, with
alignment, padding and receptive-field parity obligations. None is tested here.

### Execution and provenance

One guarded run, **2026-10-05T08:28:30.484Z–2026-10-05T08:28:33.713Z**, elapsed
**3.229 seconds**; no numbered-run failure or technical rerun.
Pre-registration **22e01eb0** was fast-forwarded and pushed
before any new implementation check. Source **f29421b538858a42f961d0a6deb7b5cf7982380f** is tagged
`g040-challenger-streaming-state-source`. The runner required committed clean code,
unchanged landed preregistration, that source tag and unused private/public IDs;
it dry-assembled the public shape before checking cases and immediately wrote/hashed
each completed case. The public summary is **22,697 bytes**.

All 409 protected files are byte-identical to the tree before preregistration, including
frozen listeners, runners, evaluator/oracle/suite records, public historical evidence
and model/audio sources. No shared frozen producer changed, so historical baseline
behavior is preserved by source/record identity; there was no baseline execution or
transitive revalidation of private acoustic evidence. Installed signal.py, retained
upstream inference, config and environment-lock source hashes are in the private
validation record. No guitar, sine, held-out, reserved/final or Winner5–8 input ran.
The local signal source was read after a remote fetch failed; no fact was inferred
from that failed fetch.

Focused checks passed 5/5 and the bench TypeScript check passed. The preregistration
gate passed 510 existing bench tests, 37 targeted root tests, static checks and build.
A draft-restore command initially used root-relative destinations from the bench
folder and found no test; it was corrected before checks or the numbered run, and
spent no technical-rerun budget. The final rebased landing gate must pass separately.

| Artifact | Path / SHA-256 |
|---|---|
| Public summary | [g040](../runs/g040-challenger-streaming-state/summary.json); `9dfb5fed0a3cfb799a0b998240216f6edff9378f8c13c0bcbc857d6d635515eb` |
| New frozen hand file | [seam 3](../bench/oracle-events/observation-seam-3.json); `83f48b1c37199a58f4d646bffb9986fac21bd7f122f4d89296c9c53d3f8bd0dc` |
| Private case/state/source checks | `/home/williao/dev/mnx-listening-data/instrument-runs/g040-challenger-streaming-state/validation.json`; `90b5dd8d8438154fc2080f659b461b84f76df954650dd20a515a655086794eb6` |

The public summary names/hash-pins every new and inherited private case record. Full
checks, protected-file hashes, tensor comparisons, prefix probes and wrong-rule
outputs stay in the private validation record.

## Against the predictions

| # | Outcome | Evidence |
|---|---|---|
| 1 | Held | All 64 new/inherited cases agree; frozen answers unchanged |
| 2 | Held within tested partitions | 89/89 float32 tensors/q selections; once-only generation, bounded retained state, no finish flush |
| 3 | Held | All 6 pre-registered wrong-rule families separated |
| 4 | Held within diagnostic scope | Normalized middle feature .5→.25;409 protected files unchanged; no native/listener/protected-evidence access |

## Decision

**D1 applies.** Observation-seam@3 and the injected-backend streaming state are ready
for independent audit; implementation agreement is not that audit. Question34's
specification/implementation work is recorded, with adequacy reserved to the auditor.
Question30 remains open for actual neural optimization, fresh measured native cost,
compute-inclusive cursor and every development-guitar/control example. This run's
input-state caching must not be reported as new-only neural inference or a cost repair.
Incumbent event-chain@3, challenger basic-pitch-chain@2, evaluator, suite and sentinels
are unchanged. This author starts no further experiment and performs no audit.

### Resulting stopping count, budgets and evidence access

Unchanged from 039: main stopping **0**, **3 versions/11 comparisons**; challenger
stopping **1**, **2 versions/3 comparisons**, exploration spent. This instrument/state
run adds no listener version or comparison. Qualification **6 versions/12 slots**
unused; held-out guitars, reserved/final evidence and Winner5–8 untouched. Sines remain
retired; no guitar stage claim or full-sweep obligation triggered. Batch **4 of6 done**,
continuing after the independent seam 3 audit; question 30 remains unresolved.

## Next

**Independent observation-seam@3 audit**, question 35: rederive all 28 added cases and
sample inherited 36 from definitions before looking at answers, including the cost
wording, prefix/stamp lifecycle, unpitched watermark and declared DSP/procedural
boundaries. After agreement, return to question 30, testing a separately versioned
native backend that accounts for global normalization/context and measures fresh
compute. Guitar-stage question 31 and one-shot held-out question 32 still follow; no
held-out input can be consumed early to select that backend.

**Awaiting the user:** no new decision from040. Promotion, future microphone gates,
qualification, Studio choices and R10's standing sentinel/pool and baseline-sweep
questions remain theirs. No questions were asked. The independent audit is a required
separate session, not a user approval and not supplied by this author.

**Direction of travel.** Bounded input buffering, distinct audio/delivery/completion
times and work/audio accounting can survive longer scores and new sounds. Whole-window
neural normalization still complicates exact reuse; monophonic masking/chain assumptions
need separate development before chords, repeated pitches and microphone performances.
No native or acoustic capability has been added by these arithmetic/state results.

## Attribution

Pre-registered, implemented, executed and recorded by **GPT-6.1-Sol (high) in Codex**.
Independent seam audit and batch process review remain other sessions' work.
