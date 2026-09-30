# 028 — Other-bars tempo reference and a recorded rising tide

## Pre-registration

2026-09-30. **Sol 6.1 (high) in Codex**, terminal/TypeScript/tsx/Vitest. Research-log question 12 and the user-approved next step in [contract 2](../contracts/development-contract-2.md#order-of-work). Exactly one instrument experiment; no listener is developed, executed or judged by the new instruments.

### Question and evidence

Do assessment-evaluator@3 and stage-gates@2 implement the approved other-bars reference and rising tide, and can the passed substages acquire reproducible sentinels without retiring evidence improperly? [026](026-single-slowed-bar.md) demonstrated the short-score median limitation; [027](027-live-confirmation.md) cleared the live defect while preserving its legacy assessment. The primary specification is the approved development contract, not a new statistical method. Alternative faults are counting intervals rather than contributing bars, letting a bar set its own reference, losing endpoint attribution, marking a routine pass confirmed, arbitrary tie selection, and hiding a failure through retirement. The hand arithmetic and synthetic suite cases isolate these. No external acoustic research or new listener hypothesis is needed for this instrument question.

### Method fixed before implementation or execution

1. Land this section, [event instruments 3](../contracts/event-instruments-3.md), a four-bar monophonic score, and hand-worked **event-oracle@3** with its SHA-256 freeze, before implementing either new instrument. Preserve instruments/oracles 1–2 and all listener versions. Oracle inputs and answers come from arithmetic and synthetic suite histories, never a listener output. A different session must audit version 3 before any listener is judged by it.
2. Implement separate assessment3 and gates2 modules. Keep following-evaluator@2 and every approved numerical threshold unchanged. Bar reference is the score-distance-weighted median of intervals ending in other bars; at least three distinct other bars must contribute. Short examples retain local tempo and informational ratio but get no bar verdict. Hand cases exercise exclusion, eligibility, sparse bars, endpoint attribution, exact-half weighting, boundaries, controls and unchanged assessment rules. Inherited oracle@2 cases continue testing unchanged rules under their original instruments.
3. Implement deterministic sentinel selection and open/passed/confirmed transitions from the versioned definition. Bootstrap the suite record from **g027a**, using its instruments-2 passing evidence and hashes only, without reevaluating a listener with version 3. Select three least-margin performances per substage plus one silence and one wrong-score control per performed score. Mark historical passes as passed, not confirmed; record their instrument version and pending version-3 revalidation. Record all open deviations. Retire no performance set: @2 has only one evaluation, so the three-evaluation requirement cannot hold. Record the explicit user-approved sweep-only baseline policy.
4. Commit a four-bar score, s3: C4 D4 E4 F4 | G4 A4 B4 C5 | B4 A4 G4 F4 | E4 D4 C4 D4, quarter notes, 4/4, unique note IDs. Compile and validate its 16 notes and four bars. Prepare a new private **contract2-four-bar-tempo-v1** with 4 clean tempi 45/63/90/99 and 80 one-slowed-bar performances (each of 4 bars at each tempo and factors .5/.6/.7/.8/.9), each with same-length silence and distant w2 controls: 252 examples. This freezes evidence for the next listener experiment; no listener runs. Check sample-rounded note boundaries, pitches, labels, digital silence and wrong-score audio identity. Do not access Winner or reserved evidence.
5. Use run **g028-other-bars-suite** once, refusing dirty/uncommitted implementation, an unlanded pre-registration and an existing run ID. Pin execution commit and source hashes with tag **g028-other-bars-suite-source**. Public summary names private validation details by path/hash. Verify all 264 g027a artifact hashes and the frozen parent manifest/assets before computing sentinels. Causality/cost are historical inputs to selection, not fresh measurements.
6. This is an **instrument validation**, not a routine listener evaluation, stage claim or full sweep. Test oracle/state/margin rules and data construction only. No gates are proposed, no batch is active, and no full sweep is due on a new stage claim. 026 is the last full baseline comparison; a full sweep remains due by experiment 031 at the latest (five experiments later), earlier at a stage completion or batch end. The routine two-minute target applies to future listener evaluations; report construction/validation time here.

### Predictions

| # | Prediction |
|---|---|
| 1 | Every hand-worked new bar/reference/count/eligibility/verdict and synthetic suite answer reproduces exactly (1e-9 numerical slack); unchanged oracle suites remain passed. |
| 2 | In the two-bar example no bar receives a verdict; in the four-bar slow-last case only the last bar is slow; slow-first endpoint attribution can flag the following bar too. Four bars with only one onset each supply too few reference bars. |
| 3 | Suite states never confirm a first or routine pass; sentinel or sweep failure reopens; ties resolve by ID; missing paired controls fail selection. Repeated bootstrap gives byte-identical sentinels: 7 stage-1, 7 hesitation, 5 slowed-bar examples. No performance set retires. |
| 4 | s3 compiles to exactly 16 expected pitches, quarters 0–15 and four measures; all 252 generated examples pass independent boundary/control checks and their frozen hashes validate. No listener executes. |
| 5 | All 264 cited artifact hashes and parent assets validate; the public summary remains below 300 KB, pinning committed sources and private details. |

Any mismatch contradicts its prediction. Exact integer/ID/state outputs permit no tolerance; floating comparisons use 1e-9. Test failures are diagnosed before the recorded run, preserving the frozen oracle; an oracle error requires a new numbered correction rather than rewriting it to match code.

### Decision rules

- **D1 supported:** all oracle, suite, source/data and integrity checks pass. Record instruments implemented **pending independent audit**, bootstrap historical suite passes with their original instrument version, and rank the oracle@3 audit first. This never constitutes a listener or stage pass under version 3.
- **D2 contradicted/mixed:** preserve the frozen oracle and failed checks; repair an implementation error within its definition. If arithmetic or a definition is inconsistent, record disagreement and rank its independent audit; do not silently change the oracle, gate or old verdict. Any unresolved check prevents D1.
- **D3 infrastructure:** preserve a failed recorded attempt, diagnose it, and permit only a new run ID for a technical rerun with unchanged evidence/oracle/method. No overwrite. Observations fitting no branch are inconclusive.

### Carried-over state and preflight

Unchanged from [027](027-live-confirmation.md#resulting-stopping-count-budgets-and-evidence-access): **0 consecutive failing listener versions**, two development listener versions, four completed listener comparisons; qualification has zero frozen versions/assessments, all six version/twelve assessment slots and reserved/final accesses unused. Winner bars 5–8 unexamined. Instrument work adds no listener version or comparison. Development iterations are unrationed; budget one successful instrument run plus D3 technical reruns only.

Worktree list, committed reports/ledger/archive and private directories show no 028 owner or used ID. Isolated listening-028 worktree created, dependencies installed once; ffmpeg available; private parent evidence readable and private write probe succeeded. No current user decision is needed. This author stops after landing and retirement; the separate audit is the next session.

## Results

**Mixed under D2: version 3 is implemented, but one frozen hand answer is wrong and needs independent resolution.** [g028-other-bars-suite](../runs/g028-other-bars-suite/summary.json) completed in **24.482 s**, at `ef679158249f3b35188172bc4843b0cf643e4e39`, pinned by annotated tag `g028-other-bars-suite-source`. The public summary is **26,731 bytes**, naming private details by path and SHA-256. No listener ran or received a version 3 verdict; all historical listener verdicts remain instruments-2 evidence.

### Instruments against the frozen oracle

The pre-registration, definitions, score and frozen oracle landed and pushed at `309c845e` before implementation. Its landing gate passed, including **301 bench tests**. The oracle hash remains **3b83278b5df9ece9317343b4a5b02a49fa7c737a59f6b74e3a98bfc73a55fd48**. No byte in the oracle, freeze or pre-registration was changed. Focused validation passed **211 tests across the three oracle files**, including inherited note/duration/overall/control checks against handwritten reports. This green test result explicitly **preserves a known counterexample**, rather than claiming every frozen oracle answer is correct.

| New validation | Result |
|---|---|
| Hand-derived assessment cases B1–B12 | 11 agree, **B1 disagrees** |
| Open/passed/confirmed cases S1–S8 | 8/8 agree |
| Normalized margin cases | 8/8 agree |
| Retirement cases | 4/4 agree |
| Synthetic sentinel ordering, ASCII ties, missing controls and duplicate IDs | Expected choices/refusals reproduced |
| Routine and sweep plan | Attempted sets plus sentinels; sweep restores full retired sets |

**B1's discrepancy is in the hand arithmetic.** The score distances are 1,3,1 quarters and durations 2,6,1 seconds. Local tempi are 30,30,60. The first interval ends in bar0; the latter two end in bar1. Excluding bar0 leaves a three-quarter interval at30 and a one-quarter interval at60: weight4, half2, so the median is **30**, not the frozen **60**. Bar0 local tempo30 therefore has informational ratio **1**, not the frozen **0.5**. Bar1's local tempo240/7, reference30 and ratio8/7 remain correct. Both bars have only one other contributing bar, so neither receives a verdict either way. The author records this explanation; it is **not an independent audit**. The frozen answer remains and any correction belongs in a later numbered version after audit.

| Case / interpretation | Bar local tempi | References | Verdicts |
|---|---|---|---|
| B1, two bars | 30, 34.285714 | Actual30,30; frozen first60 | None: too few others; first frozen ratio disagrees |
| B2, four steady bars | 60 throughout | 60 throughout, 3 other contributors | None |
| B3, slowed last interval | 60,60,60,48 | 60 throughout | Last bar slow |
| B4, stretched first bar | 30,34.285714,60,60 | 60 throughout | First **and second** bars slow, from endpoint attribution |
| B5, uniform half speed | 30 throughout | 30 throughout | None, clean |
| B6, one onset per bar | null,60,60,60 | 60; only 2 other contributors for each sounded bar | None despite four score bars |
| B7, self-dominating interval | 60,60,60,30 | 30,30,30,60 | First three fast, last slow; whole typical30 cannot replace other-bars reference |
| B12, exact-half other weights | 120,40,60,80 | 70,80,80,60 | Fast,slow,slow,fast |

B8–B11 preserve the inclusive .90/1.10 and optional .95/1.05 boundaries. Development checks found an implementation float issue at B11: subtraction after accumulated onset arithmetic placed a mathematically exact 1.05 inside the central band. A **1e-12 representational boundary comparison** preserves the specified boundary verdict without changing the approved numerical gates. Canonical zero-position expansion and an unused import were also repaired before the recorded run. All remain ordinary pre-run implementation checks, not changes to frozen evidence or technical reruns. No failed recorded attempt occurred.

Informational report@3 bars are computed from the assessor's own reported intervals and score events; performance truth is reserved for the evaluator. The new evaluator reuses unchanged note, duration and overall measurement. Numerical stage gates remain approved values. Short varied examples do not become clean merely because bar verdicts are suppressed. Flags on an ineligible bar remain false alarms. Oracle@3's audit must check all newly added/changed rules, including suite rules, not merely approve B1's diagnosis. **Coverage limits:** routine/sweep plan examples and missing-control/duplicate refusal examples are post-freeze behavioral tests, rather than separately frozen oracle rows; report@3 summary-error/null handling has no separate frozen bad-report case. An audit must record any rule it cannot independently exercise. The later correction should supply missing hand-worked coverage before any listener judgment; passing implementation tests do not close that gap.

### Suite record and rising tide

[bench/suite-record.json](../bench/suite-record.json) records historical passes and deterministic sentinels. The run verifies **264 g027a artifact hashes**, its frozen manifest/assets and **168 pinned source hashes at g027a's commit**. It computes ranking headroom from the stored instruments-2 measurements; it never re-evaluates a listener under the new instruments. Its own execution pins **202 source files**. Reversing input order reproduces exactly the same selection. Costs and causality are historical ranking evidence, not fresh benchmarks.

| Historical substage | Status | Performance sentinels | Controls | Total |
|---|---|---|---|---|
| Stage1 | passed under instruments 2 | s2-99, s1-90, s2-90 | One silence and wrong-score per s1/s2 | 7 |
| Silent hesitation | passed under instruments 2 | h-s2-90-1000, h-s2-90-2000, h-s2-90-300 | One silence and wrong-score per s1/s2 | 7 |
| Slowed bar | passed under instruments 2 | sb-s2-99-b1-90, sb-s2-99-b1-70, sb-s2-90-b2-50 | One silence and wrong-score for s2 | 5 |

All **19** IDs, normalized margins and artifact hashes are in the suite record and public summary. This reduces the historical regression portion of a routine run from 264 examples to 19, before adding all examples of the attempted substage. The exact-margin/ID rule selects these; the two formerly failed F4 examples are not manually inserted. Nothing is newly confirmed: 027 was a routine repair, and the new suite's historical passes remain explicitly pending instruments-3 revalidation. All remaining deviations, four-bar tempo revalidation and stages 3–5 are open. Stage2 remains incomplete.

**Zero performance sets retire.** Incumbent event-chain@2 has one passing evaluation, so the three-successive-evaluation condition is unavailable. All full sets remain sweep evidence, and sentinels continue running. The frozen baselines are sweep-only under the user's explicit exception, with the old summaries cited. A full sweep remains due by 031 at the latest after 026's full comparison, earlier at stage completion, new-gate proposal or batch end. This experiment claims no stage pass and proposes no gate.

### New four-bar evidence, without listener execution

s3 compiles cleanly to four 4/4 measures, quarters 0–15 and the 16 specified pitches, with one note per event and no adjacent repeated pitch. The private **contract2-four-bar-tempo-v1** manifest is `/home/williao/dev/mnx-listening-data/contract2-four-bar-tempo-v1/manifest.json`, SHA-256 **870363f2f36aa19a13aeee4d0faccff4e59d55ff8183fe8c32c868a803b5b60e**. It is frozen before any listener comparison. The data add length only, keep the sine renderer, and independently vary a single bar's tempo for the slowed examples.

| Data/validation | Count |
|---|---|
| Clean performances, 45/63/90/99 BPM | 4 |
| Single slowed bars, 4 tempi ×4 bar placements ×5 factors | 80 |
| Paired silence / wrong-score controls | 84 /84 |
| Total examples | 252 |
| Performance note instances | 1,344 |
| Independent start/end/quarter/pitch checks | 5,376 |
| Exact same-length digital-silence checks | 84 |
| Byte-identical wrong-score audio checks | 84 |

Distant w2 satisfies register, rhythm and nonmatching three-note interval checks for s3. Every generated label and frozen asset hash validates. Note boundaries are cross-checked by summing per-beat durations independently of the generator's closed-form stretch. No real clip, Winner material, reserved evidence, listener causality test or cost benchmark is newly used. Runtime is evidence preparation and validation, not listener speed. There is one recorded run and no technical rerun.

## Against the predictions

| # | Verdict | Evidence |
|---|---|---|
| 1 | **Contradicted, mixed** | 11/12 assessment cases agree; B1's frozen first reference/ratio is wrong. Suite/state/margin/retirement rules agree, unchanged oracle suites pass. No frozen answer edited. |
| 2 | Held | No short-score verdict; B3 only last slow; B4 first and following slow; B6 lacks enough contributing reference bars. B1's reference itself remains a disagreement under prediction1. |
| 3 | Held | State/tie/refusal rules hold; input-order reversal byte-identical;7/7/5 sentinels; zero performance retirements. |
| 4 | Held | s3 four bars/16 notes, all 252 examples and 5,376 boundary checks validate; no listener executes. |
| 5 | Held | All 264 historical artifact hashes and frozen assets validate; 168 old pinned sources checked;26,731-byte public summary and private hashes preserved. |

## Decision

**D2 applies, not D1.** Preserve the known B1 oracle disagreement and rank the independent **event-oracle@3 audit** first. Instruments3 are implemented but not approved for judging listeners; the green checks preserve the disagreement explicitly. Independent audit must rederive every new/changed case/rule and decide the arithmetic. If it agrees B1 is wrong, the next numbered experiment versions the oracle and any affected definitions before a listener uses them. This author neither audits itself nor starts that correction. D3 does not apply: no infrastructure failure or rerun. No favourable stage/listener verdict follows.

The suite bootstrap and frozen evidence remain useful, versioned artifacts, with historical passes explicitly labelled instruments 2. No old verdict is rewritten. No new numerical gate or user decision is needed for this work; later recorded-guitar gates remain pending.

### Resulting stopping count, budgets and evidence access

Unchanged from 027: **0 consecutive failing listener versions**, two development listener versions and four completed listener comparisons. Seven contract-2 numbered experiments now recorded. This run is instrument work, adding no version/comparison and consuming no qualification budget. All six qualification version slots, twelve assessment slots and reserved/final accesses remain unused; Winner bars 5–8 unexamined. No batch is active. New examples are developmental transformations of an authored four-bar sine score, not real-player or timbre generalisation.

## Next

First: independent audit of **event-oracle@3**, with B1's full disagreement above and every new bar/suite rule covered. Then resolve its findings in a separately numbered correction if needed. Only after audited instruments may a listener be evaluated on the new four-bar tempo evidence; held-note hesitation and the remaining stage 2 deviations wait in the approved order.

Direction of travel: other-bars references, explicit suite histories and sentinels can survive chords, guitar and longer music. The sine-specific monophonic event chain is unchanged; this instrument work provides no evidence for its transfer, partial chords, wrong/dead/missing notes or real recordings. The other-bars reference still cannot infer which bar is normal where multiple bars differ; B7 demonstrates that limit rather than hiding it.

## Attribution and validation

Designed, implemented, executed and recorded by **Sol 6.1 (high) in Codex**, one model throughout. Pre-registration landing gate passed; focused 211 oracle/compatibility tests and bench typecheck passed before the run. The final repository gate runs on the rebased complete record before landing. Report export verifies all 202 execution-source hashes at the source tag's commit. Oracle freeze and pre-registration remain unchanged; no independent audit or process review is claimed by this author.
