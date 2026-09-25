# 008 — Rung 2: recorded guitar samples at exact timing

## Pre-registration

Committed 2026-09-25, before the rung-2 set is built or any candidate runs on it.
Governed by [development contract 1](../contracts/development-contract-1.md), whose
ladder the user reordered to put this rung straight after tempo. Results are appended
below; nothing above this line changes after the run.

### Question

Is timbre what breaks the incumbent on real guitar? `online-time-warp@2` passed the
sine rungs but agrees with the real Winner clip on only 12.7% of points. The real clip
differs from the sine rendering in timbre, player timing, tuning, room, recording
chain and label precision all at once. This rung changes timbre alone: the same notes
at rung 0's exact timing and 101 BPM, sounded by recorded guitar samples.

### Evidence

The set `winner-ladder-rung2-v1` renders Winner's first four bars once per sample set.
Each note uses the sample whose root is nearest its pitch, resampled to the exact
pitch, starting 2 ms before the sample's attack and ending at the note's score end
with a 30 ms release. Every sample is normalised to the same peak, so level does not
vary between sets.

| Group | Sample set | Origin of the recordings | Licence |
|---|---|---|---|
| Development | tonejs-instruments guitar-acoustic | University of Iowa Electronic Music Studios | CC BY 3.0 |
| Development | Martin HD28 steel string | Kinwie Discord SFZ GM bank | CC0 |
| Development | Spanish classical nylon | freepats | CC0 |
| Development | Fender FSBS clean electric | freepats | CC0 |
| Held out | tonejs-instruments guitar-nylon | Freesound 11573, quartertone | CC BY 3.0 |
| Held out | tonejs-instruments guitar-electric | Karoryfer | CC BY 3.0 |
| Held out | Shinyguitar microphone | Karoryfer | CC0 |

The tonejs samples come from github.com/nbrosowsky/tonejs-instruments at commit
622c2f1c and stay outside git; each example's recipe carries its attribution. The two
Karoryfer sets may share recordings, so they share the held-out group. Each set gives a
positive example and a wrong-score control with Dust's score; one silence control
covers the rung. The groups were fixed before any candidate runs.

### Scoreboard

Every candidate on rungs 0, 1 and 2, with recognition and the thermometer. It adds a
diagnostic that is not a candidate: the incumbent with its support test switched off,
reporting its aligned position on every audible frame. This separates a wrong
alignment from a correct alignment that the support test rejects, on this rung and on
the real clip.

### Predictions

1. **The clock** follows every positive example perfectly and fails every control.
2. **The incumbent fails rung 2.** On most sample sets its supported-correct rate is
   below 95%, and most of its failed points are losses, where it reports unsupported,
   rather than wrong positions.
3. **Its alignment survives timbre.** With the support test switched off, the aligned
   position is correct on at least 95% of points for most sample sets.
4. **It still rejects the wrong score.** Its wrong-score rejection stays at or above
   95% on every set.
5. **Version 1**, with its looser per-frame support, follows the sampled positives
   more often than version 2 but still fails the wrong-score controls.
6. **On the real clip**, the alignment-only diagnostic agrees with the sync reference
   on at least 67.7% of points, version 1's rate.
7. **Rungs 0 and 1 reproduce** experiment 007 exactly for every candidate.

### Decision rules, fixed now

- **The alignment holds and the support test rejects it** (predictions 2 and 3). The
  support test is the defect. The next experiment revises it to be robust to timbre,
  developed on the development sample sets and rungs 0–1, and judged on the held-out
  sets.
- **The alignment itself fails**, with wrong positions even when support is ignored.
  The features are sensitive to timbre. The next experiment revises the features under
  the same discipline.
- **The incumbent passes rung 2.** Timbre alone does not explain the real clip. The
  ladder continues with onset timing, and the other differences between the rendering
  and the real clip become the question.
