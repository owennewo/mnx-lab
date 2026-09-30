# Audit of event-oracle@4

An independent re-derivation of **event-oracle@4** from the rules alone, under
[contract 2's audit rule](../../contracts/development-contract-2.md#auditing-an-oracle),
following [AUDITING_AN_ORACLE.md](../../AUDITING_AN_ORACLE.md). Performed 2026-09-30.

**What was audited.** `oracle-4.json`, sha256
`6fe74176cc66daeec5fccd3e07c0c8cb84051293fedd78a6b3641fb628103c02`, as `freeze-4.json`
records it (verified with `sha256sum`; `oracle-3.json` also still matches `freeze-3.json`).
The oracle was written by Sol 6.1 (high) in Codex; this audit was not.

**The rule text worked from**, and nothing else:

| File | Version | Used for |
|---|---|---|
| `contracts/event-instruments-4.md` | version 4, 2026-09-30 | the shorthand of the added sections (reports, pools, required evidence, selection cases, parent score, margin rejects, interval and example margins, plans), the reading of `onsets: null`, and its explicit statements on "every performed score", refused failed evidence and the last-three retirement history |
| `contracts/event-instruments-3.md` | version 3, 2026-09-30 | `assessment-evaluator@3`'s bar rules 1–5 and the report-level bar measures; `stage-gates@2`'s states, sentinel selection, normalized headroom, retirement and run plans |
| `contracts/event-instruments-2.md` | version 2, 2026-09-30 | everything version 3 inherits: intervals, overall tempo, the score-distance-weighted median with the exact-half mean rule, bar tempo, θ = 0.10 and the inclusive bounds; the report measures (flags, notes, false findings, claimed played, tempo claims); `stage-gates@1`'s per-example, control and pooled gates; the clarification on pending/indeterminate time |
| `contracts/event-instruments-1.md` | version 1, 2026-09-30 | `performance-label@1` admissible sets and `following-evaluator@2`: pending, grace, the categories, by-event delays, recovery, extras |
| `contracts/development-contract-2.md` | in force from 2026-09-30 | the other-bars rule, the rising tide (sentinels, retirement, sweeps, "a stage is passed when its own examples and every sentinel pass"), the approved gates whose budgets the headroom formulas normalize |
| `bench/oracle-events/README.md`, `freeze-4.json`, `freeze-3.json`, `oracle-3.json`, `oracle-2.json` | | the case shorthand, the hashes, the diff that names what version 4 added or changed, and the inherited cases sampled below |

Not read during re-derivation: `bench/src/events/`, its tests, report 029 beyond its
title, any run. No evaluator, listener or test was run during re-derivation; `node` was
used only as a calculator, to render my rational results as decimals and to evaluate the
frozen decimal onsets of B8–B10 in double precision (see [Precision](#precision)).
`audit-3.md` was read after my own derivations, for its list of uncovered rules. The
mandatory repository landing gate ran only after this file was committed, as the prompt
requires; nothing here was changed from its output.

**Scope.** Comparing `oracle-4.json` with `oracle-3.json` by case: B1 and B11 changed;
B13–B15, S9–S13, three headroom cases, one retirement case and ten whole sections
(`reports`, `reportArithmetic`, `pools`, `requiredEvidence`, `selectionCases`,
`parentScoreCase`, `marginRejects`, `intervalMargins`, `exampleMargins`, `plans`) were
added; everything else is byte-identical to version 3. I re-derived **every case in
`oracle-4.json`**, changed and unchanged, under the current definitions, and then
**sampled the inherited following, note and control rules from `oracle-2.json`**,
which version 4 declares still covers them: ten following cases (26 records) and eight
assessment cases (23 reports).

**The shorthand as I read it.** In an assessment case, `quarters[i]`, `ordinals[i]` and
`onsets[i]` describe event *i*: its score position in quarters, its performed measure
ordinal and its onset in seconds; one matched note per event, no extras; `onsets[i]:
null` means event *i* and its note are missing (B15). `flags` is the set of flags a
correct report carries: every eligible bar expecting `slow` or `fast`, `either` bars
omitted. A `reports` entry names its case, gives the literal `tempo.bars` summaries and
flags a report carries, and expects the flag counts, false findings, `clean`, the
per-example assessment gate verdict (notes, overall and intervals being correct from the
case's hand inputs, so only the `clean` gate can fail) and the bar-summary coverage with
signed or null deltas. `pools` lists the pooled flag gates its reports fail. `states`
and `requiredEvidence` give a substage's state before the evaluation, whether the run
attempted it, whether it was a full sweep, whether its own required evidence passed
(folded into `passed`, or itemised with `null` for absent), and whether its sentinels
passed. `plans` give substages with status, examples, sentinels and retirement, the
attempted substages and the sweep flag, and expect the sorted example list.

## Verdicts

### Assessment cases, `assessment-evaluator@3` (B1 and B11 changed; B13–B15 added)

"Other refs" is the reference of every bar not otherwise named. Rationals are mine;
decimals are rendered from them.

| Case | Rules exercised | My numbers | Oracle | Verdict |
|---|---|---|---|---|
| **B1** (changed) | rule 1: crossing interval to its ending bar; rule 2: exclude only the intervals ending in the bar; two-bar ineligibility; rule 5: ineligibility does not rescue `clean` | overall 100/3, typical 30; bar 0: local 30, reference **30**, ratio **1**, others 1, ineligible, none; bar 1: local 240/7, reference 30, ratio 8/7, others 1, ineligible, none; clean false; flags [] | same | **agree** (the audit-3 disagreement is corrected) |
| B2 | steady four bars; exactly three contributors each; clean | overall 60, typical 60; every bar 60/60, ratio 1, others 3, eligible, none; clean true | same | agree |
| B3 | two intervals summed in one bar; slow final bar; r = 0.8 | overall 390/7, typical 60; bar 3: 48/60, 0.8, slow; other refs 60; clean false; flags [[3, slow]] | same | agree |
| B4 | crossing interval with three other bars; two slow bars | overall 780/17, typical 60; bar 0: 30/60, 0.5, slow; bar 1: (240/7)/60 = 4/7, slow; bars 2–3: 60/60, none; others 3; clean false; flags [[0, slow], [1, slow]] | same | agree |
| B5 | uniform half speed is clean | overall 30, typical 30; every bar 30/30, ratio 1, eligible, none; clean true | same | agree |
| B6 | rule 3: a bar no interval ends in has null local tempo and ratio; other-bar counts of 2 | overall 60, typical 60; bar 0: null, reference 60, ratio null, others 3, ineligible, none; bars 1–3: 60/60, ratio 1, others 2, ineligible, none; clean true | same | agree |
| B7 | a self-dominating interval: whole-piece typical 30, leave-out reference 60 | overall 100/3, typical 30; bars 0–2: 60/30, ratio 2, fast; bar 3: 30/60, 0.5, slow; others 3; clean false; four flags | same | agree |
| B8 | inclusive slow bound r = 0.90 | overall 7020/121, typical 60; bar 3: 54/60, ratio 0.9, slow; other refs 60; clean false; flags [[3, slow]] | same | agree (see precision) |
| B9 | inclusive fast bound r = 1.10 | overall 8580/139, typical 60; bar 3: 66/60, ratio 1.1, fast; other refs 60; clean false; flags [[3, fast]] | same | agree (see precision) |
| B10 | outer edge of the none band, r = 0.95, is `either` | overall 14820/251, typical 60; bar 3: 57/60, ratio 0.95, either; other refs 60; clean false; flags [] | same | agree (see precision) |
| **B11** (changed) | outer edge of the none band, r = 1.05, is `either`, with exact integer onsets | overall 1860/23, typical 80; bars 0–2: 80/80, ratio 1, none; bar 3: 84/80 = 21/20, **either**; others 3 throughout; **clean false**; flags [] | same | **agree** (the audit-3 ambiguity is removed: the ratio is exact, and in doubles 84/80 − 1 is also on the `either` side) |
| B12 | unequal toy meters; the exact-half mean rule inside a reference; three distinct references | overall 200/3, typical 80; bar 0: 120, reference 70 (exact half: mean of 60 and 80), ratio 12/7, fast; bar 1: 40/80, 0.5, slow; bar 2: 60/80, 0.75, slow; bar 3: 80/60, 4/3, fast; others 3; clean false; four flags | same | agree |
| **B13** (added) | rule 3: a non-null local tempo whose reference is null (no other intervals); clean with a null ratio | overall 60, typical 60; bar 0: local 60, reference null, ratio null, others 0, ineligible, none; clean true; flags [] | same | agree |
| **B14** (added) | one sounded event: overall and typical null; no interval anywhere | overall null, typical null; bar 0: local null, reference null, ratio null, others 0, ineligible, none; clean true; flags [] | same | agree |
| **B15** (added) | rule 1's "or an omission": the interval spanning a missing event is charged to its ending bar; a missing note makes the example unclean | sounded events 0, 2, 3; intervals 0→2 (4 q, 4 s, 60) and 2→3 (1 q, 1 s, 60), both ending in bar 1; overall 60, typical 60; bar 0: local null, reference 60, ratio null, others 1, ineligible, none; bar 1: local 60, reference null, ratio null, others 0, ineligible, none; clean false; flags [] | same | agree |

### Reports and pools (all added)

| Case | Rules exercised | My numbers | Oracle | Verdict |
|---|---|---|---|---|
| R1 (B1) | a flag on an ineligible bar is a false alarm, negative for each direction; omitted summaries are unreported; summary presence does not feed the gates | slow 0/0/2/1, fast 0/0/2/1, unplaced 0; false findings 2; clean false; bar reports 2 expected, 0 matched, 2 unreported, 0 unexpected, no errors; gates pass | same | agree |
| P1 | pooled false-alarm gates on R1 | slow false alarms 1/2 = 0.5 > 0.05, fast 1/2 → both fail; recall inapplicable (no positives) | [slowFalseAlarms, fastFalseAlarms] | agree |
| R2 (B11) | an `either` bar is outside both denominators; flags on it are neither required nor false alarms | slow 0/0/3/0, fast 0/0/3/0; false findings 0; clean false; 4 expected, 0 matched, 4 unreported; gates pass | same | agree |
| P2 | no pooled failure | 0/3 false alarms each; no positives | [] | agree |
| R3 (B3) | summaries matched by ordinal in any order; zero deltas; a found positive beside a false fast on an eligible `none` bar | slow 1/1/3/0, fast 0/0/4/1; false findings 1; clean false; 4 matched, all deltas 0, otherBars and eligible correct; gates pass (unclean) | same | agree |
| R4 (B2) | first summary for an ordinal wins; a duplicate and an unknown ordinal are unexpected; signed deltas; summary errors alone create no finding | matched ordinals 0, 2; unreported 1, 3; unexpected 2; ordinal 2 deltas 66 − 60 = 6, 55 − 60 = −5, 1.2 − 1 = 0.2, otherBars and eligible wrong; no flags → 0/0/4/0 each; false findings 0; clean true; gates pass | same | agree (0.2 renders as 0.19999999999999996 in doubles) |
| R5 (B13) | a null on either side gives a null delta; count and eligibility mismatches | local delta null (reported null), reference null (truth null), ratio null (truth null); otherBars 1 ≠ 0, eligible true ≠ false; 1 matched; negatives 1 each; clean true; false findings 0; gates pass | same | agree |
| R6 (B2) | one false flag on a clean example fails the `clean` gate | slow 0/0/4/1, fast 0/0/4/0; false findings 1; clean true; 4 unreported; **gates fail** | same | agree |
| P4 | pooled slow false alarms on R6 | 1/4 = 0.25 > 0.05 → fail; fast 0/4 passes | [slowFalseAlarms] | agree |
| R7 (B3) | a missed positive is a pooled recall failure, not a per-example one | slow 1/0/3/0, fast 0/0/4/0; false findings 0; clean false; gates pass | same | agree |
| P3 | pooled slow recall on R7 | 0/1 = 0 < 0.9 → fail | [slowRecall] | agree |
| R8 (B14) | an all-null summary matches an all-null truth: null deltas, counts correct | 1 matched; all deltas null; otherBars 0 = 0, eligible false = false; negatives 1 each; clean true; gates pass | same | agree |

### Suite states, `stage-gates@2` (S9–S13 and E-* added)

| Case | Rule exercised | My state | Oracle | Verdict |
|---|---|---|---|---|
| S1 | attempted open substage, all evidence and sentinels pass, routine run | passed | passed | agree |
| S2 | the same in a full sweep: a first passing sweep establishes `passed` | passed | passed | agree |
| S3 | a routine pass preserves `passed` | passed | passed | agree |
| S4 | a later passing full sweep confirms | confirmed | confirmed | agree |
| S5 | a sentinel failure reopens a `confirmed` substage, unattempted | open | open | agree |
| S6 | a full-sweep failure reopens a `confirmed` substage | open | open | agree |
| S7 | an unattempted open substage stays open | open | open | agree |
| S8 | an attempted open substage whose own evidence fails stays open | open | open | agree |
| **S9** (added) | a routine pass preserves `confirmed`; a routine evaluation confirms nothing further | confirmed | confirmed | agree |
| **S10** (added) | a sentinel failure reopens a `passed` substage | open | open | agree |
| **S11** (added) | a full-sweep failure reopens a `passed` substage | open | open | agree |
| **S12** (added) | an attempted open substage whose own evidence passes while an earlier sentinel fails does not pass | open | open | agree |
| **S13** (added) | a `passed` substage attempted in a routine run whose own evidence fails | open, by the contract's definition of passed ("its own examples and every sentinel pass"); see the note below | open | agree |
| **E-examples … E-cost** (added, 5 cases) | "missing required evidence is failure, never a pass", one required item absent at a time on an attempted open substage | open, all five | open | agree |

### Sentinel selection (C1–C8 added; the version-3 case inherited)

| Case | Rule exercised | My answer | Oracle | Verdict |
|---|---|---|---|---|
| selection, performances | three smallest margins globally; ties by ascending ASCII id; independent of input order | p-b (0.1), then p-a and p-z (0.2, "p-a" < "p-z"); p-c (0.9) out | [p-b, p-a, p-z] | agree |
| selection, controls | one silence and one wrong-score per performed score, the same way | score a: sil-a (tie 0.4 with sil-z, ASCII), wrong-a; score b: sil-b, wrong-b | [sil-a, wrong-a, sil-b, wrong-b] | agree |
| **C1-fewer** | fewer than three performances means all | [p]; [s, w] | same | agree |
| **C2-every-score** | controls per performed score, including a score absent from the top three | [p1, p2, p3]; [sa, wa, sb, wb] | same | agree (the reading instruments 4 states; see the note below) |
| **C3-duplicate** | duplicate IDs fail | reject | reject | agree |
| **C4-negative** | a negative margin fails | reject | reject | agree |
| **C5-no-performance** | no performance fails | reject | reject | agree |
| **C6-missing-control** | a missing paired control fails | reject | reject | agree |
| **C7-nonfinite** | a nonfinite margin fails | reject | reject | agree |
| **C8-parent-score** | a control's performed score is its parent's, not the handed one | w grouped under a via p; [p]; [s, w] | same | agree |

### Normalized headroom (three margin cases, M-*, I1–I4, X1–X7 added; eight margin cases and four retirement cases inherited)

| Case | Formula | My number | Oracle | Verdict |
|---|---|---|---|---|
| onEvent 0.96 | (f − .95)/.05 | 0.2 | 0.2 | agree |
| ahead 0.002 | (.01 − f)/.01 | 0.8 | 0.8 | agree |
| exposure 0.01 | (.05 − f)/.05 | 0.8 | 0.8 | agree |
| episode 0.1 | (.5 − s)/.5 | 0.8 | 0.8 | agree |
| delay 0.04 | (.2 − s)/.2 | 0.8 | 0.8 | agree |
| overall 0.01 | (.05 − |e|)/.05 | 0.8 | 0.8 | agree |
| sustained 0.05 | (.25 − r)/.25 | 0.8 | 0.8 | agree |
| p99 2 | (10 − ms)/10 | 0.8 | 0.8 | agree |
| **rejection 0.97** | (f − .95)/.05 | 0.02/0.05 = 0.4 | 0.4 | agree |
| **delay 0.2** | boundary of the deadline | 0 | 0 | agree |
| **ahead 0.010000000000005** | −5 × 10⁻¹⁵ ÷ 0.01 = −5 × 10⁻¹³, within 1e-12 → clamped | 0 | 0 | agree |
| **M-negative** ahead 0.01000000001 | −10⁻¹¹ ÷ 0.01 = −10⁻⁹, beyond 1e-12 | reject | reject | agree |
| **M-nonfinite** p99 ∞ | nonfinite | reject | reject | agree |
| **I1-relative** | tol max(0.2, 0.03) = 0.2; (0.2 − 0.05)/0.2 | 0.75 | 0.75 | agree |
| **I2-floor** | tol max(0.01, 0.03) = 0.03; (0.03 − 0.015)/0.03 | 0.5 | 0.5 | agree |
| **I3-bound** | (0.03 − 0.03)/0.03; within tolerance (≤) | 0 | 0 | agree |
| **I4-outside** | 0.04 > 0.03: fails the interval gate first | reject | reject | agree |
| **X1-minimum** | min over 1, 1, 1, 1, 0.8, 0.4, 1, 0.75, 0.9, 0.9, 1, 1 | 0.4 | 0.4 | agree |
| **X2-unreached** | an unreached event contributes 0 | 0 | 0 | agree |
| **X3-control** | rejection 0.4, exposure 1, episode 1, cost 0.9, 0.9, gates 1, causality 1 | 0.4 | 0.4 | agree |
| **X4-failed-evidence** | failed binary evidence is refused | reject | reject | agree (see the note below) |
| **X5-failed-causality** | a failed prefix check is failed evidence | reject | reject | agree |
| **X6-missing-causality** | no prefix check at all is missing required evidence | reject | reject | agree |
| **X7-zero-answerable** | zero denominator follows the gates' failure rule | reject | reject | agree |
| retirement [T, T, T], harder | three passes and harder evidence | retire | true | agree |
| retirement [T, T], harder | only two | no | false | agree |
| retirement [T, F, T], harder | not three successive | no | false | agree |
| retirement [T, T, T], no harder | no harder evidence | no | false | agree |
| **retirement [F, T, T, T], harder** (added) | the last three pass | retire | true | agree |

### Run plans (all added)

| Case | Rule exercised | My list | Oracle | Verdict |
|---|---|---|---|---|
| **T1-routine** | attempted open substage's examples + sentinels of passed substages (a retired set keeps its sentinels), sorted | b, c, sil, sil-c, wrong, wrong-c | same | agree |
| **T2-sweep** | a full sweep runs everything, retired sets included | a, b, c, sil, sil-c, wrong, wrong-c | same | agree |
| **T3-retired-sentinels** | nothing attempted: only the sentinels run | b, sil, wrong | same | agree |
| **T4-reopened** | reopening restores a retired set's full examples | a, b, sil, wrong | same | agree |
| **T5-unknown** | attempting a substage the suite does not have | reject | reject | agree |

### Inherited rules sampled from `oracle-2.json`, under the current definitions

Following cases: `following-evaluator@2` is unchanged since version 1 and reads
`performance-label@2` labels exactly as version 1's.

| Case | Rule exercised | My numbers | Oracle | Verdict |
|---|---|---|---|---|
| F1-A | holding through a hesitation; pending D; grace D after each segment; by-event delays | on 10.8 of 10.8 answerable; byEvent 8/8, delays 0.1 × 8; gates [] | same | agree |
| F1-B | a clock: ahead counted separately; the longest episode; `byEvent` with fewer than 20 events | on 4.8, ahead 6 (4–10 s), exposure 6, longest 6; byEvent 5/8, delays [0,0,0,0,null,null,null,0]; gates [onEvent, ahead, exposure, episode, byEvent] | same | agree |
| F2-A | recovery after a missing event | on 7.8; byEvent 7/7 (delay 0.15 on event 4); recovery [1, 1, 0]; gates [] | same | agree |
| F2-B | waiting for ever: behind; recovery not achieved | on 4.0 (grace to 4.2), behind 3.8, exposure 3.8, longest 3.8; byEvent 3/7; recovery [0, 1, 0]; gates [onEvent, exposure, episode, byEvent] | same | agree |
| F2-C | stepping onto the missing event: ahead 0.9 then behind 0.1 | on 6.8, ahead 0.9, behind 0.1, exposure 1, longest 1; byEvent 7/7; gates [onEvent, ahead, exposure, episode] | same | agree |
| F3-A, F3-B | the `dead` admissible set {1, 2}: the predecessor and the dead event both count | on 7.8; byEvent 7/7, delays 0.1 × 7; gates [] | same | agree |
| F3-C | a lucky guess before the distinguishing event is ahead; its delay is 0 but not rewarded | on 6.9, ahead 0.9, exposure 0.9, longest 0.9; delays [0.1, 0.1, 0, 0.1 …]; gates [onEvent, ahead, exposure, episode] | same | agree |
| F3-D | the deadline runs from the distinguishing event: 0.3 s late fails `byEvent` alone | on 7.7, behind 0.1, exposure 0.1; byEvent 6/7, delay 0.3; gates [byEvent] | same | agree |
| F4-A, F4-B | the `repeated` rule: staying on the first C or counting each strike are both on event | on 3.8; byEvent 2/2; gates [] | same | agree |
| F4-C | reaching the distinguishing G at 0.25 s | on 3.75, behind 0.05; byEvent 1/2, delays [0.1, 0.25]; gates [byEvent] | same | agree |
| F4-D | overcounting the run is ahead | on 2.9, ahead 0.9, exposure 0.9, longest 0.9; gates [onEvent, ahead, exposure, episode] | same | agree |
| F6-A | an extra note held | on 7.8; extras [1, 0, 0]; gates [] | same | agree |
| F6-B | moving on the extra: ahead 0.4; `episode` passes at 0.4 ≤ 0.5 | on 7.4, ahead 0.4, exposure 0.4, longest 0.4; extras [0, 1, 0]; byEvent 8/8 (event 3 delay 0); gates [onEvent, ahead, exposure] | same | agree |
| F7-A | uncovered and abstained time; neither is exposure | on 5.9, abstained 1.1, uncovered 0.8; byEvent 6/8; gates [onEvent, byEvent] | same | agree |
| F7-B | a late revision: behind as decided, on event in hindsight | as decided on 7.5, behind 0.3, exposure 0.3, delay 0.5 on event 3, byEvent 7/8, gates [byEvent]; hindsight on 7.8 | same | agree |
| F9 good | bar anchors: indeterminate 0.05 around each start; the first start's band counted once as pending (clarification) | indeterminate 0.1, answerable 7.7, on 7.7; byEvent 0/0; gates [] | same | agree |
| F9 late-honest | a wider band: more indeterminate, nothing wrong | indeterminate 0.2 + 0.8 = 1.0, answerable 6.8, on 6.8; gates [] | same | agree |
| F9 late-narrow | a band narrower than the sync error: the reference is the largest admissible event, so 4 shown before 4.3 is ahead | indeterminate 0.1, answerable 7.7, on 7.55, ahead 0.15 (4.1–4.25), exposure 0.15; gates [ahead] (0.15/7.7 > 0.01) | same | agree |
| F10-A | the `omission-similar` rule: either D counts | on 3.8; byEvent 2/2; recovery [1, 1, 0] (event 3 is the first distinguishable event after the omission) | same | agree |
| F10-B | staying on C4 through the ambiguous D is behind | on 2.9, behind 0.9, exposure 0.9, longest 0.9; gates [onEvent, exposure, episode] | same | agree |
| F11-A | a written dead note played as written: pitchless, so the `dead` rule applies to the sound | on 7.8; byEvent 7/7; gates [] | same | agree |
| F11-C | the lucky guess on a written dead note | on 6.9, ahead 0.9; gates [onEvent, ahead, exposure, episode] | same | agree |
| F12-A | the wrong-score control: correct rejection; recovery not assessable; every extra not assessable | correct rejection 7.8; recovery [0, 0, 1]; extras [0, 0, 8]; gates [] | same | agree |
| F12-B | false following for the whole answerable time | false following 7.8, exposure 7.8, longest 7.8; gates [rejection, exposure, episode] | same | agree |

Assessment cases: the note, interval, overall, control and false-finding measures of
`assessment-evaluator@2`, which version 3 keeps. Their bar verdicts were written under
version 2's whole-piece typical-tempo rule, which version 3 replaced, so I re-derived the
typical tempo, intervals, notes and gates and not those verdicts (see the note on A8).

| Case | Rule exercised | My numbers | Oracle | Verdict |
|---|---|---|---|---|
| A1-A | a partial chord and a wrong note, marked note by note; the heard pitch named | 3 intervals of 1 s; missing 1/1/11/0; wrong 1/1/11/0, pitch named 1; matched 10/10; claimed played 11; tempo claims 4; gates [] | same | agree |
| A1-B | the whole chord called missing: two missing false alarms; a wrong note heard as right | missing 1/1/11/2; wrong 1/0/11/0/0; matched 10/8; false findings 2; claimed played 9; gates [] (unclean) | same | agree |
| A1-C | an omitted statement and a misplaced one: unassessed and unplaced; the `notes` gate | unassessed 2, unplaced 1; matched 10/8; claimed played 9; gates [notes] | same | agree |
| A2-A | durations between matched onsets: 2 s across the gap is not slowing | overall 60; intervals 6/6/0/0/6; missing 1/1/7/0; matched 7/7; claimed played 7; tempo claims 7; gates [] | same | agree |
| A2-B | a false slow flag on an unclean example: counted, not a per-example failure | slow 0/0/2/1; false findings 1; tempo claims 8; gates [] | same | agree |
| A2-C | flagging everything: false alarms on every negative; the pooled gates catch it | slow 0/0/2/2, fast 0/0/2/2, missing 1/1/7/7; matched 7/0; false findings 11; claimed played 0; tempo claims 11; gates [] | same | agree |
| A2-D | hearing the missing note: an unreported interval fails `intervals`; two unexpected | intervals 6/5/1/2/5; missing 1/0/7/0; claimed played 8; gates [intervals] | same | agree |
| A5-A | the `dead` verdict on an unintended dead note | dead 1/1/7/0; matched 7/7; claimed played 8; gates [] | same | agree |
| A5-B | the dead note called missing and measured across | intervals 7/5/2/1/5; missing 0/0/8/1; dead 1/0/7/0; false findings 1; claimed played 7; gates [intervals] | same | agree |
| A5-C | an unidentified pitch is wrong, not dead | wrong 0/0/8/1/0; dead 1/0/7/0; false findings 1; claimed played 8; gates [] | same | agree |
| A8-A, A8-B | the exact-half mean rule for the typical tempo: weights 3 at 50 and 3 at 60, half 3 reached exactly → (50 + 60)/2 | overall 600/11, typical 55; intervals 6/6/0/0/6; missing 1/1/7/0; claimed played 7; tempo claims 7 and 9; gates [] both | same | agree (typical tempo and note measures; bar verdicts are version 2's, see below) |
| A9-A | the 30 ms floor: errors of 20 and 28 ms on 250 ms intervals are within max(25 ms, 30 ms) | intervals 7/7/0/0/7; worst 0.028 s, 0.112; clean true; gates [] | same | agree |
| A9-B | 40 ms is outside both | within 6; worst 0.04, 0.16; gates [intervals] | same | agree |
| A9-C | the overall gate at 250/240 − 1 = 1/24 passes; one false fast on a clean example fails `clean` | overall error 0.041667; fast 0/0/2/1; false findings 1; tempo claims 9; gates [clean] | same | agree |
| A10-A | a written dead note played as written is matched; clean | matched 8/8; dead 0/0/8/0; clean true; gates [] | same | agree |
| A10-B | reporting it dead is a false finding on a clean example | dead 0/0/8/1; matched 8/7; false findings 1; gates [clean] | same | agree |
| A10-C | calling it missing and measuring across | intervals 7/5/2/1/5; missing 0/0/8/1; gates [intervals, clean] | same | agree |
| A12-A | the silence control: every note missing, no tempo; the null-overall rule | overall error null; missing 8/8/0/0; claimed played 0; tempo claims 0; gates [] | same | agree |
| A12-B | saying nothing on a control is honest: unassessed notes are not a control gate | unassessed 8; missing 8/0/0/0; gates [] | same | agree |
| A12-C | hearing the score in silence: `claims` and `tempo` both fail | intervals 0/0/0/7/0; claimed played 8; tempo claims 8; gates [claims, tempo] | same | agree |
| A13-A | the wrong-score control, honest | missing 8/8/0/0; gates [] | same | agree |
| A13-B | mapping the other piece onto the handed score: eight wrong false alarms, both control gates fail | wrong 0/0/8/8/0; missing 8/0/0/0; false findings 8; claimed played 8; tempo claims 8; gates [claims, tempo] | same | agree |

## The arithmetic

### B1

Events (quarter, ordinal, onset): (0, 0, 0), (1, 0, 2), (4, 1, 8), (5, 1, 9). Intervals:
0→1 distance 1, 2 s, 30 per minute, ends in bar 0; 1→2 distance 3, 6 s, 30, ends in bar
1; 2→3 distance 1, 1 s, 60, ends in bar 1. Overall 60 × 5 ÷ 9 = 100/3. Typical: sorted
30 (w1), 30 (w3), 60 (w1), W = 5, half 2.5; cumulative 1, 4 > 2.5 → 30.

Bar 0: local 60 × 1 ÷ 2 = 30. Exclude the one interval ending in bar 0; remaining 30 (w3)
and 60 (w1), W = 4, half 2; cumulative 3 > 2 → reference 30. Distinct ending ordinals
among the remaining: {1} → 1 other bar. Ratio 30/30 = 1. Ineligible (1 < 3) → none.
Bar 1: local 60 × 4 ÷ 7 = 240/7. Exclude both; remaining 30 (w1) → reference 30; others
{0} → 1. Ratio (240/7)/30 = 8/7. Ineligible → none. Clean: bar 1's ratio 8/7 has
|r − 1| = 1/7 ≥ 0.05, so a known variation is present → false. Flags: none eligible → [].

### B2–B10, B12

Unchanged from version 3; my derivations reproduce every field. The details that matter:
B3 bar 3 sums 5→6 (3 q, 3 s) and 6→7 (1 q, 2 s): 240/5 = 48; its reference excludes
both and leaves five intervals at 60. B4 bar 1 sums 1→2 (3 q, 6 s) and 2→3 (1 q, 1 s):
240/7; its reference leaves 30 (w1) and 60 (w8), W = 9, half 4.5, cumulative 1, 4, 5 →
60. B6 bar 0 has no ending interval: local null; the reference still excludes nothing and
sees all three bars. B7 bar 0's reference leaves 60 (w1), 60 (w1), 30 (w12): W = 14,
half 7, the 30 alone reaches 12 → 30; bar 3's leaves 60 × 3 → 60. B8: 5→6 = 12⅓ − 9 =
10/3 s and 6→7 = 13 4/9 − 12⅓ = 10/9 s, sum 40/9, local 240 × 9/40 = 54, ratio 0.9 ≤
0.90 → slow. B9: 129/11 − 9 = 30/11 and 139/11 − 129/11 = 10/11, sum 40/11, local 66,
ratio 1.1 ≥ 1.10 → fast. B10: 231/19 − 9 = 60/19 and 251/19 − 231/19 = 20/19, sum 80/19,
local 57, ratio 0.95: not < 0.05 from 1, not ≤ 0.90 → either. B12 bar 0's reference:
sorted 40 (w1), 60 (w1), 80 (w2), W = 4, half 2; cumulative 1, then 2 = 2 exactly → mean
of 60 and the next, 80 → 70; bars 1 and 2 leave 60 (w1), 80 (w2), 120 (w1) or 40 (w1),
80 (w2), 120 (w1): in each the 80 crosses half → 80; bar 3 leaves 40, 60, 120 (w1 each),
W = 3, half 1.5, cumulative 1, 2 → 60.

### B11

Events (quarter, ordinal, onset): (0, 0, 0), (8, 0, 6), (16, 1, 12), (24, 2, 18),
(31, 3, 23). Intervals: 0→1, 1→2, 2→3 each distance 8, 6 s, 80, ending in bars 0, 1, 2;
3→4 distance 7, 5 s, 60 × 7 ÷ 5 = 84, ending in bar 3. Overall 60 × 31 ÷ 23 = 1860/23 =
80.8696. Typical: sorted 80 (w8), 80 (w8), 80 (w8), 84 (w7), W = 31, half 15.5;
cumulative 8, 16 > 15.5 → 80.

Bars 0–2: local 80. Each reference excludes one 80 and leaves 80 (w16) and 84 (w7),
W = 23, half 11.5; cumulative 8, 16 > 11.5 → 80. Others 3. Ratio 1 → none.
Bar 3: local 84. Reference leaves 80 (w24) → 80. Others {0, 1, 2} → 3. Ratio 84/80 =
21/20 = 1.05: |r − 1| = 0.05, not < 0.05, and 1.05 < 1.10 → either. Eligible. Clean:
an informative ratio outside the central band → false. Flags: either is optional → [].

In doubles, 60 × 7 ÷ 5 = 84 exactly, 84 ÷ 80 is the double nearest 1.05, and that
double minus 1 is 0.050000000000000044 ≥ 0.05: the same side of the bound as the
rational. The audit-3 ambiguity does not recur.

### B13

Events (0, 0, 0), (1, 0, 1). One interval, distance 1, 1 s, 60, ending in bar 0. Overall
60, typical 60. Bar 0: local 60; excluding its one interval leaves nothing → reference
null, ratio null, others 0, ineligible, none. Clean: every note matched, no extras, and a
null ratio cannot establish variation → true. Flags [].

### B14

One event (0, 0, 0). No interval: overall null (fewer than two sounded events), typical
null. Bar 0: no ending interval → local null and ratio null; no other interval →
reference null; others 0; ineligible; none. Clean: the note is matched and nothing shows
variation → true. Flags [].

### B15

Events (0, 0, 0), (1, 0, null), (4, 1, 4), (5, 1, 5); event 1 and its note are missing.
Sounded events 0, 2, 3. Intervals between consecutive sounded events: 0→2 distance 4,
4 s, 60, ending in the bar of event 2 (bar 1), the omission spanned; 2→3 distance 1, 1 s,
60, ending in bar 1. Overall 60 × 5 ÷ 5 = 60; typical 60.
Bar 0: no interval ends here → local null, ratio null. Its reference excludes nothing:
median of 60 (w4), 60 (w1) → 60; the remaining intervals end in {1} → others 1.
Ineligible → none. Bar 1: local 60 × 5 ÷ 5 = 60; excluding both leaves nothing →
reference null, ratio null, others 0; ineligible → none. Clean: n1 missing → false.
Flags [].

### R1–R8 and P1–P4

The flag denominators follow instruments 2 (positives: bars expecting the direction;
negatives: bars expecting neither it nor `either`) with instruments 3's two additions: an
ineligible bar is a negative for each direction, and an `either` bar is in neither
denominator. False findings sum the false alarms of both directions (no note findings are
in play, since every note is matched by shorthand). `clean` is the case's. The per-example
assessment gates are `overall`, `intervals`, `notes` and `clean`; the first three hold by
the shorthand, so `gatesPassed` is false exactly when the case is clean and there is a
false finding. Bar summaries are matched by ordinal, the first summary for a known ordinal
matching; deltas are reported − truth, null if either is null.

- **R1** (B1, ineligible bars 0 and 1, flags [0 slow], [1 fast]): slow negatives 2,
  false alarms 1; fast negatives 2, false alarms 1; findings 2; unclean, gates pass. No
  summaries: 2 unreported. **P1**: 1/2 and 1/2 exceed 0.05 → both false-alarm gates fail;
  no positives, so recall is inapplicable.
- **R2** (B11, bar 3 either, flags [3 slow], [3 fast]): bars 0–2 are negatives (3 each);
  bar 3 is in neither denominator, so its flags are neither detections nor false alarms;
  findings 0; unclean, gates pass. **P2**: 0/3 each → nothing fails.
- **R3** (B3, reversed summaries, flags [3 slow], [0 fast]): slow positives 1 (bar 3),
  detected 1, negatives 3 (bars 0–2), false alarms 0; fast positives 0, negatives 4 (bar
  3 expects slow, which is neither fast nor either), false alarms 1 (bar 0); findings 1;
  unclean, gates pass. Summaries: all four ordinals match with zero deltas.
- **R4** (B2, summaries [2 wrong], [0], [2 right], [9]): the first ordinal-2 summary
  matches; the second is a duplicate and ordinal 9 unknown → unexpected 2; ordinals 1 and
  3 unreported; matched 2. Ordinal 2's deltas: 66 − 60 = 6, 55 − 60 = −5, 1.2 − 1 = 0.2;
  otherBars 2 ≠ 3, eligible false ≠ true. No flags → negatives 4 each, findings 0; clean,
  and summary errors are not findings → gates pass.
- **R5** (B13, summary local null, reference 60, ratio 1, others 1, eligible true): the
  truth is local 60, reference null, ratio null, others 0, ineligible. Deltas: local null
  (reported null), reference null (truth null), ratio null (truth null); count and
  eligibility wrong. Matched 1. No flags; negatives 1 each; clean; gates pass.
- **R6** (B2, no summaries, flag [0 slow]): slow negatives 4, false alarms 1; findings 1
  on a clean example → the `clean` gate fails. **P4**: 1/4 = 0.25 > 0.05 → slow false
  alarms fail; fast 0/4 passes; no positives.
- **R7** (B3, nothing reported): slow positives 1, detected 0; negatives 3 and 4; findings
  0; unclean → gates pass. **P3**: recall 0/1 < 0.9 → slow recall fails.
- **R8** (B14, all-null summary): every delta null on both sides; others 0 = 0, eligible
  false = false; matched 1; negatives 1 each; clean, findings 0, gates pass.

### S1–S13 and E-*

Instruments 3: an attempted open substage passes only when its examples and controls,
all earlier sentinels, pooled gates, causality and cost pass (S1; S2 in a sweep, which
establishes `passed`, not `confirmed`; S8 and S12 fail on own evidence or a sentinel;
E-* fail on any absent required item). A later passing full sweep confirms (S4); routine
passes preserve `passed` and `confirmed` (S3, S9); a sentinel failure or a full-sweep
failure reopens, whatever the state and whether attempted or not (S5, S6, S10, S11); an
unattempted open substage stays open (S7).

**S13** is a `passed` substage attempted in a routine run whose own evidence fails while
its sentinels pass. Instruments 3's explicit transitions name only sentinel and
full-sweep failures as reopening; a reader who takes that list as exhaustive would keep
`passed`. But contract 2 defines a stage as passed "when its own examples and every
sentinel pass", and instruments 3 says "missing required evidence is failure, never a
pass" and that only routine *passes* preserve state. A substage whose own examples have
just failed does not satisfy the definition of passed, so I read it as open, agreeing
with the oracle. The next instruments version could add the sentence "an attempted
substage whose own evidence fails is open" so this does not rest on the contract's
definition.

### Selection, C1–C8

The version-3 case: performances ranked by margin, ties by ASCII id; controls per
performed score, the same way. C1: one performance is fewer than three → all of them.
C2: the top three (p1–p3, margins 0.1–0.3) are all on score a; p4 (0.9) on score b is
not chosen, yet b is a performed score, so its silence and wrong-score controls are
chosen too. Audit 3 recorded "per performed score" as unresolved between "the chosen
sentinels' scores" and "every performance's score"; instruments 4 states the second
("every performed score even when absent from the top 3"), which is also what contract
2's "one silence and one wrong-score control per score" says of a substage, so I agree
with the oracle. C3–C7 are the listed failure conditions (duplicate IDs, a negative
margin, no performance, a missing paired control, a nonfinite margin), each a rejection.
C8: the wrong-score control's handed score is "unrelated", but its parent performance
plays a, so it is grouped under a and chosen with the silence control.

### Headroom

Each formula is instruments 3's, with the gate budgets from contract 2. The three added
margin cases: `rejection` 0.97 → (0.97 − 0.95)/0.05 = 0.4; `delay` 0.2 → exactly the
deadline, headroom 0, and the event counts as reached (the by-event window is closed);
`ahead` 0.010000000000005 → the raw excess is 5 × 10⁻¹⁵, the margin −5 × 10⁻¹³, inside
the 1e-12 clamp → 0. M-negative's excess is 10⁻¹¹, margin −10⁻⁹, outside the clamp →
failure; M-nonfinite's (10 − ∞)/10 is not finite → failure.

Interval headroom: tolerance max(0.1 × expected, 0.03). I1: 0.2, (0.2 − 0.05)/0.2 = 0.75.
I2: 0.03, (0.03 − 0.015)/0.03 = 0.5. I3: 0.03, error 0.03 is within (≤) → 0. I4: 0.04
exceeds 0.03, so the interval gate has already failed; a failed interval is failed
evidence, not a zero-ranked pass → refused.

Example margins: X1's entries are onEvent 1 → 1, ahead 0 → 1, exposure 0 → 1, episode 0
→ 1, delays 0.04 → 0.8 and 0.12 → 0.4, overall 0 → 1, the interval → 0.75, sustained
0.025 → 0.9, p99 1 → 0.9, gates passed → 1, causality passed → 1; minimum 0.4. X2's
null delay is an unreached event → 0, the minimum. X3 is a control: rejection 0.97 →
0.4, exposure and episode → 1, cost → 0.9 and 0.9, binary → 1; minimum 0.4. X4–X6:
failed binary evidence, a failed prefix check, and no prefix check at all (required
causality evidence missing) are each refused rather than ranked. X7: answerable time 0
makes every fraction's denominator zero, which the gates treat as failure → refused.

**On X4 and X5.** Instruments 3 says binary gates "contribute 1 when passed, 0 when
failed", which read alone would give X4 the number 0; instruments 4 says "failed binary
evidence and zero answerable time are refused, not ranked". Instruments 4 is the
declared rule text, and the two readings give the same sentinel selection (instruments
3 also lists "failed evidence" among the conditions selection fails on), so I agree
with the oracle and record the wording tension here rather than as an ambiguity: no
number a gate reads differs. The next instruments version could reconcile the two
sentences.

Retirement: three successive passing evaluations and named harder evidence. [F, T, T, T]
has its last three passing and three successive passes at its end, so both the
contract's "last three" and instruments 3's "three successive" readings retire it.

### Plans

Routine plan: every example of an attempted open substage, plus the frozen sentinels of
every passed or confirmed substage (a retired set keeps its sentinels until its
replacement retires), deduplicated and sorted. T1: {c, sil-c, wrong-c} ∪ {b, sil, wrong}.
T3: nothing attempted → the sentinels alone. T4: `early` is open again and attempted, so
its full set {a, b, sil, wrong} runs; `new` is open but unattempted. T2: a full sweep
runs every set, retired included, so all seven. T5: a plan cannot attempt a substage the
suite does not define → rejected.

### Inherited following samples

All times in seconds; D = 0.2. Pending is [0, 0.2). Grace: for 0.2 s after each segment
start the previous segment's admissible events also count. The reference for `ahead`
and `behind` is `truth`, or the largest admissible event when `truth` is null.

- **F1** (toy8, onsets 0, 1, 2, 3, 7, 8, 9, 10; duration 11; answerable 10.8). A shows
  each event 0.1 s after its onset: every moment is on an admissible event, by grace
  during the 0.1 s lags → on 10.8; each delay 0.1. B advances at 1 s steps: on from 0.2
  to 4 (3.8) and 10 to 11 (1); from 4 to 7 it shows 4, 5, 6 against truth 3 (ahead 3),
  from 7 to 10 it shows 7 against truths 4, 5, 6 (ahead 3) → on 4.8, ahead 6, one
  episode of 6. Events 4, 5, 6 (onsets 7, 8, 9) are never shown in their windows;
  events 0–3 and 7 have delay 0 → 5 of 8. Fractions 0.444, 0.556, 0.556, 6 s, 5/8 fail
  all five gates.
- **F2** (event 3 missing; duration 8; answerable 7.8). A: on throughout; event 4's
  delay 0.15; recovery: the missing run {3} is followed by distinguishable event 4,
  reached → [1, 1, 0]. B stops on 2: on to 4.2 (grace) = 4.0, behind 3.8 after; by
  event 3 of 7; recovery [0, 1, 0]; `ahead` passes so it is not in the gate list. C
  shows 3 from 3.1: ahead 0.9 until 4 (3 is after truth 2), behind 0.1 from 4 to 4.1 (3
  is before truth 4 and not in the grace set {2}) → on 6.8, exposure 1 in one episode.
- **F3** (E4 dead at 2; segment from 2 has truth 2, admissible {1, 2}). A stays on 1
  through the dead onset: admissible; B shows 2: admissible → both on 7.8; seven
  distinguishable events (event 2 has none), delays 0.1. C shows 3 from 2.1: ahead 0.9
  until 3, then on; event 3's delay is 0 (first shown at or after 3 → 3.0) → 7 of 7, but
  on 6.9/7.8 = 0.885, ahead 0.115, exposure 0.115, episode 0.9 fail. D shows 3 at 3.3:
  grace covers 3–3.2, behind 3.2–3.3 (0.1); delay 0.3 > D → 6 of 7 → `byEvent` fails
  alone (on 0.987, exposure 0.013, episode 0.1 pass).
- **F4** (chordsRepeat; admissible {0}, {0, 1}, {0, 1, 2}, {3}; answerable 3.8). A and B
  are on throughout. C reaches 3 at 3.25: grace to 3.2, behind 0.05; delay 0.25 → 1 of
  2 → `byEvent`. D shows 2 from 1.1: truth 1, admissible {0, 1}, 2 is after → ahead 0.9
  until 2, then admissible → on 2.9, four gates fail.
- **F6** (extra at 2.5–2.8). A holds 2 through it: the extra's onset is in answerable time
  with the cursor on event, and the cursor stays on event until the next segment (3) →
  held [1, 0, 0]. B moves to 3 at 2.6: ahead 0.4 until 3 → moved [0, 1, 0]; event 3's
  delay 0; on 7.4/7.8 = 0.949 < 0.95 fails, ahead and exposure 0.051 fail, episode
  0.4 ≤ 0.5 passes.
- **F7** (perfect performance). A: 0.2–1 nothing shown → uncovered 0.8; 1–2.1
  `unsupported` while truth is supported → abstained 1.1; then on 5.9; events 0 and 1
  never shown → 6 of 8; abstention is not exposure, so `onEvent` and `byEvent` fail
  only. B decides at 3.5 that 3 began at 3.05: as decided, 3–3.2 grace, 3.2–3.5 behind
  (0.3), delay 0.5 → 7 of 8, `byEvent` alone; in hindsight the decision refers to 3.05,
  within grace → on 7.8.
- **F9** (bar-resolution labels, truth null). Good: starts 0 and 4, uncertainty 0.05.
  [0, 0.05) is inside pending and counts once as pending (the clarification); [3.95, 4.05)
  is indeterminate 0.1; answerable 8 − 0.2 − 0.1 = 7.7; the cursor is always in the
  anchored bar's set or its grace → on 7.7. Late-honest: starts 0 and 4.3, uncertainty
  0.4: [0.2, 0.4) is 0.2 indeterminate beyond pending, [3.9, 4.7) is 0.8 → 1.0;
  answerable 6.8, all on. Late-narrow: uncertainty 0.05 around 4.3 → [4.25, 4.35) is 0.1;
  answerable 7.7; from 4.1 to 4.25 the cursor shows 4 while the first segment ({0–3},
  reference 3) is still in force → ahead 0.15; on 7.55; 0.15/7.7 = 0.019 > 0.01 →
  `ahead` fails; exposure 0.019 and episode 0.15 pass.
- **F10** (toyDD, first D omitted; segment from 2 has truth 2, admissible {1, 2}). A shows
  1 from 2.1: admissible → on 3.8; recovery: the missing run {1} is followed by event 2,
  which is not distinguishable, so the first distinguishable sounded event after it is 3,
  reached at 3.1 → [1, 1, 0]. B stays on 0: behind from 2.2 to 3 (0.8) and 3–3.1 (0.1;
  grace {1, 2} ∪ {3} excludes 0) → on 2.9, exposure 0.9.
- **F11** (toyDW, E4 written dead, sounded pitchless): the admissible sets equal F3's, so
  A and C reproduce F3-A and F3-C.
- **F12** (wrong-score control: one unsupported segment, eight extras). A says
  `unsupported` from 0.1: correct rejection 7.8; recovery: one run of eight missing
  events with no event after → [0, 0, 1]; extras: the cursor is never on event → all
  eight not assessable [0, 0, 8]. B follows: false following 7.8 = exposure = longest;
  `rejection`, `exposure` and `episode` fail.

### Inherited assessment samples

- **A1** (chordsVaried: 12 notes; v1b missing; v2b heard at 46). Three 1 s intervals,
  overall 60. A: missing 1/1/11/0; wrong 1/1/11/0 with the pitch named; matched 10 of 10
  confirmed; claimed played 10 + 1 = 11; tempo claims 1 + 3 = 4. B: v1a and v1c reported
  missing are two missing false alarms; v2b reported `match` leaves the wrong positive
  undetected; matched confirmed 8; claimed played 9; unclean, so no per-example gate
  fails. C: v3c omitted and v0a placed at event 1 → unassessed 2, unplaced 1 → `notes`.
- **A2** (toy8, event 3 missing): sounded 0, 1, 2, 4, 5, 6, 7; six intervals, 2→4 lasting
  2 s over 2 quarters → 60; overall 60 × 7 ÷ 7. Bars 0 and 1 under the current
  definitions each have one other bar, so they are ineligible and expect none; under
  version 2 they were none as well. A: correct; tempo claims 1 + 6. B: bar 1 slow is a
  false alarm on a `none` bar; still unclean → gates pass. C: every negative flagged
  (2 + 2) and seven missing false alarms → 11 findings; matched confirmed 0; claimed
  played 0; tempo claims 1 + 6 + 4. D: seven intervals reported for six expected: 2→4
  unreported, 2→3 and 3→4 unexpected → `intervals` fails.
- **A5** (E4 unintended dead). A: dead 1/1/7/0; claimed played counts matched, wrong and
  dead → 8. B: n2 missing is a missing false alarm and the dead positive is missed;
  intervals 1→3 unexpected, 1→2 and 2→3 unreported → `intervals`. C: a null-pitch
  substitution is a wrong false alarm (pitch named 0), not a dead detection.
- **A8** (bar 1 at 1 s steps, bar 2 at 1.2 s steps, C5 missing): six intervals, 60 × 3
  and 50 × 3, each of distance 1: W = 6, half 3, reached exactly at the third 50 → typical
  (50 + 60)/2 = 55; overall 60 × 6 ÷ 6.6 = 600/11. Under version 2 the bars' ratios
  against 55 are 12/11 and 10/11, both `either`, so neither report's flags are required or
  false and the slow and fast negatives are 0, as the oracle records. Under the current
  rule each bar's reference would be the other bar (50 and 60) with one other bar, so
  both are ineligible: version 3 changed this rule and version 4 pins it with B1–B15, so
  A8's bar verdicts are not re-derived as a current-rule case.
- **A9** (240 per minute, 0.25 s intervals): tolerance max(0.025, 0.03) = 0.03. A's errors
  0.02, 0.02, 0.028 are within; worst 0.028 s and 0.028/0.25 = 0.112. B's 0.04 is not:
  within 6 of 7. C: 250/240 − 1 = 1/24 ≈ 0.0417 within 0.05; a fast flag on bar 1, a
  `none` bar of a clean example → `clean`.
- **A10** (E4 written dead, played as written): matched, clean. B: reporting `dead` is a
  dead false alarm → `clean`. C: `missing` is a missing false alarm, and measuring across
  it fails `intervals`.
- **A12** (silence control): expected overall null; A reports null → error null and the
  overall gate's null rule holds; missing 8/8/0/0; claimed 0; tempo claims 0. B leaves
  all eight unassessed, which a control permits. C claims eight notes and eight tempo
  facts (overall + 7 intervals, all unexpected) → `claims`, `tempo`.
- **A13** (wrong-score control): A as A12-A. B: eight substitutions with a pitch are eight
  wrong false alarms on eight negatives; the missing positives are undetected; claimed
  played 8; tempo claims 8 → `claims`, `tempo`.

## Precision

The oracle writes doubles. Evaluated as doubles, B8's frozen onsets give bar 3 exactly
54 and ratio 0.9 (the double of 0.9), B9's give 66.00000000000003 and ratio
1.1000000000000005 (above the double of 1.1), and B10's give 56.99999999999999 and
|r − 1| = 0.050000000000000155 (above 0.05): each lands on the same side of its bound as
the rational, so the verdicts slow, fast and either hold under either reading, and the
whole-piece overall tempi agree to the sixteenth significant figure. B11 is exact. The
headroom case onEvent 0.96 renders as 0.20000000000000018 and R4's ratio delta as
0.19999999999999996; I count these as agreement at the stated precision.

## Rules not exercised by any oracle case

Not in version 4, and not in any earlier oracle either:

- `byEvent` on an example with 20 or more distinguishable events, where 95% suffices,
  and with it "deadline headroom is used even where the by-event fraction would allow
  an omission": every toy score is shorter (the README already records this).
- A flag on a bar whose ratio is null (B6's bar 0, B13, B14, B15): rule 4 makes it a
  false alarm, but R5 and R8 carry no flags.
- A flag on a bar the score does not have under instruments 3 (`unplaced` is 0 in every
  R case; oracle 2's only unplaced item, A1-C, is a note statement).
- Re-choosing sentinels at a full sweep, and "a failing sentinel reopens rather than
  being replaced" (S5 and S10 pin the reopening, not the non-replacement).
- The retirement record's contents (date, evidence, replacement), citation by hash of
  unchanged producers, and the frozen baselines' sweep-only status: procedural rules with
  no number to freeze; instruments 4 says they are checked structurally against the
  historical suite record, which no performance set has retired from, so that check is
  vacuous and I did not read it.
- The bootstrap rule (keep the old verdict, mark version-3 revalidation pending) and the
  time budget: procedural, no oracle case.

Covered by `oracle-2.json` but not re-derived in this audit: F5 (wrong notes and partial
chords move the cursor), F8 (the silence control's cursor), A3, A4, A6, A7 (variation
cases whose bar verdicts were written under the superseded whole-piece rule) and A11 (a
written dead note played with a pitch is wrong). Audit 2 covers them.

## Summary

**138 cases checked: 138 agree, 0 disagree, 0 ambiguous.** In `oracle-4.json`, 89:
15 assessment (B1 and B11 changed, B13–B15 added), 8 reports and 4 pools, 13 suite
states and 5 required-evidence cases, the selection case's 2 lists and 8 selection cases,
11 margin cases, 2 margin rejections, 4 interval and 7 example margins, 5 retirement
cases and 5 plans. From `oracle-2.json`, 49: 26 following records over ten cases and 23
reports over eight cases, re-derived under the current definitions. B1's corrected bar-0
reference and ratio (30, 1) and B11's exact `either` boundary both agree; the audit-3
disagreement and ambiguity are resolved. Two places where the rule text is thinner than
the case are recorded above without changing a verdict: S13's reopening rests on
contract 2's definition of passed rather than on instruments 3's transition list, and
X4/X5's refusal rests on instruments 4's sentence where instruments 3's reads as
"contribute 0". The rules still without a frozen case are listed above; none of them is
read by a gate on the stages in hand.

Model: Claude Fable 5.1 (high) in Claude Code, a session distinct from the one that wrote
the oracle (Sol 6.1 (high) in Codex).
