# Pitch attribution for additional attacks

[Back to fusion log](../fusion-log.md)

- **ID:** pitch-attribution
- **Role:** cheap causal filter on additional re-strikes; does not change pitch estimation.
- **Implementation:** `attributedAttack` in [attack.mjs](../detectors/attack.mjs).
- **Evidence:** F-003 frozen two-setting trial; results recorded below.
- **Disposition:** experimental, not a production default.

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
| Neighbour radius | semitones | Fixed | ±1 | Does not directly reject octave/harmonic confusions |
| Confirmation | qualifying frames | Inherited | 2 | Both frames must pass attribution as well as activity threshold |
| Pitch range edge | missing-neighbour score | Fixed | 0 | Does not invent a competitor beyond the searched range |
| Spectral attack parameters | threshold / seconds | Inherited from F-002 | .15 / .09 / .035 | Changes are not isolated if these are retuned too |

## Timing and cost contract

Uses only this frame's scorer coefficients; no lookahead or retrospective score threshold.
Checks run when a crossing could start a re-strike and on pending confirmation frames.
There is no extra confirmation frame or FFT. Measure the whole pipeline against both
F-000 and F-002, with processing, common-match latency and recall shown together. State
and resets are inherited from the re-strike tracker; no independent persistent state.

## Trial history

The [F-003 protocol](../experiments/fusion-attribution-protocol.md) freezes the two ratios,
reference recipe, regression split and fresh adjacent-note tests before measurement.

## What works, what does not, what is unknown

Mechanics tests check opt-in behaviour, both neighbours, range edges and ties. A ratio of
one allows equal evidence; 1.5 does not. Neither behaviour establishes musical correctness.
Shared harmonics, incorrect dominant hypotheses and same-pitch duplicate triggers can remain.
Real close-interval chords and quiet voices must be examined explicitly.

## Next experiment and acceptance question

Retain only measured gains over F-002 with parent pitch coverage intact. Inspect surviving
false attacks before choosing another constraint. Do not treat zero neighbouring-pitch
extras as success if genuine quiet/adjacent re-strikes disappear with them.
