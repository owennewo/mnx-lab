# Attack and re-strike evidence

[Back to fusion log](../fusion-log.md)

- **ID:** attack-restrike
- **Role:** acoustic attack evidence feeding temporal tracking/musical events.
- **Implementation:** proposed; no independent attack detector in our DSP pipeline.
- **Evidence:** untried; motivated by measured re-strike failures.
- **Disposition:** candidate next experiment, not adopted.

## Purpose and fit

Distinguish a new strike from ongoing pitch energy. Could consume spectral change/energy
features, or a neural onset stream if available at acceptable cost. Feed
[temporal events](temporal-events.md); preserve a pitch track while emitting a fresh attack.
An attack alone does not identify which pitch/string was struck. Release transients,
strums and another voice's onset must not retrigger every active note.

## Configuration

All rows below are proposed knobs, not existing configuration keys or selected defaults.

| Parameter | Units / values | Availability | Tried / candidate settings | Interaction |
|---|---|---|---|---|
| Change window / hop | Samples or ms | Proposed | Unchosen | Resolution, shared FFT reuse and processing cost |
| Attack threshold / local normalisation | Feature-relative values | Proposed | Unchosen | Quiet strikes versus loud releases; cannot reuse pitch-score thresholds blindly |
| Refractory interval | ms | Proposed | Unchosen | Reject double triggers without erasing rapid re-strikes |
| Pitch-association interval | ms | Proposed | Unchosen | Evidence may arrive at different times for attacks and pitches |
| Strum grouping allowance | ms | Proposed | Unchosen | Chord grouping must preserve individual attack times |
| Evidence source | Analytical feature / model onset | Proposed | Unchosen | Availability, dependencies and marginal processing cost differ |

## Timing and cost contract

Unmeasured. Prefer sharing existing frame computation where possible, but measure actual
incremental cost. Record any confirmation delay and state reset/trigger rules before trials.
Association must use evidence available then; later pitch recovery may revise a provisional
event but cannot make an earlier decision retrospectively certain.

## Trial history

No trials yet. [TE-002](temporal-events.md) is motivating evidence, not a trial of this
technique. The existing neural decoder's re-strike behaviour does not establish the value
of adding a separate attack source to a fused listener.

## What works, what does not, what is unknown

Everything about the proposed component's effectiveness and cost is unknown. A generic
attack detector might distinguish strikes but still assign them to the wrong pitches.

## Next experiment and acceptance question

Keep one pitch scorer fixed; compare its existing temporal layer with/without attack
association. Sweep only prespecified thresholds and refractory intervals, retaining failed
settings. Evaluate repeated/rapid notes, silent gaps, release noise, overlapping arpeggios
and strums. Accept only a useful attack-accuracy gain at an agreed latency/processing budget;
then validate the chosen region on new held-out cases.
