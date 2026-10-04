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

## Results

**D1: both unchanged listeners reject the fixed quiet-noise controls.** Every noise
assessment claims no score note played and no overall tempo, interval or flag. Every
nominal live comparison has zero false-following exposure and zero position emissions.
Basic Pitch nevertheless decodes low pitches in every clip. This answers question 29
for these controls; it is neither model-level silence rejection nor a formal live pass.

### Both outputs and the paired performance evidence

| Noise controls | Incumbent assessment | Challenger assessment | Incumbent nominal cursor | Challenger nominal cursor |
|---|---|---|---|---|
| Tone.js acoustic: clean; hesitation | 8/8; 40/40 | 8/8; 40/40 | 8/8; 40/40 | 8/8; 40/40 |
| Martin: clean; hesitation | 8/8; 40/40 | 8/8; 40/40 | 8/8; 40/40 | 8/8; 40/40 |
| Spanish: clean; hesitation | 8/8; 40/40 | 8/8; 40/40 | 8/8; 40/40 | 8/8; 40/40 |
| Fender: clean; hesitation | 8/8; 40/40 | 8/8; 40/40 | 8/8; 40/40 | 8/8; 40/40 |
| **All attachments** | **192/192** | **192/192** | **192/192** | **192/192** |

These are **48 distinct score/audio inputs**, measured once each and cited for their
identical attachments across guitars; **42 unique noise WAVs**, not 192 independent
noise realizations. Their evaluated label fields are checked identical before reuse.
All 384 retained performance and w2 examples, including their labels, are unchanged.
The g035/g036 assessment evidence is reused after producer/input/artifact verification:

| Paired evidence, all four guitars | Incumbent g036 | Challenger g035 |
|---|---|---|
| Guitar performance assessments | 10/192 | 192/192 |
| w2 assessments | 192/192 | 168/192 |
| New noise assessments | 192/192 | 192/192 |

Martin's 24 w2 claims remain failures. The incumbent's rejection remains cheap beside
its poor performance acceptance (L8). Incumbent performance cursors remain 0/192;
challenger clean edge0 cursors were exploratory in 035. Its hesitation live performances
are still unmeasured. These citations do not turn partial evidence into a stage pass.

### Noise response and its limits

| Observation | Result |
|---|---|
| Actual WAV RMS range | -60.000203 to -59.999412 dBFS |
| Maximum absolute sample | 0.004241943; no clipping |
| Welch log-power slope, 100–10,000 Hz | -1.0089 to -0.9947 (pink is approximately −1) |
| Offline clips with decoded pitches | 42/42 |
| Offline decoded events, unique WAVs | 259; 2–12 per clip |
| Maximum offline note activation | 0.622382, above the unchanged 0.3 frame threshold |
| Distinct live inputs with pitched frames | 48/48; 8,852 pitch-bearing frames over those executions |
| Score-note claims / cursor position emissions | 0 / 0, both listeners |
| False-following exposure / longest episode | 0 s / 0 s, both listeners |

Offline decoded MIDI pitches are `27, 28, 29, 30, 32, 33, 35, 36, 40, 41, 49, 53`; live frame pitches
span MIDI 24–53. None is in s1/s2's MIDI 60–72 register.
The front end therefore **does invent low pitches on the noise**, while the unchanged
exact-pitch chain/aligner has no score pitch to accept. The measured rejection does not
establish safety on scores in that lower register, another seed, another noise color,
or microphone audio. This is one fixed, correlated development stimulus, not a noise
robustness distribution. The normalization source motivates the hypothesis, but there
is no ablation here, so its causal responsibility remains an inference, not a result.
The [source note](../research/quiet-noise-038.md) records the bounded primary-source check.

### Causality, cost and execution

All **48 sampled future-prefix probes** agree: four preselected inputs × six futures
for each listener. They compare decisions on nominal delivery time, not activations or
compute-inclusive availability. The absence of score positions makes these checks weak
against defects that affect only successful acquisitions. No exhaustive live causality
or seam-2/3 adoption is claimed.

| Cost on this i7-8750H / Node 22.22.1 host | Incumbent | Challenger edge0 |
|---|---|---|
| Maximum sustained ratio | 0.002305 | 0.481118 |
| Maximum chunk p99 | 0.150 ms | 56.260 ms |
| Maximum runner backlog | 0.000 ms | 82.187 ms |

The frozen spike still exceeds the **0.25** sustained target; p99 is descriptive since
the amendment dropped that gate. Native model load was 200.655 ms,
reported separately and excluded from these per-input ratios. These are executeSeam's
measured cost quantities, provisional to this host; its decisions and frame availability
still use the nominal clock. They supply no physical feedback latency measurement and
cannot clear the amendment's live gates. Question 30 owns that producer, its complete
cost definition, compute-inclusive clock, seam-3 cases and independent audit.

The single run completed **2026-10-04T22:00:05.368Z–2026-10-04T22:03:51.597Z**, in **226.229 s**
(3.77 minutes: above the two-minute routine target, below the five-minute review trigger).
No infrastructure failure or technical rerun. Source **4a0684c38f06b8b1a58bd32e2ba09def3a255c30**,
tagged `g038-challenger-quiet-noise-source`; pre-registration **ef752e4102b0e1ff21ce114bed3f4ba06281ec14**
had already landed and pushed before generation. Dry public-record assembly preceded
generation/measurement; observations and pair records were written and hashed as made.

**2,107 distinct prior artifacts** verified before measurement, including the original
387 set assets, both listeners' guitar evaluation records, guitar observations and
challenger clean edge0 records. Original relevant producer sources, model, decoder,
environment lock and guitar-nn commit agree with their pinned records. Historical sine
and baseline behavior is preserved by unchanged source/record bytes; no retired sine
set, held-out guitar, reserved/final evidence or Winner bars 5–8 was executed or examined.
The installed FFmpeg binary and arguments are pinned; repeated raw generation agreed.
FFmpeg emitted stream-fd warnings but returned success with exact length, identical raw
hashes and validated levels. They are preserved in the execution log, not a failed run.

| Artifact | Path / SHA-256 |
|---|---|
| Public summary, 70,782 bytes | [g038](../runs/g038-challenger-quiet-noise/summary.json); `72560e5e4365e14ee48034c2eabc662323e121de1dcf70d4e3fcd02ca44d57c4` |
| Frozen noise manifest | `/home/williao/dev/mnx-listening-data/contract2-challenger-guitar-noise-v1/manifest.json`; `961d5dce4a152af17da006c2f86dfdd48fee32acae74f38b9def988462b229e8` |
| Private input/attachment results | `/home/williao/dev/mnx-listening-data/diagnostic-runs/g038-challenger-quiet-noise/results.json`; `3385893e27f85ab3fd618b834fdd1e8f0b995ba058486e42c1427ce58c05f2e2` |
| Spectral and offline-map diagnostic | `/home/williao/dev/mnx-listening-data/diagnostic-runs/g038-challenger-quiet-noise/noise-diagnostics.json`; `067b328ef0878130373b551ab676fd807b7302e8739daeadf2009ef1e72af841` |
| Full execution log | `/home/williao/dev/mnx-listening-data/diagnostic-runs/g038-challenger-quiet-noise/execution.log`; `92c349808811def83307e648fea203b4b3c31bc46190691c0640e3ddb6770563` |

Individual observation and pair record paths/hashes are named by the summary and private
results index. Focused stimulus/adapter checks passed **5/5** and the bench TypeScript
check passed before the committed run. The pre-registration gate passed **507 bench
tests**, targeted root tests, static checks and build. The final rebased landing gate
must pass separately; its output is kept with the private execution record.

## Against the predictions

| # | Outcome | Evidence |
|---|---|---|
| 1 | Held | Incumbent 192/192 assessments and nominal cursor controls |
| 2 | Held | Every unique noise clip decodes pitches; every live input has pitch-bearing frames |
| 3 | Held, within scope | Challenger 192/192 assessments and nominal cursor controls; no exact score pitch detected |
| 4 | Held | 48/48 sampled prefixes; prior producer/input/record hashes verify; all 384 retained examples unchanged |

## Decision

**D1 applies.** Question 29 is answered on the fixed control. Noise pitches are measured,
not score claims, and cost alone was explicitly excluded from this decision. Both
listeners, instruments, suite states, sentinels and incumbent remain unchanged. No
formal live, guitar-stage or promotion verdict follows. No new oracle needs an audit.
The ongoing batch advances to question 26, Martin's wrong-score claims.

### Resulting stopping count, budgets and evidence access

Main stopping **0**, **3 versions/11 comparisons**; challenger stopping **0**,
**1 version/2 comparisons**, exploration spent. This unchanged-version diagnostic adds
one comparison to each track, no failed version. Qualification **6 versions/12 slots**
unused; held-out guitars, reserved/final evidence and Winner bars 5–8 untouched.
Sines remain retired; guitar sweeps begin with the first guitar-stage claim. Batch
**2 of 6 completed**, continuing; this session stops after landing and retiring.

## Next

**Question 26:** repair Martin's isolated false low-G2 claims in a separately versioned
challenger while preserving every passing development-guitar assessment and these frozen
noise controls. Any fitted limit needs separate calibration examples, as the contract
and L11 require. Then question 30 with 34: streaming cost/clock and seam-3 audit, before
any cursor verdict; then full guitar-stage claim and the one-shot held-out confirmation.
This report author neither runs the next experiment nor performs the batch review.

**Awaiting the user:** no new decision from 038. Promotion stays with the user after
the remaining evidence and independent review. Microphone-stage gates, qualification
and Studio choices, and R10's standing sentinel tie-break/pool and baseline-sweep
questions remain future or standing user decisions; none is bypassed here.

**Direction of travel.** Exact-pitch sequence context rejects this noise on the short
upper-register scores and can remain useful as scores lengthen. Noise-triggered low
pitches, lower registers, chords and microphone conditions still need evidence; the
monophonic reduction and expensive repeated-window live producer will need development.

## Attribution

Pre-registered, implemented, run and recorded by **GPT-6.1-Sol (high) in Codex**.
Independent oracle audits and closing process review are other sessions.
