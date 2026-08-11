# Notes

MusicXML declares tuning per staff line (`<staff-tuning>` with step/octave, plus
`<capo>`); Guitar Pro stores it per track. MNX has nothing: a part is a name and
measures. The consequence is structural — MNX pitch is *sounding* pitch, so without
knowing what the open strings sound, string/fret positions cannot be derived, checked,
or even sanely stored.

The exhibit writes `strings[]` (string number + sounding open pitch, string 1 =
highest) and `capo` flat on the part — the shape `_x.mnxLab` uses and the shape a
standard field would take. The pinned error is the part's `unevaluatedProperties`
rejection.

The proposal for a standard home is
[roadmap/proposed/spec-instrument-position.md](../../../../roadmap/proposed/spec-instrument-position.md).
The "ABSENT MEANS NO FINGERBOARD" rule (no assumed instrument, ever) exists because of
this gap: a fingerboard someone *declared* is data; a fingerboard we guessed is a lie
waiting to render.
