# F-004: harmonic competition has little marginal value

Implementation loop · 2026-09-13. **Park this rule; retain F-003 as the preferred
experimental candidate. Neither is accepted as the default.**

This isolates competition against lower pitches at rounded harmonic offsets 12, 19, 24,
28 and 31 semitones, requiring coefficient ratio >=1. Neighbour competition stays at 1;
all other F-002 attack parameters are fixed. There is one setting and no tuning.

On 210 regression recordings, F-004 removes **one** of F-003's eight added false attacks
without changing the 444 true matches. On 42 fresh recordings, including actual octave and
fifth repetitions and quiet upper re-strikes over bass, both candidates produce exactly
**97 true matches, 511 false positives and 35 misses**. Both add one false accusation over
F-000. Every original parent event and pitch-presence interval remains unchanged.

Whole-pipeline processing is +4.9% versus F-000 on regression and +4.7% on held-out;
F-003 in the same run is +4.6% and +3.7%. The extra cost is small, but this trial supplies
no held-out accuracy benefit. All other frozen gates pass; false accusations still fail.
The baseline's existing errors remain large and neither recipe is ready to assess a player.

The single held-out false re-strike is MIDI 80 over a played MIDI 68 repetition, again an
octave error. Competition among the same scorer's coefficients did not resolve it. That
is evidence against this particular setting and cue, not against harmonic methods as a
family. No additional grid was tried. These v4 fixtures now become regression evidence.

**Stopping point:** two completed iterations earned a useful neighbour filter, then found
little further gain from lower-pitch competition. Keep the harmonic option disabled. A
future experiment should seek independent evidence for octave attribution—for example,
conditionally scoring the spectral change itself. That is a hypothesis, not an implemented
or scheduled follow-up. Measure its incremental accuracy, coverage and processing cost
with a new frozen split before retaining it.

[Comparison table](table.md) · [Exact unmatched re-strikes](attack-diagnostics.json) ·
[Development summary](development-summary.json) · [Held-out summary](heldout-summary.json) ·
[Decision](decision.json) · [Provenance](provenance.json) ·
[Frozen protocol](../../experiments/fusion-harmonic-attribution-protocol.md).
