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
