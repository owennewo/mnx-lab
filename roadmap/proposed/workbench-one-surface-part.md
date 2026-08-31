# Retire the part popover — one-surface campaign item 9

> **Status: proposed and built 2026-08-31.** Campaign:
> [workbench-campaign-one-surface.md](../inprogress/workbench-campaign-one-surface.md),
> item 9 — the construct-shaped item, and the one whose census found a surface
> promising something the ops could not do.

## The census (contract §1)

- **Grammar** — `parsePartDeclaration` + `parsePart`, four arms: document
  support flags (`[no] explicit accidentals|beams` → `mnx.support`); removals
  (`no name/strings/tuning/capo/tab/staves`); `capo N` / `staves N`; and
  *anything else adds a part* — the text becomes the new part's name and
  derived id, empty input the anonymous part MNX allows.
- **Surfaces** — the usual six; **five** popover tiles (`add-part`,
  `part-name`, `staves` at document, `doc-add-part` at session, and `capo` at
  partMeasure — one more than the census first counted); the badge on the
  `staff-kind` intent tile.

## The bugs (contract §3 — ops first)

1. **Renaming a part was impossible, and the UI pretended otherwise.** The
   `part-name` tile opened a popover whose grammar has no name-set arm —
   typing a name **added a new part**. `PartDeclaration` gained
   `{kind: 'name', value}`; the session already passed the cursor's part, so
   the pill and word work like capo's, and `no name` (which always existed)
   finally has a setter to undo.
2. **`setStaffKind` wrote `parts[0]` unconditionally** — the third member of
   the family items 7 found (`setTuning`) and the inspector doc recorded
   (`setFullMeasureRest`/`setMeasureRepeat`). Widened with `partIndex`;
   two-part pin in conformance.

## Coverage built

- **Part-bar rung** — the one place for part facts, joining clef/capo/tuning:
  `name` (pill + word — the rename), `staves` (1–4), `staff kind`
  (`tab`/`notation`/`both`). Typed removals (`no capo`…) ride
  `parsePartDeclaration`; a support flag typed here signposts the document
  rung (item 4's pattern).
- **The document rung's first pills and words**: `part <name>` → `addPart`
  (construction as declaration — the name declares the member; empty is the
  anonymous part), and the support flags as removable pills reading
  `mnx.support`. `rungNote`'s "no attributes to inspect yet" plea retires.

## The sweep

`partPopover` in full; five tiles with three group trims (the parts group
keeps its insert/delete intent tiles, the part group keeps `staff-kind`, the
instrument group keeps `transpose-part`/`mute-part`); the `staff-kind` badge
stripped; **two twins pruned** (`document: brace — add-part, staves`, both
sides deleted; `session: brace — doc-add-part, staff-kind-both`).
`parsePartDeclaration`/`parsePart` survive as inspector consumers; the
grammar's own header comment now names its consumer.

## Learnings handed forward

- **Count tiles by grep, not by memory**: the fifth tile (`capo` at
  partMeasure) surfaced only because the sweep asserts
  `"Shift+P" not in registry` before writing — make that assertion standard.
- A popover tile can promise an op that does not exist (`part-name`); the
  census question "what does *typing into this* actually fire?" catches what
  the tile label hides.
