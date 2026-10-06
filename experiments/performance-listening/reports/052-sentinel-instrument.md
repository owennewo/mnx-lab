# 052 — The sentinel instrument for the guitar stages

## Pre-registration

2026-10-06. **Claude Opus 5.5 (high) in Claude Code**, as the launching session stated.
Question 43, the top open question, and step 3 of
[the promotion plan](../../../roadmap/inprogress/lab-listening-promotion.md#3-the-sentinel-instrument-first-experiment-of-the-next-batch).
No batch is open. This experiment runs no listener and measures no lag or cost, so it
needs neither a quiet host nor the user's grant of solo access
([third amendment, decision 5](../contracts/development-contract-2.md#amendment-2026-10-06-promotion-and-a-fast-loop)).

### Question and why

Does a new stage-gates version implement R10's sentinel rule, adopted by the user in
[the second amendment, decision 3](../contracts/development-contract-2.md#amendment-2026-10-05-host-stalls-guitar-sweeps-sentinels-and-the-outside-review)
(deviation examples only; ties on margin broken by severity in the direction of
difficulty before name), together with a guitar margin that drops the retired chunk-p99
entry, so that it reproduces independently hand-worked cases; and what does it choose
when applied to 050's recorded evidence for the new incumbent?

The routine runs that the third amendment makes fast evaluate "the substage attempted and
the sentinels of passed substages". Guitar stage 1 and silent hesitation are passed and
have no sentinels yet, so no routine run can be planned until this exists. R10 found that
on the sines most examples tied at the third pick, because the limiting margin was
hop-quantised, and the name decided, so no half-speed example was ever a sentinel.

**Alternatives the run distinguishes.** (a) On guitar the limiting margin is the
compute-inclusive event delay or the sustained cost, both continuous host timings, so
exact ties vanish and R10's tie-break changes nothing: the sentinels are then chosen by
measured timing. (b) Ties persist (for example through hop-quantised delays that compute
does not perturb, or identical interval errors), and the tie-break decides some
sentinels. (c) A musical gate (interval, overall tempo, on-event time) limits some
examples, so the sentinels track musical difficulty rather than timing. Counting the
limiting entry and the exact ties over all 576 examples separates them.

### Stage, method and evidence

1. **The instrument, frozen first.** [Event instruments 5](../contracts/event-instruments-5.md)
   defines stage-gates@3 and [event-oracle@5](../bench/oracle-events/oracle-5.json)
   (frozen in [freeze-5.json](../bench/oracle-events/freeze-5.json)) holds 12 margin,
   10 selection and 8 refusal cases, hand-worked from those rules with synthetic inputs.
   Both land with this pre-registration, before any implementation and before any
   margin is read from recorded evidence. Severity, for the substages this version
   defines: base stage 1 (−tempo); hesitation (pause, −tempo); slowed and rushed bar
   (|factor − 1|, −tempo). Any other deviation is refused until a later version
   defines it.
2. **Implementation.** `bench/src/events/gates3.ts` beside an unchanged `gates2.ts`, a
   loader and validator for oracle 5, and a bench test that checks every case and a few
   deliberately wrong answers. stage-gates@2, oracles 1–4 and their tests are not
   edited.
3. **The run, `g052-sentinel-instrument`.** A runner that refuses to run until its code
   and this pre-registration are committed (and this pre-registration is on
   `origin/main`), refuses an existing run ID, and resolves sources from a tagged commit
   (`g052-sentinel-instrument-source`). It verifies by hash g050's public summary
   (`eb6b51c7…`) and private `results.json` (`9f3f3031…`) and the frozen manifest of
   `contract2-challenger-guitar-noise-v1` (`961d5dce…`), joins each control to its
   parent through the manifest, and computes the stage-gates@3 margin of every one of
   the 576 challenger examples (192 performances, 384 controls), recording each
   example's limiting entry. It then chooses sentinels for the two passed guitar
   substages, **guitar stage 1** (base: the 32 clean performances and their 64 controls)
   and **silent hesitation** (160 hesitation performances and their 320 controls), with
   the four development guitars pooled as the pass pooled them. No listener, evaluator
   or inference runs: the margins are computed from the recorded following and
   assessment evaluations, cost ratios and prefix results.
4. **Comparisons, informational.** (i) The same pools chosen with stage-gates@2's rule
   (no deviation filter, ASCII tie-break) over the same p99-free margins, to show what
   R10's rule changes. (ii) The least margin and limiting entry per held-out guitar from
   g051's recorded evidence (hash-verified), which is examined confirmation evidence and
   is **not** a sentinel source under the contract's rule (a substage's sentinels come
   from its passing evaluation, the development sweep). Neither comparison selects
   anything.
5. **Records.** Private per-example margins written first, to
   `mnx-listening-data/instrument-runs/g052-sentinel-instrument/margins.json`, with its
   hash; then a public `runs/g052-sentinel-instrument/summary.json` (provenance, pinned
   sources, sentinels, counts) whose shape is dry-assembled before any margin is
   computed; then **`bench/suite-record-guitar.json`**, format `contract2-suite@2`, for
   the new incumbent `basic-pitch-chain@5-note-output` (live) / `basic-pitch-chain@2`
   (offline), citing 050 and 051 by hash, with `"selection": "provisional"` until the
   audit. The sine suite record stays as it is. Expected run time: seconds.

### Numbered predictions

1. **Agreement.** stage-gates@3 reproduces all 30 event-oracle@5 cases (margins to
   1e-12, selections exactly, every refusal refused) and each injected wrong answer is
   detected; the oracle 1–4 tests still pass. Contradicted by any disagreement.
2. **No refusal on g050.** All 576 challenger examples verify and receive a finite margin
   in [0, 1]. Contradicted by any refusal or hash mismatch.
3. **Timing limits everything.** Every performance's limiting entry is an event delay or
   the sustained cost, and every control's is the sustained cost. Contradicted by any
   example limited by an interval, overall tempo, on-event, ahead, exposure, episode or
   rejection entry.
4. **No ties, so the tie-break is inert here.** No two candidate performances of a
   substage share a margin exactly, nor do two candidate controls of the same kind and
   performed score; the stage-gates@3 selection equals the stage-gates@2-rule
   comparison for both substages. Contradicted by any exact tie or any difference.
5. **The tightest performance** is a silent-hesitation example on `spanish` with margin
   1 − 0.162731/0.2 ≈ 0.1863 (to 1e-4), from 050's published maximum event delay of
   162.731 ms, and it is that substage's first sentinel. Contradicted by a lower margin
   anywhere, or a different first sentinel.
6. **Held-out is tighter than development.** g051's least performance margin is below
   g050's, from 051's published maximum delay on `shinyguitar` (about 185 ms, margin
   about 0.075). Contradicted by a held-out minimum at or above 0.1863.

Not predicted, reported: which guitars, tempi and pauses the six performance sentinels
cover.

### Decision rules, fixed now

- **D1, instrument ready for audit.** Prediction 1 holds, and the run verifies g050 and
  writes margins, summary and the guitar suite record. The selection is recorded as
  provisional; question 43 becomes the independent audit of event-oracle@5, on a model
  other than Claude Opus, before the selection comes into force; question 57's first
  routine run follows the audit and needs the user's grant of solo access. Predictions
  2–6 are findings about the evidence: whichever way they fall, they are recorded and do
  not change D1, except that a refusal under prediction 2 is D3.
- **D2, oracle and implementation disagree.** If the cause is an implementation fault,
  fix the implementation before the run (no oracle edit) and record the fault. If the
  frozen oracle itself is wrong, it is not edited: record the error, write no suite
  record, and make a corrected oracle version the next question.
- **D3, evidence or infrastructure.** A hash mismatch or a refused g050 example: no
  selection, record the evidence and what is needed. A runner failure **before**
  measuring (before margins are written) is diagnosed, the failed attempt is preserved,
  and the run is repeated once as `g052a-sentinel-instrument` after the fix is
  committed. A failure **after** the margins file is written and hashed (in the summary
  or suite-record writer) is repaired and the records are assembled from that saved
  file, without recomputing it; the failure is recorded.
- **Mixed.** If predictions 3 or 4 fail (ties or musical limits occur), D1 still applies,
  and the report says how much the tie-break or a musical gate decided. If prediction 5
  or 6 fails, the report records it against the published aggregates and checks the
  join before anything else.

### Carried state

Unchanged since [051's resulting state](051-challenger-heldout-confirmation.md#resulting-stopping-count-budgets-and-evidence-access)
apart from the promotion: the challenger's count and budgets are now the main track's
([third amendment, decision 1](../contracts/development-contract-2.md#amendment-2026-10-06-promotion-and-a-fast-loop)).
Stopping count **0**; 5 implementation versions and 10 development comparisons;
`event-chain@3` frozen with its 3 versions and 11 comparisons. Exploration budget spent;
the held-out one-shot consumed (the three held-out sounds are examined evidence);
qualification 6 versions and 12 slots unused; reserved and final evidence and Winner
bars 5–8 untouched; sines retired. Last full sweep 050; the next is due no later than
055. Instrument work adds no listener version and no comparison. No other experiment
had an owner at pickup: `main` was the only worktree, and 052 was unused in the
reports, runs, tags and private directories.

## Results

**D1: the instrument agrees with its oracle, and the guitar sentinels are chosen,
provisionally until the audit.** stage-gates@3 reproduces all 30 event-oracle@5 cases
and catches all 9 injected faults. All 576 challenger examples of g050 verify by hash
and receive a margin; none is refused. The run took 1.7 s of measured time (4.7 s wall),
read no audio and ran no listener.

| Check | Result |
|---|---|
| event-oracle@5: margin, selection, refusal cases | 12/12, 10/10, 8/8 agree |
| Injected faults detected | 9/9, including stage-gates@2's rule failing K1 and K2, and a p99 entry kept on a guitar stage failing G3a |
| g050 summary, results, manifest and 576 per-example artifacts | all hashes agree |
| Examples refused | 0 of 576 |
| Read-only verifier (`bench/src/stages/verify052.ts`) | 576 margins recomputed exactly; selection and suite record agree |

### What limits each example

| Pool | Event delay | Sustained cost | Interval | Other |
|---|---:|---:|---:|---:|
| Stage 1, 32 performances | 28 | 4 | 0 | 0 |
| Silent hesitation, 160 performances | 125 | 33 | 2 | 0 |
| All 384 controls | — | 384 | — | 0 |

Exact margin ties: none among stage 1's performances or any control group; one pair among
the hesitation performances, `tonejs-acoustic-h-s1-99-500` and `martin-h-s1-99-500` at
0.407822, both limited by the same interval error (hop-quantised, as on the sines). They
rank 126th and 127th of 160, so the tie-break decided nothing.

### The sentinels

| Substage | Sentinel | Kind | Margin | Limited by | Severity |
|---|---|---|---:|---|---|
| guitar stage 1 | `martin-s2-63` | performance | 0.236550 | delay 152.690 ms | tempo 63 |
| | `spanish-s2-63` | performance | 0.239159 | delay 152.168 ms | tempo 63 |
| | `fender-s2-63` | performance | 0.239301 | delay 152.140 ms | tempo 63 |
| | `noise-tonejs-acoustic-s1-90` | s1 silence | 0.316518 | cost | tempo 90 |
| | `spanish-w2-s1-63` | s1 wrong score | 0.385881 | cost | tempo 63 |
| | `noise-spanish-s2-99` | s2 silence | 0.385051 | cost | tempo 99 |
| | `spanish-w2-s2-99` | s2 wrong score | 0.350343 | cost | tempo 99 |
| silent hesitation | `spanish-h-s2-45-1000` | performance | 0.186344 | delay 162.731 ms | pause 1 s, tempo 45 |
| | `martin-h-s2-90-500` | performance | 0.200245 | cost 0.19994 | pause 0.5 s, tempo 90 |
| | `fender-h-s2-63-700` | performance | 0.226387 | delay 154.723 ms | pause 0.7 s, tempo 63 |
| | `noise-spanish-h-s1-99-300` | s1 silence | 0.319104 | cost | pause 0.3 s, tempo 99 |
| | `spanish-w2-h-s1-99-2000` | s1 wrong score | 0.339207 | cost | pause 2 s, tempo 99 |
| | `noise-fender-h-s2-63-1000` | s2 silence | 0.329001 | cost | pause 1 s, tempo 63 |
| | `spanish-w2-h-s2-99-300` | s2 wrong score | 0.290090 | cost | pause 0.3 s, tempo 99 |

The routine suite these make is 14 examples (`routineRegressionIds` in the summary and
the suite record). The stage-gates@2 rule over the same margins chooses exactly the same
14: on this evidence R10's rule changes nothing, because the guitar margins are
continuous and the hesitation set has no clean parents in it.

Coverage, reported rather than predicted: all six performance sentinels are on s2;
Martin, Spanish and Fender have two each and `tonejs-acoustic` none; stage 1's three are
all at tempo 63, so no half-speed example; the hesitation sentinels have pauses of 1,
0.5 and 0.7 s, so neither the 2 s pause nor the 0.3 s one. Every performance sentinel is
a timing margin, and every control sentinel is a cost margin.

### Held-out, informational

| Held-out guitar | Least performance margin | Limited by | Least control margin |
|---|---:|---|---:|
| `shinyguitar` | 0.075401 (`shinyguitar-s2-99`) | delay 184.92 ms | 0.351201 |
| `tonejs-electric` | 0.183502 (`tonejs-electric-h-s1-63-2000`) | delay 163.30 ms | 0.359648 |
| `tonejs-nylon` | 0.232649 (`tonejs-nylon-h-s2-63-700`) | delay 153.47 ms | 0.349407 |

The tightest known example on any guitar is a held-out one, with less than half the
development minimum's margin. Under the contract's rule it chooses no sentinel.

### Two exploratory observations, not pre-registered

Both read only the saved margins and g050's per-example records.

1. **The stage-1 sentinels are one systematic event, and timing noise picks the guitar.**
   On Martin, Spanish and Fender the latest event of every s2-at-63 performance is event 5
   of 8, at 152.14–152.69 ms clean and 152.10–153.91 ms with a 1 s pause, while
   `tonejs-acoustic` reaches its latest event in about 146.4 ms. So the hardest stage-1
   case is real and repeatable (s2's sixth note at 63 bpm, on three of four guitars); which
   of the three guitars becomes a sentinel is decided by 0.55 ms.
2. **Control margins are dominated by host timing.** The 48 groups of four silence
   controls that share one audio file and one handed score, one per guitar, differ only
   in when they ran; their cost margins spread by a median of 0.089 (90th percentile
   0.123, maximum 0.167), against a range of 0.317–0.494 across all 192 silence controls.
   A remeasurement would very likely choose different control sentinels.

## Against the predictions

| # | Outcome | Evidence and limit |
|---|---|---|
| 1 | Held | 30/30 cases, 9/9 faults; oracle 1–4 tests unchanged and passing |
| 2 | Held | 576/576 verified and ranked, 0 refused |
| 3 | Contradicted, in part | 190 of 192 performances and all 384 controls are timing-limited, but two hesitation performances are limited by an interval error (margin 0.4078, far from selection) |
| 4 | Contradicted, in part | One exact tie (the interval-limited pair, ranks 126–127); the selection equals the stage-gates@2-rule comparison in both substages, so the tie-break decided nothing |
| 5 | Held | `spanish-h-s2-45-1000`, 0.186344, first silent-hesitation sentinel |
| 6 | Held | Held-out least margin 0.075401 on `shinyguitar`, below 0.1863 |

## Decision

**D1.** Prediction 1 holds and the run wrote the margins, the summary and
`bench/suite-record-guitar.json`, with `"selection": "provisional"`. Under the mixed
clause: musical gates limited 2 of 576 examples and one exact tie occurred, but neither
reached the selection; on g050, R10's rule chooses what stage-gates@2's would have.
Question 43 now becomes the **independent audit of event-oracle@5**, by a session on a
model other than Claude Opus, under the revised
[AUDITING_AN_ORACLE.md](../AUDITING_AN_ORACLE.md) (every case of oracle 5 is new, so all
30 are re-derived; unchanged inherited rules are cited by hash). Its agreement puts the
selection in force; question 57's first routine run follows it and needs the user's
grant of solo access.

### Resulting stopping count, budgets and evidence access

Unchanged from the pre-registration's carried state: stopping count 0; 5 implementation
versions, 10 development comparisons; no listener version or comparison added. Held-out
evidence was read only as recorded margins (no listener, no audio), and remains
examined, sweep-only evidence. Qualification, reserved and final evidence and Winner
bars 5–8 untouched. Next full sweep due no later than 055.

## Next

1. **The audit of event-oracle@5** (question 43's remainder), on Sonnet or a Sol model.
2. **Then question 57**, the first routine run on these 14 examples, after the user's grant
   of solo access. Expected to be well under five minutes: 14 examples, with offline
   observations reused by hash.

**For the user, two choices about the routine suite, neither needed for the audit.** The
rule as adopted works, and it is inert on guitar: the margins are timings, and the
sentinels it picks are the tightest timing cases, which is the right thing for a lag- and
cost-limited listener to re-test. But it leaves gaps a routine run will not see:

- **Per-guitar coverage.** No `tonejs-acoustic` performance and no s1 performance is a
  sentinel, and the guitar chosen among the three tied-by-structure examples is decided
  by sub-millisecond noise. *Recommended:* one performance sentinel per development
  guitar per substage (the least-margin one), in place of three overall: 8 performance
  sentinels instead of 6, controls unchanged, about 16 examples a routine run. This
  tightens the rule but changes one the user adopted, so it is theirs to decide, and it
  would be stage-gates@4 with its own cases.
- **The held-out tightest case.** `shinyguitar-s2-99`, at 185 ms, is the closest any
  example has come to the 200 ms deadline, and as sweep-only evidence a routine run will
  not repeat it. Admitting the examined held-out sets' least-margin examples as sentinels
  would keep it under watch. The contract chooses sentinels from a substage's passing
  evaluation, so this too is the user's call.

R18 judged a numbered experiment plus audit heavier than sentinel selection needs. This
run supports that for the selection itself (seconds of bookkeeping, no tie decided by the
new rule); the audit is still owed under the second amendment as written.

**Direction of travel.** The margin, pool and severity code is score- and sound-agnostic
and should survive chords, microphones and longer scores; each new deviation needs a
severity row before its substage can choose sentinels. What will not survive is the
assumption that margins rank musical difficulty: on guitar they rank host timing, so on a
target device (stage 4) the sentinels will be re-chosen there and may differ.

## Attribution

Pre-registration, event instruments 5, event-oracle@5, stage-gates@3, the run, the
verifier and this record by **Claude Opus 5.5 (high) in Claude Code**. One run, no
repeat; no listener executed; no lag or cost measured.
