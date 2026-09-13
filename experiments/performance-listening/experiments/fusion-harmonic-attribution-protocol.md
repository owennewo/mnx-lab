# F-004: lower-pitch harmonic competition

Implementation loop. Frozen after F-003 and before F-004 measurement, 2026-09-13.

F-003 cut added false attacks from 23 to 7 on development and 11 to 1 on fresh v3 audio.
Its sole held-out extra was an octave above the played note; earlier residuals include
an octave and approximately fifth-harmonic confusions. Retain neighbourRatio=1 and all
F-002 attack parameters. Add one fixed test: an additional attack's coefficient must be
>= that of lower pitches at offsets 12,19,24,28,31 semitones (rounded harmonics 2–6).
Use existing scores only, at creation and each pending confirmation frame. No FFT/model
change. This is a hypothesis filter, not a physical harmonic decomposition. It may suppress
real upper notes while a stronger bass rings; dedicated fresh cases test that risk.

One candidate, no sweep. Measure against F-000 and diagnostic F-003-01 on all 210 prior
recordings; three counterbalanced passes. Retain the exact parent-event/pitch-presence
contract and unchanged acceptance gates: repeat precision/recall improve, no increased
false accusations, required category F1 drops <=2 points, median processing <=1.25x and
pooled/common-match p95 increase <=25 ms. Report marginal results against F-003 too.

Lock disposition before 42 new v4 recordings. These include real octave/fifth repetitions,
quiet upper re-strikes over ringing bass, short/rapid notes, strums and wrong notes. No
retuning on held-out outcomes. Report the dedicated octave/fifth/bass cases separately;
aggregate success must not be presented as universal polyphonic reliability.
