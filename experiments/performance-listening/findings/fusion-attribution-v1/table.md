# Measured comparison

Counts are pooled over cases. Processing is median total per-chunk wall time across three passes; latency/backlog are first-pass replay values.

## development

| Recipe | Attack TP / FP / FN | Repeat precision / recall / F1 | Active F1 | False accusations | Unassessed targets | Processing / F-000 |
|---|---|---|---|---:|---:|---:|
| F-000 | 288 / 1626 / 129 | 10.4% / 39.7% / 16.5% | 58.2% | 1625 | 143 | 1.0000× |
| F-003-01 (selected) | 327 / 1633 / 90 | 18.4% / 78.2% / 29.8% | 58.2% | 1632 | 104 | 1.0521× |
| F-003-02 | 326 / 1633 / 91 | 18.2% / 76.9% / 29.4% | 58.2% | 1632 | 105 | 1.0523× |
| F-002-01 | 328 / 1649 / 89 | 17.8% / 79.5% / 29.1% | 58.2% | 1648 | 103 | 1.0561× |

| Recipe | Matched p95 | Common-match p95 parent → candidate (count) | Max backlog | Failed gates |
|---|---|---|---|---|
| F-003-01 | 159.97 ms | 163.61 ms → 163.62 ms (288) | 6.41 ms | more false accusations |
| F-003-02 | 160.00 ms | 163.61 ms → 163.86 ms (288) | 4.83 ms | more false accusations |
| F-002-01 | 157.68 ms | 163.61 ms → 163.63 ms (288) | 2.49 ms | more false accusations |

A lower pooled latency can reflect a changed match population. Parent and reference details, all timings and category/preset results remain in the JSON summaries.

## heldout

| Recipe | Attack TP / FP / FN | Repeat precision / recall / F1 | Active F1 | False accusations | Unassessed targets | Processing / F-000 |
|---|---|---|---|---:|---:|---:|
| F-000 | 102 / 420 / 30 | 21.8% / 71.2% / 33.3% | 61.3% | 420 | 32 | 1.0000× |
| F-003-01 (selected) | 117 / 421 / 15 | 26.4% / 92.4% / 41.1% | 61.3% | 421 | 17 | 1.0782× |
| F-002-01 | 117 / 431 / 15 | 25.3% / 92.4% / 39.7% | 61.3% | 431 | 17 | 1.0721× |

| Recipe | Matched p95 | Common-match p95 parent → candidate (count) | Max backlog | Failed gates |
|---|---|---|---|---|
| F-003-01 | 156.43 ms | 155.60 ms → 156.43 ms (102) | 9.41 ms | more false accusations |
| F-002-01 | 154.99 ms | 155.60 ms → 154.99 ms (102) | 7.52 ms | more false accusations |

A lower pooled latency can reflect a changed match population. Parent and reference details, all timings and category/preset results remain in the JSON summaries.
