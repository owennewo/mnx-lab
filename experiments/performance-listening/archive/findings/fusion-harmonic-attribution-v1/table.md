# Measured comparison

Counts are pooled over cases. Processing is median total per-chunk wall time across three passes; latency/backlog are first-pass replay values.

## development

| Recipe | Attack TP / FP / FN | Repeat precision / recall / F1 | Active F1 | False accusations | Unassessed targets | Processing / F-000 |
|---|---|---|---|---:|---:|---:|
| F-000 | 390 / 2046 / 159 | 15.2% / 54.2% / 23.7% | 58.9% | 2045 | 175 | 1.0000× |
| F-004-01 (selected) | 444 / 2053 / 105 | 21.7% / 84.7% / 34.6% | 58.9% | 2052 | 121 | 1.0491× |
| F-003-01 | 444 / 2054 / 105 | 21.7% / 84.7% / 34.6% | 58.9% | 2053 | 121 | 1.0462× |

| Recipe | Matched p95 | Common-match p95 parent → candidate (count) | Max backlog | Failed gates |
|---|---|---|---|---|
| F-004-01 | 157.32 ms | 159.95 ms → 159.95 ms (390) | 10.13 ms | more false accusations |
| F-003-01 | 157.32 ms | 159.95 ms → 159.97 ms (390) | 10.65 ms | more false accusations |

A lower pooled latency can reflect a changed match population. Parent and reference details, all timings and category/preset results remain in the JSON summaries.

## heldout

| Recipe | Attack TP / FP / FN | Repeat precision / recall / F1 | Active F1 | False accusations | Unassessed targets | Processing / F-000 |
|---|---|---|---|---:|---:|---:|
| F-000 | 82 / 510 / 50 | 13.2% / 51.5% / 21.1% | 53.2% | 509 | 52 | 1.0000× |
| F-004-01 (selected) | 97 / 511 / 35 | 17.6% / 72.7% / 28.4% | 53.2% | 510 | 37 | 1.0472× |
| F-003-01 | 97 / 511 / 35 | 17.6% / 72.7% / 28.4% | 53.2% | 510 | 37 | 1.0370× |

| Recipe | Matched p95 | Common-match p95 parent → candidate (count) | Max backlog | Failed gates |
|---|---|---|---|---|
| F-004-01 | 168.62 ms | 168.63 ms → 168.62 ms (82) | 2.44 ms | more false accusations |
| F-003-01 | 168.60 ms | 168.63 ms → 168.60 ms (82) | 2.13 ms | more false accusations |

A lower pooled latency can reflect a changed match population. Parent and reference details, all timings and category/preset results remain in the JSON summaries.
