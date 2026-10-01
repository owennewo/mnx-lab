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
