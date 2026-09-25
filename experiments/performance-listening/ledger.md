# Run ledger

Append-only. Every new row updates [the research log](RESEARCH_LOG.md) in the same
commit. Construction progress belongs in [FIRST_STEP §12](FIRST_STEP.md#12-progress-and-learnings).
The original provisional contract 0 was not human-approved. Contract 1 is approved;
experiment 002 uses the subsequent user-directed approximate-development amendment.
From experiment 004, development runs under [development contract 1](contracts/development-contract-1.md):
one row per numbered experiment, pointing at that experiment's single file.

<a id="g001-clock-harness-v1"></a>

| Run | Hypothesis / sources | Parent / candidate | Set / evaluator | Conditions / resources | Results / uncertainty | Decision / next action |
|---|---|---|---|---|---|---|
| [g001-clock-harness-v1](runs/g001-clock-harness-v1/report.md) | [Pre-registered §9](FIRST_STEP.md#9-pre-registered-predictions-for-the-first-run); [evaluation research](research/cont-2007-evaluation.md), [baseline search](research/trivial-baseline-search.md) | No parent; clock-follower@1 | Frozen harness-v1; following-evaluator@1; [instrument v1 freeze](contracts/freeze.json) | 48 kHz mono, 480-sample chunks; [versions, hashes, machine and conditions](runs/g001-clock-harness-v1/metadata.json); [provisional cost](runs/g001-clock-harness-v1/report.md#processing-cost--provisional) | Every §9 prediction agrees; all prefix checks pass. [Per-category results](runs/g001-clock-harness-v1/report.md); correlated grid points from one deterministic generator, no independent-source interval or real-instrument transfer claim | Instrument check passed; clock remains the permanent floor. Research-contract-0 stays provisional and unapproved. Next: separate human-approved contract and real-evidence preparation; not started |


<a id="g002a-spectral1-winner-sync-proxy"></a>

| Run | Hypothesis / sources | Parent / candidate | Set / evaluator | Conditions / resources | Results / uncertainty | Decision / next action |
|---|---|---|---|---|---|---|
| [g002a-spectral1-winner-sync-proxy](runs/g002a-spectral1-winner-sync-proxy/summary.json) | [Pre-run proxy plan](contracts/sync-proxy-development-1.md); [bounded alignment research](research/dixon-2005-online-alignment.md) | clock-follower@1 / spectral-follower@1 | winner-four-bars-sync-proxy-v1 / sync-proxy-evaluator@1; hashes in run | Causal 48 kHz mono, 480-sample chunks, nominal 101 BPM, known start; 16.261452 CPU s; two candidate/set assessments | Winner agreement 46.03% versus clock 88.36%; wrong-score rejection 95.77%, silence 100%; all prefix/cost checks pass. One real performance with unmeasured interpolation precision, approximate wrong-score distinguishability, no population inference | proxy-targets-not-met; one focused register/harmonic revision under unchanged data and targets |

<a id="g002b-spectral2-winner-sync-proxy"></a>

| Run | Hypothesis / sources | Parent / candidate | Set / evaluator | Conditions / resources | Results / uncertainty | Decision / next action |
|---|---|---|---|---|---|---|
| [g002b-spectral2-winner-sync-proxy](runs/g002b-spectral2-winner-sync-proxy/summary.json) | [Pre-run register/harmonic revision](research/spectral-revision-2.md) | spectral-follower@1 parent, clock-follower@1 comparator / spectral-follower@2 | Same frozen set and evaluator as 002a | Same delivery and handoff; 18.324054 CPU s; two more candidate/set assessments | Winner agreement 17.99%, only 42/189 position claims; controls 100%; prefix/cost checks pass. Same development performance reused, no fresh-evidence claim | proxy-targets-not-met; hypothesis contradicted. Two-version sub-batch closed; no retention or expansion. Next: discriminate score templates at supplied alignment to isolate hearing/confidence from tracking; [complete report](reports/002-winner-sync-proxy.html) |


<a id="g003-recognition-at-sync"></a>

| Run | Hypothesis / sources | Parent / candidate | Set / evaluator | Conditions / resources | Results / uncertainty | Decision / next action |
|---|---|---|---|---|---|---|
| [g003-recognition-at-sync](runs/g003-recognition-at-sync/summary.json) | [Pre-run recognition diagnostic](contracts/recognition-diagnostic-1.md); reuses [alignment research](research/dixon-2005-online-alignment.md) | Frozen spectral-follower@1 and @2 feature/template definitions; no new candidate | Same winner-four-bars-sync-proxy-v1; supplied window-center alignment, recognition-diagnostic-1 | 467 causal analysis frames per representation; exact reconstruction audit on 312/108 eligible original decisions; 2.947644 CPU s; two diagnostic assessments conservatively charged | At supplied position, fixed-cutoff acceptance 47.54% / 16.27%; optimistic local 57.82% / 20.34%; many nearby ties. Best cutoff with each competitor ≤5% accepts only 6.00% / 6.21%. One reused performance, unmeasured sync precision, optimistic per-frame match; not end-to-end or a sequence-method ceiling | Component bottleneck identified; diagnostic closed. Investigate attacks and short sequence evidence before another static-template tracker revision. No new candidate, retention, positive Dust or bar expansion; [report 003](reports/003-recognition-at-sync.html) |


<a id="g004-rung0-clean-winner"></a>

| Run | Hypothesis / sources | Parent / candidate | Set / evaluator | Conditions / resources | Results / uncertainty | Decision / next action |
|---|---|---|---|---|---|---|
| [g004-rung0-clean-winner](runs/g004-rung0-clean-winner/summary.json) | [Pre-registered in report 004](reports/004-rung0-clean-winner.md#pre-registration); [development contract 1](contracts/development-contract-1.md) | Frozen clock-follower@1, spectral-follower@1 and @2; no new candidate | winner-ladder-rung0-v1, rung 0, frozen before running / following-evaluator@1 unchanged; recognition at exact labels; sync-proxy thermometer | Causal 48 kHz mono, 480-sample chunks, 101 BPM handoff, known start; 35.3 CPU s; development iteration, not rationed | No candidate passes. Spectral@1 79.9% supported correct, 64.6% wrong-score rejection; spectral@2 49.2%, 77.8%; clock fails both controls. Ties with nearby positions on about two thirds of frames at exact labels. Thermometer reproduces 002 exactly. One deterministic rendering; no transfer claim | Tracking defect established on clean audio; predictions 1, 3, 4, 5 held, wrong-score part of 2 contradicted. Next: online time-warping comparator on rung 0; [report 004](reports/004-rung0-clean-winner.html) |


<a id="g005-oltw-rung0"></a>

| Run | Hypothesis / sources | Parent / candidate | Set / evaluator | Conditions / resources | Results / uncertainty | Decision / next action |
|---|---|---|---|---|---|---|
| [g005-oltw-rung0](runs/g005-oltw-rung0/summary.json) | [Pre-registered in report 005](reports/005-online-time-warp-rung0.md#pre-registration); [Dixon 2005 note](research/dixon-2005-online-alignment.md) | No incumbent; comparator online-time-warp@1; frozen clock and spectral@1/@2 rerun | winner-ladder-rung0-v1 unchanged / following-evaluator@1; recognition over its own features; sync-proxy thermometer | Same delivery and handoff as 004; 69.1 CPU s for the whole scoreboard; development iteration | Positive 100%, silence 100%, wrong-score rejection 59.3%: fails rung 0. Dust frames match Winner frames below the support threshold on 77.7% of frames. No exact recognition ties; 68 of 473 margins below 0.01. Real clip 67.7% agreement. Rung 0 is an implementation check for this candidate only | Prediction 1 contradicted by the wrong-score control. Support must come from the sequence, not the frame. Next: revised support test as experiment 006 on the same set; [report 005](reports/005-online-time-warp-rung0.html) |


<a id="g006-sequence-support-rung0"></a>

| Run | Hypothesis / sources | Parent / candidate | Set / evaluator | Conditions / resources | Results / uncertainty | Decision / next action |
|---|---|---|---|---|---|---|
| [g006-sequence-support-rung0](runs/g006-sequence-support-rung0/summary.json) | [Pre-registered in report 006](reports/006-sequence-support-rung0.md#pre-registration); diagnosis in [report 005](reports/005-online-time-warp-rung0.md#why-the-wrong-score-is-accepted) | online-time-warp@1 parent / online-time-warp@2; earlier candidates rerun | winner-ladder-rung0-v1 unchanged / following-evaluator@1; sync-proxy thermometer | Same delivery and handoff; 98.4 CPU s for the whole scoreboard; development iteration | Passes rung 0: positive 99.5%, wrong-score rejection 97.9%, silence 100%, every gate met. Real clip: 12.7% positive agreement against version 1's 67.7%. Rung 0 shares synthesis with the reference, so this is an implementation-level pass | Incumbent: online-time-warp@2. Timbre-robustness prediction contradicted. Next: build rung 1 and pre-register experiment 007; [report 006](reports/006-sequence-support-rung0.html) |


<a id="g007-rung1-tempo"></a>

| Run | Hypothesis / sources | Parent / candidate | Set / evaluator | Conditions / resources | Results / uncertainty | Decision / next action |
|---|---|---|---|---|---|---|
| [g007-rung1-tempo](runs/g007-rung1-tempo/summary.json) | [Pre-registered in report 007](reports/007-rung1-tempo.md#pre-registration) | Incumbent online-time-warp@2; all earlier candidates rerun | winner-ladder-rung0-v1 and winner-ladder-rung1-v2 (v1 set aside unevaluated after an evaluator crash) / following-evaluator@1 unchanged; recognition; sync-proxy thermometer | 101 BPM handoff; performed tempi 82–121 BPM; 797.6 CPU s for the whole scoreboard; development iteration | Incumbent passes rung 1 on all 25 examples: worst positive 99.4%, worst wrong-score rejection 95.4% (development) and 96.0% (held-out), both on fast constant tempi. All other candidates fail. Rung 0 reproduces 006 exactly. Held-out seeds come from the same generator, so no transfer claim | All five predictions held. Next: rung 2, onset timing; [report 007](reports/007-rung1-tempo.html) |


<a id="g008-rung2-guitar-samples"></a>

| Run | Hypothesis / sources | Parent / candidate | Set / evaluator | Conditions / resources | Results / uncertainty | Decision / next action |
|---|---|---|---|---|---|---|
| [g008-rung2-guitar-samples](runs/g008-rung2-guitar-samples/summary.json) | [Pre-registered in report 008](reports/008-rung2-guitar-samples.md#pre-registration); user direction to separate timbre from timing | Incumbent online-time-warp@2; its alignment-only diagnostic; all earlier candidates rerun | winner-ladder-rung2-v1 (seven recorded guitar sets, grouped by origin) with rungs 0 and 1 / following-evaluator@1; recognition; sync-proxy thermometer | Rung 0 timing, 101 BPM; tonejs samples CC BY 3.0 at 622c2f1c outside git; 1654 CPU s for the whole scoreboard | Incumbent fails rung 2: positives 39.7–96.3%, wrong-score rejection 79.9–100%. Alignment only: 87.8–96.3%, errors in short bursts during decaying bass notes. 214 lost against 53 wrong points. Real clip: alignment only 69.8% against 12.7% with support | Predictions 1, 2, 6, 7 held; 3, 4, 5 contradicted. Both defects exist; next: render the reference with a fixed plucked decay, one change; [report 008](reports/008-rung2-guitar-samples.html) |


<a id="g009-plucked-reference"></a>

| Run | Hypothesis / sources | Parent / candidate | Set / evaluator | Conditions / resources | Results / uncertainty | Decision / next action |
|---|---|---|---|---|---|---|
| [g009-plucked-reference](runs/g009-plucked-reference/summary.json) | [Pre-registered in report 009](reports/009-plucked-reference.md#pre-registration); decay measured on development sets only | online-time-warp@2 parent / online-time-warp@3 and its alignment-only diagnostic; earlier entries reused from cache | Rungs 0, 1, 2 unchanged / following-evaluator@1; recognition; sync-proxy thermometer | 0.58 s reference decay; 1006 CPU s, 15 min; 18 of 18 cache spot checks reproduced | Rung 2: alignment wrong positions 57 against 53; supported-correct gate on 3 of 7 sets; wrong-score gate on 1. Bursts gone only on the two sets whose decay matches the reference. Loses rung 1 on a fast-tempo wrong-score control at 94.9%. Real clip 18.5% | Predictions 1, 2, 3 contradicted, 4 half held, 5 held. Next: a feature diagnostic of the bursts; fresh held-out guitars needed; [report 009](reports/009-plucked-reference.html) |


<a id="g010-slim-suite-and-burst-features"></a>

| Run | Hypothesis / sources | Parent / candidate | Set / evaluator | Conditions / resources | Results / uncertainty | Decision / next action |
|---|---|---|---|---|---|---|
| [g010a](runs/g010a-slim-suite/summary.json), [g010b](runs/g010b-burst-features/summary.json) | [Pre-registered in report 010](reports/010-slim-suite-and-burst-features.md#pre-registration); user direction to cut test count | Incumbent online-time-warp@2, its alignment-only diagnostic, clock; no new candidate | Slim active suite, 19 examples of rungs 0–2 / following-evaluator@1; burst feature diagnostic | Causality once per rung; 123 s wall for the scoreboard, 11 s for the diagnostic | Slim suite reproduces 57 of 57 results of 009. In wrong frames the true position matches better on 82 of 117 frames on the three hardest guitars | Features do not explain the bursts; the alignment's path is examined next; [report 010](reports/010-slim-suite-and-burst-features.html) |
