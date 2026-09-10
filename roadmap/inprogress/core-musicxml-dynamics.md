# Dynamics — the sforzando family as structure, hairpins as spanners

> **Status: BUILT 2026-09-10.** Item 17 of
> [core-campaign-musicxml.md](../proposed/core-campaign-musicxml.md), the first row the
> *Feature parity* line turned into. **Matrix supported 36 → 42**, both directions, round
> trip held over the corpus's five dynamics scenarios.

## Why this one

The converter contained the word `dynamic` only in comments, and the matrix already said
so: `dynamic-group` carried by 7 documents, surviving in 0. It surfaced from outside the
campaign — an audit of the Guitar Pro importer found a forte dropped silently, and the
MusicXML lane turned out to drop every dynamic the same way. Nothing had caught it because
**no converter fixture contains one**: not the three guitar scores, not the 27 W3C
comparisons. The feature had to be put in front of the tests before any of them meant
anything — the lesson of item 2, again.

## One MusicXML spelling, three MNX ones

MusicXML names a dynamic by element: `<f/>`, `<sfz/>`, `<pf/>`. MNX says the same thing
one of three ways, and the converter has to pick the one a reader expects:

| MusicXML | MNX | Why |
|---|---|---|
| `pppppp`…`ffffff`, `mp`, `mf`, `n` | `value` | the closed `dynamic-value` enum names them all |
| `sf sfz sffz sfp sfpp sfzp fz fp rf rfz` | `type: 'accent'` + `accentPrefix`/`value`/`accentSuffix`/`residualValue` | the structure **concatenates to exactly the element name** — s+f+z, ""+f+""+p — so import and export are one table read in two directions |
| `pf`, `<other-dynamics smufl>` | `glyphs` | nothing structural to say; the SMuFL name is exact |

The glyph names are the ones `src/engine/layout/dynamics.ts` draws, so a mark read here
engraves as the mark that was written. Every accent part is stated explicitly, because the
spec defaults an absent prefix to `s` and suffix to `z`: a bare `fz` that omitted them
would read back as `sfz`.

## Hairpins are spanners

`<wedge type="crescendo">` … `<wedge type="stop">` is item 2's shape once more: MusicXML
writes both ends and numbers them, MNX states the hairpin once with an `end` naming a
measure. Import pairs by `number` and mints the end measure's id on demand, as the ottavas
do; export numbers each hairpin with the smallest number not held by one still open.

## What still warns, and why

- **Relative dynamics** (`type: 'relative'`) — MusicXML has no element for "louder".
  Export warns and writes nothing.
- **A hairpin with no `end`** — MNX allows it; MusicXML needs a stop. Export closes it at
  the end of its measure and says so; import keeps an unpaired start without an `end` and
  says so.
- **Free-text `<other-dynamics>`** — no MNX field holds arbitrary text. Import warns.
- **`prefix`, `suffix`, `visuallyContinues`, `staffEnd`, `voice`** — export warns.
- **A niente circle** on a wedge — import warns.
- **Placement** — only `above` is imported, because below is where a dynamic sits anyway;
  an explicit `orient: 'below'` round-trips to absent. The one silent normalisation, and
  a harmless one.

A notation+TAB split writes a part's dynamics **once**, on the notation half: the importer's
merge keeps that half's measures, and now carries a dynamic written only under the TAB staff
across rather than discarding it with the TAB part.

## The agreement block

1. **The oracle** — the corpus's own dynamics scenarios through the round trip, plus
   structural assertions on hand-written MusicXML (cursor + `<offset>`, `<notations>`
   dynamics at the note's onset, the grand-staff `<staff>`, wedge pairing across a
   barline) and published-schema validation of the imported output. **Item 1 cannot judge
   this item**: none of its 27 comparisons carries a dynamic — stated rather than implied.
2. **The MNX verdict** — standard objects only (`dynamic-group`, `wedge-type`); nothing
   proposed, no `_x.mnxLab`.
3. **The dependency budget** — no new dependency.
4. **The matrix row** — regenerated. `dynamic-group`, `-group-type`, `-prefix`, `-suffix`,
   `-value` and `wedge-type` lossy → supported. `relative-dynamic-value` stays lossy,
   correctly (evidence `lab/30-dynamics/03-hairpin-and-relative`). `measure-rhythmic-position`
   and `smufl-glyph` stay lossy, but their evidence moved off the dynamics scenarios onto
   other features' documents (`spec/multiple-layouts`, `lab/40-navigation/01-jumps-and-signs`).
5. **The losslessness bar** — `spec/dynamics`, `02-accent-prefix-suffix` and
   `04-diminuendo-across-bars` deep-equal through the round trip with zero warnings;
   `01-all-dynamic-marks` keeps every mark's meaning (glyphs the enum now names return as
   values, the sforzando family as structure); `03-hairpin-and-relative` loses exactly the
   relative mark and gains an explicit `end`, each with a warning.

## Result

| | Before | After |
|---|---|---|
| Matrix supported / lossy | 36 / 72 | **42 / 66** |
| Oracle `match` | 24 / 27 | 24 / 27 (no comparison carries a dynamic) |
| Converter suite | 124 tests | **142 tests** |
