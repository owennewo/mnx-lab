# 032 — Hold through a hesitation while the preceding note sounds

## Pre-registration

2026-10-01. **Sol 6.1 (high) in Codex**, terminal/TypeScript/tsx/Vitest.
Run 3 of the five-experiment main-track batch. One diagnostic experiment of the
unchanged incumbent **event-chain@3**; no new listener or evaluator.

### Question and alternatives

Does event-chain@3 hold its live cursor through a single hesitation while the
previous note continues sounding, then acquire the resumed event and assess every
note and inter-onset interval correctly? This is open question 19 and the next
substage in [contract 2's order](../contracts/development-contract-2.md#order-of-work).
[031's completion](031-other-bars-reporting.md#completion-g031b-by-the-users-authority)
cleared the reporting prerequisite and passed every earlier substage.

The live chain updates only on a new confirmed pitch and refreshes support while
the current pitch sounds. That predicts a hold even without silence. Alternatives:
the longer note's release phase creates transient pitch tokens or premature live
commitment; resumption causes abstention or delayed acquisition; offline tokens
misplace the resumed onset and distort the pause interval. Separate live, note,
interval and cost measures distinguish these. This is a local inference from the
frozen implementation, not a published acoustic claim. The bounded primary-source
context remains [024's research](../research/event-chain-024.md) and
[025's hesitation note](../research/hesitation-025.md); this experiment tests no
published accuracy claim and changes no algorithm, so no new literature search is
needed. Relevant code, behavioral tests and g031b's causal/report records are read
before design. Constant sine sustain is the first held-note case; overlapping or
decaying guitar tails wait for later sound stages.

### Method fixed before execution

1. Land this pre-registration before implementation or generation/evaluation.
   New run **g032-held-note-hesitation**, source tag of that name plus `-source`.
   Require committed implementation, the landed unchanged pre-registration and
   an unused public/private run ID. Preserve all existing sources, listeners,
   instruments, oracles and private evidence bytes.
2. Freeze a new private **contract2-held-note-hesitation-v1**, based on verified
   contract2-hesitation-v1 and contract2-stage1-v3. Its 40 varied performances
   retain exactly the silent-hesitation onsets: s1 pauses before event 2, s2 before
   event 4 (zero based), played at 45/63/90/99 with one pause of 0.3/0.5/0.7/1/2 s.
   Extend only the preceding note's end to the resumed onset. The sine phase
   continues from its original attack, level stays -12 dBFS, attack/release remain
   10 ms, and successive notes abut without overlap. No extra note or new onset.
   Verify PCM equality to the silent counterpart outside the changed preceding
   release/sustain region; all subsequent notes and earlier attacks stay exact.
   Freeze full rendered boundaries and validation results alongside the manifest.
3. Each held performance gets digital silence of equal duration and its identical
   audio handed distant w2. Also include all 8 clean stage1 performances and their
   16 controls, preserving the required clean half-speed examples: **144 set
   examples (48 performances, 96 controls)**. Labels use unchanged perfectLabel
   and controlLabel, with exact sample boundaries. Onsets/cursor segments equal
   silent counterparts; only the preceding note's audible end changes. This adds
   no evaluation rule or oracle; renderer checks independently verify stimulus
   construction and label boundaries, not listener verdicts.
4. **Routine active suite**: the full new substage plus all 24 frozen earlier
   sentinels and controls, deduplicated against the clean parents (7 overlap):
   **161 examples**, 120 fresh held/control executions and 41 reusable old records.
   Reuse g031b only after validating its summary, per-example artifact, source
   hashes at its pinned commit, unchanged existing TypeScript producers, score,
   audio and label hashes. Re-evaluate and require identical evaluations; otherwise
   rerun affected old examples fresh. Cite the 40 paired silent-hesitation records
   by hash for read-only comparison of interval estimates and acquisition, without
   adding them to the scored active suite. Frozen baselines are sweep-only and their
   g031b evidence is cited, not run. A full sweep is not due until 036 or earlier
   batch end (034), new gates or a whole-stage pass. This attempts one substage,
   makes no whole-stage claim and retires nothing.
5. Unchanged audited following@2, assessment@3 and gates@2 (oracle@4, audit4).
   Known top/all parts, handed 90, 48 kHz/480-sample chunks. Six prefix checks per
   fresh example; inherited prefix/cost records only under verified reuse. Cost
   includes finish, provisional on the measured host: sustained <=0.25, p99<=10 ms.
   Per-example verdicts, pools separately for all new-substage performances and
   held-only performances, and earlier sentinel gates. Missing/refused output,
   absent cost or incomplete prefix checks fail. Short-score bar flags must remain
   absent; interval estimates carry the timing finding without eligible bar flags.
6. Write/hash each private record as measured. Dry-assemble and validate public
   summary shape before measurements; keep detailed records private and public
   provenance/aggregates small. Summary size is reported, never a reason to reject
   completed measurements. Verify source tag before running. Expected evaluation
   under two minutes. Diagnose failures read-only; no tuning or musical rerun.
7. Routine states: preserve existing sentinel IDs. Failing sentinels reopen their
   owner via nextState; passing prior stages retain their status. New held-note
   substage passes only if every own example, pool, prefix/cost and earlier sentinel
   passes; select its sentinels with chooseSentinels and exampleMargin then. No
   confirmation, listener version or retirement.

### Predictions and contradictions

| # | Prediction | What contradicts it |
|---|---|---|
| 1 | All 40 held performances pass cursor gates; 240/240 events reached within 0.2 s, no ahead exposure; cursor remains on preceding event throughout each added pause up to resumption. | A failed example/event, ahead exposure or movement/abstention during the inserted pause. |
| 2 | All 40 pass assessment: 240/240 matched notes, 200/200 intervals within tolerance, overall error <=5%, zero false findings and zero flags. | Any failed component, omitted/wrong note or false finding. |
| 3 | All 80 paired controls pass both outputs; 8 clean parents plus 16 controls and all 24 earlier sentinels retain passing gates and verified artifacts. | Any control claim/failure or regression. |
| 4 | All 720 fresh prefixes plus 246 cited active prefixes pass; sustained <=0.005 and p99<=0.5 ms (predictions, tighter than approved gates); prior states unchanged, held-note substage passed, no version/retirement/confirmation. | Any prefix failure, predicted cost excess, or different state. |

### Decision rules

- **D1 pass:** every active example, both declared pools, earlier sentinel and
  prefix/cost gate passes with valid construction/provenance. Record held-note
  hesitation passed and preserve incumbent/earlier states. Next is a rushed bar.
  The tighter predicted cost bounds and pause-only diagnostic do not override the
  approved gates: a contradiction there is recorded separately with its cause.
- **D2 resolved failure:** valid measurement but any required gate fails. Preserve
  component failures, reopen affected prior stages, keep held-note open, rank repair
  of the lowest open substage first. An unchanged-version diagnostic adds no failing
  listener version. The batch may continue.
- **D3 infrastructure:** failure before measurement is retained with zero measured
  examples; failure while measuring retains all completed records; failure writing
  the final record retains completed measurements with no verdict until repaired.
  Diagnose first, allow one technical rerun as g032a-held-note-hesitation with the
  same question/listener/evidence/method, runner defects only. Completed hashed
  records may be reused if their producers/inputs are unchanged. If still unresolved,
  no promotion and the batch closes at 3/5. Evidence fitting no branch is
  inconclusive and also closes the batch. Never rerun a musical failure.

### Carried-over stopping count, budgets and preflight

Unchanged from [031 after g031b](031-other-bars-reporting.md#resulting-stopping-count-budgets-and-evidence-access-after-g031b):
**0 consecutive failing listener versions**, three development listener versions,
six completed listener comparisons; all six qualification versions, twelve assessment
slots and all reserved/final accesses unused; Winner bars 5–8 unexamined. This
unchanged-version diagnostic adds one completed comparison, no version. Full sweep
last g031b, next due by036 or earlier batch end034. No user question is asked; any
needed decision goes in the results and research log, per this session's direction.

Preflight: only main checked out, no active owner/report/ledger/run/private032 ID;
listening-032 isolated worktree acquired, dependencies installed once, ffmpeg present,
required parent sets/g031b records readable, private output write probe passed.
No prerequisite evidence is substituted. No new gate/range/product decision is
needed here; recorded-guitar gates remain a standing future user decision.
