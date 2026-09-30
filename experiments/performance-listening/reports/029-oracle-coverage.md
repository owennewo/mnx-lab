# 029 — Correct and complete the event oracle

## Pre-registration

2026-09-30. **Sol 6.1 (high) in Codex**, terminal/TypeScript/tsx/Vitest.
Research-log question14; exactly one instrument experiment, no listener developed,
executed or judged. [Audit3](../bench/oracle-events/audit-3.md) is independent evidence
for the correction. Approved contract2 and instruments3 are the primary rules;
external acoustic research cannot resolve these arithmetic/coverage questions.

### Question and alternatives

Does corrected event-oracle@4 resolve B1/B11 and freeze hand-worked cases for the
uncovered bar-report, null-reference, omission, suite-state, selection, headroom and
run-plan rules, and does the existing implementation reproduce them? Alternative
explanations are wrong hand arithmetic, rounded boundaries, evaluator report counting,
and missing-evidence/state adapters. Separate literal cases distinguish them.
No agreement by this author is an independent audit.

### Method fixed before validation implementation or execution

1. Land this pre-registration, [instruments4](../contracts/event-instruments-4.md),
   oracle4 and its SHA-256 freeze before writing the new loader/validation/runner.
   Oracle3, old definitions and listener/instrument implementations stay frozen.
   Correct B1 reference30/ratio1. Reshape B11 with exact integer onsets and84/80=1.05.
   Add hand cases for null reference/no intervals/omission, report ordinal matching,
   duplicate/unknown/missing bars, signed/null errors, ineligible and optional flag
   denominators, missing flags, clean gates, state reopening/preservation, absent
   required evidence, selection refusals/parent score, normalized headroom and plans.
2. Validate against existing assessment3/gates2; do not version a listener or change
   a gate. Compare finite numbers within1e-9; IDs, booleans, nulls and verdicts exactly.
   Per-case checks preserve expected answers even if wrong. Never repair a frozen
   answer within this experiment. Check fault sensitivity by perturbing B1/reference,
   B11/verdict, flag denominators, ordinal matching, state transitions, rejection and
   interval headroom, and retired-set plans. Require every deliberate wrong answer
   to fail validation. Frozen oracle1–3 tests retain their recorded meanings.
3. Use one new instrument run **g029-oracle-coverage**. Refuse dirty/uncommitted code,
   an unlanded or changed pre-registration and an existing public/private run ID.
   Pin commit and source hashes, tag **g029-oracle-coverage-source**, and preserve
   attempts/failures. Public summary below300KB names private details by path/hash.
   Check inherited frozen bytes and historical suite structure/19 sentinel IDs;
   verify frozen baseline producer sources unchanged from main at pre-registration.
   Baseline behavior is preserved by byte-identical producers, not fresh execution.
   No listener runs, so no fresh causality/cost claim is made.
4. This is instrument validation, neither a routine listener evaluation nor a full
   sweep or stage claim. No data preparation, Winner/reserved/final evidence, new
   gate or batch. Existing four-bar evidence remains untouched. Full sweep remains
   due by031 after026, earlier at stage completion/new gates/batch end. The routine
   two-minute goal applies to listener evaluation; report validation runtime here.

### Predictions

| # | Prediction |
|---|---|
| 1 | Every corrected/inherited and added oracle4 assessment/report count/error/verdict exactly agrees under stated precision; B1 reference30/ratio1, B11 either/unclean, null-reference/omission cases agree. |
| 2 | All suite/state/selection/headroom/retirement/plan cases agree; missing evidence refuses pass, routine preserves confirmed, failures reopen passed, retired sentinels remain and reopened full sets return. |
| 3 | All eight deliberately incorrect answer families are detected; inherited oracle suites and frozen producers remain unchanged. |
| 4 | One compact provenance-pinned instrument record completes, with zero listener executions, stage confirmations, performance retirements or evidence-budget use. |

Any mismatch contradicts its prediction; mixed evidence is reported by case.

### Decision rules

- **D1 agreement:** all validation/provenance checks pass. Record oracle4 as agreeing
  with implementation, **pending independent audit4**, and rank that audit first.
  No listener or stage approval follows.
- **D2 disagreement/mixed:** preserve every failed case and frozen answer; diagnose
  arithmetic versus implementation from the written rules. No silent repair of the
  oracle or historical verdict. Rank independent audit4 with the discrepancy.
- **D3 infrastructure:** preserve failed attempt, diagnose it before a technical
  rerun using a new ID and unchanged method/evidence/oracle. Only runner/adapter
  implementation faults may be repaired within the frozen semantics. No outcome
  fitting a branch means inconclusive; it is never an agreement claim.

### Carried-over stopping count, budgets and preflight

Unchanged from [028](028-other-bars-suite.md#resulting-stopping-count-budgets-and-evidence-access):
0 consecutive failing listener versions, two development listener versions and four
completed listener comparisons; zero qualification versions/assessments, all six
version/twelve assessment slots and reserved/final accesses unused. Winner5–8
unexamined. No batch active; instrument work adds no listener version/comparison.
Budget one successful instrument run plus D3 technical reruns only.

Worktree list shows only main, reports/ledger/archive/private directories and tags
show029 and g029 unused. listening-029 isolated worktree created; dependencies
installed once; ffmpeg available; private input directories readable and write probe
succeeded. No private audio is needed or replaced. This session stops after landing
and retirement; it does not run its own independent audit or process review.
