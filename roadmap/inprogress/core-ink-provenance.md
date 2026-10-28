# Ink provenance — every primitive says what it was drawn for

> **Status: in progress, opened 2026-10-28.** Serves the **implementation loop**.
> Three phases, each landed on its own: **(1) row**, **(2) display staff + bar + bar
> geometry**, **(3) visit + role**. The goldens are the proof: a phase that only replaces
> a correct guess with the fact moves no golden, and any golden that does move is a place
> the guess was wrong.

## The problem

The layout engine knows, at the moment it pushes a primitive, which system row it is
drawing, which staff, which bar, which pass and what the mark is. It throws all of that
away: `LayoutResult.primitives` is one flat, page-wide list whose only provenance is a CSS
`className`, the MNX `sourceId`, and (on three element kinds, when asked) an `element` tag.
Everything downstream that needs to know works it back out from geometry or by parsing
strings, and every reconstruction has grown its own exceptions:

- **Row.** `tightenRows` files ink by the midpoint between systems, patched with a class list
  (`ABOVE_STAFF_CLASSES`) for marks that stack high, a below-staff reservation
  (`reservedBelowSp`) for verses that hang low, and three emission-time owner maps (voltas,
  directions, lyrics) carried through the fixed-point loop because "which row emitted a
  primitive is a fact, not a measurement". The lyric baselines have their own halfway
  cutoff (`bandTop`/`bandBottom`) that never got the class list — so a section label
  stacked over a segno in any system after the first is read as the previous system's ink,
  and the verse is set on top of it (the owner's Blackbird, bar 14, 2026-10-28).
  `layoutTabSystems`, `measureDisplayGaps` and the notation layout's `postLoopByRow` bin by
  midpoint too; `lyricReachAboveRows` exists so they don't mis-file a verse.
- **Display staff, part, projection.** The DOM overlays (`scoreGeometry.ts`) rebuild
  staves by clustering staff lines, join them into systems by which barlines touch them,
  assign ink to the nearest band, and decide a band is tab when a tab clef or a fret digit
  sits in it. `DocumentViewer` rebuilds the staff list separately from the layout.
- **Bar.** Hit-testing, the selection enclosure, the cursor ghost and the loop marker find
  bar edges by clustering barline x positions (`measureBoundaries`), interpolating evenly
  when the count does not match. Layout metadata "deliberately contains rows, not
  coordinates".
- **Visit.** The unrolled view writes the pass into ids (`w2:b0n1`); about seven sites parse
  it back, one with its own copy of the regex.
- **Role.** Layout decisions read CSS class strings: `split(' ')[0]`, `/lyric/`,
  `/notehead|fret-number|rest/` (which also matches `tab-rest-pill`).

The owner, 2026-10-28, on the Bridge overlap:

> Sorry - this seems to be a category (repeating) error. How can something in one system be
> confused with the system above? It feels like there must be a fundamental problem

and, asked to widen the question:

> before we fix this, are there any other meta that is missing that would be useful e.g.
> part/bar/voice etc

## The contract

1. **Provenance is stamped where the ink is drawn**, as `origin` on `PrimitiveBase`
   (`src/engine/primitives.ts`). Emitters stamp a range after they push it — the measure
   loop stamps its row, a spanner stamps the row of the half it drew — so no inner emitter
   needs to know about rows unless it draws across them.
2. **Consumers read it, and the reconstruction is deleted**, not kept as a fallback beside
   it. A primitive without the field it needs is a bug the census test names.
3. **Provenance never reaches a golden.** `rounded()` strips `origin`; the SVG emitter does
   not write it. The goldens stay a verdict about the ink.
4. **A census test** lays out the whole corpus in every projection the corpus pins (notation,
   tab, both, unrolled) and asserts every primitive carries the fields of the phases landed.
5. **Rows are the final layout's rows.** Segments and score blocks that are stacked offset
   their rows, so `origin.row` indexes `LayoutResult.rows`.

## Phase 1 — row

`origin.row` on every primitive. Then:

- `tightenRows` / `fitRowsToClearance` file by `origin.row`; `ABOVE_STAFF_CLASSES`,
  `reservedBelowSp`, the `owners` argument and the fixed-point carry of ownership go.
- The emission-time owner maps (`endingOwners`, `directionOwners`, `explicitOwners`, lyric
  `owners`) go: they were `origin.row` under other names.
- The lyric baselines clear the ink of their own row; `bandTop`/`bandBottom` go.
- `layoutTabSystems` bins by row; `lyricReachAboveRows` goes. `measureDisplayGaps` and
  `postLoopByRow` take the row from the ink.

## Phase 2 — display staff, bar, and bar geometry

`origin.display` (the staff's index within its row's `displays`) on staff-bound ink, and
`origin.measure` (the written measure index) on bar-bound ink. `LayoutResult` gains what the
overlays reconstruct: per row, per display, the part / staff / projection it is; per row, each
bar's x extent. Then `measureBoundaries`, `assignSystems`, `staffIndexOf`, `isTabBand` /
`tabBandMarkers`, the `DocumentViewer` staff table and the PDF export's band merge read the
layout instead of the drawing. Within-row staff attribution in `measureDisplayGaps` uses
`origin.display`.

## Phase 3 — visit and role

`origin.visit` (the performed ordinal, in a view that draws passes) so nothing parses
`w{n}:` back out of an id — ids stay unique, the prefix stays as identity, but no reader
decodes it. A `role` replaces className parsing inside the engine
(`STRUCTURAL_CLASSES`, `NOT_HANGING_INK`, `/lyric/`, the selectable-ink regex), leaving
`className` to styling. ~~The `SpatialIndex` gains part and staff, so a note's address is a
lookup rather than a document walk.~~ Dropped — see Progress.

## Progress

**Phase 1 — row (2026-10-28).** Every primitive carries `origin.row`, stamped by the
emitter that drew it: each bar's range at the end of its loop iteration (tab, notation and
the notation text pass), each half of a split slur, tie or technique curve with its own row,
voltas, ottavas and hairpins per row segment, beam runs by their stems' bar, palm-mute runs,
verses by their syllable, bookends and titles (a title heads the system below it). Stacked
segments, score blocks and the staves `layoutTabSystems` composes offset their rows
(`offsetRows`). Deleted: the midpoint rule and `ABOVE_STAFF_CLASSES` in `tightenRows`,
`reservedBelowSp`, the `owners` argument and its fixed-point carry, `rowBoundariesSp`, the
four owner maps (`endingOwners`, `directionOwners`, `explicitOwners`, lyric `owners`),
`lyricReachAboveRows`/`lyricReachBelowRows`, the lyric `bandTop` cutoff, the cross-system
half of `bandBottom`, `LayoutResult.rowInkSp` (recoverable from `origin` now), and the
score-title exclusion in the stage-D gap test, which now holds for title gaps too.
`rowOf` keeps a nearest-band answer for unstamped ink only so a missed stamp shows as a
misplaced mark rather than a crash; `harness/conformance/ink-origin.test.ts` keeps it dead
across nine projections of the corpus.

Evidence: **every golden byte-identical** — the midpoint guessed right on every scenario the
corpus pins. The bug it guessed wrong on is pinned instead by
`lyric-placement.test.ts` → *verses over a stacked heading*: on the old code the second
system's verse sat 1.1 sp into its "Bridge" label; on the new it clears it.

**Phase 2 — staff, bar and the page's geometry (2026-10-28).** `origin.display` on
staff-bound ink (staff lines, clefs, key and time signatures, every event a staff draws,
injected tab staves, full-bar rests, measure repeats, beams, slurs and ties, ottavas,
hairpins, tab technique, verses) and `origin.measure` on everything a bar's loop iteration
draws. `LayoutResult` gains `bars` (each drawn bar: row, plan index, written measure, x
extent) and `staves` (per row, per display: part, staff, projection, line count), and
`planLayout` puts them through the emitter's scale as `RenderOutcome.geometry`
(`src/engine/render/pageGeometry.ts`), with each row's ink `reach` measured over the ink
stamped as that row's. The overlays read it through `pageBands` (`scoreGeometry.ts`).
Deleted: `collectStaves`, `assignSystems`, `collectSystemBands`, `collectBarlines`,
`measureBoundaries`, `snapToBarlines` (now `snapToBars` over the layout's bar edges),
`tabBandMarkers`, `isTabBand`, `bandLineGap` and `systemReaches`; the viewer's own copy of
the staff table (now the layout's, which also fixes the tab-only view of several parts,
where the copy assumed one staff); the PDF export's band merge over every element's
`getBBox` (a text box is its whole em square, so two systems could merge). Within a row,
`measureDisplayGaps` files staff-bound ink by `origin.display`; only ink drawn for the
system as a whole (directions between staves) still goes by its anchor.

Still read off the SVG, deliberately: ink — where a selected glyph or a drawn column
actually is — and `staffIndexOf` for a selected glyph's box, now within the staves of its
projection as the layout names them.

Evidence: every golden byte-identical again (the display stamps feed `measureDisplayGaps`,
which shapes every `both` view); the census now also checks that every staff-bound
primitive names a staff of its row, that staff lines lie in the band they name, and that
the bars, row by row, are exactly `packedRowMeasures`' rows. The selection, loop, unrolled,
single-cursor, focus, inspector, studio-editor, studio-export and workbench-editor smokes
pass against the new geometry.

**Phase 3 — visit and role (2026-10-28).** `origin.visit` on everything a visit's copy of
a bar draws in the unrolled view, and `LayoutResult.occurrences` (through
`RenderOutcome.occurrences`): every id drawn for one visit, performed or not, with the
written key and the visit behind it. The viewer's `locate(id)` answers from it, so the
note click, the pointer press, the cursor's pressed visit, the editor's lyric press and
studio's long-press on a syllable no longer decode `w{n}:`; `lyricPlaceOfSyllable` takes
the visit as an argument rather than parsing it; a slur's pinned end reads the visit its
anchor was drawn for (`EventCurveAnchor.visit`). `parseOccurrenceKey` stays as public
library API and nothing in the app calls it. `role` (a field beside `origin`, because the
inner emitters that set it — `barlines.ts`, `repeats.ts` — do not know their row) is
`frame`, `lyric`, `event`, `direction` or `between`, set where the ink is drawn; it
replaces `STRUCTURAL_CLASSES` and the `direction-between` token in `measureDisplayGaps`,
`NOT_HANGING_INK` in the verse baselines, `/lyric/` in the tab composer, the selectable-ink
regex in the unrolled pass (which also matched `multirest-…` and `tab-rest-pill` by
substring) and the `direction` token in the above-direction stacking. The census checks
every role against the class it is drawn with, both ways. `systemBookends` takes the
music's edge from the layout's bars instead of its staff lines.

Left reading class names, deliberately: a module recognising a specific mark it drew
itself by its exact name (`tuplet-number`, `tab-capo`, a repeat count's text) — that is
identity, not classification — and `projectionForSourceClass`, which reads the clicked
DOM element's own class in the `both` view, where one id is drawn on both projections and
only the element pressed can say which.

Dropped: part and staff in the `SpatialIndex`. The part index the layout keys notes with
is exact only where a staff draws one part (a merged staff falls back to part 0), and the
viewer lays out the visible parts only, so a layout part index would need mapping back
before it could stand in for `findNoteAddress` — a cheap exact query on the model. An
index that answered "part 0" for a merged staff would be the kind of confident wrong
answer this item exists to remove.

Evidence: goldens byte-identical (including the unrolled SVGs); the census (27 checks over
nine projections) now covers rows, staves, bars and roles; the unrolled, workbench-editor,
studio-editor, single-cursor, selection, player, sync-bar, youtube and recording-studio
smokes pass.
