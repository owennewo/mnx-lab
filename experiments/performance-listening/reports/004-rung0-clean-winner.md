# 004 — Rung 0: can the existing followers follow clean Winner?

## Pre-registration

Committed 2026-09-25, before the rung-0 set is built or any candidate runs on it.
Governed by [development contract 1](../contracts/development-contract-1.md). This is
the first experiment under the one-file rule: results are appended below, and nothing
above this line changes after the run.

### Question

Do the frozen `spectral-follower@1` and `spectral-follower@2` meet the development
contract's following gates on rung 0? Rung 0 is Winner's first four bars rendered
from the same private score experiment 002 used: one sine partial per note, every
note at its score timing and duration, at the constant 101 BPM that experiment 002
handed the listeners. The labels are exact by construction.

Experiment 002 could not tell whether the spectral followers failed because of how
they track or because of what real guitar audio does. Clean audio with an exact answer
separates the two. A follower that fails here has a tracking or template defect that
acoustics cannot explain.

### Evidence

| Example | Audio | Score handed to the listener | Expected account |
|---|---|---|---|
| positive | Rung-0 rendering, bar 1 to the start of bar 5 | Winner | Follow throughout, from 150 ms after the first onset |
| wrong-score | The same rendering | Dust in the Wind | Unsupported, from 150 ms |
| silence | Digital silence, same duration | Winner | Unsupported, from 150 ms |

The set is `winner-ladder-rung0-v1`, built by `score-render@1` and frozen outside git
before the first run, because the score is private. Rung 0 has no randomness, so its
one example serves as both development and held-out evidence. The frozen
`following-evaluator@1` judges it without any change. Its labels have exactly the
shape that evaluator already judges; only the recipe differs from sine-v1.

### Scoreboard

- **Rung 0:** clock-follower@1, spectral-follower@1 and spectral-follower@2, all
  frozen, each on all three examples, with the six prefix causality checks per
  example that experiment 002 used.
- **Recognition at exact labels:** the experiment 003 measure for both spectral
  representations, with the supplied position taken from the exact rendering.
- **Thermometer:** all three candidates on the frozen experiment 002 real clip under
  `sync-proxy-evaluator@1`. Recorded, not used to select anything.

### Predictions

1. **Clock.** It meets every accuracy gate on the positive example with zero exposure,
   because it runs at exactly the rendered tempo. It fails both controls with no
   correct rejections. It therefore fails the rung.
2. **Spectral follower 1.** It follows clean audio better than the 46% agreement it
   reached on the real clip, but it still fails the 95% supported-correct gate. The
   template ties found in experiment 003 are structural, so clean audio should not
   remove them. It rejects silence completely and rejects the wrong score on at least
   90% of answerable points.
3. **Spectral follower 2.** Its templates expect four harmonics, and pure sines have
   none, so it follows rung 0 worse than version 1 does.
4. **Recognition.** For both representations, accepting the template at the exact
   position is more frequent than the 47.5% and 16.3% of experiment 003. Ties or
   losses against nearby wrong positions still cover more than half of the frames.
5. **Thermometer.** All three candidates reproduce their experiment 002 metrics on
   the real clip exactly, because code and data are unchanged.

### What would contradict them

- If a spectral follower passes every rung-0 gate, experiment 002's failures were
  acoustic rather than tracking defects. That follower becomes the incumbent for
  rung 1.
- If ties and losses fall below 10% of frames at exact labels, finding 19's structural
  explanation of the ties is wrong, and they came from the audio or the sync.
- If the thermometer does not reproduce experiment 002, the pipeline is not
  deterministic. That is an infrastructure defect to fix before interpreting anything.

### Decision rules, fixed now

- **No spectral version passes rung 0.** The tracking defect is established on clean
  audio. The next question is the online time-warping comparator on rung 0, before
  any revision of the spectral templates.
- **A spectral version passes rung 0.** It becomes the incumbent. Rung 1 is built
  next, and the comparator still follows.
- **Either way**, the scoreboard records every gate for every example. A follower does
  not pass by passing on average.

## Results

Run [g004-rung0-clean-winner](../runs/g004-rung0-clean-winner/summary.json), on the
pre-registration commit `2f17e836`. The rung-0 set `winner-ladder-rung0-v1` holds
32 notes, at most two sounding at once, over 9.505 seconds at 101 BPM. It was frozen
before the first candidate ran.

**No candidate passes rung 0.** Both spectral followers fail on clean audio with an
exact answer, so their failures in experiment 002 were not caused by the real
recording alone. The decision rule fixed above applies: the next question is the
online time-warping comparator on rung 0, before any revision of the spectral
templates.

### Rung 0, by example

Each cell is the as-decided view over 189 answerable grid points. Failed gates are
in bold.

| Candidate | Example | Supported correct | Correct rejection | Exposure | Longest episode | Deadline missed | Failed gates |
|---|---|---|---|---|---|---|---|
| clock@1 | positive | 100% | — | 0% | 0 s | 0% | none |
| clock@1 | wrong-score | — | **0%** | **100%** | **9.35 s** | **100%** | 4 |
| clock@1 | silence | — | **0%** | **100%** | **9.35 s** | **100%** | 4 |
| spectral@1 | positive | **79.9%** | — | 4.8% | 0.15 s | **20.1%** | 2 |
| spectral@1 | wrong-score | — | **64.6%** | **35.8%** | **0.55 s** | **35.4%** | 4 |
| spectral@1 | silence | — | 100% | 0% | 0 s | 0% | none |
| spectral@2 | positive | **49.2%** | — | 0% | 0 s | **50.8%** | 2 |
| spectral@2 | wrong-score | — | **77.8%** | **22.4%** | 0.5 s | **22.2%** | 3 |
| spectral@2 | silence | — | 100% | 0% | 0 s | 0% | none |

Coverage was 100% and every prefix causality check passed for every candidate and
example. The heaviest processing was spectral@2 at about 6% of real time, with a
per-chunk p99 of about 1.6 ms, well inside the cost gates.

Spectral@1's positive failures are mostly rejections of correct following, not wrong
positions:

| spectral@1, positive | Grid points |
|---|---|
| Correct | 151 |
| Lost: reported unsupported while following was supported | 29 |
| Wrong: position outside ±0.25 quarter | 9 |
| Separate loss episodes | 22 |

Spectral@2 was never wrong on the positive example. All 96 of its failed points were
losses, because its similarity to pure sines peaks near 0.78 and its median sits at
the 0.65 cutoff.

### Recognition at exact labels

The experiment 003 measure, with the supplied position now exact. Each figure is over
467 analysis frames.

| Measure at the 0.65 cutoff | spectral@1 | spectral@2 |
|---|---|---|
| Template at the exact position accepted | 85.2% | 48.2% |
| Best template within ±0.25 quarter accepted | 87.2% | 49.3% |
| Strongest nearby wrong template accepted | 82.2% | 52.0% |
| Strongest Dust template accepted | 42.6% | 23.6% |

| Correct position against the strongest nearby wrong one | spectral@1 | spectral@2 |
|---|---|---|
| Strictly stronger | 39 | 44 |
| Tied within 1e-9 | 313 | 296 |
| Weaker | 115 | 127 |

The best scalar cutoff that keeps each competitor at or below 5% accepts only 4.3%
and 2.8% of the correct position.

### Thermometer

All three frozen candidates reproduced their experiment 002 metrics on the real
Winner clip exactly, on all three examples. The pipeline is deterministic, and the
thermometer carries no new information for frozen candidates.

### Against the predictions

| Prediction | Outcome |
|---|---|
| 1. The clock meets every accuracy gate on the positive example and fails both controls | **Held** |
| 2. Spectral@1 beats its 46% real-clip agreement but fails the 95% gate; it rejects silence completely | **Held** at 79.9% |
| 2. Spectral@1 rejects the wrong score on at least 90% of points | **Contradicted**: 64.6% |
| 3. Spectral@2 follows worse than spectral@1 | **Held**: 49.2% against 79.9% |
| 4. Exact-position acceptance rises above experiment 003's, yet ties and losses exceed half the frames | **Held**: ties and losses cover 91.6% and 90.6% of frames |
| 5. The thermometer reproduces experiment 002 exactly | **Held** |

### What this changes

- **The tracking defect is established on clean audio.** A clean, exactly timed
  rendering still loses spectral@1 on one point in five, so real-guitar acoustics
  cannot be the whole explanation for experiment 002.
- **The template ties are structural.** About two thirds of frames tie with a nearby
  wrong position even with exact alignment and pure sines. This confirms the
  normalisation explanation from experiment 003 rather than an acoustic or sync cause.
- **The real clip's control rejection was not discrimination.** On the real clip,
  spectral@1 rejected the wrong score 96% of the time. On clean audio it rejects it
  only 65% of the time. The real clip lowered similarity to every template, correct
  or not, so rejecting the wrong score there came from recognising almost nothing.
  Control rejection must be read together with positive acceptance, never alone.

### Next

Build the causal online time-warping comparator from development contract 1 and run
it on this frozen rung, with the same scoreboard. Rung 1, tempo, is built once a
candidate passes rung 0.
