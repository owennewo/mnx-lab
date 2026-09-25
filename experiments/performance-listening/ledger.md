# Run ledger

Append-only. Every new row updates [the research log](RESEARCH_LOG.md) in the same
commit. Construction progress belongs in [FIRST_STEP §12](FIRST_STEP.md#12-progress-and-learnings).
The provisional research contract is not human-approved.

<a id="g001-clock-harness-v1"></a>

| Run | Hypothesis / sources | Parent / candidate | Set / evaluator | Conditions / resources | Results / uncertainty | Decision / next action |
|---|---|---|---|---|---|---|
| [g001-clock-harness-v1](runs/g001-clock-harness-v1/report.md) | [Pre-registered §9](FIRST_STEP.md#9-pre-registered-predictions-for-the-first-run); [evaluation research](research/cont-2007-evaluation.md), [baseline search](research/trivial-baseline-search.md) | No parent; clock-follower@1 | Frozen harness-v1; following-evaluator@1; [instrument v1 freeze](contracts/freeze.json) | 48 kHz mono, 480-sample chunks; [versions, hashes, machine and conditions](runs/g001-clock-harness-v1/metadata.json); [provisional cost](runs/g001-clock-harness-v1/report.md#processing-cost--provisional) | Every §9 prediction agrees; all prefix checks pass. [Per-category results](runs/g001-clock-harness-v1/report.md); correlated grid points from one deterministic generator, no independent-source interval or real-instrument transfer claim | Instrument check passed; clock remains the permanent floor. Research-contract-0 stays provisional and unapproved. Next: separate human-approved contract and real-evidence preparation; not started |
