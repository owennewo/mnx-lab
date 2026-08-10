# Notes

MusicXML's `<harmony>` (root/kind/bass/degree) has been load-bearing for two decades;
every lead sheet, jazz chart and guitar songbook is chord symbols first. MNX v27 has
no harmony object at all — upstream discussion is
[w3c-cg/mnx#109](https://github.com/w3c-cg/mnx/issues/109).

The exhibit puts a structured harmony on the **global** measure, not a part: like
tempo, a chord symbol is a fact about the music that every part shares, and the
global measure is where MNX already keeps such facts (`tempos` is the direct
parallel). `position` is a rhythmic position, `root` a pitch-without-octave, `kind` a
quality name — the same shape the `_x.mnxLab.harmonies` vendor block uses (which
additionally allows a literal-text form for symbols that resist structure).

The pinned error is the global measure's `unevaluatedProperties` rejection. The
proposal work is tracked in
[roadmap/proposed/chord-symbols.md](../../../../roadmap/proposed/chord-symbols.md).
