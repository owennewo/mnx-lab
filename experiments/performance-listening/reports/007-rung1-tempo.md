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
