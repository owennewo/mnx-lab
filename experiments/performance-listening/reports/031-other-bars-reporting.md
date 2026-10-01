# 031 — Report bar flags against the other bars, in a full sweep

## Pre-registration

2026-10-01. **Claude Opus 5.5 in Claude Code**, terminal/TypeScript/tsx/Vitest.
Run 2 of the research log's five-experiment main-track batch. One new listener
version, **event-chain@3**, and the full sweep that is due no later than this
experiment.

### Question, and why it is next

Can a listener that changes **only its end-of-piece bar-reporting policy** to the
approved other-bars reference with three-other-bar eligibility
([instruments 3](../contracts/event-instruments-3.md), audited through
[audit 4](../bench/oracle-events/audit-4.md)) clear the reopened silent-hesitation and
slowed-bar substages and pass the frozen four-bar tempo evidence, while its live
cursor, note statements, overall tempo and intervals stay exactly event-chain@2's?
This is the research log's top question (17). [030](030-current-instruments.md)
isolated the reopening to obsolete whole-piece-median flags: every cursor, note,
interval and control passed, and all 67 false findings and all 18 per-example
failures were short-score flags on bars that the approved rule makes ineligible.
Hesitation is the lowest open substage, so it comes first; the held-note hesitation
and later deviations wait.

Question 18 is joined to it: 030 deferred the full sweep that
[contract 2](../contracts/development-contract-2.md#keeping-the-suite-lean-the-rising-tide)
requires at least every fifth experiment (the last full comparison was 026), and a
stage claimed passed also requires one. Both questions are answered by one run; the
listener verdict and the sweep's baseline observations are reported separately.

**Alternatives this distinguishes.** (a) The reopening is purely reporting policy:
then @3 passes everything @2 passed and clears the flag pools. (b) The other-bars
reference exposes onset-estimate weakness that the whole-piece median hid: then
four-bar slow recall falls below the approved 90%, or false alarms appear where a
slowed neighbour sits in a bar's reference. (c) The copy that creates @3 has
disturbed its live or musical path: the identity checks below fail. Separate
cursor, note/interval, flag and identity measures tell these apart. No external
research is needed: the change implements an already approved and audited
definition, and the frozen @2 implementation and 030's records are the evidence
for everything else.

### The change, the only one

`bench/src/listeners/eventChain3.ts` is a new file, a byte-for-byte copy of
event-chain@2's start, feed and token alignment, with its own identifier. Its
`finish()` keeps @2's tokens, note statements, overall tempo and intervals and
changes only the tempo flags, emitting `assessment-report@3`:

- each bar's local tempo sums the intervals that **end** in it, as before;
- its **reference** is the score-distance-weighted median of the local tempi of the
  intervals ending in every **other** bar (the same median rule, exact-half mean
  included), and `otherBars` counts the distinct bars those intervals end in;
- a bar is **eligible** when local tempo and reference exist and `otherBars >= 3`;
  only an eligible bar is flagged, `slow` at ratio `<= 0.9`, `fast` at `>= 1.1`,
  the same comparisons @2 made against the whole-piece median;
- `tempo.bars` carries every bar's summary, eligible or not.

The listener computes this itself from its own intervals and the compiled score; it
does not import the evaluator. A unit test holds its bar summaries to the audited
instrument's `summarizeBars` on hand-built interval sets (exact-half median, a bar
with no intervals, a bar with no other contributors, an omission spanning bars).
The threshold, the onset estimator and everything live are deliberately unchanged:
one change per version, so the four-bar boundary misses 030 saw are expected to
remain.

### Method fixed before execution

1. Land this pre-registration before implementation or evaluation. Preserve every
   existing listener, instrument, oracle, baseline, score and set byte. New run
   **g031-reporting-sweep**, tag **g031-reporting-sweep-source**; the runner refuses
   uncommitted code, a pre-registration changed since it landed, or an existing run ID.
2. **The full sweep.** Every example of every set in the [suite record](../bench/suite-record.json),
   none retired: all **264** of `contract2-slowed-bar-v1` (stage 1's 24, the 120
   hesitations, the 120 slowed bars, controls included) and all **252** of
   `contract2-four-bar-tempo-v1`. Verify both frozen manifests and every asset first.
   Known top/all parts, handed 90, 48 kHz / 480.
3. **event-chain@3 runs fresh on all 516** (it is a new producer), with six prefix
   checks per example and cost measured per example, finish included. Judged by the
   audited following-evaluator@2, assessment-evaluator@3 and stage-gates@2, unchanged.
4. **Identity against @2.** For every example, compare @3's live decision record with
   @2's stored record (g027a's artifacts for the 264, g030's for the 252, each
   verified by hash), and @3's note statements, overall tempo and intervals with @2's
   raw report. Both must be identical, decision IDs included. @2 is not rerun: its
   current-instrument evaluations are cited from [g030](../runs/g030-current-instruments/summary.json).
5. **The frozen baselines** (clock-follower@1, online-time-warp@8, @12, @14) are part
   of the sweep. Their records on the 264 historical examples are cited from g026
   (which carries g025's), only after checking every TypeScript producer at g026's
   commit is byte-identical now and every record artifact matches its hash; their
   following is re-evaluated and must equal the stored evaluation. They have **no
   record on the four-bar set, so they run fresh on all 252**, through the unchanged
   legacy adapter, cost measured, with six prefix checks on four fixed examples each:
   `s3-90`, `sb-s3-45-b2-50`, `sil-s3-90`, `w2-s3-90`, as 026 checked a subset.
   They make no assessment, so they fail every performance; they are reported as
   comparators and instrument sanity checks and never affect @3's verdict.
6. Not in the sweep, and why: `contract2-stage1-v1`/`v2` hold the same performance
   audio as v3, and v2's `w1` near-miss controls are stage-2 wrong-note evidence for
   a substage not yet attempted; event-chain@1 is a retired development version
   whose records are cited in g027a; the Winner clip has chords, which no event chain
   accepts, and is never used to select a listener.
7. **Verdicts and suite state.** Per example: cursor, assessment, causality and cost.
   Pools per substage (stage1, hesitation, slowedBar, four-bar), controls never
   pooled. Missing or refused output, absent cost or incomplete prefix checks fail.
   States follow stage-gates@2's `nextState` with `fullSweep: true`: a substage that
   passes with all earlier sentinels passing becomes `passed` from open, and
   `confirmed` from passed. Because this is a full sweep, sentinels are **re-chosen
   for every passing substage** by the frozen rule (`exampleMargin`, `chooseSentinels`);
   a failing substage keeps its old sentinels and reopens. Retirement needs three
   successive incumbent passes; @3 has one evaluation, so nothing retires. The suite
   record names @3 as incumbent only if D1 applies.
8. Expected time: @3 about one minute; the fresh baselines on about 4,006 s of
   four-bar audio at their recorded 0.13 real-time ratio, roughly 25–40 minutes.
   A full sweep is not a routine run, so the two-minute target does not apply; the
   time is reported. Diagnose any failure read-only; no tuning, no technical rerun
   for a musical failure; failed infrastructure attempts are kept.

### Predictions

| # | Prediction | What contradicts it |
|---|---|---|
| 1 | Identity: on all 516 examples @3's decision record, note statements, overall tempo and intervals equal @2's exactly; only flags and the new bar summaries differ. | Any difference. |
| 2 | Short scores: @3 emits **no flag** on any of the 264 historical examples, every s1/s2 bar is reported ineligible, and all 264 pass both outputs. Hesitation and slowedBar pools have zero false alarms (030: 35/60 and 16/80 + 16/80); the 18 clean failures pass. | Any flag, any failed example or pool. |
| 3 | Four-bar: the 4 clean performances carry no flag and pass; slowed-bar slow recall is **87–89 of 91**, the two 030 boundary misses (`sb-s3-90-b1-90`, `sb-s3-99-b1-90`) still missed; **zero** slow and fast false alarms; all 252 pass. @3's bar summaries equal 030's promoted summaries to within 1e-9 relative. | Recall outside 87–89, a false alarm, a failed example, or a summary that differs. |
| 4 | All 3,096 @3 prefix checks pass; sustained cost ≤ 0.005 and p99 ≤ 0.5 ms (gates 0.25 and 10 ms). | Any causality or cost gate failing; or cost outside the predicted bound (noted, not a gate). |
| 5 | Suite: stage1 → **confirmed**; hesitation, slowedBar and four-bar → **passed**; sentinels re-chosen; zero retirements. | Any other state. |
| 6 | Baselines: cited records re-evaluate identically; no baseline passes any four-bar performance; every baseline cursor-fails all 21 four-bar performances at 45; the clock fails all 168 four-bar controls; each time warper passes the cursor gates of at least 95% of the 168 four-bar controls. | Any of these failing. |

### Decision rules

- **D1, pass.** @3 passes every example, pool, sentinel, causality and cost check
  of the sweep and prediction 1 holds. @3 becomes the incumbent; states and
  sentinels are recorded as in method 7; the stopping count stays **0** (a version
  that clears the lowest open substage resets it). Next: the held-note hesitation
  (question 19). Prediction 6's baseline observations do not change this verdict;
  a contradiction there is recorded as an open instrument question.
- **D2, resolved listener failure.** Valid infrastructure, but @3 fails any example,
  pool or identity check. Record which component failed. A flag-pool or recall
  failure on four bars is a reporting or onset-precision failure; an identity
  failure is a defect in the version itself. Either way @3 is a version that failed
  to clear the lowest open substage if hesitation is not cleared (count 1),
  otherwise the count stays 0 and the lowest still-open substage is ranked first.
  Substages that pass are recorded as passed by the sweep; failing ones reopen.
  The batch may continue.
- **D3, infrastructure.** A crash, provenance or hash failure, or missing record:
  preserve the attempt, diagnose, and rerun once as `g031a-…` with question, method,
  listener and evidence unchanged; repair runner defects only. If unresolved, the
  batch ends. If baselines alone fail to run, @3's verdict stands on its own
  evidence and the sweep is recorded as incomplete, which leaves the sweep due and
  no substage confirmed.
- Observations fitting no branch are **inconclusive**, recorded as such, and end the
  batch.

### Carried-over stopping count, budgets and preflight

Unchanged from [030's resulting state](030-current-instruments.md#resulting-stopping-count-budgets-and-evidence-access):
**0 consecutive failing listener versions**, two development listener versions,
five completed listener comparisons, all six qualification versions and twelve
assessment slots and every reserved/final access unused; Winner bars 5–8 unexamined;
full sweep due by 031. This experiment adds the third development version and the
sixth comparison. No qualification or reserved evidence is touched.

Preflight: only `main` was checked out before this session's `listening-031`
worktree; no 031 report, ledger row, tag, run or private run directory existed; 030
landed and its worktree is retired. Dependencies installed once; ffmpeg present;
both frozen sets, g026/g025/g027a/g030 private artifacts readable; the private data
root is writable. No question awaits the user.

## Results

**D3, unresolved: an infrastructure outcome, and the batch ends.** Neither run
produced its run record. The one technical rerun the decision rules allowed,
`g031a`, failed at its last step, after every measurement was complete, so no
listener verdict, suite state, sentinel or confirmation is recorded. The private
measurements below are **diagnostic observations, not a verdict**: they come from
a run whose own completion check failed, and their hashes were taken after the
failure rather than by the runner.

### The two attempts

| Run | Source tag | What happened | Cause | Repair |
|---|---|---|---|---|
| [g031](../runs/g031-reporting-sweep/summary.json) | `g031-reporting-sweep-source` | Stopped in the provenance checks before any example was measured | `git show <commit>:<path>` does not normalise `..`; g026 pins repository sources as `../../src/…`, which 030's runner resolved and this one did not | Resolve each pinned path against the repository, as 030 did. Runner only |
| [g031a](../runs/g031a-reporting-sweep/summary.json) | `g031a-reporting-sweep-source` | Measured all 516 examples with event-chain@3 and all four baselines (1,578 s), then refused to write a public summary over the 300 KB size limit | The summary carried every example's result inline, with the source-hash table, and exceeded 300 KB | Per-example results move to a private artifact named by hash (committed after the failure; **not run**) |

Both failures are runner defects of the kind D3 anticipates, and neither touched a
listener, an instrument or the evidence. But the rules fixed before the run say
"rerun once as `g031a-…` … If unresolved, the batch ends", and g031a did not resolve
the infrastructure outcome. A third attempt would be a branch invented after
seeing the results, so it is not made here. Each attempt's `attempt.json` and
`failure.json` are kept in its private directory, and each public summary records
`infrastructure-failed`.

### Diagnostic observations from g031a's private records

g031a's private directory holds 1,532 files: one record for each of event-chain@3's
516 examples, the @3 aggregate, every baseline's records and sweep tables, and the
reuse validation. [`post-failure-inventory.json`](#provenance-of-the-observations)
hashes them all. Read-only analysis of those files gives:

| Evidence | Performances / controls | @3 cursor pass | @3 assessment pass | Pooled flags | Identity with @2 |
|---|---|---|---|---|---|
| Stage 1 | 8 / 16 | 24/24 | 24/24 | No flags; false alarms 0/12 slow, 0/12 fast | 24/24 |
| Silent hesitation | 40 / 80 | 120/120 | 120/120 | No flags; false alarms 0/60 slow, 0/60 fast (030: 35/60) | 120/120 |
| Slowed s2 bar | 40 / 80 | 120/120 | 120/120 | No flags; false alarms 0/80 each way (030: 16/80 each) | 120/120 |
| Four-bar clean + slowed | 84 / 168 | 252/252 | 252/252 | Slow found 89/91; false alarms 0/208 slow, 0/299 fast | 252/252 |

- **Identity.** On all 516 examples, @3's decision record (IDs included), note
  statements, overall tempo and intervals are byte-identical to @2's stored
  outputs. Its bar summaries equal 030's promoted summaries exactly: 1,320 bars,
  no structural difference, relative difference 0 (`bench/src/stages/compare031.ts`).
- **Short scores.** No flag is emitted on any s1/s2 example. Every s1/s2 bar is
  ineligible (at most one other contributing bar), and the 18 clean failures of 030 pass.
- **Four bars.** The two misses are the boundary cases 030 found, `sb-s3-90-b1-90`
  and `sb-s3-99-b1-90`, with truth ratios 0.89999719 and 0.90000000. The four clean
  performances carry no flag. There are no false alarms in either direction,
  including bars whose other-bars reference contains a slowed neighbour.
- **Everything else in the record.** 1,952 performance notes; 1,780 intervals
  (maximum error 18.90 ms); 1,952 events reached (maximum delay 49.29 ms; minimum
  on-event fraction 99.21%); 344 controls rejected, with no claimed note or tempo.
- **Causality and cost.** 3,096/3,096 prefix checks pass; maximum sustained ratio
  0.002445, chunk p99 0.148 ms, backlog 0 ms (i7-8750H, Node 22.22.1, provisional).
- **What the sweep would have recorded.** Applying stage-gates@2 with
  `fullSweep: true`, the aggregate gives stage1 `confirmed` and hesitation, slowedBar
  and four-bar `passed`, with sentinels re-chosen and nothing retired. **None of this
  is written to the suite record.** One detail is worth recording for whoever
  completes the sweep: most performance margins tie at 0.75 or 0.735, set by the
  50 ms event-delay quantum (`(0.2 − 0.05)/0.2`). Re-chosen performance sentinels
  are therefore decided by the ASCII tie-break more than by real margin.

The baselines in g031a's records, with 264 examples cited after verification and 252 fresh:

| Baseline | Four-bar performances, cursor pass | At 45, cursor fail | Four-bar controls, cursor pass | Historical, as cited | Fresh cost max (ratio / p99) | Prefixes |
|---|---|---|---|---|---|---|
| clock-follower@1 | 1/84 | 21/21 | 0/168 | Fails every control; no performance passes | 0.0021 / 0.035 ms | 24 pass |
| online-time-warp@8 | 5/84 | 21/21 | 168/168 | Rejects all 176 controls; no performance passes | 0.171 / 3.57 ms | 24 pass |
| online-time-warp@12 | 1/84 | 21/21 | 168/168 | The same | 0.140 / 3.51 ms | 24 pass |
| online-time-warp@14 | 1/84 | 21/21 | 168/168 | The same | 0.145 / 2.52 ms | 24 pass |

No baseline makes an assessment, so none passes any example. All 264 cited
baseline evaluations reproduce exactly from their hash-verified records, and every
TypeScript producer at g025's and g026's commits is byte-identical today.

### Provenance of the observations

| Item | Value |
|---|---|
| Private directory | `/home/williao/dev/mnx-listening-data/diagnostic-runs/g031a-reporting-sweep/` |
| `post-failure-inventory.json` (1,532 file hashes, written after the failure by this session) | `826e380ec5aec22e0e53d0027e897b22087e16eb7308f14974a224d75a0678ad` |
| `failure.json`, `measuredExamples: 516` | `09d0df5358e326f4400454fbfb4626078726e743dd7e531e19cdc58a997aef83` |
| Runner source for g031a | tag `g031a-reporting-sweep-source` |
| Frozen sets | `contract2-slowed-bar-v1` `553d4e7e…`, `contract2-four-bar-tempo-v1` `870363f2…`, both verified by the runner |

## Against the predictions

None of these is a verdict, because the run record was not completed. Each row
says what the diagnostic observations show.

| # | Status | Observation |
|---|---|---|
| 1 | Not answerable as a verdict; observations agree | 516/516 identical records and musical output |
| 2 | Not answerable as a verdict; observations agree | No flag on 264 short-score examples; all pass; zero false alarms |
| 3 | Not answerable as a verdict; observations agree | 89/91 slow, same two misses; zero false alarms; summaries identical to 030 |
| 4 | Not answerable as a verdict; observations agree | 3,096 prefix checks pass; ratio 0.0024 ≤ 0.005; p99 0.148 ms ≤ 0.5 ms |
| 5 | Not answerable | No state is written: the run record is incomplete |
| 6 | Not answerable as a verdict; observations agree | Every listed baseline expectation holds |

## Decision

**D3, unresolved.** Applying the rule fixed before the run: g031 failed on
infrastructure, its one permitted rerun g031a failed on infrastructure too, and the
outcome stays unresolved. **The batch ends here, at run 2 of 5.** For this experiment:

- **No listener verdict.** event-chain@3 is a committed development version with no
  recorded evaluation. event-chain@2 stays the incumbent of record.
- **No state change.** The suite record is unchanged: stage1 passed, hesitation,
  slowedBar and four-bar open, the 19 old sentinels frozen, nothing confirmed or retired.
- **The full sweep is still owed**, and overdue as of 031. It was attempted and
  measured, but not recorded.
- **Stopping count.** @3 neither cleared nor failed a substage on the record, so
  the count stays **0**.

The diagnostic observations are strong evidence that a completion run would reach
D1. That is advice for the next decision, not a result of this one.

### Resulting stopping count, budgets and evidence access

**0 consecutive failing listener versions.** Three development listener versions,
event-chain@3 unjudged. Five completed listener comparisons: 031's comparison did not
complete. All six qualification versions and twelve assessment slots and every
reserved/final access remain unused. Winner bars 5–8 unexamined. No set retired. The
full sweep is overdue. The batch is closed early at 2 of 5 by this infrastructure outcome.

## Next

- **For the user, or a session they direct:** complete the sweep. The repaired
  runner is committed, but it is untested in a run because running it would exceed
  the rule. Two routes: authorise a completion run of 031's frozen pre-registration
  as `g031b-reporting-sweep` (about 27 minutes, nearly all of it baselines), or let
  experiment 032 pre-register the same measurement. Either should check the
  size-limit fix first by writing a summary from a dry assembly. A reviewer may also
  judge whether a one-rerun rule should distinguish failures that come before
  measurement from failures in writing the record afterwards. That is a process
  question, not one for this report.
- After a recorded D1: the held-note hesitation (question 19), then the order of
  work. Before that, consider recording the margin-tie observation with the sentinels.
- **Direction of travel.** The event-driven live cursor and the other-bars reporting
  are unchanged by chords or longer scores in principle. The other-bars rule needs
  four or more bars to say anything, which Winner bars 1–4 just meets. The
  monophonic sine pitch estimator and the 0.9 boundary sensitivity on millisecond
  onsets will need replacing or hardening for chords and recorded guitar.

**Awaiting the user:** a decision on completing the overdue sweep, by one of the two
routes above. The standing request for recorded-guitar gates before stage 4 also
remains. No contract relaxation is proposed.

## Attribution and validation

Designed, implemented, executed and recorded by **Claude Opus 5.5 in Claude Code**.
Pre-registration landed at `00665bba` before implementation. It passed the gate
(489 bench tests, 44 files). event-chain@3's three behavioural tests and the bench
TypeScript passed before execution. No oracle was created or re-versioned, so no
audit is due from this experiment.

## Completion: g031b, by the user's authority

The D3 decision above stands as recorded. After it, the user chose the first route
in **Next**. Their words are quoted in the research log's Current batch section:

> g031b is fine

So the frozen pre-registration above was completed **unchanged** as
[g031b-reporting-sweep](../runs/g031b-reporting-sweep/summary.json): same question,
method, listener (event-chain@3), evidence, predictions and decision rules. It ran
from tag `g031b-reporting-sweep-source` (`2f41c63e`, before any rebase) and was run
by **Claude Opus 5.5 in Claude Code**. It adds no run to the batch's count.

**Runner repairs only, each committed before measuring:**

1. Per-example results move to a private artifact named by hash (committed after
   g031a). Before measuring, a dry assembly rebuilt the would-be summary from g031a's
   private aggregates under this writer: about 60 KB against the 300 KB limit. The
   overflow had been the inlined per-example results. The real summary is 58,202 bytes.
2. The first g031b start refused at its first check, before creating any run
   directory: the runner compared the whole report with the pre-registration, and
   results are now appended below it. It now requires that the pre-registration be an
   unchanged prefix. No run ID was consumed.

### Results

**D1: passed.** All 516 examples, every pool, every frozen sentinel, causality and
cost pass. Run time 1,683 s, almost all of it fresh baselines on four bars.

| Evidence | Performances / controls | Cursor pass | Assessment pass | Pooled flags | Identity with @2 | State |
|---|---|---|---|---|---|---|
| Stage 1 | 8 / 16 | 24/24 | 24/24 | No flags; false alarms 0/12 slow, 0/12 fast | 24/24 | passed → **confirmed** |
| Silent hesitation | 40 / 80 | 120/120 | 120/120 | No flags; false alarms 0/60, 0/60 (030: 35/60 slow) | 120/120 | open → **passed** |
| Slowed s2 bar | 40 / 80 | 120/120 | 120/120 | No flags; false alarms 0/80, 0/80 (030: 16/80 each way) | 120/120 | open → **passed** |
| Four-bar clean + slowed | 84 / 168 | 252/252 | 252/252 | Slow found **89/91**; false alarms 0/208 slow, 0/299 fast | 252/252 | open → **passed** |

- **Identity.** On all 516 examples @3's decision records (IDs included), notes,
  overall tempo and intervals are byte-identical to @2's stored outputs. The bar
  summaries equal 030's promoted summaries: 1,320 bars, no structural difference,
  relative difference 0 (`compare031.ts` on g031b).
- **The two misses** are 030's boundary cases, `sb-s3-90-b1-90` and
  `sb-s3-99-b1-90`, with truth ratios 0.89999719 and 0.90000000.
- **Everything else.** 1,952 events reached (maximum delay 49.29 ms; minimum on-event
  fraction 99.21%); 1,780/1,780 intervals within tolerance (maximum error 18.90 ms);
  every note assessed; 344/344 controls reject, with no claimed note or tempo.
- **Causality and cost.** 3,096/3,096 prefix checks pass; maximum sustained ratio
  0.002278, chunk p99 0.120 ms, backlog 0 (i7-8750H, Node 22.22.1, provisional).
- **Agreement with g031a's diagnostics.** Every musical and identity count equals
  the observations recorded above.

**Baselines** (264 examples cited after hash and producer verification, 252 fresh):

| Baseline | Four-bar performance cursor pass | At 45, cursor fail | Four-bar controls cursor pass | Historical controls cursor pass | Examples passed | Fresh cost max (ratio / p99) | Prefixes |
|---|---|---|---|---|---|---|---|
| clock-follower@1 | 1/84 | 21/21 | 0/168 | 0/176 | 0/516 | 0.0018 / 0.035 ms | 24 pass |
| online-time-warp@8 | 5/84 | 21/21 | 168/168 | 176/176 | 0/516 | 0.152 / 3.09 ms | 24 pass |
| online-time-warp@12 | 1/84 | 21/21 | 168/168 | 176/176 | 0/516 | 0.160 / 3.16 ms | 24 pass |
| online-time-warp@14 | 1/84 | 21/21 | 168/168 | 176/176 | 0/516 | 0.147 / 2.21 ms | 24 pass |

### Against the predictions

| # | Verdict | Evidence |
|---|---|---|
| 1 | Held | 516/516 identical records and musical output |
| 2 | Held | No flag on any s1/s2 example; every s1/s2 bar ineligible; 264/264 pass; zero false alarms; 030's 18 clean failures pass |
| 3 | Held | Four clean performances unflagged; slow 89/91 (inside 87–89), both known misses remain; zero false alarms; summaries identical to 030's |
| 4 | Held | 3,096 prefix checks; ratio 0.0023 ≤ 0.005, p99 0.120 ms ≤ 0.5 ms |
| 5 | Held | stage1 confirmed; hesitation, slowedBar, four-bar passed; sentinels re-chosen; zero retirements |
| 6 | Held | Cited evaluations reproduce; no baseline passes any four-bar performance; all fail every 45 performance; the clock fails all 168 four-bar controls; each time warper passes 168/168 |

### Decision on the completion

**D1.** event-chain@3 is the incumbent. The [suite record](../bench/suite-record.json)
is updated only as method 7 says:

- stage1 is `confirmed`; hesitation, slowedBar and four-bar are `passed`, all with
  g031b as evidence;
- sentinels are re-chosen by the frozen rule (24 routine IDs);
- earlier passes and sentinels are kept under `previousIncumbent`;
- nothing retires; the next full sweep is due no later than 036, or earlier at
  batch end, new gates or a stage claim.

The stopping count resets to **0** (the version cleared the lowest open substage).

One observation on sentinels. The performance sentinels equal g031a's, but three of
the control sentinels differ (for example `sil-s1-99` here, `sil-s1-90` in g031a).
Control margins include measured cost terms, so run-to-run timing noise breaks
near-ties among controls. Performance margins mostly tie at 0.75 or 0.735, the
50 ms event-delay quantum, and are separated by the ASCII tie-break. Both are
consequences of the frozen rule. Neither is a gate question; this is flagged for the reviewer.

### Resulting stopping count, budgets and evidence access, after g031b

**0 consecutive failing listener versions.** Three development listener versions,
with event-chain@3 the incumbent. Six completed listener comparisons. All six
qualification versions and twelve assessment slots and every reserved/final access
remain unused. Winner bars 5–8 unexamined. No set retired. Full sweep done (g031b);
the next is due by 036. The batch continues at run 3 of 5 (032).

### Next, after the completion

Stage 2 continues in the order of work: the **held-note hesitation** (question 19),
the previous note ringing through the pause. Its routine suite is its own examples
plus the 24 sentinels and their controls. The four-bar boundary sensitivity stays a
monitoring item, not a reason to tune. **Awaiting the user:** nothing new. The
standing request for recorded-guitar gates before stage 4 remains.
