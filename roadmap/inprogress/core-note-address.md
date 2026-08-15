# One note enumeration — the address, produced once

> **Status: move 1 built 2026-08-14.** Prerequisite for campaign item 11b
> ([core-element-ops-onset-granularity.md](../complete/core-element-ops-onset-granularity.md)),
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

## Move 2 — the cursor discriminator (built 2026-08-14)

`EditorCursor` gains `slotIndex?`, `slotAt` resolves through it, and `Alt+V`
steps between notes sharing a moment and a line. Every cursor move drops the
ordinal (a different line has a different set of coincident notes), and absent
means "the first", so every cursor written before this stays valid — the
edit-trace fixtures did not move.

**What it fixes: the class, not the count.** Before, `slotAt` returned whichever
coincident note came first, so the editor could act on a *neighbour* — the
wrong-note deletion item 2 caught. Now the address is complete, the sweep cycles
the same way a player would, and the keyboard can reach the second voice on a
shared string.

**But the corpus's unaddressable mass has a different cause, and I had
over-attributed it.** Measured directly, of 161 unaddressable notes:

| cause | notes | whose problem |
|---|---|---|
| no key at all — a second part | 100 | item 13b |
| no key at all — container content | 32 | item 11b |
| no key at all — staff 2 / non-entry sequence | 22 | item 13b |
| had a key, navigation failed | **7** | this, and the ladder's per-level pass |

So move 2 rescued **one** note in the corpus and closed the correctness hole
that produced the finding. The 154 are the ops layer refusing to *name* those
notes, which no amount of cursor work reaches — it is the `parts[0]`/staff-1
assumption, and it is exactly what items 11b and 13b are for. Seven navigation
failures remain unexplained and belong with the ladder pass.

The earlier claim that move 2 would "retire item 2's 162 findings" was wrong in
magnitude: it retires their *cause* where coincidence was the cause, which the
corpus turns out to contain barely at all.

## What is still open

**Container descent** (item 11b) is now one function's business, and **the
`parts[0]` assumption** (item 13b) is the single biggest remaining cause of
unaddressable ink at 122 notes.

**The seven navigation failures are closed** (2026-08-15, during
[core-selection-ladder.md](core-selection-ladder.md)'s pass): three were a hard
±16 line clamp an 8va note sat outside of, and four were the ink walk
re-deriving its anchor voice from the ink under the cursor. The cursor now
carries `voiceIndex`, completing the address this doc set out to complete —
part, staff, voice, measure, onset, line, and the ordinal for what is found
there. Whether `Alt+V` is the right key for stepping coincident notes, or
whether it should fall out of the ladder's vertical axis, stays with the ladder.
