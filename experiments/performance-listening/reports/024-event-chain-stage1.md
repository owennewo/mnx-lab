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
