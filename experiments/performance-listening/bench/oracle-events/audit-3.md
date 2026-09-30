# Audit of event-oracle@3

An independent re-derivation of **event-oracle@3** from the rules alone, under
[contract 2's audit rule](../../contracts/development-contract-2.md#auditing-an-oracle),
following [AUDITING_AN_ORACLE.md](../../AUDITING_AN_ORACLE.md). Performed 2026-09-30.

**What was audited.** `oracle-3.json`, sha256
`3b83278b5df9ece9317343b4a5b02a49fa7c737a59f6b74e3a98bfc73a55fd48`, as `freeze-3.json`
records it (verified with `sha256sum`). The oracle was written by Sol 6.1 (high) in Codex;
this audit was not.

**The rule text worked from**, and nothing else:

| File | Version | Used for |
|---|---|---|
| `contracts/event-instruments-3.md` | version 3, 2026-09-30 | `assessment-evaluator@3`'s bar rules 1–5, `stage-gates@2`'s states, sentinel selection, normalized headroom, retirement |
| `contracts/event-instruments-2.md` | version 2, 2026-09-30 | everything version 3 inherits by reference: intervals, overall tempo, the score-distance-weighted median with the exact-half mean rule, bar tempo, θ = 0.10 and the inclusive bounds |
| `contracts/development-contract-2.md` | in force from 2026-09-30 | the other-bars rule, the rising tide (sentinels, retirement, sweeps), the approved gates whose budgets the headroom formulas normalize |
| `bench/oracle-events/README.md`, `freeze-3.json`, `oracle-2.json` | | the case shorthand, the hash, and to confirm that every case in version 3 is new |

Not read: `bench/src/events/`, its tests, report 028 beyond its title, any run. Nothing
was run; a calculator was used only to render my rational results as decimals and to
check the frozen decimal onsets of B8–B11 (below).

**Scope.** Every case in the oracle, not a sample: version 3 carries no case forward, so
B1–B12, S1–S8, the selection case, the eight headroom cases and the four retirement cases
are all new. For each assessment case I worked the intervals, the overall and typical
tempo, and every bar's local tempo, reference, ratio, other-bar count, eligibility and
expected verdict, then `clean` and the flag list, before comparing.

**The shorthand as I read it.** `quarters[i]`, `ordinals[i]` and `onsets[i]` describe
sounded event *i*: its score position in quarters, its performed measure ordinal and its
onset in seconds; one matched note per event, no extras, no missing event. `flags` is
the set of flags a correct report carries: every eligible bar expecting `slow` or `fast`,
with `either` bars omitted. `states` gives a substage's state before the evaluation,
whether the run attempted it, whether the run was a full sweep, whether its own required
evidence (examples, controls, pooled gates, causality, cost) passed, and whether its
sentinels passed.

## Verdicts

Assessment cases. "Other refs" is the reference of every bar not otherwise named.

| Case | Rules exercised | My numbers | Oracle | Verdict |
|---|---|---|---|---|
| B1 | crossing interval assigned to its ending bar; exclusion by ending bar; two-bar ineligibility; `clean` not rescued by ineligibility | overall 100/3, typical 30; bar 0: local 30, **reference 30, ratio 1**, others 1, ineligible, none; bar 1: local 240/7, reference 30, ratio 8/7, others 1, ineligible, none; clean false; flags [] | bar 0 **reference 60, ratio 0.5**; everything else the same | **disagree** (bar 0's reference and ratio) |
| B2 | steady four bars; exactly three contributors each | overall 60, typical 60; every bar 60/60, ratio 1, others 3, eligible, none; clean true | same | agree |
| B3 | two intervals summed in one bar; a slow final bar | overall 390/7, typical 60; bar 3: local 48, reference 60, ratio 0.8, slow; other refs 60, none; clean false; flags [[3, slow]] | same | agree |
| B4 | crossing interval with three other bars; two slow bars | overall 780/17, typical 60; bar 0: 30/60, 0.5, slow; bar 1: 240/7 ÷ 60 = 4/7, slow; bars 2–3: 60/60 none; others 3 throughout; clean false; flags [[0, slow], [1, slow]] | same | agree |
| B5 | uniform half speed is clean | overall 30, typical 30; every bar 30/30, ratio 1, eligible, none; clean true | same | agree |
| B6 | a bar with no ending interval: null local and ratio; other-bar counts of 2 | overall 60, typical 60; bar 0: local null, reference 60, ratio null, others 3, ineligible, none; bars 1–3: 60/60, ratio 1, others 2, ineligible, none; clean true | same | agree |
| B7 | a self-dominating interval: whole-piece median 30, leave-out reference 60 | overall 100/3, typical 30; bars 0–2: 60/30, ratio 2, fast; bar 3: 30/60, 0.5, slow; others 3; clean false; four flags | same | agree |
| B8 | inclusive slow bound r = 0.90 | overall 7020/121, typical 60; bar 3: 54/60, ratio 0.9, slow; other refs 60; clean false; flags [[3, slow]] | same | agree (see precision) |
| B9 | inclusive fast bound r = 1.10 | overall 8580/139, typical 60; bar 3: 66/60, ratio 1.1, fast; other refs 60; clean false; flags [[3, fast]] | same | agree (see precision) |
| B10 | outer edge of the none band, r = 0.95, is `either` | overall 14820/251, typical 60; bar 3: 57/60, ratio 0.95, either; other refs 60; clean false; flags [] | same | agree (see precision) |
| B11 | outer edge of the none band, r = 1.05, is `either` | onsets read as the rationals they approximate (83/7, 269/21): bar 3 63/60, ratio **21/20, either, clean false**; onsets read as the literal decimals: bar 3 62.999…, ratio **1.0499999999999998, none, clean true**; overall 16380/269, typical 60, other refs 60 either way | ratio 1.05, either, clean false | **ambiguous** (bar 3's `expected` and `clean`) |
| B12 | unequal toy meters; the exact-half mean rule in a reference; three distinct references | overall 200/3, typical 80; bar 0: 120, reference **70** (exact half: mean of 60 and 80), ratio 12/7, fast; bar 1: 40/80, 0.5, slow; bar 2: 60/80, 0.75, slow; bar 3: 80/60, 4/3, fast; others 3; clean false; four flags | same | agree |

Suite states, `stage-gates@2`.

| Case | Rule exercised | My state | Oracle | Verdict |
|---|---|---|---|---|
| S1 | attempted open substage, all evidence and sentinels pass, routine run | passed | passed | agree |
| S2 | the same in a full sweep: a first passing sweep establishes `passed`, never `confirmed` | passed | passed | agree |
| S3 | a routine pass preserves `passed`; a routine evaluation confirms nothing | passed | passed | agree |
| S4 | a later passing full sweep confirms a `passed` substage | confirmed | confirmed | agree |
| S5 | a sentinel failure reopens its substage, even unattempted and even `confirmed` | open | open | agree |
| S6 | a full-sweep failure reopens a `confirmed` substage | open | open | agree |
| S7 | an unattempted open substage stays open, whatever passes | open | open | agree |
| S8 | an attempted open substage whose own evidence fails stays open | open | open | agree |

Sentinel selection, normalized headroom and retirement.

| Case | Rule exercised | My numbers | Oracle | Verdict |
|---|---|---|---|---|
| selection, performances | three smallest margins globally; ties by ascending ASCII id; independent of input order | p-b (0.1), then p-a and p-z (0.2, tie: "p-a" < "p-z"); p-c (0.9) excluded | [p-b, p-a, p-z] | agree |
| selection, controls | one silence and one wrong-score per performed score, chosen the same way | score a: silence tie 0.4/0.4 → sil-a; wrong-a; score b: sil-b; wrong-b | [sil-a, wrong-a, sil-b, wrong-b] | agree |
| onEvent 0.96 | (fraction − .95)/.05 | 0.01/0.05 = 0.2 | 0.2 | agree |
| ahead 0.002 | (.01 − fraction)/.01 | 0.008/0.01 = 0.8 | 0.8 | agree |
| exposure 0.01 | (.05 − fraction)/.05 | 0.04/0.05 = 0.8 | 0.8 | agree |
| episode 0.1 s | (.5 − longest)/.5 | 0.4/0.5 = 0.8 | 0.8 | agree |
| delay 0.04 s | (.2 − delay)/.2 | 0.16/0.2 = 0.8 | 0.8 | agree |
| overall 0.01 | (.05 − \|error\|)/.05 | 0.04/0.05 = 0.8 | 0.8 | agree |
| sustained 0.05 | (.25 − ratio)/.25 | 0.2/0.25 = 0.8 | 0.8 | agree |
| p99 2 ms | (10 − p99)/10 | 8/10 = 0.8 | 0.8 | agree |
| retirement [T,T,T], harder | three successive passes and named harder evidence | retire | true | agree |
| retirement [T,T], harder | only two evaluations | keep | false | agree |
| retirement [T,F,T], harder | passes not successive | keep | false | agree |
| retirement [T,T,T], no harder | no harder active evidence | keep | false | agree |

## The arithmetic

Notation: interval *iₖ* runs from sounded event *k* to *k+1*; d = score distance in
quarters, s = seconds, t = 60·d/s; "ends" names the ordinal of event *k+1*. Weighted
median: sort by t ascending, accumulate d, stop at the first interval reaching W/2; a
strict excess takes that tempo, an exact half takes the mean of it and the next.

### B1

Events (quarter, ordinal, onset): (0,0,0), (1,0,2), (4,1,8), (5,1,9).

| | d | s | t | ends |
|---|---|---|---|---|
| i₀ | 1 | 2 | 30 | 0 |
| i₁ | 3 | 6 | 30 | 1 |
| i₂ | 1 | 1 | 60 | 1 |

Overall 60·5/9 = 100/3 = 33.333…. Typical: sorted 30 (1), 30 (3), 60 (1); W = 5,
W/2 = 2.5; accumulated 1, then 4 > 2.5 → 30.

Bar 0 own: i₀ only, 60·1/2 = 30. Reference: rule 2 excludes every interval **ending** in
bar 0, which is i₀ alone; remaining i₁ (30, d 3) and i₂ (60, d 1); W = 4, W/2 = 2;
accumulated 3 > 2 → **30**. Other bars: the remaining intervals end in {1} → 1. Ratio
30/30 = **1**. Ineligible (1 < 3) → none.

Bar 1 own: i₁ + i₂, 60·(3+1)/(6+1) = 240/7 = 34.2857…. Reference: remaining i₀ → 30.
Others {0} → 1. Ratio (240/7)/30 = 8/7 = 1.142857…. Ineligible → none.

Clean: bar 1's ratio 8/7 is informative and outside |r − 1| < 0.05 → not clean, under
either reading of bar 0.

**Where the oracle departs.** Its bar 0 reference is 60, which only the remaining
interval i₂ can supply, so both i₀ and i₁ were left out of bar 0's reference. i₁ ends in
bar 1: rule 2 keeps it in bar 0's reference, and the oracle itself counts it toward bar 1's
own tempo (240/7), so the frozen case excludes i₁ from one bar's reference while
attributing it to the other bar's tempo. Under the written rules an interval feeds exactly
one bar's own tempo and is excluded from exactly that bar's reference. The reading that
gives 60 is "exclude every interval that touches bar 0"; it is not the rule's reading.
The slip hides in the local tempo because 60·1/2 and 60·4/8 are both 30. Neither
verdict changes (both bars are ineligible) and `clean` is false either way, so the
disagreement is confined to bar 0's `reference` and `ratio`, two informational fields;
but a corrected version must still carry the right numbers, since the evaluator reports
reference and ratio errors against them.

### B2

Onsets equal quarters; ordinals 0,0,1,1,2,2,3,3. Every interval has t = 60: d/s =
1/1, 3/3, 1/1, 3/3, 1/1, 3/3, 1/1, ending in bars 0, 1, 1, 2, 2, 3, 3. Overall
60·13/13 = 60; typical 60. Bar 0 own d 1 → 60; bars 1–3 own d 4 → 60 (the "1, 4, 4, 4"
of the author's note). Each reference: the remaining intervals are all 60 → 60; they end
in the other three ordinals → others 3, eligible, ratio 1, none. Clean: every note matched,
no extras, every ratio in the band → true.

### B3

As B2 except onset₇ = 14: i₆ has d 1, s 2, t 30, ends 3. Overall 60·13/14 = 390/7 =
55.7142…. Typical: sorted 30 (1), 60 (12); W = 13, W/2 = 6.5; 1 < 6.5, 13 > 6.5 → 60.
Bar 3 own: i₅ + i₆ = 60·(3+1)/(3+2) = 48. Reference: remaining five intervals all 60 → 60;
others {0,1,2} = 3; ratio 0.8 ≤ 0.90 → slow. Bar 0 reference: remaining 30 (1) and 60
(11), W = 12, W/2 = 6, 1 < 6, 12 > 6 → 60. Bars 1 and 2: remaining 30 (1), 60 (8); W = 9,
W/2 = 4.5 → 60. Ratios 1, none. Clean false (0.8 informative and outside the band).
Flags [[3, slow]].

### B4

Onsets 0, 2, 8, 9, 12, 13, 16, 17.

| | d | s | t | ends |
|---|---|---|---|---|
| i₀ | 1 | 2 | 30 | 0 |
| i₁ | 3 | 6 | 30 | 1 |
| i₂ | 1 | 1 | 60 | 1 |
| i₃ | 3 | 3 | 60 | 2 |
| i₄ | 1 | 1 | 60 | 2 |
| i₅ | 3 | 3 | 60 | 3 |
| i₆ | 1 | 1 | 60 | 3 |

Overall 60·13/17 = 780/17 = 45.8823…. Typical: 30 (4), 60 (9); W = 13, W/2 = 6.5;
4 < 6.5, 13 > 6.5 → 60.

Bar 0 own 30. Reference: remaining 30 (3), 60 (9); W = 12, W/2 = 6; 3 < 6 → 60. Others
{1,2,3} = 3. Ratio 0.5 → slow. Bar 1 own 240/7. Reference: remaining 30 (1), 60 (8);
W = 9, W/2 = 4.5 → 60. Ratio (240/7)/60 = 4/7 = 0.5714… → slow. Bar 2 own
60·4/4 = 60. Reference: remaining 30 (4: i₀, i₁), 60 (5: i₂, i₅, i₆); W = 9, W/2 = 4.5;
4 < 4.5, 9 > 4.5 → 60; ratio 1 → none. Bar 3 likewise → 60, none. Others 3 everywhere.
Clean false. Flags [[0, slow], [1, slow]].

This is the four-bar form of B1: with three other bars at 60 the crossing interval no
longer dominates bar 0's reference, and 60 is right here for the reason it is wrong in B1.

### B5

Onsets 0, 2, 8, 10, 16, 18, 24, 26: every s is twice B2's, so every t = 30. Overall
60·13/26 = 30; typical 30; every bar own 30, reference 30 (all remaining are 30), others 3,
ratio 1, none. Clean true.

### B6

Events (0,0,0), (4,1,4), (8,2,8), (12,3,12). Three intervals, each d 4, s 4, t 60,
ending in bars 1, 2, 3. Overall 60·12/12 = 60; typical 60. Bar 0: no interval ends in it
→ local null, ratio null; reference from all three → 60; others {1,2,3} = 3; ineligible
(null local) → none. Bar 1: own 60; reference from i₁, i₂ → 60; others {2,3} = 2 →
ineligible → none. Bars 2 and 3 the same with others {1,3} and {1,2}. Clean: no informative
ratio outside the band → true.

### B7

Events (0,0,0), (1,0,1), (2,1,2), (3,2,3), (15,3,27). i₀, i₁, i₂: d 1, s 1, t 60,
ending 0, 1, 2. i₃: d 12, s 24, t 30, ends 3. Overall 60·15/27 = 100/3 = 33.333….
Typical: 30 (12), 60 (3); W = 15, W/2 = 7.5; 12 > 7.5 → 30.

Bars 0, 1, 2: own 60; reference from the two unit intervals at 60 and i₃ at 30: 30 (12),
60 (2); W = 14, W/2 = 7; 12 > 7 → 30; others 3; ratio 2 ≥ 1.10 → fast. Bar 3: own
60·12/24 = 30; reference from i₀–i₂ → 60; others {0,1,2} = 3; ratio 0.5 → slow.
Clean false. Flags [[0, fast], [1, fast], [2, fast], [3, slow]].

### B8

Onsets 0, 1, 4, 5, 8, 9, 12.333333333333334, 13.444444444444445. Reading the last two as
37/3 and 121/9: i₅ has d 3, s 37/3 − 9 = 10/3, t = 180·3/10 = 54; i₆ has d 1,
s = 121/9 − 37/3 = 10/9, t = 54. Bar 3 own 60·4/(10/3 + 10/9) = 240/(40/9) = 54; ratio
54/60 = 0.9 ≤ 0.90 → slow (the bound included). Overall 60·13/(121/9) = 7020/121 =
58.0165289…. Typical: 54 (4), 60 (9); W/2 = 6.5; 4 < 6.5 → 60. Bar 0 reference: 54 (4),
60 (8), W/2 = 6, 4 < 6 → 60; bars 1–2: 54 (4), 60 (5), W/2 = 4.5, 4 < 4.5 → 60. Others 3.
Clean false. Flags [[3, slow]].

### B9

Last two onsets 129/11 and 139/11: i₅ s = 30/11, t = 180·11/30 = 66; i₆ s = 10/11,
t = 66. Bar 3 own 240/(40/11) = 66; ratio 1.1 ≥ 1.10 → fast. Overall 60·13/(139/11) =
8580/139 = 61.7266…. Typical 60 (60 has weight 9 of 13, sorted first). References 60
(60 always reaches W/2 first). Clean false. Flags [[3, fast]].

### B10

Last two onsets 231/19 and 251/19: i₅ s = 60/19, t = 180·19/60 = 57; i₆ s = 20/19,
t = 57. Bar 3 own 240/(80/19) = 57; ratio 0.95: not ≤ 0.90, not ≥ 1.10, and |r − 1| =
0.05 is not < 0.05 → either. Overall 60·13/(251/19) = 14820/251 = 59.0438…. Typical 60;
references 60 (57 carries 4 of 13, sorted first). Clean false (0.95 is informative and
outside the none band). Flags [].

### B11

Last two onsets 83/7 and 269/21: i₅ s = 20/7, t = 180·7/20 = 63; i₆ s = 269/21 − 249/21
= 20/21, t = 63. Bar 3 own 240/(60/21 + 20/21) = 240/(80/21) = 63; ratio 21/20 = 1.05;
|r − 1| = 0.05, not < 0.05 → either. Overall 60·13/(269/21) = 16380/269 = 60.8921….
Typical 60; references 60. Clean false. Flags [].

That is the oracle's answer, and it is right **if the onsets are the rationals**. The
frozen file cannot hold 83/7; it holds `11.857142857142858` and `12.80952380952381`, and
those decimals, taken literally, sum bar 3 to 3.80952380952381 s, which is more than
80/21 = 3.8095238095238095…, so bar 3's tempo is 62.99999999999998… and its ratio
1.0499999999999998…, which **is** < 1.05 in absolute distance from 1 → `none`. With bar 3
inside the none band and no other informative ratio outside it, the literal reading also
makes the example **clean**. The rule text says nothing about the arithmetic in which a
ratio is compared to its bound ("compared exactly as written"), so both readings are
honest, and they give different verdicts on two fields a gate reads (`expected` decides
whether a flag on bar 3 is a false alarm; `clean` decides whether any false finding fails
the example). Hence ambiguous.

The same check on the other three boundary cases finds them robust: B8's literal decimals
give 0.8999999999999999… (still slow), B9's 1.1000000000000003… (still fast), B10's
0.95000000000000007… (still either). Only B11 lands on the wrong side of its bound. A
corrected version can either say in the rule which arithmetic the comparison uses, or
change the case's shape: with a reference of 60 and a four-quarter bar, a ratio of exactly
21/20 needs 80/21 s, which no decimal holds, whereas a reference of 80 (unit intervals of
0.75 s and 2.25 s) and a seven-quarter bar over exactly 5 s gives 84/80 = 1.05 with every
onset exact.

### B12

Events (0,0,0), (1,0,0.5), (2,1,2), (3,2,3), (5,3,4.5).

| | d | s | t | ends |
|---|---|---|---|---|
| i₀ | 1 | 0.5 | 120 | 0 |
| i₁ | 1 | 1.5 | 40 | 1 |
| i₂ | 1 | 1 | 60 | 2 |
| i₃ | 2 | 1.5 | 80 | 3 |

Overall 60·5/4.5 = 200/3 = 66.666…. Typical: sorted 40 (1), 60 (1), 80 (2), 120 (1);
W = 5, W/2 = 2.5; accumulated 1, 2, 4 > 2.5 → 80.

Bar 0 own 120. Reference: remaining 40 (1), 60 (1), 80 (2); W = 4, W/2 = 2; accumulated 1,
then 2 **= W/2 exactly** → mean of 60 and the next, 80 → **70**. Others {1,2,3} = 3.
Ratio 120/70 = 12/7 = 1.7142… → fast. Bar 1 own 40. Reference: remaining 60 (1), 80 (2),
120 (1); W = 4, W/2 = 2; 1 < 2, 3 > 2 → 80. Ratio 0.5 → slow. Bar 2 own 60. Reference:
40 (1), 80 (2), 120 (1); 1 < 2, 3 > 2 → 80. Ratio 0.75 → slow. Bar 3 own 60·2/1.5 = 80.
Reference: 40 (1), 60 (1), 120 (1); W = 3, W/2 = 1.5; 1 < 1.5, 2 > 1.5 → 60. Ratio 4/3 →
fast. Others 3 everywhere. Clean false. Flags [[0, fast], [1, slow], [2, slow], [3, fast]].

### S1–S8

From `stage-gates@2`: "An attempted open substage moves to passed only when all its
examples and controls, all earlier sentinels, pooled gates, causality and cost pass. A
first passing full sweep establishes passed; a later full sweep confirms it. Routine
passes preserve passed/confirmed. Any sentinel failure or full-sweep failure reopens its
owning substage, even when it was not attempted. An unattempted open substage stays
open. … A successful routine evaluation does not confirm anything."

- S1: open, attempted, own evidence and sentinels pass, routine → the first sentence →
  passed.
- S2: the same in a full sweep → "a first passing full sweep establishes passed" →
  passed, not confirmed.
- S3: passed, unattempted, routine, all pass → "routine passes preserve passed" → passed.
- S4: passed, unattempted, full sweep, all pass → "a later full sweep confirms it" →
  confirmed. Contract 2 agrees: "confirmed at the next full sweep".
- S5: confirmed, sentinels fail → "any sentinel failure … reopens … even when it was not
  attempted" → open.
- S6: confirmed, full sweep, own evidence fails → "full-sweep failure reopens" → open.
- S7: open, unattempted, everything passes → "an unattempted open substage stays open"
  → open.
- S8: open, attempted, own evidence fails → the first sentence's condition is unmet →
  open.

### Selection

Performances by margin: p-b 0.1; p-a 0.2 and p-z 0.2 tie, broken by ascending ASCII id
("p-a" < "p-z"); p-c 0.9 is fourth and dropped. The inputs list p-z before p-a, so the
result also shows independence from input order. Controls, per performed score: score a
has silences sil-z and sil-a at 0.4 each, tie → sil-a, and one wrong-score, wrong-a;
score b has sil-b and wrong-b. The oracle's order (by score, silence before wrong) is a
presentation choice; the rule fixes the set.

### Headroom

Each formula from the instruments, applied to the case's value, is in the table above.
Every case sits inside its budget, so no zero-denominator or negative-margin rule is
touched. In IEEE doubles 0.96 − 0.95 is 0.010000000000000009 and the first case renders
as 0.20000000000000018; the oracle's 0.2 is the exact value.

### Retirement

Contract 2: "the incumbent listener has passed it in its last three evaluations, and
harder active evidence exercises the same capability"; instruments 3: "three successive
passing incumbent evaluations **and** named harder active evidence". [T,T,T] with harder
evidence meets both; [T,T] has two; [T,F,T] has no three successive passes; [T,T,T]
without harder evidence fails the second condition.

## Precision

The oracle writes doubles. Where my rational result renders to a different last digit
(B8 overall 58.01652892561984 against the oracle's …83; B9 61.726618705035975 against
…98; B10 59.04382470119522 against …21) the difference is one unit in the sixteenth
significant figure and comes from the oracle's onsets being rounded before the division;
I count these as agreement at the stated precision, and no gate reads a whole-piece
overall tempo to that precision. B11's boundary is the one place the rounding crosses a
rule's bound, and it is recorded as ambiguous above, not here.

## Rules not exercised by any oracle case

`assessment-evaluator@3`:

- Rule 1's "or an omission": no case has a missing event, so no interval spans an
  omitted one. The attribution rule is the same as for a bar crossing, which B1, B4, B7
  and B12 exercise, but the omission form is unexercised.
- Rule 3's "no other intervals gives reference null": every case has intervals ending in
  at least two bars, so no bar has a non-null local tempo with a null reference.
- Rule 4's evaluator measures: "a flag on an ineligible bar is a false alarm (negative
  for each direction)" and "optional either bars remain excluded from both denominators".
  Version 3 has no report-level cases (version 2's A-cases carried reports; B1–B12 carry
  only the expected assessment), so nothing in the oracle pins how a report's flags are
  scored against ineligible or `either` bars.
- The closing paragraph entirely: bar summaries matched by ordinal, duplicate and
  unknown ordinals counted unexpected, omitted ordinals unreported, local/reference/ratio
  errors, and "flag counts, not summary presence, feed the unchanged finding gates". No
  case carries a `tempo.bars` report to match.

`stage-gates@2`:

- A routine evaluation preserving `confirmed` (S3 covers `passed` only).
- A sentinel or full-sweep failure reopening a `passed` (not `confirmed`) substage.
- An attempted open substage whose own evidence passes while a sentinel fails.
- "Missing required evidence is failure, never a pass": the cases fold examples,
  controls, pooled gates, causality and cost into one `passed` flag, so absent evidence
  is not modelled.

Sentinels and headroom:

- "Fewer than three performances means all"; "fail on duplicate IDs, nonfinite/negative
  margins, failed evidence, or missing performance/paired controls".
- "Per performed score" cannot be told apart here between "the scores of the chosen
  sentinel performances" and "the scores of every performance in the substage": both
  scores have a chosen performance. The two readings differ only when a score's every
  performance misses the top three; a future case should separate them.
- "For a control, performed score is its parent performance's score, not the unrelated
  handed score": the inputs already carry the parent's score.
- The `rejection` and per-interval `(max(.1·expected, .03) − |error|)/max(…)` formulas;
  the zero-denominator rule; binary gates contributing 1 or 0; the minimum over entries;
  an unreached event giving 0; clamping within 1e-12; negative margins as failure.

Retirement and run plans:

- A history longer than three where the last three pass after an earlier failure (the
  contract's "last three" reading against a literal "three successive").
- Keeping a retired set's sentinels until its replacement retires; reopening restoring
  the full set; the retirement record's contents; the routine plan's composition, the
  sweep's contents and citation by hash. These are procedural rules with no number to
  freeze, but the suite record they govern has no oracle case either.

## Summary

**34 cases checked (12 assessment, 8 suite states, 2 selection, 8 headroom, 4
retirement): 32 agree, 1 disagree, 1 ambiguous.** The disagreement is B1's bar 0
`reference` (30, not 60) and `ratio` (1, not 0.5), which confirms the disagreement the
freeze recorded; it changes no verdict in B1 and leaves `clean` false. The ambiguity is
B11, whose frozen decimal onsets read literally put bar 3 inside the none band (`none`,
`clean` true) and read as the intended rationals put it on the `either` edge (`clean`
false); both fields are read by a gate. Version 3 also leaves the report-level bar
measures, the null-reference case and several suite-state transitions uncovered, as listed
above; those need frozen and audited cases before instruments 3 judge a listener.

Model: Claude Fable 5.1 (high) in Claude Code, a session distinct from the one that wrote
the oracle (Sol 6.1 (high) in Codex).


### R8 provenance and scope note

[Process review R8](../../reviews.md#r8-after-audit-3-and-experiment-029) checked the
Claude Code session `b0318502-4451-460e-8ebb-a4b65e03a74a`: model
`claude-fable-5-1`, effort `high`, matching the recorded attribution. Re-derivation
preceded commit `8f998e0e`; the mandatory landing gate subsequently ran 369 bench
tests and static checks. “Nothing was run” above describes the re-derivation phase,
not that later repository validation. No audit arithmetic or verdict changed after
the gate.

The 34-case count covers oracle3's additions. Audit3 did not freshly sample the
unchanged following, note and control rules from earlier oracle files; audit2's
historical coverage remains separate evidence. Audit4 must include inherited-rule
samples as the contract requires, and record absent cases as uncovered. In particular,
the oracle README already identifies the unexercised by-event branch for examples
with at least 20 distinguishable events. This note changes no audit verdict.
