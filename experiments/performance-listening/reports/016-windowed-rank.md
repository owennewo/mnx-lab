# 016 — Support from the path's rank over two seconds

## Pre-registration

2026-09-29, before any private execution of the new version. Designed and run by
**Claude Opus 5.5 (1M context) in Claude Code**, using terminal tools, TypeScript/tsx,
Vitest and the existing scoreboard. Governed by
[development contract 1](../contracts/development-contract-1.md). This section is
immutable after the run; results will be appended below.

### Question and why

Open question 22, the top of the research log: can support keep correct alignments on
recorded guitar and the real clip, and still reject the wrong score in every timbre,
with its false acceptance on unrelated audio measured rather than assumed? The
incumbent, `online-time-warp@6`, requires its path's last-second mean rank to lie in the
reference's best 10%. [Report 013](013-why-support-rejects.md#results) showed that limit
refuses correct recorded-guitar frames, which rank in the best 12–17%. Experiments 014
and 015 tried relative comparisons with decoys instead. One decoy is a coin flip on
unrelated audio, and a family of them is too loose for the cost
([report 015](015-decoy-null.md#decision)).

### A challenge to report 013's restriction

[Report 013's decision](013-why-support-rejects.md#decision) said the next support test
does not replace the limit with a looser fixed number, "because the wrong score was
only ever measured against 10%, so nothing says it would still be rejected".
[Report 015's Next](015-decoy-null.md#next), which I wrote, repeated that restriction.
It is a report's restriction on future methods, not a contract or user direction, so it
may be challenged with evidence ([RUNNING_AN_EXPERIMENT.md §3](../RUNNING_AN_EXPERIMENT.md)).

- **The evidence.** The private traces of runs `g014b-decoy-traces` and
  `g015b-decoy-null-traces` now record the incumbent path's last-second mean rank on
  every frame of every active wrong-score example, in every timbre, and on the real
  clip. The rationale "nothing says it would still be rejected" no longer holds for
  the active suite: it can be measured, and it is below.
- **The disagreement.** The residual risk is narrower than the one 013 guarded
  against. A limit set after seeing these traces is fitted to one wrong piece, Dust.
  A wrong score more similar to Winner could rank closer to the correct path.
- **The test.** Here, the whole active scoreboard. Beyond it, the contract's own fresh
  check: on saturation, Winner's bars 5–8 become the suite, and this limit was never
  fitted to them.

### How the window and limit were chosen

Before writing this, I recomputed a causal statistic from the 015b traces of the
incumbent's forward path. The statistic is the mean of the path's last-second mean
rank over every traced frame of the last W seconds. For each limit L, the table counts
admissions after the unchanged 0.7 cost cap and 0.2 s warm-up. "Kept" is the share of
correctly aligned positive frames the rule admits. "Admitted" is the share of
wrong-score frames it admits. Correctness uses the exact labels or the sync
interpolation, as in 014b and 015b; these are analysis frames, not the scoreboard's
50 ms grid.

| W | L | Kept, worst positive | Admitted, worst wrong-score |
|---|---|---|---|
| 1 s | 0.15 | 0.375 (real clip) | 0.019 (real clip) |
| 1 s | 0.20 | 0.883 (Shinyguitar) | 0.058 (rung 1 drift) |
| 2 s | 0.15 | 0.246 (real clip) | 0.019 (real clip) |
| **2 s** | **0.20** | **0.961 (Shinyguitar)** | **0.028 (real clip); at most 0.006 on rungs 0–2** |
| 2 s | 0.25 | 0.980 (Shinyguitar) | 0.251 (tonejs acoustic) |
| 3 s | 0.20 | 0.961 (Shinyguitar) | 0.028 (real clip) |

The rule used: take the smallest L in {0.15, 0.20, 0.25} that keeps at least 95% of
correct frames on every positive, then the shortest W in {1, 2, 3, 4} s that admits at
most 3% of wrong-score frames at that L. A shorter window reacts sooner when following
is lost. That gives **W = 2 s, L = 0.20**. At W = 1 s the drift control's admission
of 5.8% would leave its rejection below 95%. These numbers are development selection
on examples the candidate will then be scored on. The report says so, and does not
treat the scoreboard as independent confirmation.

The same traces show what the rule cannot do. It also admits the path's
wrong-position bursts: 42 of 42 such frames on nylon, 53 of 57 on Shinyguitar and
141 of 141 on the real clip. Support is not what fails there; the alignment is.

### One version, one change

`online-time-warp@8` (`src/candidates/onlineTimeWarp8.ts`) keeps version 6's features,
reference, path, endpoint, warm-up, silence rule, cost cap and position emissions.
Only the support rule changes. The same last-second path rank is averaged over every
analysed frame of the last 2 s, and must be at most 0.20 instead of the single-frame
value being at most 0.10. The window and limit are two parameters of that one rule;
the table shows neither works alone on the active suite. No shared code changes, and no
decoy, label or trace is visible to the listener. A unit test checks that every
claimed position equals the incumbent's alignment-only emission, and that silence is
never claimed.

### Evidence and run

Run `g016-windowed-rank`: the scoreboard on the unchanged 19 active examples of
rungs 0–2 with the clock, version 6, its alignment-only diagnostic and version 8,
plus supplied-label recognition, the real-clip thermometer and every Studio seam
check. It runs with `--reproduce g015a-rotation-reproduce`: all 57 shared results must
reproduce, excluding cost. No `--full`, fresh source, next bars or reserved evidence is
used, and nothing is tuned after results.

### Predictions

Version 6's figures are from [run g015a](../runs/g015a-rotation-reproduce/summary.json).

1. **The controls hold.** Every active wrong-score example and every silence example
   passes every gate. Rejection is at least 95%, with no exposure episode over 0.5 s.
2. **The sine rungs hold.** Every rung-0 and rung-1 example passes every gate.
3. **Two guitars pass.** The tonejs acoustic and tonejs electric positives pass every
   gate. The nylon and Shinyguitar positives still fail. Their wrong exposure rises above
   5%, from version 6's 4.3% and 2.1%, because their bursts are now claimed.
4. **Support gains.** Supported-correct rises by at least 10 points on nylon, electric
   and Shinyguitar, from 62.4%, 79.9% and 38.6%.
5. **Cost and causality.** Every example stays within the sustained 25% and p99 10 ms
   cost gates, and every causality check passes.
6. **Reproduction.** All 57 shared results reproduce g015a's, excluding cost; the three
   shared thermometer entries and every seam check are unchanged.
7. **The thermometer moves** (recorded, never used to select). Real-positive agreement
   with the sync interpolation is at least 50%, and real wrong-score rejection at
   least 95%.

Any number outside its stated range contradicts that prediction.

### Decision rules, fixed now

- **Keep: version 8 becomes incumbent** if every rung-0 and rung-1 example passes every
  gate; every active wrong-score and silence example passes every gate; causality and
  cost pass everywhere; tonejs acoustic still passes every gate; and more rung-2
  positives pass every gate than version 6's one. Positive examples that fail under
  both versions may fail on different gates; that trade is recorded, not hidden. The
  real clip cannot select.
  - If all four rung-2 positives pass, the suite is **saturated**. The next experiment
    renders Winner's bars 5–8, per the contract; this experiment does not.
  - If kept without saturation, and the remaining failures include wrong exposure,
    the steady-tempo alignment question, 20, becomes the top question: support will
    then have stopped being the limit.
- **Reject** if any safeguard above fails, or no additional rung-2 positive passes.
  Version 6 stays incumbent, and the failure is recorded against this rule.
- **Inconclusive infrastructure** if reproduction or seam checks fail, or execution
  crashes. Preserve the failed attempt and diagnose it; only a documented infrastructure
  correction permits a new run ID with identical code and rules. An outcome that fits
  no branch is inconclusive.
- **Plateau accounting**, as experiment 014 fixed it. A gain on the current failing
  positive gate means supported-correct rising by at least 5 points on all three harder
  guitars. With a gain, the count stays 0 whether version 8 is kept or rejected;
  without one, it becomes 1.

### Carried-over state and preflight

`git worktree list` showed only the primary checkout, with `main` at the landing of
experiment 015. No report, ledger row, public run or private run numbered 016 existed.
This session owns worktree `listening-016-windowed-rank`; dependencies were installed
once. The frozen set hashes were verified for experiment 015 today and are recorded in
[report 015's preflight](015-decoy-null.md#carried-over-state-and-preflight); the
scoreboard re-verifies them.

The incoming plateau count is **0 consecutive versions without a gain**, per
[report 015's resulting state](015-decoy-null.md#resulting-plateau-budgets-and-evidence-access).
No research refresh or stopping rule applies. Development is unrationed. Qualification
has no frozen candidate and no assessment. Its six version slots, twelve assessment
slots, and reserved and final access remain unused. All active examples are development
evidence, including the traces this design was chosen from. Bars 5–8 remain
unexamined. No new research source is consulted. No user judgement or contract
change is needed: the pass bar, ranges and exit rule are unchanged, and only a
report's restriction on method is challenged.

## Results

**Keep version 8.** Every prediction held. Version 8 passes every gate on rungs 0 and 1,
on every control and on two of the four recorded guitars, tonejs acoustic and tonejs
electric. Version 6 passed only acoustic. The two guitars that still fail, nylon and
Shinyguitar, fail because version 8 now claims their alignment's wrong-position bursts.
Support is no longer what fails; the alignment is.

The run was [g016-windowed-rank](../runs/g016-windowed-rank/summary.json), at the
pre-registration commit `44c4acc0`: 248.580 CPU seconds, with no failed attempt and no
rerun. The frozen sets, labels and instruments were unchanged.

### Recorded guitar

Exact-label evaluator, 189 answerable grid points per positive.

| Positive | v6 supported correct | v8 supported correct | v8 wrong exposure | v8 longest | v8 missed deadlines | v8 fails |
|---|---|---|---|---|---|---|
| tonejs acoustic | 96.3% | 96.3% | 3.2% | 0.15 s | 3.7% | — |
| tonejs nylon | 62.4% | 90.5% | 9.1% | 0.35 s | 9.5% | supported correct, exposure |
| tonejs electric | 79.9% | 95.8% | 3.7% | 0.20 s | 4.2% | — |
| Shinyguitar | 38.6% | 84.1% | 10.7% | 0.25 s | 15.9% | supported correct, exposure, deadline |

Version 6's wrong exposure on nylon and Shinyguitar was 4.3% and 2.1%. It rose because
the bursts that version 6's strict limit happened to refuse are now claimed. On these
two guitars the alignment is right on only about 91% and 88% of frames, so no support
rule could reach 95% supported-correct there without better alignment. Version 8's
positive figures are within a point of experiment 014's version 7. That is expected:
both admit essentially every frame the path aligns, correct or not.

### Controls

| Wrong-score control | v6 rejection | v8 rejection | v8 longest false exposure |
|---|---|---|---|
| Rung 0 | 98.4% | 100.0% | 0.00 s |
| Rung 1 constant 110 | 98.8% | 100.0% | 0.00 s |
| Rung 1 drift | 98.4% | 100.0% | 0.00 s |
| Rung 1 ramp | 100.0% | 100.0% | 0.00 s |
| tonejs acoustic | 100.0% | 99.5% | 0.05 s |
| tonejs nylon | 100.0% | 98.9% | 0.10 s |
| tonejs electric | 98.4% | 98.9% | 0.10 s |
| Shinyguitar | 100.0% | 100.0% | 0.00 s |

All three silence examples reject 100%. Every control passes every gate, and on the sine
rungs version 8 rejects the wrong score more completely than version 6 did.

### Thermometer, recorded without selection

| Real Winner clip | v6 | v8 |
|---|---|---|
| Positive agreement with sync interpolation | 0.0% | 69.8% |
| Wrong-score rejection | 100.0% | 96.8% |
| Silence rejection | 100.0% | 100.0% |

Version 8's real-positive agreement equals the alignment-only diagnostic's 69.8%, so on
the real clip support now refuses nothing the path gets right. The remaining 30% is
alignment, measured against a sync interpolation of unmeasured precision. This is the
first version to keep both real-clip figures up at once. It did not select the version.

### Integrity, seam, recognition and cost

| Check | Result |
|---|---|
| Shared results against g015a | 57/57 identical, excluding cost |
| Shared thermometer entries against g015a | All three identical |
| Version 8 seam replay | 573 + 1,308 + 1,719 grid points on rungs 0–2, no failures |
| Navigation fixtures | Expected refusals: repeat inside the modelled bars, mid-score start |
| Delivery | 48 kHz/480 equals direct; 48 kHz/128 same decisions within one block; 44.1 kHz/128: 186 of 186 jointly claimed positions within tolerance |
| Causality | Every prefix and delivery check passes |
| Supplied-label recognition | Identical to version 7's in experiment 014 (same features and reference) |
| Version 8 sustained cost | Worst 15.7% of real time, gate 25% |
| Version 8 per-chunk p99 | Worst 2.06 ms, gate 10 ms |

Cost was measured on the declared development laptop (i7-8750H, Node 22.22.1, 48 kHz
mono, 480-sample chunks). It is provisional and includes initialization. The window
adds a running mean to version 6's work and nothing else.

The window and limit were chosen from traces of these same examples, as disclosed
above. The scoreboard shows the rule behaves as those traces said it would; it is
not independent confirmation. The evidence is still one piece and one wrong piece,
with correlated grid points. Bars 5–8 and any other wrong score remain untested.

## Against the predictions

| Prediction | Outcome | Evidence |
|---|---|---|
| 1. Every control passes every gate, rejection at least 95%, no episode over 0.5 s | **Held** | 98.9–100% rejection; longest false exposure 0.10 s; silence 100% |
| 2. Rungs 0–1 pass every gate | **Held** | All ten examples |
| 3. Acoustic and electric pass; nylon and Shinyguitar fail with exposure above 5% | **Held** | Exposure 9.1% and 10.7% |
| 4. Supported correct gains at least 10 points on the three harder guitars | **Held** | +28.1, +15.9, +45.5 points |
| 5. Cost and causality | **Held** | Worst sustained 15.7%, worst p99 2.06 ms; all causality checks pass |
| 6. Reproduction | **Held** | 57/57, thermometer and shared seam checks identical |
| 7. Thermometer: positive at least 50%, wrong-score rejection at least 95% | **Held** | 69.8% and 96.8% |

## Decision

**Keep: `online-time-warp@8` becomes the incumbent.** Every safeguard in the keep rule
passes: rungs 0 and 1, every control, causality, cost, and tonejs acoustic. Two rung-2
positives now pass every gate, against version 6's one. The trade is recorded: nylon and
Shinyguitar fail under both versions, but version 8 fails them on wrong exposure, and
on Shinyguitar also the deadline, where version 6 failed them on refused support.
Version 6 stays frozen with its recorded results. It leaves the active suite, which now
runs the clock, version 8 and the alignment-only diagnostic. That diagnostic is also
version 8's alignment.

The suite is **not saturated**, so bars 5–8 are not opened. Because the remaining
failures include wrong exposure, the pre-registered branch makes **question 20, the
alignment's bursts, the top question**. On both failing guitars, support now claims
what the path aligns, and the path is wrong on about a tenth of the frames.

Report 013's restriction is replaced for this suite by measured evidence, not waived:
the limit rejects Dust in every active timbre. Whether it rejects a wrong score closer
to Winner, and whether it transfers to new bars, is untested.

### Resulting plateau, budgets and evidence access

The incoming plateau count was 0. Supported-correct rose by at least 5 points on all
three harder guitars, a gain on the failing gate, so the count stays **0 consecutive
versions without a gain**, now with a viable incumbent. No research refresh or stopping
rule applies. Development remains unrationed: one new version and one scoreboard run,
248.580 CPU seconds. Qualification still has zero frozen versions and zero
assessments, with its six version slots, twelve assessment slots and reserved and
final access unused. All active examples remain development evidence, and bars 5–8
remain unexamined. No research source, user judgement or contract change was used.

## Next

This is advice, not a restriction.

- **The alignment is now the limit.** On nylon and Shinyguitar, version 8's failures
  are the error bursts that [report 008](008-rung2-guitar-samples.md#where-the-alignment-goes-wrong)
  located in the decay of sustained bass notes. [Report 010](010-slim-suite-and-burst-features.md#the-features-do-not-explain-the-bursts)
  found that the features prefer the true position there, and
  [report 011](011-path-and-support.md#the-alignment-changes) found that making the path
  react faster made the bursts worse. Question 20, steadier tempo where evidence is
  weak, is the untested opposite direction.
- **Any alignment change must be checked against this support rule.** Version 8's limit
  was fitted to version 6's path. A path that moves differently changes the wrong
  score's ranks too, so the controls need rechecking, not assuming.
- **Reserve a wider negative check** for when the suite saturates. Dust is the only
  wrong score, and the 0.20 limit has only been measured against it.

## Attribution

Designed, implemented, run, interpreted and recorded by **Claude Opus 5.5 (1M context)
in Claude Code**. No delegated agent, independent executor or subsequent numbered
experiment was used.
