# Reference measurement

Generated from the full run; see `summary.json` for counts and provenance.

| Strategy / mode / sound | Attack F1 | Active F1 | Exact active sets | Matched latency p95 (s) | Processing / audio |
|---|---:|---:|---:|---:|---:|
| harmonic/offline/guitar | 30.2% | 61.9% | 53.6% | 1.522 | 0.063 |
| harmonic/stream-256/guitar | 30.2% | 61.9% | 53.6% | 0.122 | 0.062 |
| harmonic/stream-2048/guitar | 30.2% | 61.9% | 53.6% | 0.179 | 0.063 |
| template/offline/guitar | 56.6% | 79.6% | 69.4% | 1.563 | 0.079 |
| template/stream-256/guitar | 56.6% | 79.6% | 69.4% | 0.192 | 0.079 |
| template/stream-2048/guitar | 56.6% | 79.6% | 69.4% | 0.224 | 0.081 |
| neural/offline/guitar | 69.5% | 88.0% | 66.3% | 8.089 | 2.553 |
| neural/stream-256/guitar | — | — | — | — | — |
| neural/stream-2048/guitar | — | — | — | — | — |
| harmonic/offline/guitar2 | 25.0% | 66.1% | 63.2% | 1.517 | 0.077 |
| harmonic/stream-256/guitar2 | 25.0% | 66.1% | 63.2% | 0.147 | 0.075 |
| harmonic/stream-2048/guitar2 | 25.0% | 66.1% | 63.2% | 0.223 | 0.073 |
| template/offline/guitar2 | 30.3% | 53.0% | 25.5% | 1.607 | 0.091 |
| template/stream-256/guitar2 | 30.3% | 53.0% | 25.5% | 0.182 | 0.092 |
| template/stream-2048/guitar2 | 30.3% | 53.0% | 25.5% | 0.229 | 0.094 |
| neural/offline/guitar2 | 75.2% | 88.1% | 70.5% | 7.961 | 2.923 |
| neural/stream-256/guitar2 | — | — | — | — | — |
| neural/stream-2048/guitar2 | — | — | — | — | — |
| harmonic/offline/piano | 28.8% | 56.5% | 23.6% | 1.519 | 0.066 |
| harmonic/stream-256/piano | 28.8% | 56.5% | 23.6% | 0.099 | 0.064 |
| harmonic/stream-2048/piano | 28.8% | 56.5% | 23.6% | 0.148 | 0.065 |
| template/offline/piano | 34.4% | 41.2% | 18.1% | 1.602 | 0.082 |
| template/stream-256/piano | 34.4% | 41.2% | 18.1% | 0.146 | 0.082 |
| template/stream-2048/piano | 34.4% | 41.2% | 18.1% | 0.224 | 0.082 |
| neural/offline/piano | 79.0% | 88.4% | 63.9% | 8.021 | 2.647 |
| neural/stream-256/piano | — | — | — | — | — |
| neural/stream-2048/piano | — | — | — | — | — |

Neural stream rows are unavailable, not zero scores. Latencies cover matched attacks only.
Processing uses wall-clock elapsed time on the recorded machine; no microphone or UI latency is included.
