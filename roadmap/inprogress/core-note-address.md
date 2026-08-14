# One note enumeration — the address, produced once

> **Status: move 1 built 2026-08-14.** Prerequisite for campaign item 11b
> ([core-element-ops-onset-granularity.md](core-element-ops-onset-granularity.md)),
> and a standing hazard retired on its own merits.

## The problem it removes

`model/noteKeys.ts` was always shared — but only as a **formatter**. The
coordinates fed to it (`measure`, `voice`, `event`, `note`) were derived
independently in six places: `edit/cursor.ts` (twice — `forEachKeyedNote` and
`buildGrid`), `edit/ops.ts` (`forEachEventNote`, `findKeyedNote`),
`model/jsonView.ts` (twice), `engine/layout/notation.ts` and
`engine/layout/tabStaff.ts`. CLAUDE.md's instruction to keep them "in lockstep"
is exactly the smell: a correctness property maintained by care.

It came due when campaign item 11b tried to make container content addressable.
A container holds several events at one `content` index, so every inner note
collapses to the same key — and fixing that meant changing five walks
simultaneously with the goldens as the only witness. That is not a hard change;
it is an *unsafe* one.

## What landed

**`src/model/noteWalk.ts` produces coordinates, once.**
`forEachNoteAddress`/`findNoteAddress`/`noteKeysOf` enumerate the entry surface
and hand back the address with its key. `forEachKeyedNote`, `forEachEventNote`
and `findKeyedNote` are now thin wrappers over it — three walks collapsed into
one — and `jsonView`, `notation` and `tabStaff` take their keys from the same
`noteKeyAt`, so no module restates the id-else-positional rule.

Consumers that need more than identity still walk for their own purposes: the
grid needs onsets, the layouts need geometry. That is fine, and it is why the
second half matters.

**`harness/conformance/note-keys.test.ts` checks the agreement.** Over all 106
scenarios: every *synthesized* key the renderer stamps into the goldens must be
one the canonical walk produced, and the walk must produce no duplicates
anywhere — a duplicate being the container collision in miniature, two notes
that cannot be told apart and therefore cannot be edited apart. 107 assertions,
replacing a comment.

**The safety net held**: goldens byte-identical, which is the whole proof that
this refactor changed nothing.

## What it unlocks

Container descent is now **one function's business**. When `forEachNoteAddress`
descends, every consumer descends with it, and the nested key form
(`@m0.v0.e2.c1.n0`) stays inside this module rather than becoming a contract
five files have to honour. The join then says whether they moved together.

## Move 2, still open

The other collision is the **cursor address**: `{measure, onset, line}` assumes
at most one thing per moment × line, and the campaign has hit that three times —
two voices on one string (item 2, 162 unaddressable notes), two chord members
derived onto one string (item 10), and a grace note sharing its host's onset
(item 11b). The grid already knows the answer — `NoteSlot` carries
`voiceIndex`/`eventIndex`/`noteIndex` — so the fix is a discriminator on the
cursor, not a longer key. One mechanism retires all three findings, and it
belongs with [core-selection-ladder.md](core-selection-ladder.md)'s per-level
pass.
