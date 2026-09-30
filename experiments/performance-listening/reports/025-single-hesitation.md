# 025 — One hesitation on the same sine scores

## Pre-registration

2026-09-30. Designed, implemented, run and recorded by **GPT-6 in Codex (exact version unverified)**, as stated at launch. Terminal/TypeScript/tsx/Vitest. Research-log question 9; stage 2's first deviation only. This pre-registration lands before generation, execution or evaluation. No listener, instrument or oracle is changed.

### Question and evidence

Does unchanged event-chain@1 hold the live cursor through a single hesitation and reconstruct its interval and bar-level timing effect, while preserving stage 1?
[024](024-event-chain-stage1.md) established the happy path and predicted a held cursor from the absence of clock advancement. Its actual code holds acquired positions in silence; its assessor aligns pitch changes independently of time and uses matched onsets. The alternative is transient pitch rejection on release/re-entry, a missed resumption, or onset bias large enough to change a flag. Frozen clock and time-warp@8/@12/@14 distinguish audio-dependent holding from clock prediction. Their absence of assessment remains a limitation.

The bounded [research refresh](../research/hesitation-025.md) revisits the existing event-HMM source; its clarinet results are not evidence for these gates. The audited event-oracle@2 already covers hesitation and the typical-tempo reference. Its instruments and approved stage-gates@1 apply unchanged. New exact generated labels are evidence instances, not new measurement definitions or oracle cases.

### Method fixed before the run

1. Freeze private **contract2-hesitation-v1**, retaining all 24 stage-1 v3 examples byte-identically. Add 40 performances: s1 and s2, at steady base tempi 45/63/90/99, with one pause of 0.3/0.5/0.7/1/2 seconds. Insert it immediately before s1 event index 2 (third note) or s2 event index 4 (second-bar boundary). Release the preceding note at its unchanged written end; shift each following note's onset and end by the exact pause samples. Use the existing sine renderer, -12 dBFS, 10 ms ramps, 48 kHz. No pitch, note count, articulation elsewhere, duration or further tempo deviation changes. These cover the hesitation range endpoints and intermediate values; no bundled beginner claim is made.
2. Every new performance carries same-length digital silence and its own audio handed distant w2: 120 new examples plus 24 regressions, **144 total**. w1 remains deferred to the wrong-note deviation as the contract specifies. Exact sample boundaries determine matched-note labels and cursor segments: throughout the pause the last sounded event remains true. Validate the complete frozen manifest and hashes before running. Verify the rendered PCM equals its stage-1 parent before the gap and equals it shifted after the gap; the gap itself is zero. Freeze before writing the comparison runner.
3. Run unchanged event-chain@1 and all four frozen baselines on all 144 examples at 48 kHz/480-sample chunks. Assess event-chain@1 only. Compare every stage-1 record for all five listeners and its eight performance assessments with g024 byte for byte. Run six prefix changes on every example for event-chain@1, and for each baseline on s1-90/s2-90, h-s1-90-1000/h-s2-90-1000 and the latter's two controls. Cost includes initialization, feed and finish on the recorded Linux host, provisional against the existing target; no browser/microphone claim.
4. Evaluate cursor/assessment gates per example, pooled separately for hesitation and stage-1 regressions, and cost/causality for the whole run. Pin commit, full source hashes, private manifest, records and assessments. The runner refuses dirty experiment files, an unlanded pre-registration and reused run IDs. Preserve any failed execution before diagnosing it.

### Predictions

| # | Prediction |
|---|---|
| 1 | All 24 regression examples retain identical assets and labels; all 40 new performances are exactly the parent's PCM with one zero-valued gap, with unchanged notes and exactly one enlarged onset interval. All 120 stage-1 listener records and eight event-chain performance assessments equal g024 byte for byte. |
| 2 | event-chain@1 passes every cursor gate on 40 hesitation performances, reaches all 240 events within 0.2 s, has zero ahead/exposure and makes no cursor movement within any inserted pause. |
| 3 | It matches all 240 notes and reports all 200 intervals within tolerance and all overall tempi within 5%. Typical tempo remains the base tempo; the analytical bar ratios are 3/(3 + pause*tempo/60) for s1 and 4/(4 + pause*tempo/60) for s2's second bar. There are 35 definite slow-bar positives, five either bars, and 20 unaffected first bars on s2. At least 90% of slow positives are found, with zero false findings of any kind. |
| 4 | All 96 controls (16 old, 80 new) reject for 100% of answerable time, with zero played-note/tempo claims in event-chain@1's assessment. |
| 5 | Every prefix check passes; event-chain@1 sustained ratio <=0.25 and chunk p99 <=10 ms; all stage-1 gates remain passed. |
| 6 | event-chain@1 passes this hesitation substage completely; the clock fails at least one new cursor example and no frozen baseline passes the complete two-output substage. |

Any shortfall or changed reused byte contradicts its prediction. An optional flag in the instruments' `either` band is not a false alarm. Actual gate counts and uncertainty bands are reported even if an aggregate prediction fails.

### Decision rules

- **D1, integrity:** if input hashes, exact PCM insertion, label invariants or reused deterministic artifacts differ, preserve the attempt and diagnose before claiming comparisons. Only runner/serialization defects permit a technical rerun with a new ID; neither listener tuning nor evidence changes do.
- **D2, pass:** only if every hesitation example, control, regression, pooled group, causality and cost gate passes, record this first stage-2 deviation passed and rank the next single deviation, a slowed bar. Stage 2 as a whole remains incomplete. Keep event-chain@1 unchanged.
- **D3, failure/mixed:** if any gate fails, record the failing output, example and gate. Stage 1 may remain passed when its own gates pass, but hesitation stays open. Rank the concrete measured cause, with no tuning in this experiment. A prediction stricter than the gates may be contradicted while D2 passes; report both.
- **D4, infrastructure/inconclusive:** a crash or failed prefix check is preserved and diagnosed, not treated as ordinary score error. Observations fitting no branch are inconclusive; do not invent a favourable branch afterwards.

### Carried-over state and preflight

[024](024-event-chain-stage1.md#resulting-plateau-budgets-and-evidence-access) establishes plateau **0**, one development listener version and one completed comparison; development iterations are not rationed. This experiment budgets no new listener version and one successful recorded execution, with only D1/D4 technical reruns. Qualification contract 1 remains zero frozen versions and zero assessments, all six version slots, twelve assessment slots and reserved/final access unused. Winner bars 5–8 stay unexamined. Stage-1 evidence is reused development evidence; the new pause variants are correlated transformations of the same two scores, not independent generalisation.

Worktree/ledger/reports/archive/private directories show no existing owner of 025. Worktree listening-025 and run **g025-single-hesitation** are unused. Private stage-1 v3 is readable; ffmpeg is available; the authorised external worktree and data-root writes use sandbox escalation. Dependencies are installed once. No new oracle or instrument means no audit is due. No current user decision is needed; later recorded-guitar gates, qualification and product decisions remain pending.

## Results

[g025-single-hesitation](../runs/g025-single-hesitation/summary.json) completed on its first attempt in **364.73 s**, at commit `ed842e7e0a39545663b04d63d56878776e8e14bf`. The source commit is preserved by the annotated tag `g025-single-hesitation-source`, so final rebasing cannot make its source snapshot disappear from fresh clones. The frozen private manifest is `/home/williao/dev/mnx-listening-data/contract2-hesitation-v1/manifest.json`, SHA-256 `acf11389497910efe6036b0c5d9aaab510d23d382cd9624264beaacca73841b3`. The public summary names and hashes every private record and assessment and pins the contracts, instruments, oracle/audit, runner, listener, renderer, scores and pre-registration.

### Integrity and procedure

All 40 rendered performances passed the exact PCM insertion check: unchanged samples before the gap, zeros inside it, unchanged samples shifted afterwards. All matched-note onsets and ends obey the one exact shift, with unchanged pitches and note counts. All 24 stage-1 examples retain their assets and labels; all **120 stage-1 records**, including controls and the new listener, and all **eight stage-1 performance assessments** reproduce g024 byte for byte. No frozen listener, shared harness, instrument, oracle or product source was edited.

The pre-registration landed and was pushed at `18e85df8` before generation. The builder was committed at `a7d731b7`, the set frozen, then the comparison runner written and committed at `ed842e7e`. The full bench suite passed before execution. A copied reference path in the runner was corrected during inspection before execution; it produced no failed attempt. There was no infrastructure failure, technical rerun, tuning or departure from the pre-registered sequence. The results append to the unchanged pre-registration.

### Both outputs on the 40 hesitations

Each row covers all five pause lengths. Every cursor and assessment gate passes.

| Score / base BPM | Cursor examples | Notes matched | Intervals within | Slow bars found / definite positives | Max event delay, ms | Max interval error, ms | Max overall error |
|---|---|---|---|---|---|---|---|
| s1 / 45 | 5/5 | 20/20 | 15/15 | 4/4 | 30.00 | 6.67 | 0.000% |
| s1 / 63 | 5/5 | 20/20 | 15/15 | 4/4 | 37.63 | 12.40 | 0.227% |
| s1 / 90 | 5/5 | 20/20 | 15/15 | 5/5 | 33.33 | 16.67 | 0.437% |
| s1 / 99 | 5/5 | 20/20 | 15/15 | 5/5 | 33.94 | 16.06 | 0.085% |
| s2 / 45 | 5/5 | 40/40 | 35/35 | 3/3 | 36.67 | 16.67 | 0.069% |
| s2 / 63 | 5/5 | 40/40 | 35/35 | 4/4 | 38.10 | 17.63 | 0.048% |
| s2 / 90 | 5/5 | 40/40 | 35/35 | 5/5 | 36.67 | 16.67 | 0.067% |
| s2 / 99 | 5/5 | 40/40 | 35/35 | 5/5 | 37.58 | 16.06 | 0.167% |

**The live cursor holds every entire silent gap**, with no position or unsupported emission within any gap. It reaches all **240 events** within 15.75–38.10 ms; there is zero ahead time, behind time or wrong-position exposure. On-event answerable time is **99.488–99.920%**, rather than 100%: 25 examples briefly abstain for 10 ms on sound resumption, and 15 for 20 ms. Private decision traces place those unsupported emissions immediately after the gap ends. Inference from the unchanged code: non-silent re-entry ends the unconditional silence hold before two agreeing pitch windows restore support, while `lastSupported` predates the pause. This small transient is measured rather than hidden by the successful gate; it is not a missed resumption or an incorrect event claim. On-event figures also use the instrument's 200 ms transition allowance and should not be described as instantaneous tracking.

The assessor matches every score note and reconstructs all **200 inter-onset intervals**, including every pause. Its largest interval error is **17.625 ms** and largest overall-tempo error **0.437%**. All **35 definite slow-bar positives** are found. The **five `either` bars** receive no flag; optional flags there would also satisfy the approved instrument. The 20 unaffected s2 first bars have no slow flag, and there are no fast flags or false note findings. The five optional cases are s1-45/63 at 0.3 s, and s2-45 at 0.3/0.5 s and s2-63 at 0.3 s. This is a bar-level judgement: not every inserted pause must yield a flag at every base tempo.

For the user's slow-player example, **s2 at base 45 with a 1 s pause** reports overall **40.619 BPM** (exact truth 40.645), matches all eight notes, measures the hesitating interval as **2.320 s** (truth 2.333), and flags only bar 2 slow. The exact typical tempo remains 45; bar 1's ratio is 1, bar 2's 0.842. At base 90 the corresponding overall is 74.074 (truth 74.118), the interval 1.670 s (truth 1.667), and again only bar 2 is slow. Overall speed and local variation remain distinct.

### Controls, regressions, causality and cost

| Listener | New hesitation cursor gates | Stage-1 performance cursor gates | All control cursor gates | Max sustained ratio | Max chunk p99, ms | Complete two-output run |
|---|---|---|---|---|---|---|
| clock-follower@1 | 0/40 | 3/8 | 0/96 | 0.00254 | 0.082 | fail |
| online-time-warp@8 | 0/40 | 3/8 | 96/96 | 0.20538 | 2.512 | fail |
| online-time-warp@12 | 0/40 | 2/8 | 96/96 | 0.19329 | 2.636 | fail |
| online-time-warp@14 | 0/40 | 2/8 | 96/96 | 0.20354 | 2.656 | fail |
| event-chain@1 | 40/40 | 8/8 | 96/96 | 0.00237 | 0.116 | pass |

Each frozen comparator fails the ahead gate on every hesitation. Ahead fractions range from 1.10–85.48% for the clock, 7.43–33.99% for @8, 6.91–46.52% for @12, and 17.35–46.52% for @14. Its other failing gates remain in the complete summary; the failure is not attributed solely to the pause at slow base tempi, where the parent already failed. No baseline emits assessment, so no assessment improvement is inferred from their comparison.

Every event-chain control, **48 silence and 48 distant wrong-score examples**, rejects for **100%** of answerable time with zero false following, zero played-note claims and zero tempo claims. Every stage-1 per-example and pooled gate remains passed, with no false finding. The near-miss w1 was not tested or solved here.

All **1008 prefix checks pass**: 864 for event-chain@1, 144 across the frozen baselines. Every start is accepted. All listeners meet cost gates on the measured host, Intel Core i7-8750H / Linux x64 / Node v22.22.1. Event-chain's maximum sustained ratio is **0.002370523**, p99 **0.116244 ms**; cost includes its offline finish. Maximum observed backlog across all listeners is **0.234 ms**, with no sustained backlog. These are provisional Node results, not microphone, browser or mobile latency.

Pooled gates are passed separately for hesitation and stage-1 regressions. On hesitation, slow recall is 35/35, slow false alarms 0/20, fast false alarms 0/55, and missing/wrong/dead false alarms each 0/240. Recovery, extra-note holding and finding recall for fast/missing/wrong/dead have no positives and remain not applicable. They establish no error-handling capability.

## Against the predictions

| # | Verdict | Evidence |
|---|---|---|
| 1 | Held | 40 exact PCM insertions; unchanged regression inputs; all 120 records and eight assessments reproduce g024 byte for byte. |
| 2 | Held | 40/40 cursor gates, 240/240 events within 38.10 ms, zero ahead/exposure, zero live changes in every gap. Brief 10–20 ms abstention occurs after resumption and does not contradict the stated prediction. |
| 3 | Held | 240/240 notes, 200/200 intervals, overall error at most 0.437%; 35/35 definite slow findings, five either bars, no false finding. Sample rounding makes typical tempo differ from nominal base by less than 0.001 BPM; the declared analytical counts and ratios hold at sample precision. |
| 4 | Held | 96/96 controls reject for 100% of answerable time, with no note or tempo claim. |
| 5 | Held | All 1008 prefix checks pass; cost within both limits; all stage-1 gates pass. |
| 6 | Held | event-chain@1 passes the hesitation substage and regressions; each comparator fails all 40 new cursor examples and lacks assessment. |

## Decision

**D1:** input and deterministic-artifact integrity holds. **D2:** the first stage-2 deviation, **one silent hesitation**, passes with both outputs, both controls and every stage-1 regression. This is measured progress by the unchanged event-chain@1, not a new listener version or qualification retention. **D3:** no gate fails; the resumption abstention is a documented imperfection within the approved gates. **D4:** no failed execution, prefix failure, technical rerun or inconclusive outcome. Stage 2 as a whole remains incomplete. No instrument or oracle was written, so no audit is due.

### Resulting plateau, budgets and evidence access

Plateau **0**: the next single deviation cleared its gates. Contract 2 now has four numbered experiments, one development listener version and two completed listener comparisons. This run used one recorded execution and no technical rerun or new listener version. Development iterations remain unrationed. Qualification is untouched: zero frozen versions and assessments; all six version slots, twelve assessment slots, reserved and final accesses remain unused. Winner bars 5–8 remain unexamined. This evidence comprises transformations of two short pure-tone scales, at two fixed pause locations, not independent scores or player sessions.

## Next

Rank stage 2's next single deviation, **a slowed bar**, as question 10 for experiment 026. Retain stage-1 v3 and the frozen hesitation set as regressions; do not mix in another deviation yet. A two-bar score will test the approved typical-tempo definition's unequal interval counts, previously observed in oracle A7, separately from a listener defect. Preserve w1 for the wrong-note deviation.

Direction of travel: event states that hold without clock advancement and the separate offline onset alignment are candidates to survive chords and guitar. The pure-sine pitch estimator, hard pitch emissions and single-pitch tokens will need replacing for chords, wrong notes, ringing guitar, repeated pitches and real music. This run does not establish those capabilities, and no product promotion is claimed.

No current user decision is needed. Future recorded-guitar gates, qualification/evidence access and Studio product decisions remain pending. The independent process review introduced on main during this experiment is due after landing; this experimenter does not review its own work. No further experiment is started here.

## Attribution and validation

Designed, implemented, executed and recorded by **GPT-6 in Codex (exact version unverified)**, exactly as stated at launch. Terminal, TypeScript/tsx/Vitest; one model throughout. The full listening bench passed before execution (299 tests and typecheck); the final repository gate is run on the rebased completed record before landing. The report registry/exporter validates recorded source hashes against the pinned source commit.
