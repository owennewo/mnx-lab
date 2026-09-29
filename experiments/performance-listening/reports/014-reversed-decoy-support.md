# 014 — Support relative to a reversed reference

## Pre-registration

2026-09-29, before private candidate or diagnostic execution. Designed and run by
**GPT-6 in Codex**, using terminal tools, TypeScript/tsx, Vitest and the existing
scoreboard. Governed by [development contract 1](../contracts/development-contract-1.md).
This section is immutable after the run; results will be appended below.

### Question and mechanism

Can comparing the forward path's mean rank with a fitted reversed-reference path
keep correct guitar alignments while preserving rejection of the wrong score?
This is a bounded test of open question 22, following
[experiment 013](013-why-support-rejects.md): its fixed rank limit rejects correct
alignments, while its cost cap rarely does. No frozen candidate, evaluator, labels,
range or pass bar changes. [Research and alternative explanations](../research/reversed-reference-decoy.md)
separate published path-matching evidence from this experiment's decoy inference.

### One version, one change

`online-time-warp@7` keeps version 6's features, sine reference, forward path,
endpoint, warm-up, silence threshold, absolute cost cap and position emissions.
Only the rank-support rule changes. A second instance of the same causal aligner
receives the reference frames in reverse order, with the same origin and slope
constraints. The reference's feature multiset is exactly preserved. Each path's
rank is computed as in version 6 over its own last-second traceback. Support
requires **forward mean rank strictly less than reverse mean rank**, in addition
to the unchanged warm-up and cap. Ties refuse support. There is no fitted margin,
new rank cutoff, decoy selection or label access. A new module freezes version 7;
the shared aligner's optional reversal leaves all existing configurations forward.

This can fail because Dust's forward sequence may beat its reverse on unrelated
Winner audio, because the decoy's start is disadvantaged, or because sustained
passages fit both directions. The controls distinguish positive acceptance from
actual rejection; private traces distinguish rank-comparison refusals from cap
refusals. One decoy has no statistical false-positive guarantee.

### Evidence and runs

Run `g014a-reversed-decoy-support` on the 19 unchanged active examples of rungs
0–2, with the clock, incumbent version 6, its version-2 alignment-only diagnostic
and version 7. Use `--reproduce g012-seam-verification` because the shared aligner
changes: all 57 shared results and the incumbent thermometer must reproduce,
excluding measured cost. Recognition at supplied labels and all Studio seam checks
run as usual. No `--full`, fresh sources, next bars or reserved evidence is used.

Then run `g014b-decoy-traces`, a diagnostic using the frozen version-7 rule, on the
same active non-silence examples and the real positive/wrong-score pair. Save the
forward/reverse traces privately, with their path ranks and costs; aggregate rank
comparison and cap refusals after warm-up. Positive alignment is classified only
for explanation, using existing exact labels or the sync proxy. This is neither a
new evaluator nor a privileged-input candidate. No version is tuned after results.

### Predictions and contradictions

1. **Positive support improves.** On nylon, electric and Shinyguitar, version 7's
   supported-correct rate rises by at least 10 percentage points from version 6's
   62.4%, 79.9% and 38.6%. Acoustic does not fall below its 95% gate. A smaller gain
   on any harder guitar, or an acoustic failure, contradicts this prediction.
2. **The decoy discriminates.** Every active wrong-score example still rejects at
   least 95% of answerable points, and every silence example rejects 100%. Any
   control below that bar contradicts this prediction.
3. **Earlier rungs and cost survive.** Version 7 passes every gate on rungs 0 and 1,
   every causality check and the provisional sustained/p99 cost gates everywhere.
   Any failure contradicts this prediction.
4. **The forward alignment is unchanged.** Every version-7 position emission agrees
   exactly with the incumbent's alignment-only emission at the same delivery time.
   Any discrepancy is an implementation failure, not evidence for a changed path.
5. **The thermometer moves.** Version 7's real-positive sync agreement exceeds 0%,
   while its real wrong-score rejection stays at least 95%. Either failure contradicts
   this prediction; neither outcome enters candidate choice.

### Decision rules, fixed before execution

- **Keep provisionally** only if supported-correct improves by at least 5 percentage
  points on all three harder guitars, acoustic stays at least 95%, every active
  wrong-score/silence example meets all applicable gates, rungs 0–1 still pass, and
  causality, cost and unchanged-alignment checks pass. No real-clip result can select it.
  If all rung-2 gates also pass, record saturation; otherwise the remaining positive
  alignment/exposure/deadline failures stay open.
- **Reject** if any required safeguard above fails, even with positive gains. Preserve
  version 6 as incumbent. If gains coexist with control losses, the result is a tradeoff,
  not calibrated support. If positives do not improve, this single decoy does not solve
  the support failure. Either case resolves this version's question without ruling out
  other relative methods.
- **Inconclusive infrastructure** if reproduction, alignment invariance or seam checks
  fail, or execution crashes. Preserve the failed attempt and diagnose it; only a
  documented infrastructure correction permits a new technical run ID with identical
  candidate and rules. An unanticipated outcome that fits no branch is inconclusive.

### Carried-over state and preflight

The sole worktree was the primary checkout when ownership was checked; no report,
ledger row or private run numbered 014 existed. This session owns
`listening-014-decoy-support`. Dependencies installed once; ffmpeg is available;
private output creation/deletion was checked. Every frozen asset's hash was checked:

| Set | Manifest SHA-256 |
|---|---|
| Rung 0 v1 | f658adb47d452985bc578c73f96aa22063256e35a32ac8b3aa51cb468c897a79 |
| Rung 1 v2 | bee05932cf87d8a57cd22185919710427f77e3f1926d3c8eca549f2c8bc1d6d1 |
| Rung 2 v1 | 71211bce7991353b12dfee2a24063f15f1a4e1d2b4b9b0099f6ee54a33c134e2 |
| Winner sync proxy v1 | 80c8a6358751f356e164f75389dd50d49a2a0da6ad094f95847bd304eb5c5b8b |

Incoming plateau count is **0 consecutive versions without a gain**: version 3 failed
its stated aim in [009](009-plucked-reference.md), versions 4 and 5 failed in
[011](011-path-and-support.md), then version 6 gained on rung 2's wrong-score gate
and was kept, ending that sequence. Experiments 010, 012 and 013 are diagnostics or
infrastructure checks and add no versions. No plateau-triggered research refresh or
post-refresh sequence has occurred. Development has no version/compute ration.
For this version, a gain on the current failing positive gate means the predeclared
5-point improvement on all three harder guitars, recorded separately from retention:
a control regression may reject a version that nevertheless gains on that gate.

All active guitars, including historically named held-out examples, are development
evidence under the user's [active-suite direction](../contracts/development-contract-1.md#the-active-suite-and-the-next-bars).
Bars 5–8 remain unexamined. No reserved or final evidence has been accessed; the
qualification tier has no candidate frozen or assessment run, leaving six qualification
version slots, twelve assessment slots and its reserved/final access unused.
The old 002–003 history (two versions, six diagnostic/candidate assessments and
37.533150 CPU seconds) remains preserved and was development, not qualification,
under the contract's amendment. No qualification manifests or decision are created.
This one-question, one-new-source research note is development research, outside the
historical two-question proxy sub-batch. Neither history nor evidence freshness resets
with this model handover.
