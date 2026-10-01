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

## Results

**D1: held-note hesitation passes.** The unchanged event-chain@3 held through
all 40 inserted pauses while the preceding sine remained audible, reached every
event within the approved deadline and assessed every note and interval correctly.
Every control, clean parent and earlier sentinel passed. This is one substage pass,
not completion of stage 2 or evidence for recorded guitar.

[g032-held-note-hesitation](../runs/g032-held-note-hesitation/summary.json)
completed once in **11.080 s**, at `cee5bff178d25071a3ddada16ca6652b8a87fea8`, pinned by
`g032-held-note-hesitation-source`. The pre-registration landed/pushed at
`9895e657` before implementation, stimulus generation or measurement and remains
unchanged. Public summary **44,082 bytes**, SHA-256 `1925e9ce3ed85b154376e768a0e383372f35529b6e96cd7981543a4877c74185`.
Each detailed record was written/hashed immediately after its measurement; a dry
public-record assembly passed before measurements. No infrastructure attempt failed
and no technical or musical rerun occurred.

### Both outputs, controls and regressions

| Evidence | Performances / controls | Cursor pass | Assessment pass | Events reached | Notes matched | Intervals within tolerance |
|---|---|---|---|---|---|---|
| Held-note pauses and paired controls | 40 / 80 | 120/120 | 120/120 | 240/240 | 240/240 | 200/200 |
| Clean parents, including half speed | 8 / 16 | 24/24 | 24/24 | 48/48 | 48/48 | 40/40 |
| Additional earlier sentinels (after deduplication) | 9 / 8 | 17/17 | 17/17 | 96/96 | 96/96 | 87/87 |
| Entire active suite | 57 / 104 | 161/161 | 161/161 | 384/384 | 384/384 | 327/327 |

All **24 earlier sentinels** pass (seven overlap clean parents). No false findings
occur anywhere. The held/clean sets emit zero bar flags; the four-bar sentinels
retain four correct slow flags. Both declared new-substage pools (own 144 and
held-only 120) pass separately. Missing/wrong/dead finding recall, missing-event
recovery and extra-note hold have no positive cases in this experiment.

| Held-performance measure | Result |
|---|---|
| Cursor throughout each added pause | 40/40 holds; no movement or abstention |
| Supported-time on event | 100% after the instrument's acquisition/deadline exclusion |
| Ahead exposure | 0 s |
| Maximum event acquisition delay | 48.104 ms |
| Resumed-event acquisition delay | 27.875–47.875 ms |
| Maximum interval-duration error | 16.667 ms |
| Maximum overall-tempo relative error | 0.4367% |
| False findings / bar flags | 0 / 0 |

100% is the audited instrument's supported **answerable** denominator; it does not
mean the cursor moves at zero latency. The entire active suite's minimum on-event
fraction is 99.448%, maximum delay 48.625 ms, maximum interval error 17.625 ms and maximum
overall error 0.5026%. Silence and distant-w2 controls reject and claim no score note
played and no tempo.

### Construction and the silent counterparts

The private manifest freezes **40 full rendered boundary lists**, each with exact
sample onsets and a single changed preceding-note end. All 40 reproduce the original
silent counterpart's cursor segments and onsets exactly. Every PCM sample outside
that note's original release-through-new-release region is unchanged. The predecessor
keeps its phase and amplitude, with one 10 ms release at resumption; no overlap, extra
onset, frequency change or decay is introduced. The 40 examples are transformations
of two authored scores at fixed locations, not 40 independent players.

Read-only paired diagnostics verify each g031b silent artifact by hash. In 39/40
pairs the held note delays resumed acquisition by up to 20 ms and moves the adjacent
interval estimates by equal/opposite amounts; one pair is unchanged. Overall and
interval gates still pass. The likely cause is the changed mixed-pitch release window
and confirmation history, inferred from the period estimator and frozen trace; phase
and release effects have not been independently isolated. This does not establish
anything about overlapping notes or decaying guitar.

### Provenance fallback, causality and cost

The pre-registered conservative reuse guard checks every existing TypeScript file
pinned by g031b. It found **one changed file**, `bench/src/stages/compare031.ts`,
which was extended after g031b's measured source to read completed-run artifacts.
This is a read-only diagnostic, outside the listener, seam runner and evaluator's
import graph; their bytes are unchanged. Nevertheless the fixed guard chose its
allowed fresh-execution fallback. Thus **161 examples ran fresh, 0 reused** rather
than the predicted120 fresh / 41 reused. All 966 fresh prefix checks pass; none is counted
as cited. No listener changed and this was not a failed infrastructure attempt.

After measurement, a separately hashed identity check verifies every old selected
artifact and finds **41/41 fresh decision records, raw reports, following evaluations
and assessment evaluations exactly equal to g031b**. That check was written after
the run, explicitly distinguished from the runner's per-example hashing. The
`groups.regressions` field is the zero-sized **reused-record** subset, so its vacuous
`passed:false` is not a regression verdict; the actual regression evidence is the
41 fresh records and the 24 passing sentinel checks.

| Cost (Intel Core i7-8750H, Node22.22.1; provisional host only) | Result | Approved gate |
|---|---|---|
| Maximum sustained ratio (initialization and finish included) | 0.002294 | <=0.25 |
| Maximum chunk p99 | 0.192189ms | <=10 ms |
| Maximum backlog | 0ms | informational |
| Prefix checks | 966/966 | every check |
| Evaluation wall time | 11.080s | routine target about 2 minutes |

| Artifact | Path / hash |
|---|---|
| Frozen set | `/home/williao/dev/mnx-listening-data/contract2-held-note-hesitation-v1/manifest.json`; `716ecb099ec8e0a501af16ca123f265deba584a77e55542433e96defdecba650` |
| Measured details | The summary's `results`, `measures`, `pairedDiagnostics` and `validation` artifacts, each with an absolute private path and SHA-256 |
| Post-run identity check | `/home/williao/dev/mnx-listening-data/diagnostic-runs/g032-held-note-hesitation/post-run-regression-identity.json`; `696b03fd35f59f86e4feb8c921a10b1f34c1ae8ef8dda969d4241e1251db8110` |

No shared harness, frozen baseline, listener, evaluator, oracle, contract, score or
previous set is edited. The baseline evidence remains cited from g031b without
fresh baseline execution. Preparation caught a wrong output working directory and
a sentinel-kind TypeScript annotation before the committed source; these consumed
no measurement attempt and changed no frozen prediction.

## Against the predictions

| # | Verdict | Evidence |
|---|---|---|
| 1 | Held | 40/40 cursor passes; 240/240 events; zero ahead; every pause holds |
| 2 | Held | 240/240 matched notes; 200/200 intervals; zero false findings/flags; overall error <=0.4367% |
| 3 | Held | All 80 held controls, 24 clean parents/controls and 24 earlier sentinels pass; 41 historical artifacts and fresh outputs verified identical |
| 4 | Mixed: prefix-reuse counts contradicted; quality/cost/state held | The allowed fallback gives 966 fresh / 0 cited rather than 720 fresh / 246 cited prefixes, all passing; ratio 0.002294, p99 0.192189 ms; held passed, earlier states unchanged |

## Decision

**D1 applies**: every active example, both required pools, every earlier sentinel
and every prefix/cost gate passes with valid construction and provenance. The
count prediction's contradiction is explained by the pre-registered fallback and
cannot turn these fresh passing measurements into a failure or a reuse claim.

event-chain@3 remains incumbent. Held-note hesitation becomes **passed**, with
sentinels chosen by the frozen margin rule. Earlier states stay stage 1 confirmed,
silent hesitation/slowedBar/four-bar passed. Existing sentinel IDs stay frozen;
the new seven sentinels add four unique active IDs (routine union 28). One new
sentinel is clean `s2-99`: its delay margin ties the two selected held examples,
and the approved ASCII tie-break selects it. Preserve this result rather than
hand-picking harder examples. No substage confirmed and nothing retired; earlier
sentinel-only checks do not count as new full-set passes for retirement.

The suite's obsolete root audit3-pending label and stale version3-failed labels
are aligned with the already recorded audit4/g031b verdict; their historical
records remain intact. No oracle was created/re-versioned, so no oracle audit is
due. This session runs no auditor or process reviewer.

### Resulting stopping count, budgets and evidence access

**0 consecutive failing listener versions**, **three** development listener
versions, **seven** completed listener comparisons (this adds one unchanged-version
diagnostic). All six qualification versions, twelve assessment slots and every
reserved/final access remain unused. Winner bars 5–8 unexamined. Full sweep last
g031b, next due by 036 or earlier at batch end 034, new gates or a whole-stage claim.
Batch advances to **3 of 5**, with 033–034 remaining; no early-closing condition applies.

## Next

Next is **one rushed bar**, the next deviation in contract 2's order, with current
sentinels and clean/control evidence. The held-note case supplies no new permission
to skip that stage. Avoid treating a changed independent diagnostic file as a changed
output producer in future reuse guards: pin the actual producer/import closure and
keep checking inputs and raw records. This is efficiency advice, not a change to
this experiment's frozen guard or evidence.

Direction of travel: event-state holding and offline inter-onset reporting are
plausible parts to keep through chords, longer scores and guitar. The zero-crossing
sine estimator and constant, non-overlapping sustain assumptions will need richer
acoustic treatment there. This result supplies no chord, decay, real-music or
missing/wrong/dead/extra-note claim.

**Awaiting the user:** nothing new for the next experiment. The standing requirement
for evidence-based gates before recorded guitar (stage 4), and later qualification
and Studio product decisions, remains. The session direction is recorded verbatim:

> You cannot ask the user questions: record anything that needs them in your report and the research log.

## Attribution and validation

Designed, implemented, executed and recorded by **Sol 6.1 (high) in Codex**, as
specified by the user. Pre-registration landing gate passed 492 bench tests plus
37 targeted root tests, static checks and build. Two new stimulus boundary tests
and bench TypeScript passed before source commitment. Report export verifies all
pinned source hashes; the final rebased-tree gate is required before landing.
Stop after landing and retiring listening-032; do not start 033.
