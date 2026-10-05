# 039 — Dominant-pitch decoding for Martin's wrong-score claims

## Pre-registration

2026-10-05. **GPT-6.1-Sol (high) in Codex**. Experiment 039, challenger track,
run 3 of 6 in the sampled-guitar promotion batch. Question 26; one listener version,
**basic-pitch-chain@2**, changing only the score-blind offline decoder input policy.

### Question and alternatives

Can keeping only each frame's strongest note activation remove Martin's false low-G2
claims while retaining all correct development-guitar assessments and quiet-noise
rejection? The preserved Martin s2-45 trace has a G2 event of confidence .398 alongside
B4 at .835, but its G2 onset peak exceeds .5: disabling the residual Melodia pass alone
is not a sound explanation for removing every such event. Either the low ghost loses
frame competition and disappears, or it wins long enough to survive decoding; a real
pitch may also lose during attacks or decays and break acceptance or timing.

The hypothesis is deliberately monophonic, matching the current chain's scope. It is
not a low-register exclusion, score-derived frequency restriction or fitted threshold.
The raw maps, decoded events and paired evaluations distinguish suppression from
simply refusing both controls and correct performances (L8).

### Method and evidence

1. Land this pre-registration before executing the new policy or measuring. Commit
all producer code and require a clean tree, unchanged landed pre-registration, unused
run ID and HEAD tag `<run-id>-source`. Primary **g039-challenger-dominant-pitch**;
one infrastructure-only rerun **g039a-challenger-dominant-pitch**. Dry-assemble and
check public summary shape before decoding; persist/hash each observation and each
assessment as completed. If writing the final record fails, repair writing without
remeasuring completed examples. Never impose a summary-size refusal after measuring.
2. Use all **576** frozen examples of contract2-challenger-guitar-noise-v1: 192
performances, 192 w2 controls and 192 pink-noise controls, clean then single silent
hesitation, all four development guitars. Use audited assessment3/gates2/oracle4
unchanged, including pooled assessment finding gates. This is an assessment-component
repair, not a full guitar-stage claim. There are no passed guitar substages or guitar
sentinels yet. The amendment retires the sines and starts guitar full-sweep obligations
at the first guitar-stage claim; no retired sine or held-out set runs here.
3. Reuse g035's guitar and g038's noise **raw model maps** after verifying producer,
model/environment/decoder and input/artifact hashes. The model, resampling and
stitching are unchanged. Verify every original audio, score and label before reuse;
any changed relevant source/input requires fresh measurement or an infrastructure
stop, never silent reuse. Cite original @1 assessments and incumbent evidence by
verified hash; incumbent and frozen baselines are unchanged and not rerun.
4. Apply a fixed frame-local winner policy to the raw note map: `argmax` across all
88 bins, lowest bin on exact ties. Set losing note **and onset** bins to zero; leave
winning entries, contour map and frame times unchanged. Run the official pinned
Basic Pitch 0.4.0 decoder with all existing defaults (onset .5, frame .3, minimum 11
frames, inferred onsets and Melodia enabled). No parameter fitting, extra event filter,
score context or frequency bound. Save score-blind decoded observations and diagnostics
on removed model energy/pitches and changes from old decoded events. Downstream
BasicPitchChain alignment/reporting is inherited byte-for-byte; @2 gets a separate
module/configuration. No existing frozen producer is edited.
5. Run every example's assessment with @2, retaining serialized reports, evaluator
results, failures, note claims and timing errors. Compare with @1 on the same labels.
Record @1's Martin 24 failures separately and verify their disappearance or persistence.
Count raw/decoded low-G2 occurrences; do not equate decoded pitch with a score claim.
There is **no live listener measurement or cursor verdict**: question 30 owns streaming,
compute-inclusive cost and seam@3/audit. No new instrument or observation timing
contract is introduced; this transformation changes listener evidence, not its oracle.
6. Bounded primary-source refresh: pinned Spotify decoder's onset and residual-energy
branches, recorded separately from the inference motivating this monophonic mask.
Synthetic policy checks exercise ties, preservation, shape/refusal and sustained
single-pitch decoding. Bench tests/typecheck and final rebased gate must pass.

### Predictions and contradictions

1. @2 rejects all **192 w2** assessments, including all **24** former Martin failures;
any remaining claim contradicts the repair prediction.
2. All **192 correct performances** retain passing assessments, with every score note
matched and zero false findings; any lost note or failed timing gate contradicts it.
3. All **192 quiet-noise controls** retain rejection and null tempo, intervals and flags;
any score claim or tempo contradicts it. Raw/decoded noise pitches may remain.
4. All 576 input/label records and reused relevant producers verify by hash; every
assessment is measured under unchanged instruments, with zero held-out/reserved access.
Any mismatch or forbidden access contradicts integrity.

### Decision rules fixed now

- **D1 component repair:** complete valid measurement, all 576 individual assessments
and every assessment pool pass, including all 24 former Martin failures. Carry @2's
fixed offline policy forward to question 30. No live or stage pass, promotion or suite
change follows from this component result.
- **D2 resolved failure:** valid complete measurement with any assessment/pool failure.
Reject this repair as a complete solution; preserve whether Martin improved and whether
correct notes/noise regressed. Rank the measured lowest assessment failure before
streaming; no tuning or second listener version within 039. The batch may continue
with a separately pre-registered repair, subject to the stopping rule.
- **D3 infrastructure/inconclusive:** a failure before measurement preserves its error
and zero measurements; a failure during measurement preserves all completed hashed
records. Diagnose before the one technical rerun. A record-only failure repairs the
writer without rerunning measurements. Unresolved infrastructure, integrity failure or
observations outside D1/D2 is inconclusive and closes the batch.

### Carried-over state and preflight

From [038](038-challenger-quiet-noise.md#resulting-stopping-count-budgets-and-evidence-access):
main stopping 0, 3 versions/11 comparisons; challenger stopping 0, 1 version/2
comparisons, exploration spent. Qualification 6 versions/12 slots unused; held-out
guitars, reserved/final evidence and Winner bars 5–8 untouched. This adds one challenger
version/comparison. Because an offline-only change cannot clear the lowest open guitar
substage's two outputs, conservatively charge one uncleared version to the challenger's
stopping count even on D1; the next version must still pass the full substage.

Preflight found only main checked out, no 039 committed/archive/private record or owner.
Own worktree listening-039, dependencies installed once; FFmpeg, pinned Python/model,
raw observations, frozen guitar/noise inputs and prior records are readable. Private
output access is checked before measurement. No threshold calibration is needed or
performed. The user's instructions are preserved:

> Your model and tool: GPT-6.1-Sol (high) in Codex.

> You cannot ask the user questions: record anything that needs them in your report and the research log.

Any needed user decisions go below the results and into the research log; this session
runs exactly one experiment, lands it, retires its worktree and stops.
