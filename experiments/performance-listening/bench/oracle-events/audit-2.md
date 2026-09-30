# Audit of event-oracle@2

An independent re-derivation of **event-oracle@2** from the rules alone, under
[contract 2's audit rule](../../contracts/development-contract-2.md#auditing-an-oracle),
following [AUDITING_AN_ORACLE.md](../../AUDITING_AN_ORACLE.md). Performed 2026-09-30.

**What was audited.** `oracle-2.json`, sha256
`e29ba389170181cffdf6f67fd51052f5ca58709927a1767e42819ccf3f157a2c`, as `freeze-2.json`
records it (verified with `sha256sum`).

**The rule text worked from**, and nothing else:

| File | Version | Used for |
|---|---|---|
| `contracts/event-instruments-2.md` | version 2, 2026-09-30 | `performance-label@2`, `assessment-report@2`, `assessment-evaluator@2`, `stage-gates@1` |
| `contracts/event-instruments-1.md` | version 1, 2026-09-30 | `following-evaluator@2` (unchanged in version 2) and everything version 2 does not restate: the label shape, the admissible-set rules, bar tempo, note placement |
| `contracts/development-contract-2.md` | in force from 2026-09-30 | the approved gates, θ = 0.10, D = 0.2 s |
| `bench/oracle-events/README.md` and `oracle.json` (event-oracle@1) | | the shorthand, and to find what version 2 added or changed |

Not read: `bench/src/events/`, its tests, report 023 beyond its title, any run. Nothing
was run.

**Scope.** Every record and every report in the oracle was re-derived, not a sample:
the version added F11, F12 and A8–A13, re-worked every assessment case, and added a
`gates` verdict to every following record, so nearly every number is new or changed.
The re-derivation also covers version 1's following measures, since a `gates` verdict
cannot be checked without them. The `derived` block of each assessment case (overall,
typical, intervals, bars, clean) was worked before its reports.

## Verdicts

Following records. "Judged measures" are the ones the gates read: on event, ahead,
behind, exposure, longest episode, answerable and supported-answerable time, by event,
recovery, extras. Every oracle number in the record was compared.

| Case | Rules exercised | My numbers | Oracle | Verdict |
|---|---|---|---|---|
| F1-A | hesitation held; grace; by event | on 10.8/10.8, byEvent 8/8, gates [] | same | agree |
| F1-B | ahead separately; episode; byEvent delay of an event already shown | on 4.8, ahead 6.0, exposure 6.0, longest 6.0, byEvent 5/8, gates all five | same | agree |
| F2-A | recovery after a missing event | on 7.8, byEvent 7/7, recovery [1,1,0], gates [] | same | agree |
| F2-B | behind; recovery not made | on 4.0, behind 3.8, exposure 3.8, longest 3.8, byEvent 3/7, recovery [0,1,0], gates onEvent, exposure, episode, byEvent | same | agree |
| F2-C | ahead onto a missing event, then behind for the grace remainder | on 6.8, ahead 0.9, behind 0.1, exposure 1.0, longest 1.0, byEvent 7/7, gates onEvent, ahead, exposure, episode | same | agree |
| F3-A | `dead` admissible set: the predecessor | on 7.8, byEvent 7/7, gates [] | same | agree |
| F3-B | `dead` admissible set: the dead event itself | on 7.8, byEvent 7/7, gates [] | same | agree |
| F3-C | ahead of a dead onset; delay 0 for an event shown early | on 6.9, ahead 0.9, byEvent 7/7, delays[2] = 0, gates onEvent, ahead, exposure, episode | same | agree |
| F3-D | deadline from the distinguishing event; `byEvent` alone fails | on 7.7, behind 0.1, byEvent 6/7, delays[2] = 0.3, gates byEvent | same | agree |
| F3b-A | consecutive dead onsets | on 7.8, byEvent 6/6, gates [] | same | agree |
| F3b-C | ahead across two dead onsets | on 6.9, ahead 0.9, byEvent 6/6, gates four | same | agree |
| F4-A | `repeated` admissible set: undercounting allowed | on 3.8, byEvent 2/2, gates [] | same | agree |
| F4-B | `repeated`: counting each strike | on 3.8, byEvent 2/2, gates [] | same | agree |
| F4-C | deadline from the distinguishing chord | on 3.75, behind 0.05, byEvent 1/2, gates byEvent | same | agree |
| F4-D | `repeated`: overcounting is ahead | on 2.9, ahead 0.9, byEvent 2/2, gates four | same | agree |
| F5-A | partial chord and wrong note still sound the event | on 3.8, byEvent 4/4, gates [] | same | agree |
| F5-B | behind through partial and wrong events | on 1.9, behind 1.9, byEvent 2/4, gates onEvent, exposure, episode, byEvent | same | agree |
| F6-A | extra note held | on 7.8, extras [1,0,0], gates [] | same | agree |
| F6-B | extra note moved the cursor; `episode` passes at 0.4 s | on 7.4, ahead 0.4, extras [0,1,0], gates onEvent, ahead, exposure | same | agree |
| F7-A | uncovered and abstained are not exposure | on 5.9, abstained 1.1, uncovered 0.8, byEvent 6/8, gates onEvent, byEvent | same | agree |
| F7-B | as-decided vs hindsight | live on 7.5, behind 0.3, byEvent 7/8, delays[3] = 0.5; hindsight on 7.8; gates byEvent | same | agree |
| F8-A | correct rejection on a control; control gates | correctRejection 3.8, recovery [0,0,1], gates [] | same | agree |
| F8-B | false following; control gates | falseFollowing 3.8, exposure 3.8, longest 3.8, gates rejection, exposure, episode | same | agree |
| F9 sync-good | `bar-anchor`; indeterminate time; `byEvent` with no distinguishable event | on 7.7, answerable 7.7, gates []; indeterminate 0.1 **or** 0.15 (below) | on 7.7, indeterminate 0.1 | ambiguous (the indeterminate figure only; every judged measure and the gates agree) |
| F9 late-honest | a band covering the sync error | on 6.8, answerable 6.8, gates []; indeterminate 1.0 **or** 1.2 | on 6.8, indeterminate 1.0 | ambiguous (as above) |
| F9 late-narrow | a band not covering it: ahead; `ahead` alone fails | on 7.55, ahead 0.15, exposure 0.15, longest 0.15, gates ahead; indeterminate 0.1 **or** 0.15 | same, indeterminate 0.1 | ambiguous (as above) |
| F10-A | `omission-similar`; recovery to the first distinguishable event after the run | on 3.8, byEvent 2/2, recovery [1,1,0], gates [] | same | agree |
| F10-B | behind through the ambiguous D | on 2.9, behind 0.9, recovery [1,1,0], gates onEvent, exposure, episode | same | agree |
| F11-A | **new**: written dead note, `dead` rule on the sound, shown when it sounds | on 7.8, byEvent 7/7, gates [] | same | agree |
| F11-C | **new**: ahead of a written dead onset | on 6.9, ahead 0.9, byEvent 7/7, gates four | same | agree |
| F12-A | **new**: wrong-score control rejected; every extra not assessable | correctRejection 7.8, recovery [0,0,1], extras [0,0,8], gates [] | same | agree |
| F12-B | **new**: following the handed score on another piece | falseFollowing 7.8, exposure 7.8, longest 7.8, gates rejection, exposure, episode | same | agree |

Assessment cases. Each row is one report; the `derived` block is checked under the
case's arithmetic below.

| Case | Rules exercised | My numbers (where they differ from the trivial) | Oracle | Verdict |
|---|---|---|---|---|
| A1 derived | typical tempo, one bar | overall 60, typical 60, bar 0 none, clean false | same | agree |
| A1-A | wrong pitch named; claimed played; tempo claims | missing [1,1,11,0], wrong [1,1,11,0,1], claimedPlayed 11, tempoClaims 4, gates [] | same | agree |
| A1-B | false alarms on an unclean example pass per example | missing [1,1,11,2], wrong [1,0,11,0,0], matched [10,8], falseFindings 2, claimedPlayed 9, gates [] | same | agree |
| A1-C | unassessed and unplaced; `notes` gate | unassessed 2, unplaced 1, matched [10,8], claimedPlayed 9, gates notes | same | agree |
| A2 derived | a missing event is not slowing; distance-weighted typical | overall 60, typical 60, bars none, clean false | same | agree |
| A2-A | correct | intervals [6,6,0,0,6], tempoClaims 7, gates [] | same | agree |
| A2-B | a slow false alarm, unclean | slow [0,0,2,1], falseFindings 1, tempoClaims 8, gates [] | same | agree |
| A2-C | flag everything, unclean: no per-example gate | slow/fast [0,0,2,2], missing [1,1,7,7], matched [7,0], falseFindings 11, claimedPlayed 0, tempoClaims 11, gates [] | same | agree |
| A2-D | **new**: unreported and unexpected intervals; `intervals` gate | intervals [6,5,1,2,5], missing [1,0,7,0], claimedPlayed 8, tempoClaims 8, gates intervals | same | agree |
| A3 derived | **re-worked**: typical (median) tempo vs overall; hesitation charged to bar 2 | overall 42, typical 60, bar 0 60 r 1 none, bar 1 34.2857 r 0.5714 slow | same | agree |
| A3-A | **changed verdict**: the fast flag is now a false alarm | slow [1,1,1,0], fast [0,0,2,1], falseFindings 1, tempoClaims 10, gates [] | same | agree |
| A3-B | **changed verdict**: now correct | fast [0,0,2,0], falseFindings 0, tempoClaims 9, gates [] | same | agree |
| A3-C | **new**: duration tolerance ±10% | within 6, worst [0.35, 0.12], gates intervals | same | agree |
| A4 derived | clean at half speed | overall 30, typical 30, clean true | same | agree |
| A4-A | correct | gates [] | same | agree |
| A4-B | false findings on a clean example; `clean` gate | slow [0,0,2,2], falseFindings 2, gates clean | same | agree |
| A4-C | **new**: `overall` gate | overallError 1, gates overall | same | agree |
| A5 derived | dead note in the assessment | clean false | same | agree |
| A5-A | the `dead` verdict detected | dead [1,1,7,0], claimedPlayed 8, gates [] | same | agree |
| A5-B | missing false alarm; measured across the note | intervals [7,5,2,1,5], missing [0,0,8,1], dead [1,0,7,0], claimedPlayed 7, tempoClaims 7, gates intervals | same | agree |
| A5-C | **new**: unidentified pitch is wrong, not dead | wrong [0,0,8,1,0], dead [1,0,7,0], falseFindings 1, claimedPlayed 8, gates [] | same | agree |
| A6 derived + A | assessment never reads sync | clean true, gates [] against all four labels | same | agree |
| A7 derived | **re-worked**: the longer bar sets the typical tempo | overall 55.2632, typical 52.1739, bar 0 r 1.15 fast, bar 1 r 1 none | same | agree |
| A7-A | **changed verdict**: a missed fast bar, per example passes | fast [1,0,1,0], slow [0,0,2,0], gates [] | same | agree |
| A7-B | **changed verdict**: fast found, slow a false alarm | fast [1,1,1,0], slow [0,0,2,1], falseFindings 1, tempoClaims 10, gates [] | same | agree |
| A8 derived | **new**: typical tempo at an exact half; `either` band | overall 54.5455, typical 55, bar 0 r 1.0909 either, bar 1 r 0.9091 either | same | agree |
| A8-A | no positives or negatives for flags | slow/fast [0,0,0,0], missing [1,1,7,0], tempoClaims 7, gates [] | same | agree |
| A8-B | optional flags neither found nor false | slow/fast [0,0,0,0], falseFindings 0, tempoClaims 9, gates [] | same | agree |
| A9 derived | **new**: fast clean example | overall 240, typical 240, clean true | same | agree |
| A9-A | the 30 ms floor | within 7, worst [0.028, 0.112], gates [] | same | agree |
| A9-B | beyond both 10% and 30 ms | within 6, worst [0.04, 0.16], gates intervals | same | agree |
| A9-C | `overall` within 5%; a false flag on a clean example | overallError 0.041667, fast [0,0,2,1], falseFindings 1, gates clean | same | agree |
| A10 derived | **new**: a written dead note played as written is matched, and the example is clean | clean true | same | agree |
| A10-A | correct | dead [0,0,8,0], matched [8,8], gates [] | same | agree |
| A10-B | reporting a written dead note dead is a false finding | dead [0,0,8,1], matched [8,7], falseFindings 1, gates clean | same | agree |
| A10-C | missing false alarm plus an unreported interval | intervals [7,5,2,1,5], missing [0,0,8,1], matched [8,7], claimedPlayed 7, tempoClaims 7, gates intervals, clean | same | agree |
| A11 derived | **new**: a written dead note with a pitch is wrong, even at its written pitch | clean false | same | agree |
| A11-A | wrong detected, pitch named (64) | wrong [1,1,7,0,1], matched [7,7], gates [] | same | agree |
| A11-B | wrong missed, unclean: passes per example | wrong [1,0,7,0,0], falseFindings 0, gates [] | same | agree |
| A12 derived | **new**: silence control: no sounded event | overall null, typical null, bars null → none, clean false | same | agree |
| A12-A | every note missing, no tempo | missing [8,8,0,0], slow/fast [0,0,2,0], tempoClaims 0, gates [] | same | agree |
| A12-B | nothing said: honest on a control | missing [8,0,0,0], unassessed 8, claimedPlayed 0, gates [] | same | agree |
| A12-C | `claims` and `tempo` control gates | intervals [0,0,0,7,0], overallError null, claimedPlayed 8, tempoClaims 8, falseFindings 0, gates claims, tempo | same | agree |
| A13 derived | **new**: wrong-score control | as A12 | same | agree |
| A13-A | correct | missing [8,8,0,0], gates [] | same | agree |
| A13-B | mapping another piece onto the handed score | wrong [0,0,8,8,0], missing [8,0,0,0], falseFindings 8, claimedPlayed 8, tempoClaims 8, gates claims, tempo | same | agree |

## The ambiguity: F9's indeterminate figure

Rule 3 of `following-evaluator@2` (event instruments 1): "*Pending*: from 0 until D
after the start of the first segment that has a non-empty admissible set or is
unsupported. *Indeterminate*: within `uncertainty` of any segment start. Everything
else in `[0, duration)` is **answerable**." Rule 6 reports "pending, indeterminate,
answerable and supported-answerable time" as separate seconds.

In every F9 label the first segment starts at 0 with a non-zero `uncertainty`, so
`[0, uncertainty)` is both pending and indeterminate, and the text does not say which
figure the overlap belongs to.

- **Reading 1, pending first** (the overlap counts once, as pending): sync-good and
  late-narrow: pending 0.2, indeterminate 0.1 (from `[3.95, 4.05)` or `[4.25, 4.35)`);
  late-honest: pending 0.2, indeterminate 0.2 (`[0.2, 0.4)`) + 0.8 (`[3.9, 4.7)`) = 1.0.
  The oracle's numbers.
- **Reading 2, each measure on its own definition** (indeterminate is the whole
  `[0, 0.05)` or `[0, 0.4)` band plus the second): sync-good and late-narrow
  indeterminate 0.15; late-honest 1.2; pending 0.2 in both.

Under both readings the excluded time is the same union, so answerable (7.7 / 6.8 /
7.7), supported-answerable, on event, ahead, exposure, longest episode and every gate
are identical. The ambiguity is in one reported figure only. It is inherited from
version 1 (F9 is a carried-over case), and the oracle chooses reading 1 consistently.
Resolving it is a one-sentence tie-break in the instruments, a tightening.

## The arithmetic

Conventions: D = 0.2 s, θ = 0.10. In every event-resolution label the first segment
starts at 0 with a non-empty admissible set (or is unsupported), so **pending = [0,
0.2)** and answerable = duration − 0.2 unless indeterminate time is also excluded.
"Grace" is the D after a segment start in which the previous segment's admissible
events also count. Under rule 1 a decision `[madeAt, e]` shows event e from `madeAt`
until the next decision. The reference is `truth`, or the largest admissible event when
`truth` is null.

### Following

**F1, toy8-hesitation** (duration 11; segments start 0, 1, 2, 3, 7, 8, 9, 10 with truth
0–7; answerable 10.8, all supported).

- A: each decision 0.1 s after its onset. Every moment shows `truth`, or during grace
  (`[k, k+0.1)`) the previous segment's event: on event throughout = 10.8. Every event
  is distinguishable at its onset and shown 0.1 s later: byEvent 8/8, delays 0.1 ×8.
  Gates: onEvent 1 ≥ 0.95; ahead 0; exposure 0; episode 0; byEvent all 8 → **[]**.
- B: clock, event k shown from k s. 0.2–4: on (3.8). 4–7: shows 4, 5, 6 while truth is 3 →
  non-admissible, after the reference → ahead (3.0). 7–7.2 grace: admissible {4} ∪ {3},
  shown 7 → ahead. 7.2–10: shows 7 while truth 4, 5, 6 → ahead. Ahead = 4→10 = 6.0.
  10–11: truth 7, shown 7 → on (1.0). On = 3.8 + 1.0 = 4.8. Exposure 6.0, one unbroken
  run → longest 6.0. By event: 0–3 shown at their `distinguishableAt` (delay 0); 4, 5, 6
  never shown (null); 7 is already shown at 10 → delay 0 → 5/8. Gates: onEvent 4.8/10.8
  = 0.444; ahead 6.0/10.8 = 0.556 > 0.01; exposure 0.556 > 0.05; episode 6.0 > 0.5;
  byEvent 5 of 8 → **all five fail**.

**F2, toy8-missing-e3** (duration 8; segments 0, 1, 2, 4, 5, 6, 7; event 3 missing;
answerable 7.8; distinguishable events 0, 1, 2, 4, 5, 6, 7).

- A: 2.1–4 shows 2 = truth; 4–4.15 grace ({4} ∪ {2}); 4.15 on. On 7.8. Event 4 shown at
  4.15 ∈ [4, 4.2] → byEvent 7/7, delays [0.1, 0.1, 0.1, 0.15, 0.1, 0.1, 0.1]. Recovery: the
  run {3}; first distinguishable sounded event after it is 4, reached → [1, 1, 0]. **[]**.
- B: shows 2 from 2.1 for ever. 0.2–4 on (3.8); 4–4.2 grace, 2 ∈ {4} ∪ {2} → on (0.2);
  4.2–8 shows 2 before the reference → behind (3.8). On 4.0, behind 3.8, exposure 3.8,
  longest 3.8. byEvent 3/7 (4–7 null). Recovery [0, 1, 0]. Gates: onEvent 4.0/7.8 =
  0.513; ahead 0 passes; exposure 0.487; episode 3.8; byEvent → **onEvent, exposure,
  episode, byEvent**.
- C: steps onto 3 at 3.1. 3.1–4: shows 3 while truth 2 → ahead (0.9). 4–4.1: segment 4
  (grace {4} ∪ {2}); 3 is not admissible and is before the reference 4 → behind (0.1).
  4.1–8 on. On = 2.9 + 3.9 = 6.8; ahead 0.9; behind 0.1; exposure 1.0 in one run (ahead
  then behind, nothing between) → longest 1.0. byEvent 7/7 (event 4 at 4.1). Recovery
  [1, 1, 0]. Gates: onEvent 0.872; ahead 0.115; exposure 0.128; episode 1.0 → **onEvent,
  ahead, exposure, episode**; byEvent passes.

**F3, toy8-dead-e2** (segments 0, 1, 2 {1, 2} `dead`, 3, …, 7; distinguishable 0, 1, 3–7 =
7 events; answerable 7.8).

- A: stays on 1 from 1.1 to 3.1: 2–3 admissible {1, 2} → on; 3–3.1 grace ({3} ∪ {1, 2}) →
  on. On 7.8, byEvent 7/7, delays 0.1 ×7. **[]**.
- B: shows 2 from 2.1: 2 ∈ {1, 2} → on. On 7.8, byEvent 7/7. **[]**.
- C: shows 3 from 2.1. 2.1–3: 3 ∉ {1, 2}, after truth 2 → ahead 0.9. 3–8 on. On 6.9.
  Event 3 is distinguishable at 3 and already shown → delay 0. byEvent 7/7. Gates: onEvent
  6.9/7.8 = 0.885; ahead 0.115; exposure 0.115; episode 0.9 → **onEvent, ahead, exposure,
  episode**.
- D: shows 3 from 3.3. 3–3.2 grace → on; 3.2–3.3 behind 0.1; on 7.7. Event 3 first shown at
  3.3 > 3.2 → not reached, delay 0.3 → byEvent 6/7. Gates: onEvent 0.987; exposure
  0.1/7.8 = 0.013; episode 0.1 → only **byEvent**.

**F3b, toy8-dead-e2-e3** (segments 2 {1, 2}, 3 {1, 2, 3}; distinguishable 0, 1, 4–7 = 6).

- A: shows 1 from 1.1 to 4.1; 2–4 admissible contains 1; 4–4.1 grace → on 7.8. byEvent
  6/6. **[]**.
- C: shows 4 from 3.1. 3.1–4: 4 ∉ {1, 2, 3}, after truth 3 → ahead 0.9. On 6.9. Event 4
  already shown at 4 → delay 0; byEvent 6/6. **onEvent, ahead, exposure, episode**.

**F4, chordsRepeat-60** (duration 4; segments 0 {0}, 1 {0, 1}, 2 {0, 1, 2}, 3 {3};
distinguishable 0 and 3; answerable 3.8).

- A: shows 0 until 3.1: 0 is admissible through 3; 3–3.1 grace → on 3.8. byEvent 2/2,
  delays 0.1, 0.1. **[]**.
- B: shows 1 from 1.1, 2 from 2.1: each admissible → on 3.8. byEvent 2/2. **[]**.
- C: shows 3 at 3.25. 3–3.2 grace on; 3.2–3.25 behind 0.05; on 3.75. Event 3 first shown
  at 3.25 > 3.2 → byEvent 1/2, delays [0.1, 0.25]. Gates: onEvent 3.75/3.8 = 0.987;
  exposure 0.013; episode 0.05 → only **byEvent**.
- D: shows 2 from 1.1. 1.1–2: 2 ∉ {0, 1}, after truth 1 → ahead 0.9. 2–3: 2 ∈ {0, 1, 2}
  → on. 3–3.1 grace → on. On 2.9, ahead 0.9. byEvent 2/2 (3 at 3.1). Gates: onEvent 0.763;
  ahead 0.237; exposure 0.237; episode 0.9 → **onEvent, ahead, exposure, episode**.

**F5, chordsVaried-60-partial-wrong** (duration 4; four `sounded` segments; answerable 3.8).

- A: on 3.8, byEvent 4/4. **[]**.
- B: shows 0 until 3.1. 0.2–1 on (0.8); 1–1.2 grace on (0.2); 1.2–2 behind (0.8); 2–2.2
  grace {2} ∪ {1}, 0 ∉ → behind (0.2); 2.2–3 behind (0.8); 3–3.1 grace {3} ∪ {2} → behind
  (0.1); 3.1–4 on (0.9). On 1.9, behind 1.9, exposure 1.9, longest 1.9. byEvent 2/4,
  delays [0.1, null, null, 0.1]. Gates: onEvent 0.5; exposure 0.5; episode 1.9; byEvent →
  **onEvent, exposure, episode, byEvent**.

**F6, toy8-extra** (extra note 2.5–2.8, MIDI 40).

- A: on 7.8, byEvent 8/8. The extra's onset 2.5 is answerable and the cursor is on event
  (shows 2, truth 2); it stays on event until the next segment (3) → held → extras
  [1, 0, 0]. **[]**.
- B: moves to 3 at 2.6. 2.6–3 ahead 0.4; on 7.4. Event 3 already shown at 3 → delay 0;
  byEvent 8/8. Extra: the cursor leaves event before 3 → moved → [0, 1, 0]. Gates:
  onEvent 7.4/7.8 = 0.9487 < 0.95; ahead 0.4/7.8 = 0.0513 > 0.01; exposure 0.0513 >
  0.05; episode 0.4 ≤ 0.5 passes → **onEvent, ahead, exposure**.

**F7, toy8-perfect-60.**

- A: 0.2–1.0 nothing shown → uncovered 0.8; 1.0–2.1 `unsupported` while truth is
  supported → abstained 1.1; 2.1–8 on 5.9. Neither uncovered nor abstained is exposure.
  byEvent 6/8 (0 and 1 never shown). Gates: onEvent 5.9/7.8 = 0.756; byEvent → **onEvent,
  byEvent**; ahead, exposure, episode pass at 0.
- B: as decided, the statement made at 3.5 shows from 3.5. 3–3.2 grace on; 3.2–3.5
  behind 0.3; on 7.5. Event 3 first shown at 3.5 → delay 0.5 → byEvent 7/8. Hindsight:
  the decision with the latest `refersTo ≤ t` shows 3 from 3.05, so 3–3.05 is grace and
  3.05 on → on 7.8, pending 0.2, answerable 7.8. Gates: onEvent 7.5/7.8 = 0.962; exposure
  0.3/7.8 = 0.038; episode 0.3 → only **byEvent**.

**F8, toy8-silence** (duration 4, one unsupported segment from 0; pending 0.2; answerable
3.8; supported-answerable 0; a control).

- A: `unsupported` from 0.1 → correct rejection 3.8. byEvent 0/0. Recovery: one run of
  missing events with no event after it → [0, 0, 1]. Control gates: rejection 1;
  exposure 0; episode 0 → **[]**.
- B: shows 0 from 0.1 → false following 3.8 = exposure, longest 3.8. Gates: rejection 0;
  exposure 1; episode 3.8 → **rejection, exposure, episode**.

**F9, bar-resolution labels** (duration 8; the same cursor, event k from k + 0.1).

- sync-good: segments 0 and 4, uncertainty 0.05. Excluded: pending [0, 0.2), indeterminate
  [3.95, 4.05) (and [0, 0.05), already pending). Answerable 8 − 0.2 − 0.1 = 7.7. 0.2–3.95:
  shows 0–3, all in {0, 1, 2, 3} → on 3.75. 4.05–4.1: shows 3, grace of the segment at 4
  ({4–7} ∪ {0–3}) → on. 4.1–8: shows 4–7 → on. On 7.7. No distinguishable event → byEvent
  0/0, which passes. **[]**.
- late-honest: segments 0 and 4.3, uncertainty 0.4. Indeterminate [0, 0.4) and [3.9, 4.7):
  beyond pending that is 0.2 + 0.8 = 1.0. Answerable 6.8. 0.4–3.9: shows 0–3 → on 3.5.
  4.7–8: shows 4–7 (4 from 4.1) → on 3.3. On 6.8. **[]**.
- late-narrow: segments 0 and 4.3, uncertainty 0.05. Indeterminate [4.25, 4.35) → 0.1;
  answerable 7.7. 0.2–4.1: shows 0–3 within the first segment → on 3.9. 4.1–4.25: shows 4
  while the first segment's admissible set is {0–3} and truth is null: reference is the
  largest admissible, 3; 4 is after it → ahead 0.15. 4.35–8: shows 4–7 → on 3.65. On
  7.55, ahead 0.15, exposure 0.15, longest 0.15 (the indeterminate band ends the run).
  Gates: onEvent 7.55/7.7 = 0.981; ahead 0.15/7.7 = 0.0195 > 0.01; exposure 0.0195 ≤ 0.05;
  episode 0.15 → only **ahead**.

**F10, toyDD-omit-e1** (segments 0 {0}, 2 {1, 2} `omission-similar`, 3 {3}; distinguishable
0 and 3; answerable 3.8).

- A: shows 1 from 2.1: 1 ∈ {1, 2} → on; 3–3.1 grace → on. On 3.8, byEvent 2/2. Recovery:
  the run {1}; the first *distinguishable* sounded event after it is 3 (2 is not
  distinguishable); reached → [1, 1, 0]. **[]**.
- B: shows 0 until 3.1. 2–2.2 grace ({1, 2} ∪ {0}) → on; 2.2–3 behind 0.8; 3–3.1 grace
  ({3} ∪ {1, 2}), 0 ∉ → behind 0.1; 3.1–4 on. On 2.9, behind 0.9. byEvent 2/2, recovery
  [1, 1, 0]. Gates: onEvent 0.763; exposure 0.237; episode 0.9 → **onEvent, exposure,
  episode**.

**F11, toyDW-as-written-60** (new). Label check first: `n2` is a written dead note played as
written → outcome `matched`, and under `performance-label@2` rule 3 a matched written dead
note is pitchless, so event 2 is a pitchless event; the last distinguishable event is 1, so
the segment at 2 has admissible {1, 2} under the `dead` rule and `distinguishableAt` null.
The label says exactly that. Distinguishable events 0, 1, 3–7 = 7.

- A: shows 2 from 2.1, 2 ∈ {1, 2} → on 7.8; byEvent 7/7; **[]**.
- C: shows 3 from 2.1: 2.1–3 ahead 0.9; on 6.9; event 3 delay 0; byEvent 7/7 → **onEvent,
  ahead, exposure, episode** (same arithmetic as F3-C).

**F12, toyW-hears-toy8** (new; duration 8; unsupported throughout; answerable 7.8;
supported-answerable 0; eight extras, one per toy8 note).

- A: correct rejection 7.8. Recovery [0, 0, 1]. Extras: the cursor is never on event, so
  no extra is assessable → [0, 0, 8]. Control gates → **[]**.
- B: false following 7.8, exposure 7.8, longest 7.8 → **rejection, exposure, episode**.

### Assessment

Common definitions. Local tempo = 60 × distance ÷ duration. Bar tempo = 60 × Σ distance ÷
Σ duration over the intervals ending in the bar. Typical tempo: sort local tempi
ascending, W = Σ distance, walk to the first interval reaching W/2. r = bar ÷ typical:
slow if r ≤ 0.9, fast if r ≥ 1.1, none if |r − 1| < 0.05, else either. Flag negatives:
bars expecting neither that direction nor either. Note negatives: every score note that
is not a positive for that kind. Duration tolerance: |error| ≤ max(0.1 × expected,
0.030). Claimed played: standing statements of match/timing/duration, substitution or
dead. Tempo claims: (overall given ? 1 : 0) + intervals + flags.

**A1, chordsVaried-60-partial-wrong** (12 notes; 4 events at 0, 1, 2, 3 s). Intervals 0→1,
1→2, 2→3: each 1 s, distance 1, 60. Overall 60 × 3 ÷ 3 = 60. Typical: [60, 60, 60], W = 3,
W/2 = 1.5; accumulated 1, then 2 > 1.5 → 60. Bar 0: 60 × 3 ÷ 3 = 60, r = 1 → none. Notes:
v1b missing, v2b wrong (46), 10 matched. Clean false.

- A: intervals [3, 3, 0, 0, 3], worst [0, 0]. slow [0, 0, 1, 0]; fast [0, 0, 1, 0]. missing
  positives 1 (v1b), detected 1, negatives 11, fa 0. wrong 1, 1, 11, 0, pitch named 1. dead
  0, 0, 12, 0. matched 10 confirmed 10. falseFindings 0. Claimed 10 + 1 = 11. Tempo claims
  1 + 3 + 0 = 4. Gates: overall 0, intervals all, notes all, not clean → **[]**.
- B: v1a, v1b, v1c missing, v2b match. missing 1, 1, 11, fa 2 (v1a, v1c). wrong 1, 0, 11, 0,
  0. matched 10, confirmed 8. falseFindings 2. Claimed 12 − 3 = 9. Tempo claims 4. Not
  clean, so no per-example gate fails → **[]**.
- C: v3c omitted; v0a placed at event 1, where no note v0a exists → unplaced 1; v0a and
  v3c have no standing statement → unassessed 2. matched 10, confirmed 8. Claimed 8 + 1 =
  9. falseFindings 0. Gates → **notes**.

**A2, toy8-missing-e3** (sounded 0, 1, 2, 4, 5, 6, 7 at 0, 1, 2, 4, 5, 6, 7 s). Intervals: 0→1
1 s/1 q 60; 1→2 60; 2→4 2 s/2 q 60; 4→5, 5→6, 6→7 60. Overall 60 × 7 ÷ 7 = 60. Typical: all
60 → 60. Bar 0 (intervals ending at 1, 2): 60 × 2 ÷ 2 = 60; bar 1 (ending at 4, 5, 6, 7):
60 × 5 ÷ 5 = 60. Both r = 1 → none. Clean false (n3 missing).

- A: intervals [6, 6, 0, 0, 6]. missing 1, 1, 7, 0. matched 7, 7. Claimed 7. Tempo claims
  1 + 6 = 7. **[]**.
- B: flag [1, slow]: slow 0, 0, 2, fa 1. falseFindings 1. Tempo claims 8. **[]**.
- C: flags all four; every note missing. slow 0, 0, 2, 2; fast 0, 0, 2, 2. missing 1, 1, 7,
  fa 7. matched 7, 0. falseFindings 2 + 2 + 7 = 11. Claimed 0. Tempo claims 1 + 6 + 4 = 11.
  Every note assessed, not clean → **[]**.
- D: seven reported intervals 0→1 … 6→7, 1 s each. Matched by (from, to): 0→1, 1→2, 4→5,
  5→6, 6→7 = 5; unreported 2→4 = 1; unexpected 2→3, 3→4 = 2; within 5. missing 1, 0, 7, 0.
  matched 7, 7. Claimed 8 (n3 said match). Tempo claims 1 + 7 = 8. Gates → **intervals**.

**A3, toy8-hesitation** (onsets 0, 1, 2, 3, 7, 8, 9, 10). Intervals: 0→1, 1→2, 2→3 at 60;
3→4 4 s/1 q = 15; 4→5, 5→6, 6→7 at 60. Overall 60 × 7 ÷ 10 = 42. Typical: sorted [15, 60,
60, 60, 60, 60, 60], W = 7, W/2 = 3.5; accumulated 1, 2, 3, 4 > 3.5 at the fourth (60) →
60. Bar 0: 60 × 3 ÷ 3 = 60, r = 1 → none. Bar 1: 60 × 4 ÷ (4 + 1 + 1 + 1) = 240 ÷ 7 =
34.285714…, r = 0.571428… ≤ 0.9 → slow. Clean false.

- A: flags [0, fast], [1, slow]. slow: positives 1, detected 1, negatives 1 (bar 0), fa
  0. fast: positives 0, negatives 2 (bar 1 expects slow, which is neither fast nor
  either), fa 1. falseFindings 1. Tempo claims 1 + 7 + 2 = 10. **[]**.
- B: [1, slow] only: fast 0, 0, 2, 0; falseFindings 0; tempo claims 9. **[]**.
- C: 0→1 reported 1.09: error 0.09, tolerance max(0.1, 0.03) = 0.1 → within. 3→4 reported
  4.35: error 0.35, tolerance max(0.4, 0.03) = 0.4 → within. 4→5 reported 0.88: error
  −0.12, tolerance 0.1 → not within. Within 6. Worst seconds 0.35; worst relative
  max(0.09, 0.0875, 0.12) = 0.12. Gates → **intervals**.

**A4, toy8-slow-30** (onsets every 2 s). Seven intervals 2 s/1 q = 30. Overall 60 × 7 ÷ 14
= 30. Typical 30. Bars 30 and 30, r = 1 → none. Clean true.

- A: **[]**. Claimed 8, tempo claims 8.
- B: both bars slow: slow 0, 0, 2, fa 2; falseFindings 2; clean → **clean**.
- C: overall 60 reported: 60 ÷ 30 − 1 = 1 → **overall**; falseFindings 0 so clean passes.

**A5, toy8-dead-e2** (n2 dead, onsets 0–7). Seven intervals at 60; overall 60; typical 60;
bars none. Clean false (n2 not matched).

- A: n2 dead: dead 1, 1, 7, 0. matched 7, 7. Claimed 7 + 1 = 8. Tempo claims 8. **[]**.
- B: n2 missing; intervals 0→1, 1→3, 3→4, 4→5, 5→6, 6→7. Matched 0→1, 3→4, 4→5, 5→6, 6→7
  = 5; unreported 1→2, 2→3 = 2; unexpected 1→3 = 1; within 5. missing 0, 0, 8, fa 1. dead 1,
  0, 7, 0. falseFindings 1. Claimed 7. Tempo claims 7. → **intervals**.
- C: n2 substitution null → wrong, pitch not identified: wrong 0, 0, 8, fa 1, pitch 0. dead
  1, 0, 7, 0. falseFindings 1. Claimed 8. Not clean → **[]**.

**A6, four labels of the perfect performance.** Derived from `performance` alone, so the
same for all four: seven intervals at 60, overall 60, typical 60, bars none, clean true.
Report A: [7, 7, 0, 0, 7], claimed 8, tempo claims 8, falseFindings 0 → **[]**.

**A7, toy8-slight-drag** (onsets 0, 1, 2, 3, 4.15, 5.3, 6.45, 7.6). Intervals: three at 60;
four of 1.15 s/1 q = 60 ÷ 1.15 = 52.173913…. Overall 60 × 7 ÷ 7.6 = 55.263157…. Typical:
sorted [52.17 ×4, 60 ×3], W = 7, W/2 = 3.5; accumulated 1, 2, 3, 4 > 3.5 at the fourth
(52.17) → 52.173913…. Bar 0: 60, r = 60 ÷ 52.1739 = 1.15 ≥ 1.1 → fast. Bar 1: 60 × 4 ÷ 4.6
= 52.1739, r = 1 → none. Clean false.

- A: no flags. fast: positives 1, detected 0, negatives 1 (bar 1), fa 0. slow: 0, 0, 2
  (bar 0 expects fast, bar 1 none), 0. falseFindings 0. Per example → **[]** (the miss is
  a pooled matter).
- B: [0, fast], [1, slow]: fast 1, 1, 1, 0; slow 0, 0, 2, fa 1; falseFindings 1; tempo claims
  10 → **[]**.

**A8, toy8-drag-last-missing** (onsets 0, 1, 2, 3, 4.2, 5.4, 6.6; event 7 missing).
Intervals: 0→1, 1→2, 2→3 at 60; 3→4, 4→5, 5→6 each 1.2 s/1 q = 50. Overall 60 × 6 ÷ 6.6 =
54.545454…. Typical: sorted [50, 50, 50, 60, 60, 60], W = 6, W/2 = 3; accumulated 1, 2,
3 = W/2 exactly at the third interval (50) → mean of 50 and the next in sorted order,
60 → 55. Bar 0: 60, r = 60 ÷ 55 = 1.0909…: not ≥ 1.1, |r − 1| = 0.0909 ≥ 0.05 → either. Bar
1: 60 × 3 ÷ 3.6 = 50, r = 0.9090…: not ≤ 0.9, |r − 1| = 0.0909 → either. Clean false.

- A: intervals [6, 6, 0, 0, 6]. slow and fast: positives 0, negatives 0 (both bars either)
  → [0, 0, 0, 0]. missing 1, 1, 7, 0. matched 7, 7. Claimed 7. Tempo claims 7. **[]**.
- B: [0, fast], [1, slow]: neither positive nor negative → [0, 0, 0, 0] both; falseFindings
  0; tempo claims 9. **[]**.

**A9, toy8-fast-240** (onsets 0.25 s apart). Seven intervals 0.25 s/1 q = 240. Overall 60 ×
7 ÷ 1.75 = 240. Typical 240. Bars 240, r = 1 → none. Clean true. Tolerance on a 0.25 s
interval: max(0.025, 0.030) = 0.030.

- A: 0→1 0.27 (error 0.02), 2→3 0.23 (−0.02), 4→5 0.278 (0.028): all ≤ 0.030 → within 7.
  Worst seconds 0.028; worst relative 0.028 ÷ 0.25 = 0.112. **[]**.
- B: 4→5 0.29: error 0.04 > 0.030 → within 6; worst [0.04, 0.16] → **intervals**.
- C: overall 250: 250 ÷ 240 − 1 = 0.041666… ≤ 0.05, passes. Flag [1, fast]: fast 0, 0, 2, fa
  1; falseFindings 1 on a clean example → **clean**. Tempo claims 9.

**A10, toyDW-as-written-60** (n2 written dead, sounded pitchless → matched). Seven
intervals at 60; overall 60; typical 60; bars none. Clean: every note matched (n2
included), no extras, all bars none → true.

- A: dead: positives 0 (no outcome is dead), negatives 8, fa 0. matched 8, 8. Claimed 8.
  **[]**.
- B: n2 dead: dead 0, 0, 8, fa 1; matched 8, 7; falseFindings 1; claimed 8 (dead counts as
  sounded) → **clean**.
- C: n2 missing and intervals skip it: [7, 5, 2, 1, 5]; missing 0, 0, 8, fa 1; matched 8, 7;
  falseFindings 1; claimed 7; tempo claims 7 → **intervals, clean**.

**A11, toyDW-rang-60** (n2 written dead, sounded with pitch 64 → wrong, heardMidi 64).
Seven intervals at 60; clean false.

- A: substitution 64: wrong 1, 1, 7, 0, pitch named 1 (64 = heardMidi). matched 7, 7.
  Claimed 8. **[]**.
- B: all match: wrong 1, 0, 7, 0, 0; matched 7, 7; falseFindings 0; not clean → **[]**.

**A12, toy8-silence** (no sounded event). Intervals none; overall null; typical null; no
interval ends in either bar → bar tempo null → expected none, twice. Clean false.

- A: overall null vs null → overallError null. intervals [0, 0, 0, 0, 0]; worst [null,
  null]. slow, fast: 0, 0, 2, 0. missing 8, 8, 0, 0. wrong 0, 0, 8, 0, 0. dead 0, 0, 8, 0.
  matched 0, 0. Claimed 0; tempo claims 0. Control gates: claims, tempo pass → **[]**.
- B: no statements: missing 8, 0, 0, 0; unassessed 8; claimed 0; tempo claims 0. The
  `notes` gate is a performance gate and does not apply → **[]**.
- C: overall 60, seven intervals, all match: overallError null (expected null); intervals
  expected 0, matched 0, unreported 0, unexpected 7, within 0. missing 8, 0, 0, 0. matched
  0, 0 (no positives). falseFindings 0 (a match on a missing note is no kind's false
  alarm). Claimed 8; tempo claims 1 + 7 = 8 → **claims, tempo**.

**A13, toyW-hears-toy8** (score toyW, w0–w7, all missing; eight extras). Derived as A12.

- A: as A12-A → **[]**.
- B: eight substitutions with pitches: wrong 0, 0, 8, fa 8, pitch 0; missing 8, 0, 0, 0; dead
  0, 0, 8, 0; matched 0, 0; falseFindings 8; claimed 8; tempo claims 8 → **claims, tempo**.

### Precision

Several oracle numbers are decimal renderings of quantities that are inexact in binary
(1.15 from 4.15 − 3, 52.17391304347826, 0.12 from 0.88 − 1, 0.028 from 0.278 − 0.25,
50 from 60 ÷ 1.2). I compared to the oracle's stated precision, as the audit rule says.
None sits at a gate bound (the nearest is A9-A's 0.028 against the 0.030 floor).

## Rules not exercised by any oracle case

- `byEvent` with 20 or more distinguishable events, where 95% suffices (the README says
  so; every toy score is shorter).
- The `overall` gate's second clause, "when the expected overall tempo is null, the
  reported one is null too": on a control the performance gates do not apply, so the
  clause is reachable only on a performance with one sounded event, and none exists.
- "A fraction whose denominator is zero fails its gate": no performance has zero
  supported-answerable time.
- Inclusive bounds ("≥ and ≤ include the bound"): no measure lands exactly on 0.95,
  0.01, 0.05, 0.5 s, ±0.05 or the duration tolerance.
- The pooled gates `recovery`, `extrasHeld`, `found:<kind>` and `falseAlarms:<kind>`,
  and the exclusion of controls from them: the oracle is per example; A1-B, A2-C and
  A7-A are noted as pooled matters but carry no pooled number.
- Flags on a bar the score does not have (unplaced flags); the `timing`, `duration`
  and `extra` verdicts; `heardMidi` on a written dead note at a pitch other than the
  written one.
- Causality and cost: measured by the runner, not by an oracle.
- The `wrong-score` validation rule that "every note of the audio is an extra" is
  satisfied by F12's label but is a label check, not a number.

## Summary

**66 records and reports checked (32 following, 34 assessment, plus all 13 `derived`
blocks): 63 agree, 0 disagree, 3 ambiguous.** The three ambiguous cases are F9's, on
one reported figure (`indeterminate`) whose two readings give 0.1 or 0.15 and 1.0 or
1.2; both readings give identical answerable time, categories and gates, and the
oracle uses one reading consistently, inherited from version 1. No number that any gate
reads was disagreed with.

Model: Claude Fable 5.1 (`claude-fable-5-1`), in Claude Code, as a subagent session
distinct from the one that wrote the oracle (Claude Opus 5.5).
