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
