# 038 — Quiet-noise controls for both unchanged listeners

## Pre-registration

2026-10-04. **GPT-6.1-Sol (high) in Codex**. Experiment 038, challenger track,
run 2 of 6 in the sampled-guitar promotion batch. Diagnostic comparison, no listener
version. Question 29, in the order the user approved after the seam-2 audit.

### Question and alternatives

Do basic-pitch-chain@1 and event-chain@3 reject the amended silence control on both
outputs: fixed pink noise at −60 dBFS RMS, as long as each of the 192 frozen guitar
performances? Digital zero passed both listeners; noise can instead produce no pitch,
spurious pitches outside the score, or spurious pitches that the unchanged chain
accepts. Raw activations, decoded events and score claims distinguish those outcomes.
Rejection beside each listener's existing acceptance results avoids lesson L8.

The observation-seam@2 audit agrees on its supplied cases but leaves live/cost coverage
gaps. The user folded those into question 30 and put this check first. Therefore the
unchanged edge0 live spike is **exploratory on its nominal clock**; no compute-inclusive
cursor verdict, stage pass or promotion follows from this experiment.

### Method and evidence

1. Land this pre-registration before generation or listener measurements. Commit code,
require a clean tree, unchanged pre-registration already on origin/main, unused run ID
and HEAD tagged `<run-id>-source`. Primary **g038-challenger-quiet-noise**; one
infrastructure-only rerun **g038a-challenger-quiet-noise** after preserving/diagnosing
failure. Check public-summary shape on dry assembly before measurement; write/hash
private observations and each completed input evaluation immediately.
2. Freeze **contract2-challenger-guitar-noise-v1**, replacing only the 192 digital-zero
silence controls of 035's frozen guitar set. Retain all 192 performance and 192 w2
examples byte-identically, including labels/assets. Generate with installed FFmpeg's
`anoisesrc`, color=pink, rate=48000, amplitude=1, seed=380038, nb_samples=1024;
record binary SHA-256, version and exact arguments. Generate one stream long enough
for the longest performance, take each required sample-length prefix, subtract its
mean, scale its RMS to 0.001 (−60 dBFS), and round to canonical PCM16 mono WAV.
Validate the decoded RMS within 0.01 dB of −60 and no clipping; record actual peak,
mean, level and a bounded spectral diagnostic. No level, seed or color tuning. Same
score/length pairs share an identical WAV across guitars: 48 unique listener inputs,
42 unique audio lengths. Freeze the manifest and audio hashes before any inference.
The new control label remains silence (no sounded score event), not a new evaluator.
3. Verify g035/g036 public and private records, the original manifest and all assets,
model/environment/decoder provenance and all original producer hashes needed for reuse.
Cite unchanged guitar performance and w2 assessment results, plus incumbent cursor
records and challenger clean edge0 cursor records; no new guitar performance inference
or retired sine set runs. Any changed producer/input requires fresh measurement or an
infrastructure stop, not silent reuse. Baseline sources/records remain unchanged.
This is a complete control diagnostic beside the full clean/hesitation guitar evidence,
not a stage claim or full sweep. Guitar sweep obligations begin at the first stage claim.
4. Run every new control assessment through the pinned official Python offline model
and 11-frame decoder, unchanged defaults, then the unchanged BasicPitchChain offline
aligner/report. Native live uses the unchanged BasicPitchLive edge0, all controls,
48 kHz/480 chunks and 100 ms inference cadence. Run incumbent EventChain3 on the same
inputs through unchanged executeSeam. Measure each distinct score/audio pair once,
then cite its hashed evaluation for each identical guitar control. Evaluate following2,
assessment3 and gates2, with audited event-oracle@4 verified on load. Control-assessment
rules are formal; native live control comparisons use nominal timestamps and cannot
clear the amended live gate. Record sustained cost, p99 and backlog, provisional to
this host; no cost tuning or seam adoption.
5. Six future-prefix causality probes on four inputs selected without outputs: shortest
clean and longest hesitation per score s1/s2 (tie: ascending ID), for each live listener.
Report these 24 probes per listener as sampled causality evidence, never exhaustive
or a stage verdict. Record native model load separately. Offline raw/decoded outputs
are retained score-blind. Count decoded pitches and exact score-note claims; count live
pitch-bearing frames, position emissions, false-following exposure and rejection.
No quiet-noise observation changes the official decoder or either listener.
6. Bounded source check: FFmpeg's installed filter documentation and official source,
and pinned Basic Pitch preprocessing/model sources, especially normalization. Record
upstream facts separately from causal inference; positive activations alone do not prove
normalization caused them. No new oracle or observation seam is written here.

### Predictions and contradictions

1. All 192 incumbent noise controls pass assessment and cursor comparisons. Noise RMS
is half its 0.002 silence threshold; any failure contradicts this prediction.
2. At least one of the 48 distinct noise inputs yields a Basic Pitch decoded pitch or
a pitch-bearing live frame. Zero of both contradicts the acoustic-response hypothesis.
3. All 192 challenger noise assessments pass and all 192 nominal live control
comparisons pass: unrelated broadband noise should not supply the score's exact pitches
in a supported sequence. Any failed example contradicts this rejection hypothesis;
decoded pitches without score claims do not contradict it.
4. All 48 sampled prefix checks (24 per listener) agree; original producers/inputs and
cited records verify by hash, and all 384 retained non-silence examples are unchanged.
Any mismatch contradicts this integrity/causality prediction.

### Decision rules fixed now

- **D1 rejection:** complete valid measurement, both listeners reject every noise
assessment and every nominal live control comparison, integrity/prefix checks agree.
Question 29 is answered on these fixed development controls; question 26 (Martin)
remains next. No formal live or stage pass is inferred.
- **D2 noise failure:** complete valid measurement and any listener fails a noise
assessment or nominal live rejection comparison. Attribute to the measured output and
trace, and rank its noise repair before Martin if the challenger fails. Preserve mixed
outputs explicitly. Cost failure alone does not change D1/D2: streaming cost is question
30, already open; the old spike cannot be passed under the amended live gates here.
- **D3 infrastructure/inconclusive:** failure before measuring preserves error and zero
measurements; a mid-run failure preserves each completed hashed measurement. Diagnose
before the one technical rerun. A final-record-only failure preserves measured results
and repairs writing without remeasurement. Unresolved infrastructure, prefix/integrity
failure, or evidence outside D1/D2 is inconclusive and closes the batch.

### Carried-over state and preflight

Stopping/budgets unchanged from [037](037-challenger-observation-seam.md#resulting-stopping-count-budgets-and-evidence-access):
main 0 consecutive failed versions, 3 versions/10 comparisons; challenger 0,
1 version/1 comparison, exploration spent. This unchanged-version diagnostic adds one
comparison to each track, no version and no stopping-count increment. Qualification
6 versions/12 slots unused; held-out guitars, reserved/final evidence and Winner bars
5–8 untouched. Sines retired; no guitar stage is claimed or suite state changed.

Only main was checked out, no 038 owner/report/ledger or private run ID exists; own
worktree listening-038, dependencies installed once. FFmpeg, frozen guitar data,
g035/g036 records, pinned Python and ONNX model are readable; private output access
is checked before generation. No other experiment is in progress. The user directs:

> Your model and tool: GPT-6.1-Sol (high) in Codex.

> You cannot ask the user questions: record anything that needs them in your report and the research log.
