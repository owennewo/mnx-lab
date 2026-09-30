# 026 — One slowed bar on the same sine scale

## Pre-registration

2026-09-30. Designed, implemented, run and recorded by **GPT-6 in Codex (version unverified)**. Terminal/TypeScript/tsx/Vitest. Research-log question 10; stage 2's next single deviation. This section and the research note land before generation, execution or evaluation. No listener, instrument or oracle changes.

### Question and evidence

Does unchanged event-chain@1 follow a single slowed bar and assess variation under the approved median-tempo definition, preserving stage 1 and hesitation? [025](025-single-hesitation.md) established holding through silence. The actual listener and behavioral tests use pitch changes rather than time advancement. A tempo-boundary transient, missed pitch or biased onset is an alternative to tempo-independent tracking. The four frozen comparators distinguish this from handed-tempo progression; they provide no assessment comparison. The bounded [research refresh](../research/slowed-bar-026.md) separates published motivation from this local inference. Audited event-oracle@2 and approved instruments apply unchanged.

### Method fixed before the run

1. Freeze private **contract2-slowed-bar-v1**. Retain all 144 examples of contract2-hesitation-v1 byte-identically, including its 24 stage-1 regressions. Add **40 s2 performances**: base tempi 45/63/90/99, slow factor 0.5/0.6/0.7/0.8/0.9, independently applied to bar 1 or bar 2. The one-bar s1 stays in regression: slowing its entire bar would only repeat steady-tempo evidence. No combined hesitation or other deviation. These are range endpoints and intermediate values, not category bundles.
2. Time in seconds at quarter q is `(q + min(4,max(0,q-4*b))*(1/f-1))*60/base`, for zero-based slowed-bar ordinal b and factor f. Round each onset and end once to 48 kHz samples; extend the clip to mapped quarter 8. Thus pitch, score duration, amplitude (-12 dBFS), phase-at-onset and 10 ms ramps stay fixed; only time in that bar stretches. Use the existing sine renderer. Independently check all eight note boundaries, pitches/counts, cursor segments, unchanged note-local PCM where the note duration is unchanged, and exact same-length digital silence. Freeze before writing the comparison runner.
3. Each new performance carries same-length silence and its audio handed distant w2: **120 new examples**, **264 total** with regressions. w1 remains for the wrong-note deviation. Validate frozen assets and labels before execution. New labels are exact evidence instances under existing rules, not a new oracle.
4. Run event-chain@1 and all four frozen comparators on the 120 new examples at 48 kHz/480 samples. Assess only event-chain@1. Six prefix changes on every new example for event-chain; for each baseline, on `sb-s2-90-b1-50`, `sb-s2-90-b2-50` and the latter's two controls. Cost includes start/feed/finish, provisional on the recorded Linux host.
5. Reuse g025's regression results only after verifying its pinned source files (including listener, adapter, causal runner, renderer, evaluators, scores and its own run025 producer) against the current tree, all label/input bytes against its frozen set, and every private record/assessment hash. Additionally compare every tracked TypeScript source under src/audio, src/model, listen and bench/src at its source commit, excluding only the new 026 modules. If any producer dependency or input changed, rerun the affected earlier evidence in this execution rather than reuse it. Reused cost/causality remains evidence from the original host/run, explicitly cited, not a fresh timing measurement. Re-evaluate reused records with unchanged instruments for separate stage-1 and hesitation pools. All 720 earlier records and 144 assessments (controls included) are checked by hash. Public summary stays compact: per-example gate verdicts/provenance and aggregates; full decision, per-event and assessment-evaluation detail stays private by path/hash.
6. Report slowed-bar pools by placement and combined, and earlier pools separately. Derive typical tempo and expected bar flags from sounded onsets, not the recipe name. Applying the approved interval-end attribution: b=0 gives four slow and three base intervals, typical f*base, bar-1 ratio 1 and bar-2 ratio `4/(1+3*f)`; b=1 gives four base and three slow intervals, typical base, bar-1 ratio 1 and bar-2 ratio `4*f/(f+3)`. Overall is `7*base/(4/f+3)` for b=0 and `7*base/(4+3/f)` for b=1. Sample rounding is allowed only at one-sample precision. This reproduces the contract's asymmetry, rather than demanding that every slowed recipe yield a slow flag.

### Predictions

| # | Prediction |
|---|---|
| 1 | All 144 regression example/input bytes and eligible producer sources stay unchanged; all 720 records and 144 assessments match their cited hashes. All 40 new performances satisfy the independent boundary and unchanged-note PCM checks; controls match length. |
| 2 | event-chain passes every new cursor gate: >=95% on-event, <=1% ahead, <=5% exposure, episodes <=0.5 s; all 320 events reached within 0.2 s. |
| 3 | All 320 score notes matched; all 280 intervals within max(10%,30 ms); overall tempo within 5%; no false note or bar finding. Exactly 16 definite fast flags for b=0 and 16 definite slow flags for b=1, with eight optional `either` bars at f=0.9, within sample precision. |
| 4 | All 80 new controls reject for 100% of answerable time, with zero played-note or tempo claim by event-chain. |
| 5 | All new and cited prefix checks pass; all new and cited cost gates pass; every earlier event-chain example and pool remains passed. |
| 6 | event-chain passes the whole slowed-bar substage; each comparator fails at least one new performance cursor gate and lacks assessment. |

Any shortfall or changed reused artifact contradicts its prediction. Optional flags in `either` are not false alarms. Report exact counts, both placements and any mixed result even if an aggregate prediction fails.

### Decision rules

- **D1 integrity:** preserve and diagnose any input, boundary, PCM or artifact mismatch before comparing. Changed genuine dependencies require regression reruns, not a silent claim of reuse. Only runner/serialization defects permit a technical rerun with a new ID; never tune or change the evidence in a technical rerun.
- **D2 pass:** only if every new event-chain example, control, separate pooled group, regression, causality and cost gate passes, record this slowed-bar substage passed and rank the next single deviation, a rushed bar. Keep event-chain unchanged. Stage 2 as a whole stays incomplete.
- **D3 failure/mixed:** any gate failure keeps slowed-bar handling open and ranks the measured cause next, with no tuning here. Earlier substages keep their own verdict if their gates pass. A stricter prediction can fail while D2 passes; report both. The predicted median-reference asymmetry is not a listener error under the unchanged contract.
- **D4 infrastructure/inconclusive:** preserve and diagnose crashes or failed prefix checks. Observations fitting no branch are inconclusive, never a new favourable branch. No contract relaxation or oracle edit in this experiment.

### Carried-over state and preflight

Unchanged from [025](025-single-hesitation.md#resulting-plateau-budgets-and-evidence-access): plateau **0**, one development listener version, two completed listener comparisons, development iterations unrationed. This experiment budgets no listener version and one successful recorded execution with only D1/D4 technical reruns. Qualification stays at zero frozen versions/assessments; all six version slots, twelve assessment slots and reserved/final accesses unused. Winner bars 5–8 unexamined.

Worktree list, ledger, reports, archive and private directories show no 026 owner or run. Worktree listening-026 and run **g026-single-slowed-bar** are unused. The frozen hesitation/stage-1 data are readable; ffmpeg is available; a private write probe passed. Dependencies installed once in the authorised external worktree. The model identity visible to this session is GPT-6 only, so no narrower version is asserted. The R4 process questions do not block this one-deviation experiment. No instrument or oracle change means no audit due. No current user decision is needed. Evidence is development transformations of a two-bar sine scale, not independent generalisation or product qualification.

## Results

[g026-single-slowed-bar](../runs/g026-single-slowed-bar/summary.json) completed its first attempt in **414.245 s**, at commit `ac598a899c9d2ea40a96dd745e67c63a390f5ec1`, pinned by `g026-single-slowed-bar-source`. The private manifest is `/home/williao/dev/mnx-listening-data/contract2-slowed-bar-v1/manifest.json`, SHA-256 `553d4e7e62ebebacc63cb8fa7a735414490455d8a8eff19a3671eb36d96954db`. The compact public summary is **365,708 bytes**; it names the private detailed artifacts by path and hash, and pins the run's source files. **The substage fails on its live cursor; assessment passes.** No listener or gate was tuned.

### Integrity and procedure

All 40 performances pass all **640 note-boundary checks**, unchanged pitches/counts and exact cursor-segment checks. Of their 160 notes outside the slowed bars, **141** have byte-identical note-local PCM; the other **19** differ in rounded length by one sample, because shifted absolute endpoints are rounded independently. They are explicitly counted, rather than treated as identical. All 40 silence controls are zero PCM and the same length; wrong-score controls reuse the performance WAVs. The analytical tempo/ratio predictions hold at sample precision.

All **144 regression example/label entries** are unchanged. The reuse validation verifies **153 existing TypeScript producer files**, the pinned contracts/oracles and other source hashes, all frozen inputs, and all **864 private artifacts** (720 records and 144 assessments, including controls). No dependency changed, so every regression is reused, with its original cost/causality provenance; re-evaluation reproduces every original evaluation exactly. No frozen baseline, listener, shared harness, instrument, oracle or product source changed. The validation artifact is named and hashed in the public summary.

Pre-registration landed and was pushed at `23508443` before generation. The builder was committed at `9bea24e1`, the set frozen, then the comparison runner written and committed at `ac598a89` and tagged before execution. The bench suite passed at pre-registration (299 tests); the new modules typechecked before execution. There was no failed attempt, infrastructure outcome, technical rerun, listener tuning or departure from the pre-registered sequence. A committed, read-only component diagnostic below ran after the comparison; it did not run another listener or change its verdict. The pre-registration remains unchanged.

### Live cursor and assessment, by placement

Each row contains all five slow factors. Note/interval numbers are assessment results; cursor numbers are independent.

| Slowed bar / base BPM | Cursor gates | Events reached | Notes matched | Intervals within | Definite flags found | Min on-event | Max interval error, ms |
|---|---|---|---|---|---|---|---|
| 1 / 45 | 5/5 | 40/40 | 40/40 | 35/35 | fast 4/4 | 100% | 16.67 |
| 1 / 63 | 4/5 | 39/40 | 40/40 | 35/35 | fast 4/4 | 83.934% | 11.79 |
| 1 / 90 | 4/5 | 39/40 | 40/40 | 35/35 | fast 4/4 | 86.003% | 18.875 |
| 1 / 99 | 5/5 | 40/40 | 40/40 | 35/35 | fast 4/4 | 100% | 17.58 |
| 2 / 45 | 5/5 | 40/40 | 40/40 | 35/35 | slow 4/4 | 100% | 15.25 |
| 2 / 63 | 5/5 | 40/40 | 40/40 | 35/35 | slow 4/4 | 100% | 15.23 |
| 2 / 90 | 5/5 | 40/40 | 40/40 | 35/35 | slow 4/4 | 100% | 16.67 |
| 2 / 99 | 5/5 | 40/40 | 40/40 | 35/35 | slow 4/4 | 100% | 12.13 |

Assessment passes **40/40**: all **320 notes** matched, all **280 intervals** present and within tolerance, maximum interval error **18.875 ms**, maximum overall-tempo error **0.182292%**. All **16 definite slow** and **16 definite fast** flags are detected, with zero false findings. All **eight optional `either` bars**, at factor 0.9, receive no flag. The slowed-bar, each-placement, stage-1 and hesitation pools all pass. Recovery, extra-note holding and missing/wrong/dead recall have no positives and remain untested.

The live cursor passes **38/40**, reaches **318/320** events within the 200 ms deadline, and fails on two fourth notes. Its successful reaches have delay at most **38.958 ms**. On the other 38 examples on-event time is 100% under the instrument's transition allowance, with zero ahead/exposure. The failing examples are not hidden by this aggregate:

| Example | Failed gates | On-event | Ahead | Wrong-position exposure | Abstention | Missed event |
|---|---|---|---|---|---|---|
| sb-s2-63-b1-60 | onEvent, ahead, byEvent | 83.934% | 1.105% | 0.110 s | 1.490 s | F4, index 3 |
| sb-s2-90-b1-90 | onEvent, ahead, byEvent | 86.003% | 2.026% | 0.110 s | 0.650 s | F4, index 3 |

Both still pass exposure and longest-episode gates, but that does not override their failed on-event/ahead/by-event gates. This is not a numerical tolerance failure or a late assessment; it is a causal cursor skipping a correctly played note.

### Diagnosis: a transient pitch skip, inside the slowed bar

The private component diagnostic is `/home/williao/dev/mnx-listening-data/contract2-slowed-bar-v1/runs/g026-single-slowed-bar/pitch-boundary-diagnosis.json`, SHA-256 `3793e16aeba87c68fcf1ed8e4a3a581746b0e438828b82ca4ca8312ba605f2a9`. Its committed source is [diagnose026.ts](../bench/src/stages/diagnose026.ts), commit `03dca97b`, pinned by `g026-single-slowed-bar-diagnosis-source`. It reads the existing sinePitch estimator on exact 960-sample causal windows at 480-sample hops; no new instrument, full listener execution or tuning.

| Example | True F4 onset | Two windows heard as G4 | F4 windows resume | Cursor jumps to G4 | Cursor abstains | True G4 acquired |
|---|---|---|---|---|---|---|
| 63 / bar 1 / factor 0.6 | 4.761896 s | 4.77, 4.78 s | 4.79, 4.80 s | 4.78 s | 4.89 s | 6.38 s |
| 90 / bar 1 / factor 0.9 | 2.222229 s | 2.23, 2.24 s | 2.25, 2.26 s | 2.24 s | 2.35 s | 3.00 s |

The observations establish that two overlapping mixed-pitch windows identify MIDI 67 while the newly sounded note is MIDI 65. The code then accepts two-window agreement, skips F4 for the future G4 state, and cannot move backward when F4 is identified correctly. It becomes unsupported after its 100 ms grace and returns only when the actual G4 sounds. At nearby successful placements (63/factor 0.5 and 90/factor 0.8), the estimator rejects a mixed window and then identifies F4, without two false G4 observations.

The offline token alignment discards the spurious G4 token and matches F4 at 4.77/2.23 s, which explains why assessment survives. These failures occur at E4→F4 **within bar 1**, before the tempo-rate boundary at quarter 4. Inference: stretching changes the phase and frame placement of abutting notes, exposing a zero-crossing transition artifact. We have not isolated phase versus frame offset by a separate controlled sweep, nor tested a repair. The measured defect is premature irreversible live state commitment on transient pitch evidence; it is not evidence that a tempo model is needed.

### The approved typical-tempo asymmetry

The predicted placement asymmetry holds. At base 45, bar 1 at half speed reports overall **28.630 BPM** (truth 28.636), typical truth **22.5**, and flags the unchanged bar 2 **fast** (ratio 1.6). Slowing bar 2 instead reports **31.484 BPM** (truth 31.5), typical truth **45**, and flags bar 2 **slow** (ratio 0.571429). Every note is assessed as matched in both cases.

These are correct under the approved median and interval-end attribution. A slowed first bar provides four of seven intervals and sets the median; a slowed second bar provides three. They are not false listener findings merely because the generator calls both recipes slowed bars. Nevertheless, in a two-bar example the practice cue can name the unchanged bar rather than the intentionally difficult one. This consequence is now demonstrated end-to-end, beyond oracle A7; it is a limitation to carry into longer scores, not a contract change or a new approval request here.

### Controls, comparators, regressions, causality and cost

| Listener | New performance cursor gates | New control cursor gates | Max fresh sustained ratio | Max fresh p99, ms | Full two-output substage |
|---|---|---|---|---|---|
| clock-follower@1 | 0/40 | 0/80 | 0.001752 | 0.038 | fail |
| online-time-warp@8 | 0/40 | 80/80 | 0.126222 | 2.566 | fail |
| online-time-warp@12 | 0/40 | 80/80 | 0.130836 | 2.380 | fail |
| online-time-warp@14 | 0/40 | 80/80 | 0.125437 | 1.850 | fail |
| event-chain@1 | 38/40 | 80/80 | 0.001580 | 0.147 | fail: two cursor examples |

Every time warper fails the ahead gate on all 40 new performances: ahead ranges @8 **2.947–52.016%**, @12 **8.002–48.011%**, @14 **8.002–50.950%**. Some slow parent performances already fail, so their entire loss is not attributed to the local tempo change. No baseline assesses. Their controls reject; the clock fails all controls. Original w1 failure remains untouched and w1 still waits for wrong-note handling.

All **80 new event-chain controls** reject for 100% of answerable time, with zero false following, played-note or tempo claims. All **144 earlier event-chain examples** retain their gates, including both outputs and controls; all regression evaluations are reproduced from their verified artifacts. Thus stage 1 and hesitation remain passed.

All **816 fresh prefix checks** pass (720 event-chain, 96 across baselines); all **1008 cited g025 prefix checks** remain valid under verified unchanged producers. All fresh and cited cost gates pass. Fresh event-chain maximum sustained ratio is **0.001579718**, chunk p99 **0.147054 ms**, and backlog zero; maximum fresh backlog across all listeners is **0.362043 ms**, with no sustained backlog. Host: Intel Core i7-8750H, Linux x64, Node v22.22.1. These include start/feed/finish, remain provisional Node costs and establish no microphone, browser or mobile latency. Reused costs are g025's original measurements, not a new benchmark. Lower fresh baseline ratios are not an algorithm improvement.

## Against the predictions

| # | Verdict | Evidence |
|---|---|---|
| 1 | Held | All 144 regression entries, 153 producer files and 864 private artifacts verified; every earlier evaluation identical; all new boundary/PCM/control checks passed, with 19 one-sample rounded note-length differences counted explicitly. |
| 2 | Contradicted | 38/40 cursor examples pass; 318/320 events reached. Two examples fail onEvent, ahead and byEvent from a transient skip. |
| 3 | Held | 320/320 notes, 280/280 intervals, overall error <=0.182292%; 16/16 fast and 16/16 slow findings, eight optional bars, zero false findings. |
| 4 | Held | 80/80 controls reject 100%, with zero played-note or tempo claims. |
| 5 | Held | 816 fresh and 1008 cited prefix checks pass; fresh/cited cost gates and every earlier event-chain example/pool pass. |
| 6 | Contradicted, mixed | All four comparators fail every new performance and lack assessment, as predicted; event-chain fails the complete substage because of two cursor examples despite passing assessment/controls. |

## Decision

**D1:** integrity holds and reuse is eligible; no regression rerun needed. **D2 does not apply:** the substage cannot pass while two live examples fail. **D3 applies:** **one slowed bar remains open**, with assessment passed and the concrete live cause ranked next. Stage 1 and hesitation remain passed. **D4:** no infrastructure failure, failed prefix check, technical rerun or inconclusive outcome. This is a contradicted hypothesis with a supported diagnosis, not a pass or an infrastructure problem. No listener, instrument or oracle changed, so no oracle audit is due.

### Resulting plateau, budgets and evidence access

Plateau count **1** (one unsuccessful substage attempt), from the carried-over 0: the first attempt at slowed bars did not clear the live gates. This is not a declaration of a sustained plateau; contract 2 defines no numerical plateau stopping threshold. One recorded comparison execution, no technical rerun/new listener version, plus the read-only pitch-component trace. Five contract-2 experiments, one development listener version and three completed listener comparisons. Qualification budgets and evidence access are unchanged from [025](025-single-hesitation.md#resulting-plateau-budgets-and-evidence-access); reserved/final evidence and Winner bars 5–8 remain untouched. These are correlated transformations of one short sine scale, not independent scores or real players.

## Next

Rank question 11 for experiment 027: **can a new listener version reject transient pitch skips or recover from premature commitment, passing both failed slowed-bar examples without losing the other 38, controls, stage 1 or hesitation?** Keep the frozen 026 set and records; do not change onsets or the gates to erase the failure. A component investigation can separate frame-placement sensitivity from state-commitment policy. Any repair is a new version, and its proposed method is advice for the next experimenter. Rushed bars wait until this lowest unpassed substage clears.

Direction of travel: event states that wait for audio and separate whole-recording alignment remain plausible for chords/guitar. Two overlapping agreeing pitch windows do not suffice to protect the live path even on pure sines. The zero-crossing estimator and single-pitch hard emissions still need stronger evidence for transitions, wrong notes, chords, ringing guitar, repeated pitches and real music. This experiment qualifies none of those and makes no product claim.

No current user decision is needed. Later recorded-guitar gates, qualification/product decisions and R4's outside-review/multiple-substage process questions remain pending. Independent process review is due after landing; this experimenter does not review its own work or start 027.

## Attribution and validation

Designed, implemented, executed, diagnosed and recorded by **GPT-6 in Codex (version unverified)**, one model throughout, terminal/TypeScript/tsx/Vitest. Pre-registration suite: 299 bench tests plus typecheck and repository gate. New comparison source typechecked before execution; final repository gate runs on the rebased complete record before landing. The report exporter verifies all recorded source hashes against the pinned source commit.


**Attribution correction, review R5 (2026-09-30):** the experimenter's Codex session
`01a0f364-e751-7bb2-a2b7-a4117ba26aac` records `model: gpt-6.1-sol` and `effort: high`:
**Sol 6.1 (high) in Codex**. The original attribution and frozen pre-registration
remain above unchanged. This identifies the runtime, not independent replication.
