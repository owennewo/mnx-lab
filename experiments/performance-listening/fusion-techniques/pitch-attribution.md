# Pitch attribution for additional attacks

[Back to fusion log](../fusion-log.md)

- **ID:** pitch-attribution
- **Role:** cheap causal filter on additional re-strikes; does not change pitch estimation.
- **Implementation:** `attributedAttack` in [attack.mjs](../detectors/attack.mjs).
- **Evidence:** F-003 two-setting trial and F-004 fixed harmonic follow-up.
- **Disposition:** neighbour ratio 1 is the preferred experimental setting; harmonic rule parked. Neither accepted as default.

## Purpose and fit

F-002 often re-struck semitone-neighbour pitch hypotheses that were never played. Require
an additional attack's current harmonic coefficient to be at least `neighborRatio` times
the larger coefficient of the immediate semitone neighbours. This consumes scores already
computed for the same frame; it introduces no extra FFT or model. It is competition among
hypotheses, not proof that the winning pitch was played and not a calibrated probability.

The filter applies only when creating/confirming an additional attack. A rejected pending
candidate does not refund its crossing. Confirmed events continue following their parent.
Every original F-000 event, its peak confidence and active-pitch presence remain unchanged.
This deliberately preserves existing erroneous parent pitches too.

## Configuration

| Parameter | Units | Availability | Tried | Interaction |
|---|---|---|---|---|
| `fusion.neighborRatio` | coefficient ratio | Configurable, opt-in | 1.0 and 1.5 | Higher margin may lose real adjacent or quiet notes |
| `fusion.harmonicRatio` | coefficient ratio | Configurable, opt-in | F-004: 1.0 | Lower-pitch competition may suppress a real upper voice |
| Harmonic offsets | semitones below candidate | Fixed | 12, 19, 24, 28, 31 | Rounded partials 2–6; no tuning/inharmonicity model |
| Neighbour radius | semitones | Fixed | ±1 | Does not directly reject octave/harmonic confusions |
| Confirmation | qualifying frames | Inherited | 2 | Both frames must pass attribution as well as activity threshold |
| Pitch range edge | missing-neighbour score | Fixed | 0 | Does not invent a competitor beyond the searched range |
| Spectral attack parameters | threshold / seconds | Inherited from F-002 | .15 / .09 / .035 | Changes are not isolated if these are retuned too |

F-004 additionally compares the candidate against lower-pitch coefficients at those
harmonic offsets. It is a hypothesis test over the same scorer, not subtraction of the
lower voice’s spectral contribution. Real octave/fifth voices over stronger bass are a
known risk. All added criteria apply to additional attacks only.

## Timing and cost contract

Uses only this frame's scorer coefficients; no lookahead or retrospective score threshold.
Checks run when a crossing could start a re-strike and on pending confirmation frames.
There is no extra confirmation frame or FFT. Measure the whole pipeline against both
F-000 and F-002, with processing, common-match latency and recall shown together. State
and resets are inherited from the re-strike tracker; no independent persistent state.

## Trial history

The [F-003 protocol](../experiments/fusion-attribution-protocol.md) freezes the two ratios,
reference recipe, regression split and fresh adjacent-note tests before measurement.

| Trial | Recipe and inputs | Accuracy/cost observation | Decision |
|---|---|---|---|
| PA-001 · F-003 development | Ratios 1/1.5; 168 regression recordings | Ratio 1 removes 16/23 F-002 added false attacks, loses one true match; +5.2% processing vs F-000 | Prefer 1; higher margin gives no further false-positive benefit |
| PA-002 · F-003 held-out | Locked ratio 1; 42 new recordings | Removes 10/11 added false attacks with unchanged TP vs F-002; +7.8% processing vs F-000 | Revise: one octave false re-strike remains; [evidence](../findings/fusion-attribution-v1/README.md) |
| PA-003 · F-004 development | Neighbour 1 + harmonic 1; 210 previous cases | Removes one of eight F-003 extras; unchanged TP; +4.9% vs F-000 | Very small contribution |
| PA-004 · F-004 held-out | Fixed setting; 42 fresh octave/fifth/bass cases | Same 97 TP / 511 FP / 35 FN as F-003; +4.7% vs F-000, F-003 +3.7% | Park harmonic rule; [full evidence](../findings/fusion-harmonic-attribution-v1/README.md) |

## What works, what does not, what is unknown

Mechanics tests check opt-in behaviour, both neighbours, range edges and ties. A ratio of
one allows equal evidence; 1.5 does not. Neither behaviour establishes musical correctness.
Shared harmonics, incorrect dominant hypotheses and same-pitch duplicate triggers can remain.
Real close-interval chords and quiet voices must be examined explicitly.

## Next experiment and acceptance question

Neighbour competition earned a useful gain, while lower-harmonic score competition did
not generalize that gain to fresh audio. Keep harmonicRatio absent in the preferred recipe.
The residual octave error suggests testing an independent cue, such as conditional
spectral-change scoring, with its cost and quiet/close-interval losses measured explicitly.
This is untried. Preserve the existing parent-pitch contract and freeze a new held-out set.
