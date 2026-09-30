# 027 — Confirm live pitch evidence before committing

## Pre-registration

2026-09-30. Designed, implemented, run and recorded by **Sol 6.1 (high) in Codex**. Terminal/TypeScript/tsx/Vitest. Research-log question 11; repair the lowest open substage, one slowed bar. This section and the bounded research note land before implementing or executing the candidate. One new listener version; no new data, instrument, oracle or gate.

### Question and evidence

Can three consecutive agreeing pitch windows, rather than two, protect the live event chain from the transient skips in [026](026-single-slowed-bar.md), while preserving both outputs on all earlier examples and controls? The frozen component trace identifies two G4 windows at each failed E4→F4 transition, followed by sustained F4. The original chain commits irreversibly after the second G4. Offline alignment already discards that token and succeeds. This experiment isolates live commitment policy from pitch estimation and offline assessment, rather than changing all three.

Alternative explanations: (a) more than two erroneous observations elsewhere can still commit a skip; (b) the extra hop can exceed a cursor deadline or increase resumption abstention; (c) accidental coupling to token capture can change assessment. The complete frozen set, explicit delay/abstention comparisons and byte comparisons of offline reports distinguish these. Phase versus frame-placement causation remains unisolated. The [research note](../research/live-confirmation-027.md) records bounded primary-source context and distinguishes it from this local hypothesis.

### Method fixed before the run

1. Add **event-chain@2** as a separate listener. Keep event-chain@1 frozen. Reuse its pure-sine pitch estimator and offline aligner. Preserve two-window token capture, onset backdating, finish/report behavior, transition costs, skip range, support grace and silence hold. Give live transitions their own last-processed pitch, and require **three consecutive agreeing windows** before evaluating a new pitch for the live chain. The first and third 20 ms windows at 10 ms hops have non-overlapping interiors; this is temporal confirmation, not three independent samples. Support refresh retains its existing two-window rule once a state is finite. No backwards recovery is added; this tests prevention only. This is one mechanism changed, not a new acoustic model.
2. Use frozen private **contract2-slowed-bar-v1**, manifest SHA-256 `553d4e7e62ebebacc63cb8fa7a735414490455d8a8eff19a3671eb36d96954db`: all 264 examples (8 stage-1, 40 hesitation, 40 slowed-bar performances; 176 paired controls). No assets, labels, recipes or evaluation definitions change. Validate its frozen hashes and audited oracle@2 before execution. Apply following-evaluator@2, assessment-evaluator@2 and stage-gates@1 unchanged, including their current bar flags. Contract 2 explicitly defers instruments 3 and the suite record to 028; these legacy flags are not claimed to implement the newly approved other-bars definition.
3. This is a **routine repair evaluation**, not a stage-completion/full-sweep claim. Under contract 2's explicit order for 027, stage 1, hesitation and slowed bars all run in full because no sentinels exist yet. Frozen clock/time-warp baselines are sweep-only. Cite their existing summaries by hash; no new baseline execution. No batch is active. The last full comparison is 026; the next instrument/gate milestone is 028.
4. Rerun event-chain@2 on every example: changed listener sources prohibit reuse of its live evidence. Six prefix-future checks on each example at 48 kHz/480 samples; measure initialization/feed/finish cost on the recorded Linux host, provisional under sustained ratio <=0.25 and chunk p99 <=10 ms. Budget one candidate and one successful recorded comparison; no tuning after evaluation. Target evaluation time about two minutes.
5. Reconstruct event-chain@1's complete comparator from g026's 120 new example artifacts and its 144 reused regression entries. Verify g026's pinned producer sources against their git commit and the current tree, excluding historical reports/research and the subsequently user-amended development contract from current-byte equality. Pin that contract separately as a policy change, not an unchanged dependency. Verify its g025 citation and every parent input, record, assessment and causality artifact used. Verify unchanged tracked TypeScript under model/audio/listen/bench from g026's commit; only new 027 modules are allowed. Re-evaluate old records with unchanged instruments and require the same gate results. A changed actual producer or input forces rerunning the affected comparator in this run; missing/corrupt artifacts stop as integrity failure. Reused causality/cost is cited original evidence, not fresh timing.
6. For every new example, compare the normalized whole offline assessment and its evaluation with the verified old report. Reports compare note/tempo values and finish emission IDs as well as onsets; live serial IDs may differ when suppressing a transient, so also report whether differences are ID-only. Primary assessment invariance concerns every musical value, not emission bookkeeping. Pin commit and source hashes, tag the execution commit `g027-live-confirmation-source`, and write compact public per-example verdicts/provenance plus private detailed decisions and evaluations. Refuse dirty code, an unlanded pre-registration and any reused run ID; preserve failed attempts.

### Predictions

| # | Prediction |
|---|---|
| 1 | Frozen inputs and all comparator artifacts/producer checks hold; no actual dependency requires a comparator rerun. Re-evaluation reproduces old gates: stage 1 24/24, hesitation 120/120, slowed-bar cursor 118/120 with 38/40 performances. |
| 2 | Both formerly failing F4 events are reached within 0.2 s with zero premature G4 exposure. All 40 slowed-bar performances pass cursor gates; 320/320 events reached. |
| 3 | Every earlier cursor/control gate remains passed: 24 stage-1 and 120 hesitation examples; all 176 controls reject for 100% of answerable time. Every acquired transition unaffected by the old skip occurs one hop (10 ms) later; hypothesis checked as a diagnostic, not a new gate. |
| 4 | All 264 assessments and evaluations preserve their musical values; 608/608 performance notes match, 520/520 intervals remain within tolerance, all approved old bar findings remain correct and all controls claim no played notes or tempo. IDs may differ only where live emissions differ. |
| 5 | All 1584 fresh prefix checks pass; all fresh cost gates pass; every per-example and separate stage-1/hesitation/slowed-bar pool passes. |

Any shortfall contradicts its prediction; report mixed evidence and measured delays, abstention, assessment ID differences and maxima rather than hiding them in the overall verdict.

### Decision rules

- **D1 integrity:** any corrupt input/artifact or irreproducible comparator evaluation stops comparison, preserves the attempt and gets diagnosed. Genuine changed producer dependencies require fresh comparator execution. Only a runner/serialization defect permits a technical rerun with a new ID and unchanged candidate, evidence and gates.
- **D2 pass:** if all 264 candidate examples, all three separate substage pools, cost and causality pass, record slowed-bar handling passed and use event-chain@2 as the development incumbent. Earlier substages retain their verdicts. The next numbered question remains **028: event instruments 3 and the suite record**, then its independent audit, before more deviations. Stage 2 remains incomplete. A stricter prediction may be contradicted while D2 holds.
- **D3 failure/mixed:** any ordinary gate failure keeps the lowest failed substage open, with its measured cause ranked next; no second candidate or tuning here. Add one failing listener version to the stopping count if slowed bars do not clear. Earlier substages retain a pass only if their own gates pass.
- **D4 infrastructure/inconclusive:** crash, failed prefix check or unexplained artifact difference is preserved and diagnosed. Evidence fitting no branch is inconclusive. Neither is a pass or grounds for silently changing methods.

### Carried-over state and preflight

The [current log](../RESEARCH_LOG.md#current-state) and contract 2's new stopping rule establish **0 consecutive failing listener versions**: 026 failed with unchanged @1 and does not add a version. Qualification budgets/access are unchanged from [026](026-single-slowed-bar.md#resulting-plateau-budgets-and-evidence-access): zero frozen versions/assessments, all six version and twelve assessment slots and reserved/final accesses unused; Winner bars 5–8 unexamined. Development iterations are not rationed. This experiment adds at most one listener version and one successful comparison, plus only technical reruns allowed by D1/D4. Evidence is reused development transformations, not new generalisation.

Worktree list, committed reports/ledger/archive and private directories show no owner or use of 027 or **g027-live-confirmation**. Isolated worktree listening-027 created, dependencies installed once, ffmpeg available, frozen data readable and private write probe passed. No user decision or oracle audit is needed for this bounded repair. The independent process review follows completion; this session does not review itself or start 028.

## Results

**event-chain@2 passes all 264 examples and repairs both live skips.** The recorded comparison [g027a-live-confirmation](../runs/g027a-live-confirmation/summary.json) completed in **19.480 s**, at `b30ba711a0f7ad2fe92b4656a95db838bc8ce898`, pinned by `g027a-live-confirmation-source`. Its public summary is **120,172 bytes**. The unchanged private manifest is `/home/williao/dev/mnx-listening-data/contract2-slowed-bar-v1/manifest.json`, SHA-256 `553d4e7e62ebebacc63cb8fa7a735414490455d8a8eff19a3671eb36d96954db`. All detailed decisions, evaluations, comparisons and validation artifacts are private, named and hashed by the summary.

### Integrity, comparison and procedure

The pre-registration landed and was pushed at `4ebc3cad` before implementation or execution. The listener, focused regression and runner were frozen at `b106501c`. The focused regression reproduces @1's premature G4 on a generated copy of the 90 BPM/factor 0.9 transition and shows @2 on the correct F4; it also tests ordinary acquisition and silence holding. The first Vitest command used the repository working directory and found no tests; the corrected bench-directory invocation passed both behavioral tests. The bench typecheck passed before execution.

**One failed infrastructure attempt was preserved.** [g027-live-confirmation](../runs/g027-live-confirmation/summary.json), pinned by `g027-live-confirmation-source`, stopped during source validation, with **zero candidate examples executed**. Its `git show` path included literal parent-directory segments (`experiments/performance-listening/../../src/audio/carryPlace.ts`), which Git tree lookup does not normalize. The terminal log, failure and attempt are private artifacts named and hashed in that summary; the public [attempt](../runs/g027-live-confirmation/attempt.json) also remains. A single runner lookup was corrected to a normalized repository-relative path, committed at `b30ba711`, and the authorized **D1 technical rerun used a new ID**. The listener, inputs, instruments, gates and pre-registration were unchanged. There was one successful comparison, no post-evaluation tuning and no second candidate.

Frozen assets and all 264 labels validate. The comparator validation verifies **155 unchanged TypeScript producer files**, **165 pinned source hashes** against g026's source commit, and **986 distinct private artifacts** by hash. Historical report/research bytes are verified at their original commit; the later user-amended development contract is explicitly pinned as a policy change. The instrument/oracle bytes and actual producer closure remain unchanged. All 264 old evaluations and gate verdicts reproduce exactly; no comparator rerun is needed. The old stage-1 and hesitation examples pass, and the old slowed-bar performances retain **38/40** cursor passes. Frozen baseline summaries are cited by hash as sweep-only evidence; no baseline ran here.

This is the contract's routine repair evaluation with all three substages in full, pending 028's sentinels. It is neither a full sweep nor a claim that all of stage 2 passed. Shared harness, frozen listeners, evaluator/oracle, corpus and product source files were not edited. The legacy typical-tempo bar flags remain the approved instruments 2 comparison for this repair; the new other-bars definition still needs instruments 3 and its independent oracle audit.

### Both outputs, including earlier regressions

Control counts are shown separately below; these rows cover performances only. Every cursor, assessment and separate pooled gate passes.

| Substage | Cursor performances | Events reached | Notes matched | Intervals within tolerance | Minimum on-event | Maximum event delay | Maximum interval error | Maximum overall-tempo error |
|---|---|---|---|---|---|---|---|---|
| Stage 1 | 8/8 | 48/48 | 48/48 | 40/40 | 100% | 48.104 ms | 17.625 ms | 0.503% |
| Silent hesitation | 40/40 | 240/240 | 240/240 | 200/200 | 99.208% | 48.104 ms | 17.625 ms | 0.437% |
| Slowed bar | 40/40 | 320/320 | 320/320 | 280/280 | 100% | 48.958 ms | 18.875 ms | 0.182% |

There is **zero ahead or wrong-position exposure on every performance**, and zero false findings. The 200 ms transition allowance contributes to on-event scores; they do not imply instantaneous tracking. All **606 events reached by both versions** are reached exactly **10 ms later** by @2 (within floating-point precision), with no exception. The two newly reached events are measured separately:

| Previously failed example | Actual F4 onset | @1 cursor | @2 F4 acquisition | @2 delay | @2 ahead/exposure/abstention |
|---|---|---|---|---|---|
| sb-s2-63-b1-60 | 4.761896 s | G4 at 4.78 s, then unsupported | 4.81 s | 48.104 ms | 0 / 0 / 0 |
| sb-s2-90-b1-90 | 2.222229 s | G4 at 2.24 s, then unsupported | 2.27 s | 47.771 ms | 0 / 0 / 0 |

The old mixed-window G4 observations still exist; the unchanged token stream still contains them. The third confirmation does not occur before F4 replaces that pending pitch, so the live chain never commits to the spurious G4. This establishes prevention on these two observed transitions, not recovery after a committed skip and not an acoustic repair. The old 1.49/0.65 s unsupported episodes disappear. On hesitation resumption, all 40 examples add **10 ms** of abstention, from 10–20 ms to **20–30 ms**; this measured regression remains within the gates. Silence holding and every earlier verdict survive.

All **264 musical assessment reports and all 264 assessment evaluations are byte-identical** after excluding note emission IDs from the report comparison. **262 complete reports are identical including IDs**; the two repaired examples differ only in IDs because their live emission counts changed. Onsets, ends, note verdicts, tempo intervals and flags do not change. All **608 notes** match and all **520 intervals** remain within tolerance. The old **35 hesitation slow flags**, **16 slowed-bar slow flags** and **16 slowed-bar fast flags** are all detected, with zero false findings; optional bars preserve their old output. Recovery after omissions, extra-note holding and wrong/dead/missing finding recall have no positives and remain untested.

### Controls, causality and cost

| Substage | Paired controls | Correct rejection | Played-note / tempo claims |
|---|---|---|---|
| Stage 1 | 16/16 | 100% each | 0 / 0 |
| Silent hesitation | 80/80 | 100% each | 0 / 0 |
| Slowed bar | 80/80 | 100% each | 0 / 0 |

All **176 controls** have zero false following. All **1,584 fresh prefix checks** pass, six for every candidate example. The old comparator's **1,584 checks** and cost gates are verified cited evidence, not fresh measurements.

Fresh @2 maximum sustained cost ratio is **0.002521372**, chunk p99 **0.139850 ms**, backlog **0 ms**; both cost gates pass including initialization/feed/finish. Host: Intel Core i7-8750H, Linux x64, Node v22.22.1. This is provisional Node cost, with no browser, microphone or mobile latency claim. The full evaluation including provenance checks takes 19.480 s, comfortably within the routine two-minute target; no frozen-baseline timing is being compared to this as an algorithm gain.

## Against the predictions

| # | Verdict | Evidence |
|---|---|---|
| 1 | Held | Frozen set verified; 155 producer files, 165 pinned hashes and 986 private artifacts validated. All old evaluations/gates reproduce; no actual dependency changed or comparator rerun needed. The initial path-lookup failure was a preserved runner defect, not an artifact mismatch. |
| 2 | Held | Both F4 events acquired in <=48.104 ms with no premature G4 claim; slowed-bar cursor 40/40, events 320/320. |
| 3 | Held, with measured latency cost | All 144 earlier examples and all 176 controls pass; each of the 606 shared reaches adds exactly 10 ms. Hesitation resumption abstention also adds 10 ms, to 20–30 ms. |
| 4 | Held | 264/264 musical reports and evaluations identical; 262/264 whole reports identical, two ID-only changes. All 608 notes, 520 intervals and old flags preserved, no control claims or false findings. |
| 5 | Held | 1584/1584 fresh prefix checks, all cost gates, all 264 examples and all three separate substage pools pass. |

## Decision

**D1:** integrity holds; the first attempt's normalized-path defect was diagnosed before the authorized technical rerun, with both IDs and sources preserved. **D2 applies:** use **event-chain@2** as the development incumbent; **one slowed bar passes** alongside preserved stage 1 and silent hesitation. Stage 2 remains incomplete and awaits future deviations. **D3 does not apply:** no candidate gate failed. **D4:** the initial preflight infrastructure failure remains recorded; the successful fixed-runner evidence resolves the experimental question. No inconclusive verdict, failed prefix check or candidate tuning. No instrument/oracle changed and no audit is due for 027.

### Resulting stopping count, budgets and evidence access

**0 consecutive failing listener versions**, unchanged from the incoming 0 and reset by clearing the lowest open substage. Contract 2 now has six numbered experiments, two development listener versions and four completed listener comparisons. This experiment used one new version, one failed preflight and one successful technical rerun/comparison. Qualification budgets/access remain unchanged from 026: zero frozen versions and assessments, all six version slots/twelve assessment slots and reserved/final accesses unused; Winner bars 5–8 unexamined. No new evidence was treated as independent; these are the same short-score sine transformations. No batch is active.

## Next

Rank **question 12 for experiment 028: event instruments 3 and the suite record**, as the user's approved order requires. Freeze hand-worked oracle cases for bar flags against the other bars only when at least three other bars provide intervals; add the four-bar sine score, rising-tide stage states and deterministic sentinels for the passed substages. Implement no new listener in that instrument experiment, and make its oracle audit the next question before any listener is judged by it. Preserve all older verdicts. Later deviations wait for that instrument work and audit.

Direction of travel: separating live commitment from offline token capture can survive richer listeners, and the event chain still waits for audio instead of a tempo clock. A fixed three-window pitch gate merely suppresses short transient evidence on these sines; longer false pitches, wrong notes, repeated notes, chords, ringing guitar and real music can defeat it and may need a stronger acoustic estimator or recoverable state distribution. No product/generalisation/qualification claim follows.

No current user decision is needed. Recorded-guitar gates and qualification/product decisions remain later. Independent process review is due after this experiment; this session does not review its own work or start 028.

## Attribution and validation

Designed, implemented, executed, diagnosed and recorded by **Sol 6.1 (high) in Codex**, one model throughout, terminal/TypeScript/tsx/Vitest. The pre-registration landing gate passed with 299 bench tests; the two new behavioral tests and bench typecheck passed before execution. Execution sources are preserved by both annotated tags. The final repository gate runs on the final rebased record before landing; report export checks all successful and failed run source hashes against their pinned commits.
