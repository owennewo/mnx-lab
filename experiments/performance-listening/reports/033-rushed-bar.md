# 033 — One rushed bar, on the two-bar scale and the four-bar melody

## Pre-registration

2026-10-01. **Claude Opus 5.5 in Claude Code** (reasoning effort not visible to the
session). Run 4 of the five-experiment main-track batch. One diagnostic experiment of
the unchanged incumbent **event-chain@3**; no new listener, evaluator, oracle or gate.

### Question and why

Does the unchanged event-chain@3 follow a single **rushed** bar with its live cursor,
and does its end-of-piece assessment report every note and interval and flag the
rushed bar **fast** where the audited instruments expect it, while every earlier
sentinel and control still passes? This is open question 21, the next deviation in
[contract 2's order](../contracts/development-contract-2.md#order-of-work) after the
held-note hesitation [032](032-held-note-hesitation.md) passed. It is also the first
evidence with **fast-flag positives**: every earlier substage's bar-flag positives
were slow, so the fast half of the pooled finding gate has never been exercised by a
listener.

The batch's goal is to continue the main track under contract 2's order of work; this
substage is the next item in that order and needs no new user decision.

### Alternatives the measures distinguish

1. **Shorter notes outrun the live confirmation.** event-chain@2/3 waits three
   10 ms analysis hops before the live state moves. A rushed bar shortens notes to
   as little as 0.466 s (99 × 1.30 quarters per minute). If confirmation or the
   960-sample analysis window straddled two notes long enough, events would be reached
   late or skipped. The per-event deadline and maximum delay separate this.
2. **The offline onsets are tempo-independent.** The tokens' onsets lag a fixed number
   of hops, so interval errors should not grow with tempo, and the interval and
   overall gates should hold. Interval errors separate this from (1).
3. **Bar flags near the threshold depend on onset precision.** With intervals
   attributed to the bar of their ending event, a rushed bar `b > 0` contains one
   unrushed interval, so its true ratio is `4 / (1 + 3/f)`, not `f`: at f = 1.15 it is
   1.1084, only 0.0084 above the 1.10 threshold, and at f = 1.10 it is 1.0732, an
   optional `either` bar. Bar 0 has only its own three rushed intervals and a ratio of
   `f`. g031b's four-bar records show the listener's ratio estimates differ from the
   truth by −0.0053 to +0.0101 (336 bars, read before this design). Misses, if any,
   should be confined to true ratios within about 0.01 of 1.10. Per-bar ratio errors
   separate a precision limit from a systematic fault (a fault would miss far from
   the threshold, or raise false alarms).
4. **Contaminated reference.** The other-bars reference includes the one rushed
   interval in the following bar; the weighted median should ignore it. A false
   `fast` or `slow` on an unrushed bar would contradict this.

No new literature is needed: the question tests the frozen implementation's timing,
not a published method; the bounded context remains [024's research](../research/event-chain-024.md).
Inferences above are from the frozen code and g031b's recorded estimates, not from
running the listener on the new audio.

### Stage, method and evidence

1. Land this pre-registration before writing the stimulus or runner code, generating
   audio or running anything. New run **g033-rushed-bar**; source tag
   `g033-rushed-bar-source`. The runner refuses to run unless its code is committed,
   this pre-registration reached `origin/main` unchanged as a prefix of the report, the
   source tag points at HEAD, and the public and private run directories do not exist.
2. Freeze a new private set **contract2-rushed-bar-v1** beside the existing sets.
   Rendering is exactly the slowed-bar recipe (`windowNotes` + `mixSines`, sine,
   −12 dBFS, 10 ms ramps, 48 kHz) under a piecewise tempo map that plays one bar
   at `f` times the base tempo:
   `sample(q) = round((q + min(4, max(0, q − 4b)) × (1/f − 1)) × 60/tempo × 48000)`.
   - Scores: [s2, the two-bar scale](../sources/s2-two-bar-scale.mnx.json) and
     [s3, the four-bar melody](../sources/s3-four-bar-melody.mnx.json). s1 has one bar,
     where rushing the bar is a steady tempo change already covered by stage 1.
   - Base tempi 45, 63, 90, 99 (handed 90, so 45 is the mandatory half speed); every
     bar `b` independently; factors **1.05, 1.10, 1.15, 1.20, 1.25, 1.30**, the whole
     rushed range of contract 2's category table (intermediate 105–115%, beginner
     110–130%) at even steps.
   - s2: 4 × 2 × 6 = **48** performances; s3: 4 × 4 × 6 = **96**. Each has a paired
     silence of equal length and its own audio handed the distant `w2`.
   - Clean parents for the performed scores: s2-45/63/90/99 from contract2-stage1-v3
     and s3-45/63/90/99 from contract2-four-bar-tempo-v1, with their controls, copied
     unchanged and checked equal to their source manifests.
   - Set: **152 performances, 304 controls, 456 examples.**
   - Independent checks at freeze: each note's boundaries recomputed by summing each
     beat's duration (not the rendering map); pitches equal to the score; notes
     outside the rushed region keep their duration within one sample of the steady
     parent and, where the length is identical, byte-identical PCM; silence exactly
     zero; wrong-score audio identical to the performance; labels validated. Labels
     come from the unchanged `perfectLabel` and `controlLabel`.
3. **Routine active suite**: the whole new set plus the 28 frozen routine sentinel IDs
   in the suite record, deduplicated (s2-90, s2-99, s3-99, sil-s2-90 and w2-s2-90
   overlap): **479 examples**, all executed fresh. The event chain is cheap, so no
   reuse guard is used. As a read-only regression diagnostic, every re-measured
   example that already has an event-chain@3 record is compared with its latest one
   (g032 if it ran there, otherwise g031b), verified by hash: decision record, raw
   report, following and assessment evaluations must be byte-identical. Frozen
   baselines are sweep-only and not run. A full sweep is not due (latest g031b; next
   by 036, or at batch end 034, new gates or a whole-stage claim). This attempts one
   substage, claims no stage, and retires nothing: no earlier substage has three
   complete-set incumbent evaluations.
4. Unchanged audited following-evaluator@2, assessment-evaluator@3, stage-gates@2
   (event-oracle@4, audit 4). Top of score, all parts, handed 90 quarters per minute,
   48 kHz in 480-sample chunks. Six prefix checks per example; cost includes finish,
   provisional on this host. Per-example cursor and assessment gates; pooled gates
   over the new set's own 456 examples, and separately over the 144 rushed
   performances with their controls; every earlier substage's sentinel group passes
   separately. Missing or refused output, absent cost or incomplete prefix checks
   fail.
5. Records: each example's private record is written and hashed as it is measured; the
   public summary's shape is checked on a dry assembly before measuring; its size is
   reported and never a reason to refuse a completed measurement. Expected evaluation
   time one to two minutes.
6. States: if D1, rushed-bar becomes `passed` with sentinels from `chooseSentinels`
   over `exampleMargin`, earlier states are preserved by `nextState`, and existing
   sentinel IDs stay frozen. No confirmation, version or retirement.

### Expected arithmetic, fixed now from the design

Computed from the sample formula with the evaluator's own `summarizeBars` and flag
rule, before any audio exists:

| Bars of the new set | Count |
|---|---|
| Expected `fast` (s3 only: bar 0 at 1.15–1.30, and at 1.10 for tempi 45 and 99 where sample rounding puts the ratio at 1.100001–1.100003; bars 1–3 at 1.15–1.30) | **66** |
| Of which within 0.01 of the threshold (bar 0 at 1.10 ×2; bars 1–3 at 1.15 ×12, true ratio 1.1084) | 14 |
| Optional `either` (bar 0 at 1.05 for 45/99 and 1.10 for 63/90; bars 1–3 at 1.10; the bar after a rushed bar at 1.25–1.30) | 40 |
| Expected `none`, so negative for both directions (includes every s2 bar, ineligible with one other bar) | 398 |
| Expected `slow` | 0 |

Highest true ratio among `none` bars is 1.05 minus rounding; lowest true ratio
anywhere is above 1.0.

### Predictions

| # | Prediction | What contradicts it |
|---|---|---|
| 1 | All 144 rushed performances pass the cursor gates: 1,920/1,920 events reached within 0.2 s, zero ahead, maximum acquisition delay ≤ 60 ms, minimum on-event fraction ≥ 99%. | Any failed example, unreached event, ahead time, or delay above 60 ms. |
| 2 | All 144 pass the per-example assessment gates: 1,920/1,920 notes matched, 1,776/1,776 intervals within tolerance with maximum error ≤ 25 ms, overall-tempo error ≤ 1%, zero false findings. | Any failed component, unmatched note, interval outside tolerance, or false finding. |
| 3 | Fast flags: at least **64/66** detected (≥ 97%), every miss among the 14 near-threshold bars; **zero** fast or slow false alarms over 398 and 464 negatives; reported bar-ratio errors within ±0.015. Both pooled gates pass. | Recall below 64/66, a miss more than 0.01 from 1.10, any false alarm, or a ratio error beyond ±0.015. |
| 4 | All 304 controls reject and claim nothing; the 8 clean parents pass with no flags; every earlier substage's sentinels pass. | Any control or sentinel failure. |
| 5 | 2,874/2,874 prefix checks pass; sustained cost ≤ 0.005, chunk p99 ≤ 0.5 ms (tighter than the gates); every previously recorded example is byte-identical to its latest record. | Any prefix failure, cost above the prediction, or a changed record. |

### Decision rules

- **D1 pass**: every active example, both declared pools, every earlier sentinel
  group, and every prefix and cost gate passes, with valid construction and
  provenance. Rushed-bar becomes passed; event-chain@3 stays incumbent; next is a
  missing event. A contradicted prediction tighter than an approved gate (delay,
  ratio error, cost, recall above 90%) is recorded with its cause and does not change
  the decision.
- **D2 resolved failure**: measurement is valid but any required gate fails. Record
  each failure by component; reopen any earlier substage whose sentinel failed; keep
  rushed-bar open and rank its repair first. If the only failure is pooled fast
  recall, with every miss within 0.01 of the threshold, the diagnosis is the
  listener's onset precision at the threshold and the next question is a listener
  version that improves it; the gate is not loosened and the stimulus is not changed.
  An unchanged-listener diagnostic adds no failing version to the stopping count. The
  batch may continue.
- **D3 infrastructure**: a failure before measuring is preserved with zero measured
  examples; a failure while measuring preserves every completed record; a failure
  writing the final record preserves the completed measurements with no verdict until
  repaired. Diagnose first; one technical rerun is allowed as **g033a-rushed-bar**
  with the same question, listener, evidence and method, repairing runner defects
  only, and it may reuse completed records whose producers and inputs are unchanged by
  hash. If still unresolved: no state change, and the batch closes at 4 of 5.
- Evidence that fits no branch is **inconclusive**, recorded as such, and closes the
  batch. A musical failure is never rerun.

### Carried-over stopping count, budgets and preflight

Unchanged since [032's resulting state](032-held-note-hesitation.md#resulting-stopping-count-budgets-and-evidence-access):
**0** consecutive failing listener versions; three development listener versions;
seven completed listener comparisons; all six qualification versions, twelve
assessment slots and every reserved and final access unused; Winner bars 5–8
unexamined. Full sweep last g031b, next due by 036 or earlier at batch end 034. This
diagnostic adds one comparison and no version.

Preflight: only `main` checked out before this session's `listening-033` worktree; no
report, ledger row, public run or private directory numbered 033 exists; dependencies
installed once; `ffmpeg` present; contract2-stage1-v3, contract2-four-bar-tempo-v1,
g031b's and g032's private records readable; private data root writable. No user
decision is needed for this substage. The session's direction is recorded verbatim:

> You cannot ask the user questions: record anything that needs them in your report and the research log.

## Results

**D1: the rushed bar passes.** The unchanged event-chain@3 followed every rushed bar
with its live cursor, matched every note, reported every interval within tolerance
and flagged 64 of the 66 bars the audited instruments expect `fast`, with no false
alarm anywhere. Every control, clean parent and earlier sentinel passed. The two
missed flags are the two bars whose true ratio sits on the threshold itself. This
passes one substage; it completes neither stage 2 nor anything on recorded guitar.

[g033-rushed-bar](../runs/g033-rushed-bar/summary.json) ran once, in **47.0 s**, at
`eea40ef3e5c2d6185239f24b87965f83f12375c8`, pinned by the tag
`g033-rushed-bar-source`. The pre-registration landed at `e5925746` before any
stimulus or runner code existed and is unchanged above. The set
**contract2-rushed-bar-v1** was frozen at the same source commit; its construction
checks all passed (3,840 note boundaries recomputed beat by beat; 1,249 unrushed
notes byte-identical to their steady parent, the other 95 within one sample of its
length; silences exactly zero). Each private record was written and hashed as it was
measured, after a dry assembly of the public record. No attempt failed and nothing
was rerun.

### Both outputs, controls and regressions

| Evidence | Performances / controls | Cursor pass | Assessment pass | Events reached | Notes matched | Intervals within tolerance |
|---|---|---|---|---|---|---|
| Rushed s2 (two bars) | 48 / 96 | 144/144 | 144/144 | 384/384 | 384/384 | 336/336 |
| Rushed s3 (four bars) | 96 / 192 | 288/288 | 288/288 | 1,536/1,536 | 1,536/1,536 | 1,440/1,440 |
| Clean s2/s3 parents, half speed included | 8 / 16 | 24/24 | 24/24 | 96/96 | 96/96 | 88/88 |
| Earlier sentinels not already above | 11 / 12 | 23/23 | 23/23 | 100/100 | 100/100 | 89/89 |
| Entire active suite | 163 / 316 | 479/479 | 479/479 | 2,116/2,116 | 2,116/2,116 | 1,953/1,953 |

| Rushed-performance measure | Result |
|---|---|
| Ahead exposure | 0 s |
| Minimum on-event fraction of supported answerable time | 100% |
| Maximum event acquisition delay | 49.5 ms |
| Maximum interval-duration error | 18.9 ms |
| Maximum overall-tempo error | 0.21% |
| False findings | 0 |

Every earlier substage's sentinel group passes (stage 1, hesitation, slowed bar,
four-bar, held-note); the four-bar sentinels keep their 4/4 slow flags. All 304 new
controls and the 12 earlier ones reject, and their assessments claim no note, tempo
or flag. Missing, wrong, dead and extra-note gates have no positives here.

### The first fast flags

| Pool | Fast found | Fast false alarms | Slow false alarms |
|---|---|---|---|
| New set's own 456 examples | **64/66** (97.0%) | 0/398 | 0/464 |
| The 144 rushed performances and their controls | 64/66 | 0/374 | 0/440 |

Both pooled gates pass (found ≥ 90%, false alarms ≤ 5%). Every positive and
negative count equals the pre-registered design arithmetic.

| Missed bar | True ratio | Reported ratio | Error |
|---|---|---|---|
| rb-s3-45-b1-110, bar 0 | 1.100003 | 1.096154 | −0.0038 |
| rb-s3-99-b1-110, bar 0 | 1.100001 | 1.093299 | −0.0067 |

Both misses are the two bars that sample rounding puts a few millionths **above**
1.10, so a 1–2% onset-precision error decides them either way. The twelve thin
positives at true ratio 1.1084 (bars 1–3 at f = 1.15) were all found. In g031b the
mirror case, bar 0 slowed to exactly 0.90, gave three expected-slow bars (rounding made
the fourth `either`) and missed two. Four misses in five exact-threshold positives
over the two runs fits a near coin flip at millisecond onset precision; in both
directions the misses lie on the side of 1.0, but five cases cannot establish a bias.

Reported bar ratios (informational, no gate) differ from the truth by −0.0173 to
+0.0256 over all 480 rushed-performance bars. Four bars exceed the predicted ±0.015:
three are ineligible s2 bars, whose reference is one other bar's three or four
intervals, and one is an s3 bar after a rushed bar, expected `none` at true ratio
1.0526 and reported 1.035. None changes a flag.

### Regression identity, causality and cost

All 47 re-measured examples that already had an event-chain@3 record (28 sentinels and
19 clean parents and controls, latest record in g032 or g031b, verified by hash) have
byte-identical decision records, raw reports, following and assessment evaluations.

| Cost (Intel Core i7-8750H, Node 22.22.1; provisional host only) | Result | Approved gate |
|---|---|---|
| Maximum sustained ratio, finish included | 0.00183 | ≤ 0.25 |
| Maximum chunk p99 | 0.166 ms | ≤ 10 ms |
| Prefix checks | 2,874/2,874 | every check |
| Evaluation wall time | 47.0 s | routine target about 2 minutes |

| Artifact | Path / hash |
|---|---|
| Frozen set | `/home/williao/dev/mnx-listening-data/contract2-rushed-bar-v1/manifest.json`; `102915fe315a1fb84a810a9755353a76d87258c35b008b00d02a3db4f5e364d3` |
| Per-example results | `…/diagnostic-runs/g033-rushed-bar/results.json`; `2981a5a2138fdeb9de70b47c18f9479c1bf19c9a2ad4cf287fef3e1928b49168` |
| Aggregates, margins, identity and per-bar flag rows | `…/diagnostic-runs/g033-rushed-bar/aggregate-details.json`; `a46fcdf9bbeb70ec13769d13572b8ee691f7ea11af6b6e4960915fb629c52d79` |
| Public summary | 49,830 bytes; `a8c7bad94f319ce838786f81805d262c6ac040d7101a050e6773c6c10f753a18` |

No listener, evaluator, oracle, contract, score, frozen baseline or earlier set was
edited.

## Against the predictions

| # | Verdict | Evidence |
|---|---|---|
| 1 | Held | 144/144 cursor passes; 1,920/1,920 events; zero ahead; maximum delay 49.5 ms; on-event 100% |
| 2 | Held | 1,920/1,920 notes; 1,776/1,776 intervals, maximum error 18.9 ms; overall error ≤ 0.21%; zero false findings |
| 3 | Mixed: flag counts held, ratio-error bound contradicted | 64/66 fast, both misses at the threshold; zero false alarms; but 4 of 480 bar ratios err by more than ±0.015 (up to +0.0256 on an ineligible s2 bar); none affects a flag, and the bound is tighter than any gate |
| 4 | Held | All 304 new controls reject; 8 clean parents with no flags; every earlier sentinel group passes |
| 5 | Held | 2,874/2,874 prefixes; sustained 0.00183, p99 0.166 ms; 47/47 earlier records byte-identical |

## Decision

**D1 applies**: every active example, both declared pools, every earlier sentinel
group and every prefix and cost gate passes, with valid construction and provenance.
The ratio-error contradiction is a prediction tighter than any gate, recorded with
its cause, and does not change the decision.

event-chain@3 remains incumbent. **Rushed bar becomes passed**, with sentinels chosen
by the frozen margin rule: performances rb-s2-99-b2-115, rb-s3-99-b2-115 and
rb-s2-90-b1-125; controls sil-s2-45 and w2-rb-s2-63-b1-125 (s2),
sil-rb-s3-63-b1-130 and w2-rb-s3-90-b2-125 (s3). The routine union grows from 28 to
35 IDs. Every earlier state is preserved: stage 1 confirmed; hesitation, slowed bar,
four-bar and held-note passed. Nothing is confirmed or retired: earlier substages
again had sentinel-only checks, and rushed-bar has one evaluation. No oracle was
created or re-versioned, so no audit is due.

### Resulting stopping count, budgets and evidence access

**0** consecutive failing listener versions; **three** development listener versions;
**eight** completed listener comparisons (this adds one unchanged-version diagnostic).
All six qualification versions, twelve assessment slots and every reserved and final
access remain unused; Winner bars 5–8 unexamined. Full sweep last g031b. The batch
advances to **4 of 5**; 034 is its last run, and the batch end makes a full sweep due
there.

## Next

Next in contract 2's order is **a missing event**, the first deviation that changes
what sounds rather than when. It is also the first test of the live cursor's recovery
gate and of `missing` findings. Because 034 ends the batch, the full sweep falls due
there: 034 can attempt the missing event and run the sweep in the same evaluation, as
031 did, or run the sweep alone; that is its experimenter's choice to pre-register.

Exact-threshold flags remain a coin flip at the event chain's 10 ms onset resolution
(four misses in five such positives over g031b and g033), within the approved pooled gate.
That would matter only if a later stage puts many bars near the threshold or coarsens
onsets, as recorded guitar may; it is an observation, not a proposal.

Direction of travel: the event-state cursor and the offline interval and bar-flag
reporting survive a change of local tempo in both directions, and are plausible to
keep through chords and longer scores. The sine zero-crossing pitch estimator and its
hop-quantised onsets are the parts expected to need replacing for recorded guitar.

**Awaiting the user:** nothing new. Evidence-based gates before stage 4 (recorded
guitar) and later qualification and Studio product decisions remain standing. The
session's direction is recorded verbatim:

> You cannot ask the user questions: record anything that needs them in your report and the research log.

## Attribution

Designed, implemented, executed and recorded by **Claude Opus 5.5 in Claude Code**.
The pre-registration passed the landing gate before any code existed; the stimulus
tests and bench type check passed before the source commit; the final rebased-tree
gate runs before landing.
