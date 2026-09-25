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
