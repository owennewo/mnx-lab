# Notes

MusicXML has carried `<fingering>` (plus `<pluck>` for p-i-m-a) since 1.0; every
pedagogical edition depends on it. MNX's note holds pitch, id, tie, accidental
display and performance data — no fingering.

The exhibit writes `fingering: {hand, finger}` flat on the note. That is the shape
`_x.mnxLab.fingering` uses, and it is deliberately **not** under the `tab`
sub-namespace in the extension: fingering is universal (piano's whole interest in
this register), so nesting it under tab would make a universal field
fretboard-scoped by construction. The same logic applies to an eventual standard
field, which is why the extension keeps it separable for independent migration.

The pinned error is the note's `unevaluatedProperties` rejection. The rendered
counterpart scenarios live in `lab/tab-fingering` (valid documents carrying the
extension form).
