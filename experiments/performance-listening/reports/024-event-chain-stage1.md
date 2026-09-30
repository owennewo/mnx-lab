# 024 — A fresh event listener on the sine happy path

## Pre-registration

2026-09-30. Designed, implemented, run and recorded by **GPT-6.1 in Codex**, terminal,
TypeScript/tsx/Vitest. Research-log question 4, stage 1 of development contract 2 only.
This section, the distant score and research note are landed before rendering, listener
implementation or evaluation. Exactly one new listener version is tested; a failure
is reported and left for the next experiment rather than tuned in this one.

### Question and evidence

Can a pitch-driven event chain with explicit stay/advance/skip transitions and a
separate end-of-piece alignment pass the simplest sine performances and their controls?
The audited event-oracle@2 and approved stage-gates@1 are used unchanged. Experiment
023 showed that the frozen frame warpers run ahead of slow players and follow a
semitone-neighbour wrong score. The user moved that near miss to stage 2. Here the new
control is `w2`, two bars in a distant register, with leaps and another rhythm.

The bounded [research note](../research/event-chain-024.md) records the published
monophonic HMM family, and the limits of pure-tone pitch measurements. Our inference
is that its hard-emission, ordered-chain limit suffices for this happy path. It is not
a reproduction of the published general algorithm. Frozen clock and time-warp@8,
@12 and @14 provide informative comparisons, and their eight performance records
must remain identical to g023. No claim about errors, guitars or real music is tested.

Alternative explanations are separated: the controls catch a clock or a pitch-blind
onset counter; off-tempo performances catch handed-tempo advancement; full assessment
metrics catch a cursor that hears pitches but cannot reconstruct timing. The strict
zero-false-finding gate catches an assessor that mechanically flags slowness.

### Method fixed before the run

1. Freeze `contract2-stage1-v3`: reuse the eight WAV performances and eight silence
   controls from v2 byte for byte, relabelling only the wrong-score controls with w2.
   The new score is C2 G2 C#2 (half, quarter, quarter) | A#2 E2 B1 F#2 (quarter,
   eighth, eighth, half). Every three-note interval pair is compared with s1 and s2,
   including transpositions; its register and rhythm must differ. The v2 set stays fixed.
2. Build `event-chain@1` directly on the version-2 Listener interface. Compile selected
   monophonic score events. On causal 20 ms windows at 10 ms hops, estimate pitch from
   interpolated positive zero-crossing periods, requiring at least three crossings and
   RMS >= 0.002. Accept a rounded MIDI note only within 0.25 semitone, with two successive
   windows agreeing. A hard-emission event chain stays on the current event or advances
   by one or skips up to two, with ordered-transition costs 0, 0.1 and 1.5 per skipped
   event. It never advances because of time or the handed tempo. Unsupported audio
   emits unsupported after 100 ms; silence after an acquired event holds it. Restrict
   start to a clean monophonic score, all parts and the top of the score. Refusals count.
3. At finish align the detected pitch-change tokens to score events by independent
   whole-sequence dynamic programming: exact pitch match costs zero; insertion and
   deletion cost one; mismatched pitch cannot match. Report every score note matched
   or missing, intervals between matched observations and overall/typical tempo and
   bar flags from those intervals. Token onset is the first agreeing window's end minus
   20 ms (floored at zero). The assessor reads neither labels nor generator recipes.
   This version has no wrong-pitch/dead recognition and cannot support chords or
   repeated identical notes; those are later-stage limitations.
4. Run all 24 examples through all five listeners at 48 kHz in 480-sample chunks;
   assess only event-chain@1 (the baselines have no assessment). Check six prefix
   changes on every example for the new listener, and on s1-90, s2-90, sil-s2-90 and
   w2-s2-90 for each baseline. Cost includes start, feed and finish on the measured
   Linux host and is provisional, not a browser/device claim. Pin commit and source
   hashes and record private records and assessments by path and hash. The runner
   refuses uncommitted files, an unlanded pre-registration and existing run IDs.

### Predictions

| # | Prediction |
|---|---|
| 1 | All 16 reused WAV hashes equal v2; w2 has no transposition-equivalent three-note interval pair or matching rhythm with s1/s2; the eight performance records for every baseline equal g023 byte for byte. |
| 2 | event-chain@1 passes every cursor gate on all eight performances: >=95% on-event, <=1% ahead, <=5% exposure, no episode >0.5 s and all 48 events reached within 0.2 s. |
| 3 | It rejects all 16 controls with 100% correct rejection and zero false following; each control assessment claims zero played notes and zero tempo. |
| 4 | All eight assessments match all 48 score notes, report all 40 intervals within the approved tolerance, overall tempo within 5%, and zero false findings or bar flags. |
| 5 | Every prefix check passes; every new-listener cost ratio <=0.25 and p99 <=10 ms. |
| 6 | event-chain@1 passes stage-gates@1 completely; no baseline passes the whole stage, and each time warper rejects the eight distant-score controls. |

Each numerical shortfall, any changed reused bytes, any failed prefix check, any
unsupported claim of notes/tempo on a control, or any changed baseline record
contradicts the corresponding prediction. All gate figures are also recorded when
mixed evidence contradicts an aggregate prediction.

### Decision rules

- **D1, set integrity:** freeze only if all reused bytes and w2's structural checks pass;
  otherwise stop with an infrastructure outcome, diagnose and preserve any attempt.
- **D2, listener:** pass stage 1 only if every per-example, pooled, causality and cost
  gate passes. If so the next question is stage 2's first deviation, a hesitation,
  retaining this set as regression evidence. If any gate fails, stage 1 remains open;
  record the concrete failure and rank its cause next. Do not change gates or tune.
- **D3, comparators:** any difference on a reused performance is an integrity issue;
  preserve and diagnose it before trusting comparative claims. Rejection of w2 says
  nothing about the frozen w1 failure. No baseline is modified.
- **D4, infrastructure:** a crash, failed prefix check or non-reproducible input is
  preserved in an attempt file and diagnosed; only an implementation defect in the
  runner or serialization permits a rerun under a new ID. Never change the listener
  and call it a technical rerun. Observations fitting no branch are inconclusive.

No new instrument or oracle is written, so no audit is due. The existing gate and
oracle approval suffices; no numerical or product decision is being requested.

### Carried-over state and preflight

No active worktree, report, ledger or private run owns 024. Worktree `listening-024`
is isolated; run ID `g024-event-chain-stage1` and set v3 are unused. v2 and ffmpeg are
accessible, and private outputs can be written under the authorised data root.
Dependencies are installed once in this worktree. No plateau is inherited: 022 and
023 developed no listener (report 023). Development iterations are not rationed;
this experiment budgets one listener version and one successful recorded execution,
with infrastructure reruns only under D4. Qualification contract 1 has zero frozen
versions and zero assessments: all six version slots, twelve assessment slots and
reserved/final accesses are unused and will remain so. Winner bars 5–8 are untouched.
The eight performances are already examined development evidence; passing them is
stage progress, not independent generalisation or qualification.

## Results

Run [g024-event-chain-stage1](../runs/g024-event-chain-stage1/summary.json), at commit
`36b6807a`, completed on its first attempt in 74.7 s. No listener was changed after
observing results. The pre-registration above is unchanged. The new private set is
`contract2-stage1-v3`, SHA-256
`170fe62059038a9d584ffd991599b6b95d53b40db754aebedcf75369a8281b04`.
The summary pins the set, code, pre-registration, private records and assessments.

### Set integrity and procedure

All 16 reused WAVs retain the v2 asset paths and hashes, verified by readStageSet2
before freezing and again before execution. w2 compiled cleanly and passed all
pre-registered structural checks. Its MIDI pitches are 36, 43, 37, 46, 40, 35, 42;
its onsets in quarters are 0, 2, 3, 4, 5, 5.5, 6. Every adjacent interval pair differs
from every three-note pair in s1/s2, even allowing transposition. v2 is unchanged;
its w1 controls stay stage-2 evidence. All 32 baseline records on the eight reused
performances are byte-identical to g023. No shared harness, baseline, instrument,
oracle or product source was edited.

**Procedure departure:** the new set builder and the listener source were written
in the same implementation batch, before the set was frozen. The pre-registration
ordered freezing before building the listener. No listener had run, no observation
was available, and the already-landed w2 and reused audio were not changed. Thus the
set was frozen before any candidate evaluation, but not before its code existed.
This departure is recorded rather than silently treating the order as followed.
The runner's legacy-factory typing mistake and an initial Vitest invocation from the
wrong working directory were corrected before execution; neither ran a listener or
changed its method. There was no infrastructure failure or technical rerun.

### New listener: the eight performances

All eight pass every cursor and assessment gate. On-event time uses the instrument's
200 ms transition allowance; it does not imply instantaneous detection. The actual
48 event delays are 19.7–38.1 ms, with no early claim and no wrong-position exposure.
The table gives each example's longest delay and largest interval-duration error.

| Example | On-event | Reached | Max delay, ms | Reported BPM | Overall error | Intervals within | Max interval error, ms |
|---|---|---|---|---|---|---|---|
| s1-45 | 100% | 4/4 | 33.3 | 45.000 | 0.000% | 3/3 | 6.67 |
| s1-63 | 100% | 4/4 | 37.6 | 63.158 | 0.251% | 3/3 | 12.38 |
| s1-90 | 100% | 4/4 | 36.7 | 90.452 | 0.503% | 3/3 | 16.67 |
| s1-99 | 100% | 4/4 | 33.9 | 98.901 | 0.100% | 3/3 | 6.06 |
| s2-45 | 100% | 8/8 | 36.7 | 44.968 | 0.071% | 7/7 | 16.67 |
| s2-63 | 100% | 8/8 | 38.1 | 62.969 | 0.050% | 7/7 | 17.63 |
| s2-90 | 100% | 8/8 | 36.7 | 89.936 | 0.071% | 7/7 | 16.67 |
| s2-99 | 100% | 8/8 | 37.6 | 98.824 | 0.178% | 7/7 | 16.06 |

All **48 score notes** are assessed and matched. All **40 intervals** are present
and within tolerance. Every clean assessment has zero false findings: no missing,
wrong or dead note and no fast/slow bar flag. At half speed the assessor reports
approximately 45 BPM while matching all notes and flagging no tempo variation,
as the user's example requires. This establishes steady slow timing only, not
hesitations or beginner bundles.

### Controls

| Control kind | Examples | Correct rejection | False-following exposure | Played-note claims | Tempo claims | Cursor + assessment gates |
|---|---|---|---|---|---|---|
| Silence | 8 | 100% each | 0 s each | 0 each | 0 each | all pass |
| Distant wrong score w2 | 8 | 100% each | 0 s each | 0 each | 0 each | all pass |

The assessor marks every handed-score note missing on the controls. These reports
are honest rejections, and controls are excluded from pooled finding counts as
approved. Because the score and audio have disjoint registers, this is an easy
rejection result; it establishes nothing about w1 or wrong-note acceptance.

### Comparators, causality and cost

| Listener | Performance cursor gates | Control cursor gates | Max sustained ratio | Max chunk p99, ms | Whole stage |
|---|---|---|---|---|---|
| clock-follower@1 | 3/8 | 0/16 | 0.00263 | 0.073 | fail |
| online-time-warp@8 | 3/8 | 16/16 | 0.18271 | 1.853 | fail |
| online-time-warp@12 | 2/8 | 16/16 | 0.17486 | 1.557 | fail |
| online-time-warp@14 | 2/8 | 16/16 | 0.16315 | 1.711 | fail |
| event-chain@1 | 8/8 | 16/16 | 0.00215 | 0.115 | pass |

The baseline performance-gate pattern is unchanged. Each time warper now passes all
16 cursor controls, including all eight distant-score controls. That differs from
023 because the approved control changed, not because the baseline improved; its
recorded failure on w1 remains intact. Every baseline fails the assessment gates
because it emits no assessment.

All **240 prefix checks pass**: 144 for the new listener (six on every example),
and 96 for the four baselines (six on each of four examples). No start was refused.
Every listener meets the cost budget and has zero backlog. The new listener's maximum
sustained ratio is **0.00215** and chunk p99 **0.115 ms**; maximum initialization and
finish times are recorded per example in the summary. The measurement includes the
whole-recording alignment at finish. This is a provisional Node measurement on the
summary's Linux host, not a microphone/browser/mobile claim.

The new listener also passes all applicable pooled gates: zero false alarms among
12 bar negatives for each tempo direction and 48 note negatives for each note-finding
kind. Finding recall, recovery and extra-note handling have no positives here and
are **not applicable**. Passing vacuous recall gates establishes no error detection.

## Against the predictions

| # | Verdict | Evidence |
|---|---|---|
| 1 | Held | All 16 reused WAV hashes match v2, every w2 structural check passes, all 32 baseline performance records equal g023. |
| 2 | Held | All eight cursor verdicts pass: 100% on-event under the transition allowance, zero ahead/exposure, 48/48 reached within 38.1 ms. |
| 3 | Held | All 16 controls reject for 100% of answerable time, with zero played-note or tempo claims. |
| 4 | Held | 48/48 notes matched, 40/40 intervals within tolerance (maximum error 17.63 ms), overall error at most 0.503%, no false finding or flag. |
| 5 | Held | All 240 prefix checks pass; the new listener's maxima are ratio 0.00215 and p99 0.115 ms. |
| 6 | Held | event-chain@1 passes every applicable per-example, pooled, causality and cost gate; no baseline passes the stage; every time warper rejects all distant-score controls. |

## Decision

**D1:** set integrity holds. **D2:** stage 1 passes under stage-gates@1, controls and
both outputs included. event-chain@1 is the provisional development listener; it
is preserved as this version, with no qualification or product retention claimed.
**D3:** the comparisons are trusted because all reused baseline records reproduce;
w1's failure is unchanged. **D4:** no infrastructure failure, failed prefix or rerun.
The recorded implementation-order departure does not fit the outcomes tested by D1–D4;
it limits the procedural claim, not the measured stage verdict. No favourable new
branch is invented for it. No instrument or oracle changed, so no audit is due.

### Resulting plateau, budgets and evidence access

Plateau **0**: the first candidate cleared the lowest unpassed stage on this evidence.
Contract 2 has three numbered experiments and one new listener version, with one
completed listener comparison here and no technical rerun. Development versions are
not rationed. Qualification contract 1 is untouched: zero frozen qualification
versions and zero assessments; all six version slots, twelve assessment slots,
reserved and final access remain unused. Winner bars 5–8 remain unexamined.
All stage-1 sets are reused development evidence. Passing these short pure-tone
scales does not demonstrate transfer to another piece, synth, guitar or player.

## Next

The top question is stage 2's **first deviation, a hesitation**, with the same scores
and sine sound, keeping the full stage-1 v3 set as regression evidence. Declare
hesitation labels from generation and test the approved ranges before adding another
deviation. The live chain's absence of clock advancement predicts a held cursor;
the independent interval assessor predicts a slow-bar finding. Those are hypotheses,
not findings from this run. The near-miss w1 belongs to stage 2 beside wrong-note
handling; it must not be forgotten or reclassified as solved by w2.

No current user approval is required. Existing gates cover stages 1–3. Gates before
recorded guitar in stage 4, qualification evidence and Studio promotion remain future
user decisions, and are not entered here. Do not test the next stage in this session.

## Attribution and validation

Designed, implemented, executed and recorded by the GPT-6-based Codex agent in this
session, terminal/TypeScript/tsx/Vitest. The pre-registration called it GPT-6.1; the
runtime instructions identify the GPT-6 family but expose no independently verifiable
minor model identity, so that narrower attribution is not asserted as evidence.
The user, who launched the session, identified it afterwards as **Sol 6.1 (high) in
Codex** (recorded 2026-09-30, after the experiment landed).
The focused behavioral suite passed before execution; the final repository gate
validates the completed record and complete bench suite before landing.
