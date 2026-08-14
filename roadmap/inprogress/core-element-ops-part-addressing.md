# Part addressing — the cursor learns there is more than one part

> **Status: built 2026-08-14.** Campaign:
> [core-campaign-element-ops.md](core-campaign-element-ops.md), item 13b's
> **addressing half**. Entry remains on `parts[0]` — that is 13c, and the
> boundary is deliberate.

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

## What remains, honestly

- **Entry still writes to `parts[0]`** (item 13c). You can navigate to part 2,
  select and remove there — but a note you type lands in part 1. That is a real
  incoherence, bounded and documented, and it is the ~25 sites above.
- **Staff 2 is not addressable** (`note` 29 no-op = 22 staff-2 notes + the seven
  navigation failures; `clef` 12 = mid-measure and staff-2). The walk names them
  now; the grid still filters to staff 1, which is the same shape of change one
  level down.
