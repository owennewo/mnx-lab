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
