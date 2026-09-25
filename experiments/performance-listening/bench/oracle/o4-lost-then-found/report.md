# o4-lost-then-found

Candidate: handwritten oracle (no listener). Set: oracle-v1. Evaluator: following-evaluator@1.

Development instrument check under research-contract-0 (provisional, not human-approved). No qualification or retention decision. Counts are correlated grid points.

## o4-lost-then-found

Partition: development.

| Profile dimension | Level | Actual range / deviation |
| --- | --- | --- |
| melodic | 1 | C4–C5 (handwritten score context); C5 exceeds the level-1 range; no audio used by the evaluator. |
| polyphonic | 1 | one voice |
| harmonic | 1 | sine |
| dynamics | 1 | constant −12 dBFS |
| rhythm | 1 | quarter; half-beat sounding |
| tempo | 1 | 60 BPM |
| structuralAmbiguity | 1 | eight distinct quarter notes; no repeats |
| navigation | 1 | known start; continuous |


| Category | As decided | Hindsight | Denominator (live / hindsight) |
| --- | --- | --- | --- |
| correct | 118 | 118 | 158 / 158 |
| wrong | 0 | 0 | 158 / 158 |
| overAmbiguous | 0 | 0 | 158 / 158 |
| lost | 40 | 40 | 158 / 158 |
| abstained | 0 | 0 | 158 / 158 |
| uncovered | 0 | 0 | 158 / 158 |
| falseFollowing | 0 | 0 | 0 / 0 |
| correctRejection | 0 | 0 | 0 / 0 |
| pending | 2 | 2 | 2 / 2 |


### As decided

Supported correct: 118 / 158 (74.68%). Uncovered: 0 / 158 (0.00%). Unsupported on supported truth: 40 / 158 (25.32%).

Wrong-position errors: n=0; mean none, p95 none, max none quarters; wrong-route points without a quarter distance: 0.

False following: 0 s. Confident pending claims: 2 / 2 (100.00%).

| Loss starts (s) | Recovery (s) | Elapsed (s) |
| --- | --- | --- |
| 4 | 6 | 2 |


| Confidence bin | All claims | Pending | Correct / all | Correct / answerable |
| --- | --- | --- | --- | --- |
| [0, 0.2) | 0 | 0 | 0 / 0 (n/a) | 0 / 0 (n/a) |
| [0.2, 0.4) | 0 | 0 | 0 / 0 (n/a) | 0 / 0 (n/a) |
| [0.4, 0.6) | 0 | 0 | 0 / 0 (n/a) | 0 / 0 (n/a) |
| [0.6, 0.8) | 0 | 0 | 0 / 0 (n/a) | 0 / 0 (n/a) |
| [0.8, 1] | 120 | 2 | 118 / 120 (98.33%) | 118 / 118 (100.00%) |


### Hindsight

Supported correct: 118 / 158 (74.68%). Uncovered: 0 / 158 (0.00%). Unsupported on supported truth: 40 / 158 (25.32%).

Wrong-position errors: n=0; mean none, p95 none, max none quarters; wrong-route points without a quarter distance: 0.

False following: 0 s. Confident pending claims: 2 / 2 (100.00%).

| Loss starts (s) | Recovery (s) | Elapsed (s) |
| --- | --- | --- |
| 4 | 6 | 2 |


| Confidence bin | All claims | Pending | Correct / all | Correct / answerable |
| --- | --- | --- | --- | --- |
| [0, 0.2) | 0 | 0 | 0 / 0 (n/a) | 0 / 0 (n/a) |
| [0.2, 0.4) | 0 | 0 | 0 / 0 (n/a) | 0 / 0 (n/a) |
| [0.4, 0.6) | 0 | 0 | 0 / 0 (n/a) | 0 / 0 (n/a) |
| [0.6, 0.8) | 0 | 0 | 0 / 0 (n/a) | 0 / 0 (n/a) |
| [0.8, 1] | 120 | 2 | 118 / 120 (98.33%) | 118 / 118 (100.00%) |


Timeliness: missed deadlines 40 / 158 (25.32%); correct-decision delay mean 0, p95 0, max 0 s. No correct decision: 40 points. Deadline: 0.2 s.

Exposure (as decided only): total 0 s; longest continuous episode 0 s.

## Combined confidence (as decided)

| Bin | Correct / all claims | Pending claims | Correct / answerable claims |
| --- | --- | --- | --- |
| 0–0.2 | 0 / 0 (n/a) | 0 | 0 / 0 (n/a) |
| 0.2–0.4 | 0 / 0 (n/a) | 0 | 0 / 0 (n/a) |
| 0.4–0.6 | 0 / 0 (n/a) | 0 | 0 / 0 (n/a) |
| 0.6–0.8 | 0 / 0 (n/a) | 0 | 0 / 0 (n/a) |
| 0.8–1 | 118 / 120 (98.33%) | 2 | 118 / 118 (100.00%) |


## Causality

Not run: oracle records are handwritten, with no listener.

## Processing cost — provisional

Development-machine budget: sustained ≤ 25% of real time; p99 chunk ≤ 10 ms. Wall-clock measurements vary with load; they do not measure microphone-to-feedback latency.

Not measured: no listener executed.

Summary: 40 answerable live points in failure categories; inspect the example tables above. This is an instrument check.
