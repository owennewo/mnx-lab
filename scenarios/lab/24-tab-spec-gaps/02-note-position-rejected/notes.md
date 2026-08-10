# Notes

Every tablature format that exists — Guitar Pro, MusicXML (`<string>`/`<fret>` under
`<technical>`), ASCII tab — records which string a note is played on. MNX records only
sounding pitch, and the note object closes itself to anything else.

The exhibit writes `string`/`fret` flat on the note, which is deliberate: it is the
shape our `_x.mnxLab` extension drafts (peers of `pitch`, because a position is a fact
about the note, not a fretboard-only decoration) and the shape an adopted standard
field would take. The pinned error is the note's `unevaluatedProperties` rejection.

Position is the founding reason `_x.mnxLab` exists. The proposal to give it a standard
home is [roadmap/proposed/instrument-position.md](../../../../roadmap/proposed/instrument-position.md);
the derivation rules that make a stored `fret` redundant (and therefore validation-only)
are exercised by the whole `lab/tab-derivation` category.
