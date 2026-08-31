# Retire the tray's attribute tiles — one-surface campaign item 11a

> **Status: proposed and built 2026-08-31.** Campaign:
> [workbench-campaign-one-surface.md](../inprogress/workbench-campaign-one-surface.md),
> item 11a — the attribute half of the tray, split from 11 by the user's call:
> every tile here was a mouse-spelling of a word, key or pill the inspector
> already has.

## What retired (34 tiles, 5 helpers, 12 bands)

- **Helper-made**: the six markings, three dynamics, six techniques, four bar
  toggles (repeats, segno, coda), two barline styles — and the `marking`/
  `dynamic`/`barAttribute`/`barlineStyle`/`technique` factory functions with
  them.
- **Literal**: `accidental-display`, `ottava`, `dots`, `tie`, `longer`/
  `shorter`, `respell`, the `staff-kind` quartet, `slur`, `beam`.
- **Bands**: spelling, both joins, duration, dynamics, fingerboard, both
  articulation groups (the event one keeps only the blocked `arpeggio`, 11b's
  to dispose), lines-and-text, part, repeats, jumps.
- **Two more glyph twins resolved** (`tenuto`/`hammer-pull`,
  `coda`/`section-colour`) and pruned.

Every deleted tile's covering surface was named in the split census: letters
(`B H S V X O`, `S`/`Shift+S`, `T`, `.` `=` `−`, `J`), typed words
(markings/dynamics/directions via `parseAdornment`, bar toggles via
`parseBarAttribute`, `staff kind`), or pills (accidental, ottava, slur/beam
coincidence).

## The tests told the story straight

Twelve tests touched the deleted tiles; the sweep sorted them honestly:

- **Six retired with their subjects** (tile-active reads, barline switching,
  band grouping, the projection-dialect filter — which now has zero
  declaring tiles and awaits 11b's shell demolition).
- **Five re-fixtured** — they tested *session* semantics through tile
  fixtures: the ranges suite now reads mixed state off the document (the
  inspector's partial pill is the other witness), the intent-funnel test
  fires the surviving `new-voice` construct, the bands-cut test uses the
  structure band.
- **One (spanner tiles reading the coincidence) retired with a pointer** at
  the inspector pills that inherited the read.

## What 11b inherits

The tray now holds **only verbs and blocked residue**: the insert/delete
families, closures, history, `new-voice`, `clear-event`, `cycle-voice`,
`part-scope`, `delete-section-boundary`, and the four blocked tiles. The
global tab is down to go-first/last + undo/redo. `SessionView`'s
attribute-reading fields (`markings`, `memberBarlineTypes`, `tied`,
`spannerCoincidence`, the projection filter) have no registry consumers
left — the shell demolition bill, itemized.
