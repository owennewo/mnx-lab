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
