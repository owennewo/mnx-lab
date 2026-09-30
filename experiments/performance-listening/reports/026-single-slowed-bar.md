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
