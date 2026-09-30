# 014 — Support relative to a reversed reference

## Pre-registration

2026-09-29, before private candidate or diagnostic execution. Designed and run by
**GPT-6 in Codex**, using terminal tools, TypeScript/tsx, Vitest and the existing
scoreboard. Governed by [development contract 1](../../../contracts/development-contract-1.md).
This section is immutable after the run; results will be appended below.

### Question and mechanism

Can comparing the forward path's mean rank with a fitted reversed-reference path
keep correct guitar alignments while preserving rejection of the wrong score?
This is a bounded test of open question 22, following
[experiment 013](013-why-support-rejects.md): its fixed rank limit rejects correct
alignments, while its cost cap rarely does. No frozen candidate, evaluator, labels,
range or pass bar changes. [Research and alternative explanations](../../../research/reversed-reference-decoy.md)
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
evidence under the user's [active-suite direction](../../../contracts/development-contract-1.md#the-active-suite-and-the-next-bars).
Bars 5–8 remain unexamined. No reserved or final evidence has been accessed; the
qualification tier has no candidate frozen or assessment run, leaving six qualification
version slots, twelve assessment slots and its reserved/final access unused.
The old 002–003 history (two versions, six diagnostic/candidate assessments and
37.533150 CPU seconds) remains preserved and was development, not qualification,
under the contract's amendment. No qualification manifests or decision are created.
This one-question, one-new-source research note is development research, outside the
historical two-question proxy sub-batch. Neither history nor evidence freshness resets
with this model handover.

## Results

**Reject version 7.** Comparing the score with its own reversed reference restores
positive support, but does not establish that the score is the intended piece.
The wrong-score safeguard fails, and the second aligner exceeds the sustained
processing budget. Version 6 remains incumbent.

The frozen design and code ran at commit `b932f7b142cba6fadbd4015a682ab67e400bbde8`:

| Run | Purpose | CPU seconds |
|---|---|---|
| [g014a-reversed-decoy-support](../runs/g014a-reversed-decoy-support/summary.json) | Whole active scoreboard, recognition, thermometer and seam | 370.078 |
| [g014b-decoy-traces](../runs/g014b-decoy-traces/summary.json) | Frozen rule's explanatory traces and forward-position invariance | 80.766 |

Execution completed unchanged across a user interruption; there was no failed private
attempt or technical rerun. Private artifacts live under
`/home/williao/dev/mnx-listening-data/ladder-winner-v1/runs/`, in those two run directories.
The scoreboard summary hashes its records, evaluations, recognition and seam records;
the diagnostic summary names and hashes `frames.json`. The frozen sets, labels and
instruments were unchanged.

### Positive following

The exact-label evaluator's rates on the four active guitars (189 answerable grid
points each). Wrong exposure includes only claimed wrong positions, whereas the
supported-correct and deadline denominators also penalise refused support.

| Guitar | Version 6 supported correct | Version 7 supported correct | Gain | Version 7 wrong exposure | Version 7 missed deadlines |
|---|---|---|---|---|---|
| tonejs acoustic | 96.3% | 96.3% | +0.0 points | 3.2% | 3.7% |
| tonejs nylon | 62.4% | 90.5% | +28.0 points | 9.1% | 9.5% |
| tonejs electric | 79.9% | 95.8% | +15.9 points | 3.7% | 4.2% |
| Shinyguitar | 38.6% | 84.7% | +46.0 points | 10.2% | 15.3% |

Nylon and Shinyguitar still fail the 95% following gate and the 5% exposure gate;
Shinyguitar also misses the 10% deadline bar. Acoustic and electric meet those
logical positive gates, but fail cost. Increased support exposes the forward path's
existing wrong-position bursts; it does not fix them.

### Wrong-score rejection

| Guitar control | Version 6 rejection | Version 7 rejection | Version 7 longest false exposure |
|---|---|---|---|
| tonejs acoustic | 100.0% | 42.3% | 1.50 s |
| tonejs nylon | 100.0% | 46.0% | 1.85 s |
| tonejs electric | 98.4% | 77.8% | 0.75 s |
| Shinyguitar | 100.0% | 100.0% | 0.00 s |

Version 7 rejects only 66.7% on rung 0, and 64.7%, 66.3% and 68.7% on the active
constant, ramp and drift controls. Seven of eight active wrong-score examples fail
95% rejection, exposure and deadline gates. All three silence examples reject 100%.
The sine positives retain their previous 99.4–99.5% rates, but rungs 0 and 1 no
longer pass because of their controls and cost.

### What the relative comparison admits

Each guitar has 466 traced non-silent analysis frames after warm-up. The following
counts use supplied exact positions for explanation, not a new evaluator. They
therefore differ from the scoreboard's 50 ms grid counts.

| Guitar | Correctly aligned frames | Given support | Refused by comparison alone | By cap alone | By both |
|---|---|---|---|---|---|
| tonejs acoustic | 452 | 452 | 0 | 0 | 0 |
| tonejs nylon | 424 | 424 | 0 | 0 | 0 |
| tonejs electric | 448 | 448 | 0 | 0 | 0 |
| Shinyguitar | 409 | 395 | 6 | 8 | 0 |

The three tonejs positives keep every correctly aligned frame. Shinyguitar keeps
395/409; its remaining refusals split between the comparison and cap.

On the wrong-score controls, being better than a reversed sequence frequently
happens even though the handed score is Dust and the audio is Winner:

| Guitar control | Forward rank beats reverse | Support admitted after cap | Median reverse-minus-forward rank |
|---|---|---|---|
| tonejs acoustic | 273/466 | 273/466 | +0.0140 |
| tonejs nylon | 262/466 | 251/466 | +0.0248 |
| tonejs electric | 203/466 | 103/466 | -0.0113 |
| Shinyguitar | 180/466 | 0/466 | -0.0303 |

**Shinyguitar is rejected entirely by the cost cap.** Its forward path beats the
decoy on 180 frames, but all 466 forward costs exceed 0.7. The comparison alone
would not reject this control reliably. On acoustic and nylon the forward path
beats the decoy in over half the frames, and the cap admits almost all those wins.

These traces establish that superiority to one reversed sequence is insufficient;
they do not identify whether the fixed start, repeated/shared notes or later
path fitting causes those wins. The boundary changes under reversal, and the
whole-history path can retain that disadvantage. No causal explanation beyond the
measured admissions is claimed.

### Thermometer, recorded without selection

| Real Winner clip | Version 6 | Version 7 |
|---|---|---|
| Positive agreement with sync interpolation | 0.0% | 68.3% |
| Wrong-score rejection | 100.0% | 55.0% |
| Silence rejection | 100.0% | 100.0% |

The trace keeps 319/325 correctly aligned real-positive frames, but admits 208/466
wrong-score frames. Positive acceptance and negative discrimination separate here
too. The sync interpolation's precision remains unmeasured; neither this clip nor
its improvements selected the candidate or qualified it.

### Integrity, seam, recognition and cost

| Check | Result |
|---|---|
| Shared scoreboard reproduction against experiment 012 | 57/57 identical, excluding measured cost |
| All three incumbent/floor thermometer entries against experiment 012 | Identical |
| Version 7 position invariance | 11,044 emitted positions across the traced examples; zero mismatches with the incumbent's alignment-only path |
| Supplied-label recognition | All eight positives reproduce version 2's experiment-010 results exactly; features/reference unchanged |
| Causality | All rung prefix and delivery checks pass |
| Display and replay | All 76 examples agree; 14,400 replay grid points, zero failures; no positions clamped |
| Navigation fixtures | Expected scope refusals; clock follows the repeat fixture and refuses the mid-score start |
| Delivery | 48 kHz/480 equals direct; 48 kHz/128 same decisions within one block; at 44.1 kHz/128 all 186 jointly claimed version-7 positions agree within tolerance |
| Version 7 sustained cost | 17/19 examples exceed 25% real time; worst 39.45% |
| Version 7 per-chunk p99 | Worst 5.91 ms, below 10 ms |

Cost is measured on the declared development laptop, Intel i7-8750H, Node 22.22.1,
48 kHz mono in 480-sample chunks. It is provisional, includes initialization, and
is not microphone-to-display latency. The second full reference render and aligner
are a real cost of this implementation; a cost failure is not treated as permission
to rerun for a favourable measurement. The combined two-run CPU total is 450.844 s.

A reporting correction after execution normalises relative source paths before
`git show` in the shared exporter. The diagnostic pins imported root sources as
`../../src/...`; git does not normalise those itself. This ensures they are checked
against the run's commit rather than falling back to present-day files. No frozen
run, source hash, candidate or experimental metric was edited, and all registered
reports were checked with the corrected exporter.

The data remain one piece's controlled renderings and one reused real recording;
correlated grid points are not independent performances. No population interval,
new-source transfer, qualification or Studio integration is established.

## Against the predictions

| Prediction | Outcome | Evidence |
|---|---|---|
| 1. At least 10-point gains on all three harder guitars, acoustic stays above 95% | **Held** | Gains +28.0, +15.9, +46.0 points; acoustic unchanged at 96.3% |
| 2. Every wrong-score rejection at least 95%, every silence 100% | **Contradicted, mixed** | Silence holds; seven of eight wrong-score controls fail |
| 3. Rungs 0–1, causality and cost all pass | **Contradicted, mixed** | Sine positives and causality hold; controls and sustained cost fail |
| 4. Every emitted position is the existing forward alignment | **Held** | 11,044 checked positions, zero mismatches |
| 5. Real positive exceeds 0% with wrong-score rejection at least 95% | **Contradicted, mixed** | Positive reaches 68.3%, rejection falls to 55.0% |

## Decision

The pre-registered rejection branch applies. The three hard-positive gains exceed
the 5-point minimum and acoustic survives, but the required wrong-score, earlier-rung
and cost safeguards fail. **Version 7 is rejected; version 6 stays incumbent.**
No rung is saturated and no next bars or later rungs are opened. Version 7 and both
run records remain frozen; it is removed from the active suite.

The experiment resolves this one reversed-decoy rule's question: it recovers positive
support while losing discrimination. That is a tradeoff, not calibrated support.
It does not disprove every relative or decoy method, and does not licence a looser
fixed cutoff. Correct alignment, sufficient support and acceptable compute remain
separate failures to resolve.

### Resulting plateau, budgets and evidence access

Incoming plateau was 0. By the pre-registered accounting, the version gains on the
current failing positive gate (more than 5 points on all three harder guitars),
so the resulting count is **0 consecutive versions without a gain** despite rejection.
No plateau stopping rule applies and no post-refresh sequence begins. This records
metric progress separately from a viable incumbent; it is not a retention claim.
The [preflight](#carried-over-state-and-preflight) preserves the historical sequence
and the legacy 002–003 budget history.

Development remains unrationed: this experiment used one new candidate version,
one scoreboard run and one diagnostic run. Qualification remains at zero frozen
versions and zero assessments, with its six version and twelve assessment slots
unused; no reserved comparison or final acceptance access occurred. All active
examples remain development evidence, and bars 5–8 remain unexamined. One bounded
research question consulted one new primary-source notebook; the full Dixon PDF
attempt failed and supplied no new evidence. No user judgement or contract change
was spent, and the interrupted session did not reset any state.

## Next

Advice for the next experiment: first distinguish whether Dust's forward advantage
on unrelated audio comes from the fixed origin or from subsequent sequence fitting.
A comparator's ability to keep positive frames is established here; its ability to
calibrate rejection is not. A future null needs a justified matching opportunity,
with start and temporal dependence addressed, rather than merely a weaker sequence.
This suggests a diagnostic before another support variation, not a restriction on
which method a later pre-registration may test. The steady-tempo alignment question
remains open, and any added support computation must address the measured cost.

## Attribution

Designed, implemented, run, interpreted and recorded by **GPT-6 in Codex**.
The same model resumed after interruption and completed the frozen experiment.
No delegated agent, independent executor or subsequent numbered experiment was used.
