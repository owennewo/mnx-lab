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
