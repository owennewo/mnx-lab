# Ottavas, tuplet units, and a note id that was not unique

> **Status: BUILT 2026-09-04.** Item 7 of
> [core-campaign-musicxml.md](../proposed/core-campaign-musicxml.md).
> **Oracle 21 → 24 of 27, and `spacing` reaches zero.** The three that remain are the
> deferred final-barline default, which is
> [upstream's question](core-musicxml-repeat-barlines.md).

Three findings, in increasing order of how much they mattered.

## Ottavas: two sign conventions and an off-by-one-note

MusicXML names the direction the **written** notes move, so an 8va — which *sounds* an
octave above what is printed — is `type="down"`. MNX states it in sounding terms
(`value: 1`). The sign flips.

The subtler half is where the bracket ends. MusicXML's `<octave-shift type="stop">` sits
in the stream **after** the last note it covers; MNX's `end.position` names **that note's
onset**. Measuring from the cursor put the end a quarter-note late, which drew two bracket
segments too many. A start needs no such correction: it sits *before* its first note, so
the cursor is already that note's onset.

MNX's `end` also names a **measure**, and MusicXML measures have no id we can reuse — so
one is minted, for the referenced measure only. An id nothing points at is noise.

## Tuplet units: the same ratio, a different number on the bracket

Six quarters in the time of four is arithmetically identical to three halves in the time
of two. It is not *notationally* identical: the first prints a **6** over the bracket, the
second a **3**.

The unit search preferred the longest note value that divided both totals, which silently
renumbered every ratio it could reduce. `<normal-type>` already says which unit the source
means, so it is tried first and the longest-first search stays as the fallback for unequal
groups, where no single unit is implied.

**Two encodings that compute the same are not therefore the same.** The engraved number is
part of the content.

## Note ids were not unique, and that is a correctness bug

`parts` was minting **14 note ids over 9 distinct values.** The scheme was
`n-<measure>-<voice>-<event>-<note>`, which is unique within a part and collides the
moment there are two.

An MNX id is document-wide. Colliding ids break every reference that names one — ties,
slurs, technique targets — and the workbench's note↔JSON cross-highlight with them. The
part index is now part of the id.

**The oracle found this without being able to see it.** The verdict was `spacing`: the
same glyphs at the same coordinates. What differed was which primitives *shared* a
`sourceId` — precisely the structure that the order-preserving normalisation
([core-musicxml-w3c-oracle.md](core-musicxml-w3c-oracle.md)) was built to preserve rather
than discard. Had `sourceId` simply been stripped, `parts` would have read as a clean
match and the duplicate ids would still be there.

## The agreement block

1. **The oracle** — `ottavas-8va`, `tuplets`, `parts`; five structural assertions in
   `spanners.test.ts`, including the uniqueness invariant.
2. **The MNX verdict** — standard objects (`ottava`, `tuplet`, `id`); nothing proposed.
3. **The dependency budget** — no new dependency.
4. **The matrix row** — none yet.
5. **The losslessness bar** — all three at `match`; ottava round trip deep-equal;
   converter suite green at 84.

## Result

| | Before | After |
|---|---|---|
| Oracle `match` | 21 / 27 | **24 / 27** |
| Oracle `spacing` | 1 | **0** |
| Converter suite | 79 tests | 84 tests |

**Every remaining scenario is the same deferred question**, and the campaign has no
further feature gap the 27 can see.
