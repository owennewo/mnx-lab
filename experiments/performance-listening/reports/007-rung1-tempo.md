# 007 — Rung 1: tempo

## Pre-registration

Committed 2026-09-25, before the rung-1 set is built or any candidate runs on it.
Governed by [development contract 1](../contracts/development-contract-1.md). Results
are appended below; nothing above this line changes after the run.

### Question

Does the incumbent, `online-time-warp@2`, follow Winner's first four bars when the
performed tempo changes within 80–120% of the tempo it is handed? This is the first
rung where following the audio matters: the audio-ignoring clock loses the position
as soon as the performance drifts from the handed tempo.

### Evidence

The set `winner-ladder-rung1-v1` renders the same score and the same sine timbre as
rung 0, with one change: each example has its own tempo curve. Tempo is a whole BPM,
constant within each eighth note, and changes only at eighth-note boundaries, so every
label stays an exact straight line. The listener is always handed 101 BPM.

| Family | What the curve does | Development seeds | Held-out seeds |
|---|---|---|---|
| Constant | One tempo throughout, drawn from 81–121 BPM | 1, 2 | 101, 102 |
| Ramp | A straight line between two tempi drawn from that range | 3, 4 | 103, 104 |
| Drift | A slow wander around a centre, two sinusoids, within the range | 5, 6 | 105, 106 |

Each seed gives a positive example and a wrong-score control with the same audio and
Dust's score. One digital-silence control covers the rung. The seeds are split here,
before any candidate runs. The rung is passed on the held-out examples and the
silence control, as the contract requires; development examples are reported
alongside.

### Scoreboard

Every candidate so far: the clock, both spectral followers and both online
time-warping versions, on rung 0 and rung 1, with recognition at exact labels on
every positive example and the real-clip thermometer.

### Predictions

1. **The clock fails rung 1.** Its supported-correct rate is below 95% on at least 10
   of the 12 positive examples.
2. **The incumbent passes rung 1.** `online-time-warp@2` meets every gate on every
   held-out example and on the silence control. The worst held-out positive example is
   at least 95% supported correct, and the worst wrong-score control is at least 95%
   correct rejection.
3. **It also passes the development examples.**
4. **Version 1 still fails** the wrong-score controls, as it did on rung 0, and both
   spectral followers fail.
5. **Rung 0 reproduces.** Every candidate's rung-0 results match experiment 006
   exactly.

### What would contradict them

- An incumbent failure on a positive example means its alignment or its support test
  cannot absorb tempo change within the declared range. The failing family and seed
  locate it.
- A wrong-score failure means a tempo-warped path through Dust's reference can fit
  Winner's audio.

### Decision rules, fixed now

- **The incumbent passes rung 1.** Rung 2, onset timing, is built and pre-registered
  next.
- **It fails a held-out example.** The failure is diagnosed before any revision. A
  revision is developed on development seeds only. Because a held-out failure would
  then have informed it, the revised candidate is judged on a fresh held-out set with
  new seeds, not on these.

## Results

Run [g007-rung1-tempo](../runs/g007-rung1-tempo/summary.json), on commit `2ece1fe3`.

### An infrastructure failure first

The first attempt crashed on its first example and produced no result. The frozen
`following-evaluator@1` rounds its time grid to 1e-9 s. A clip whose duration has
more decimals than that can put the last grid point just past the last label
interval, and the evaluator then finds no label. Rung 0 escaped only because its
duration happened to round down. The set builder now pads each clip by at most two
samples of silence to a multiple of 3 samples, which makes the duration exact at that
precision, and refuses any clip that is not exact. The never-evaluated
`winner-ladder-rung1-v1` was set aside, and `winner-ladder-rung1-v2` replaced it with
the same seeds, curves and audio apart from that padding. The evaluator did not change.
Before the rerun, the clock alone was run through the evaluator on all 25 examples to
confirm that each was accepted.

### The incumbent passes rung 1

**`online-time-warp@2` meets every gate on every example**: all 12 held-out and 12
development examples and the silence control. Under the rule fixed above, rung 2 is
next.

| online-time-warp@2 on rung 1 | Worst held-out | Worst development |
|---|---|---|
| Positive: supported correct | 99.4% | 99.4% |
| Wrong score: correct rejection | 96.0% | 95.4% |
| Silence: correct rejection | 100% | — |

Every positive example misses exactly one point, the moment at the start while the
follower gathers 0.2 s of evidence. No positive example has a single wrong position.
Processing peaked at about 14% of real time, with a per-chunk p99 of about 2.3 ms.
Every prefix check passed.

### The wrong-score margin is thinnest when the performance is fast

| Wrong-score control | Mean performed tempo | Correct rejection |
|---|---|---|
| development constant 2 | 110 BPM | 95.4% |
| development constant 1 | 106 BPM | 95.6% |
| held-out constant 102 | 109 BPM | 96.0% |
| held-out ramp 103 | 105.7 BPM | 97.2% |
| held-out ramp 104 | 120.3 BPM | 97.5% |
| development ramp 4 | 106.2 BPM | 97.8% |
| development drift 5 | 105.2 BPM | 97.3% |
| development drift 6 | 100.8 BPM | 98.4% |
| held-out drift 106 | 95.8 BPM | 99.0% |
| development ramp 3 | 96.1 BPM | 99.5% |
| held-out constant 101 | 86 BPM | 100% |
| held-out drift 105 | 94 BPM | 100% |

The four examples averaging below 100 BPM all reject Dust on at least 99% of points.
The three weakest are all constant tempi 5–9% faster than handed. The pattern is not
strictly monotone: the fastest example, at about 120 BPM, rejects 97.5%. This is an
observation to watch on the next rungs, not yet an explanation.

### The other candidates

| Candidate | Rung 1 | Why |
|---|---|---|
| clock@1 | Fails | Supported correct between 7.6% and 76.2% on the 12 positives; rejects nothing |
| spectral@1 | Fails | Supported correct 56–81% on the positives; wrong-score rejection about 60–66% |
| spectral@2 | Fails | Supported correct 34–49%; loses the position far more than it gets it wrong |
| oltw@1 | Fails | Follows every positive perfectly; wrong-score rejection 52–64% |

Every candidate reproduced its experiment 006 rung-0 results exactly, and its
thermometer results on the real clip.

### Recognition at exact labels under tempo change

Summed over the 12 positive examples:

| Correct position against the strongest nearby wrong one | spectral@1 | spectral@2 | oltw features |
|---|---|---|---|
| Frames | 5551 | 5551 | 5621 |
| Strictly stronger | 580 | 587 | 5161 |
| Tied | 3643 | 3413 | 21 |
| Weaker | 1328 | 1551 | 439 |

The online time-warping features, rendered at the handed tempo, still prefer the exact
position on 91.8% of frames when the performance is faster or slower. Losing 7.8% of
single frames does not cost the aligned path a single wrong position.

### Against the predictions

| Prediction | Outcome |
|---|---|
| 1. The clock is below 95% supported correct on at least 10 of 12 positives | **Held**: all 12, at most 76.2% |
| 2. The incumbent passes every held-out example and the silence control, each above 95% | **Held**: worst 99.4% and 96.0% |
| 3. It also passes the development examples | **Held**: worst 95.4% rejection |
| 4. Version 1 and both spectral followers still fail | **Held** |
| 5. Rung 0 reproduces experiment 006 exactly | **Held** |

### Next

Rung 2, onset timing: independent per-note jitter up to ±40 ms and chord spread up to
30 ms, pre-registered with the incumbent. The fast-tempo rejection margin is watched
there. The real-clip thermometer is unchanged: the incumbent still agrees on only
12.7% of real positive points, which the timbre rung will have to address.
