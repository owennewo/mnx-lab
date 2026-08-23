# Part & staff addressing — the cursor learns where else music lives

> **Status: built 2026-08-14; the row closed 2026-08-15.** Campaign:
> [core-campaign-element-ops.md](core-campaign-element-ops.md), item 13b's
> **addressing half**. Entry remains on `parts[0]` — deliberately, and it is no
> longer this campaign's: it graduated out as
> [core-entry-surface.md](../complete/core-entry-surface.md), because what is
> left of it is a policy question (what typing into a second voice means when
> the bar is full) rather than a missing verb.

## The measurement that scoped it

`parts[0]` was hard-coded in **44 places** across the edit layer, and they split
in two:

- **addressing** (~10): the cursor, the grid, clef lookup, selection, the sweep.
- **entry and structural ops** (~25, nearly all in `ops.ts`): `insertNote`,
  `appendMeasure`, `setClef`, `padMeasureRests` — every op that *writes* has to
  decide which part it writes to.

Removal was already part-agnostic, because `deleteNote` and every note-attached
verb resolve through the shared walk ([core-note-address.md](core-note-address.md)).
So the addressing half alone unlocks the whole blocked set, and the writing half
can follow separately without either being half-done.

## What landed

- **The key grammar generalized without moving a byte**:
  `@[p<part>.]m<measure>[.s<staff>].v<voice>.e<event>[.c<container>].n<note>`.
  Part 0 and staff 1 stay silent because they were the whole world when the
  scheme was written, so every key the goldens embed is unchanged.
- **The walk spans every part and staff**, counting voices **per staff** so a
  second staff cannot shift the first staff's voice indices.
- **The cursor carries `partIndex`** (absent = the first), the grid is built per
  part, `clefAt` takes a part, and a `setPart` intent moves between them —
  landing on the new part's first position rather than pretending the old
  address means anything there.
- **Removals follow the cursor's part**: clefs and the five part declarations
  take a `partIndex`, so "remove this part's name" means the part you are in.
- **The renderer keys per staff**, not just the first: any staff showing exactly
  one part's staff 1 synthesizes keys with *that* part's index, so the overlay
  can paint wherever the cursor can go.

## Results

**Removable elements 1,218 → 1,333.** Notes 672 → 772 (every second-part note),
part-names 46 → 59, staves 3 → 5. Unaddressable-with-a-verb fell from 183 to 68.

Five scenarios' goldens gained `sourceId`s where second parts were previously
anonymous — `spec/parts`, `spec/multiple-layouts`, `spec/multimeasure-rests`,
`lab/score-text/directions-across-parts`, `lab/layout/group-barline-individual`
— with **no geometry moved**; they wait in `/verify` with the seven from the
container work.

## Staff addressing followed (13c's first half, 2026-08-14)

The same shape, one level down: the cursor carries a `staffIndex`, the grid
filters to it, `clefAt` honours it, a `setStaff` intent moves between them, and
the renderer keys **any staff showing exactly one part's one staff** — so the
grand staff's lower half is addressable and paintable.

**And it uncovered a real bug in ordinary editing.** Navigation builds fresh
cursors — which is how the coincidence ordinal resets — and that silently
dropped the part too. So `goToMeasure` after moving to part 2 sent the next edit
back to `parts[0]` while the cursor still showed part 2: a clef removal that
returned `true` and removed the wrong part's clef. Position (part, staff) now
survives every move; only meaning-at-that-spot (the ordinal) resets. The sweep
caught it as nine `refused` clefs that should have been removable.

**Removable elements 1,351 → 1,389.** Notes 794 (7 left, the navigation
failures), clefs 112 (1 left, the mid-measure one), ties and beams all but four.
Three more scenarios' goldens gained `sourceId`s on staff 2 — `spec/grand-staff`,
`spec/organ-layout`, `lab/score-text/directions-multi-staff` — no geometry moved.

## The presentation layer (2026-08-14)

`layout`, `score` and `multimeasure-rest` — 26 elements, the last large block —
get **removal only**, and the asymmetry is the point:

- A **layout** is a tree of staff and group nodes; a **score** is a presentation
  with its own page and system breaks. Neither is a declaration, so neither gets
  a typed grammar: authoring one needs a surface that can express a tree without
  pretending a one-line grammar is one. Naming that gap is better than filling
  it badly, and the construct report keeps saying `layout`/`score` block six
  scenarios each until it is filled.
- Removing a layout **unlinks the scores that named it** — the *reference*
  class, and unusually clean here because `score.layout` is optional: a score
  without one means "all parts", which is a sane state rather than a hole.
- The surface is the part popover's `no layout 2` / `no score 1`, where the user
  supplies the index, exactly as `no line 2` does for lyric verses. The palette
  would have been the natural home, but it deliberately cannot see the loaded
  document, so it cannot enumerate what to offer.

**All 26 removed; the corpus reaches 1,415 of 1,460.**

## What remains, honestly

- **Entry still writes to `parts[0]`** (item 13c). You can navigate to part 2,
  select and remove there — but a note you type lands in part 1. That is a real
  incoherence, bounded and documented, and it is the ~25 sites above.
- **Seven navigation failures** remain unexplained (notes the cursor reaches by
  coordinates but not by resolution) and one **mid-measure clef**, which needs an
  onset-addressed variant of the op.
