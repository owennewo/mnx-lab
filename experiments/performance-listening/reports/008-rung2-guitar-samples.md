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

## Results

Run [g008-rung2-guitar-samples](../runs/g008-rung2-guitar-samples/summary.json), on
the pre-registration commit `386b6be1`.

**Timbre alone breaks the incumbent.** With timing exact and only the sound changed,
`online-time-warp@2` fails rung 2 on six of seven sample sets. Switching its support
test off shows two defects of different sizes. The support test is the larger one: it
rejects an alignment that is mostly right. The alignment is the smaller one: it goes
briefly wrong in the same places for every guitar.

### The incumbent and its alignment, by sample set

Supported correct on the positive examples, and correct rejection on the wrong-score
controls, each over 189 answerable points:

| Group | Sample set | Incumbent: supported correct | Alignment only: correct | Incumbent: wrong-score rejection |
|---|---|---|---|---|
| Development | tonejs acoustic | 96.3% | 96.3% | **94.7%** |
| Development | Martin | **94.2%** | **94.2%** | **90.5%** |
| Development | Spanish | **91.0%** | **94.2%** | **94.7%** |
| Development | Fender | 96.3% | 96.3% | **80.4%** |
| Held out | tonejs nylon | **62.4%** | **90.5%** | **79.9%** |
| Held out | tonejs electric | **78.8%** | 95.8% | **88.9%** |
| Held out | Shinyguitar | **39.7%** | **87.8%** | 100% |

Bold marks a value below the 95% gate. Silence was rejected everywhere, every prefix
check passed, and rungs 0 and 1 reproduced experiment 007 exactly for every candidate.

Summed over the seven positive examples, the incumbent's failed points are:

| Failed points on the positives | Count |
|---|---|
| Lost: reported unsupported while its alignment was mostly right | 214 |
| Wrong: a position outside ±0.25 quarter | 53 |

### The support test is not calibrated across timbre

It fails in both directions depending on the guitar. On the held-out nylon and
Shinyguitar sets it rejects the correct score for a third to three fifths of the
performance. On the Fender and nylon sets it accepts Dust's score for about a fifth of
the time. The gap between path cost and free cost moves with timbre, and a single
fixed limit cannot serve all seven guitars.

### Where the alignment goes wrong

The alignment-only diagnostic has no consistent lag: its median signed error is
between −0.034 and 0.000 quarter on every set checked. Its wrong positions come in
short bursts of 0.15–0.35 s, at the same score positions for every guitar, during
the second half of sustained bass notes:

| Score position | What is sounding | Direction of the error |
|---|---|---|
| Quarters 5.5–5.8 | G3 bass held for a beat under the arpeggio | Ahead, by up to 0.51 |
| Quarters 13.5–13.8 | E3 bass held for a beat | Ahead, by up to 0.54 |
| Quarters 6.5–7.0 and 10.1–11.0, some sets | D♯3 and E3 bass held for a beat or more | Behind, by up to 0.71 |

The sine reference holds every note at full level until its score end, while a plucked
string decays. The likely cause, not yet tested, is that decay, not tone colour, is what
misleads the alignment in these places. It fits finding 19: decay cues matter, and the
current reference has none.

### Recognition and the thermometer

With its own features at exact labels, the online time-warping reference prefers the
exact position over the nearest wrong one on 49–69% of frames, depending on the set,
compared with 100% on sine audio. The spectral features stay tie-dominated.

On the real Winner clip, the alignment-only diagnostic agrees with the sync reference
on 69.8% of points, against 12.7% for the incumbent with its support test. The real
clip shows the same split as rung 2: most of the incumbent's real-audio failure is its
support test.

### Against the predictions

| Prediction | Outcome |
|---|---|
| 1. The clock follows every positive and fails every control | **Held** |
| 2. The incumbent is below 95% on most sets, mostly through losses | **Held**: 5 of 7 sets; 214 lost points against 53 wrong |
| 3. With support off, the alignment is correct on at least 95% for most sets | **Contradicted**: 3 of 7 sets; the others 87.8–94.2% |
| 4. Its wrong-score rejection stays at or above 95% on every set | **Contradicted**: 6 of 7 below, down to 79.9% |
| 5. Version 1 follows the positives more often but fails the wrong score | **Contradicted** both ways: it collapses to 0% on Fender and Shinyguitar, and rejects the wrong score on at least 95% of points |
| 6. The alignment-only diagnostic reaches at least 67.7% on the real clip | **Held**: 69.8% |
| 7. Rungs 0 and 1 reproduce experiment 007 | **Held** |

### Decision

The pre-registered rules assumed one defect would dominate; the result shows both. By
size, the support test comes first: it causes four times as many failed points as the
alignment, and on the real clip it turns 69.8% into 12.7%. The alignment errors are
smaller but systematic, and they have a specific suspected cause.

Both defects may share that cause. The support test compares the in-order path with
unconstrained matching, and a reference that never decays makes the in-order path
look worse exactly where a real note is fading. So the next experiment tests one
change: **render the listener's reference with a fixed plucked decay** instead of
held sines, keeping the features, alignment and support test unchanged. It is
developed on the development sample sets and rungs 0 and 1, and judged on the held-out
sets. If the support test still fails across timbre after that, it is revised next,
under the same discipline.
