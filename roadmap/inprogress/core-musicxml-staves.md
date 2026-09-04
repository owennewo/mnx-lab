# Multi-staff parts — and a limit of the matrix

> **Status: BUILT 2026-09-04.** Item 12 of
> [core-campaign-musicxml.md](../proposed/core-campaign-musicxml.md). Grand staff round
> trips; **the matrix score did not move, and the reason is worth more than the feature.**

## What was missing

The importer kept **one** clef (`state.clefSign`), read from the first `<clef>` in
`<attributes>`. A grand staff states two, so the bass staff silently inherited the treble
clef. `<staves>` was not read at all, and `<staff>` on a note was neither read nor
written.

Now, both ways:

| MusicXML | MNX |
|---|---|
| `<attributes><staves>2</staves>` | `part.staves` |
| `<clef number="1">`, `<clef number="2">` | `measure.clefs[].staff` |
| `<note><staff>2</staff>` | `sequence.staff`, or `event.staff` where a voice crosses staves |

Clefs are tracked **per staff** on both sides, because two clefs change independently and
"has the clef changed" was a single question when it needed to be one per staff.

Everything is stated only when it is not the default: no `staves: 1`, no `staff: 1`, no
`<staves>` for a single-staff part — matching what the spec's own examples write.

## The one that was not a mapping

MNX can tell two sequences apart by **staff alone** — a grand staff's two hands often
carry no `voice` at all, and `scenarios/spec/grand-staff` does exactly that. MusicXML has
no such notion: `<voice>` is what separates simultaneous streams.

So exporting both hands with no voice merged them into one, and re-importing read eleven
notes as a single stream. A staff-only distinction now becomes a voice on the way out.
**Where one format can express a distinction the other cannot, the conversion has to
manufacture the carrier** — the same shape as the jump `<offset>` and the beam nesting.

## What the matrix did not say, and why

Grand staff round trips. The matrix moved by **nothing**: `staff` stayed `lossy` at 0/6.

The reason is a real limit of def-level granularity: **`staff` is used by two different
features.** It appears on sequences and clefs — now supported — *and* inside `layouts`,
the system-layout tree the converter does not handle at all. A def used by two features
scores as the worse of them, so the row cannot improve until both work.

`staff-number` did move, 0/6 to 4/6 surviving, because it is less entangled.

This is not a bug in the matrix so much as the honest consequence of choosing schema
objects as rows — the same choice that makes the two *kinds* of gap separate cleanly.
Worth recording so the next reader does not conclude the work did nothing:
**a flat `lossy` cell can hide a feature that works, when the def is shared.** The
converter tests are what pin this one.

## The agreement block

1. **The oracle** — three assertions in `spanners.test.ts` over
   `scenarios/spec/grand-staff` (both staves survive as separate sequences; a clef per
   staff, independent; nothing said on a single-staff part). The 27-comparison oracle has
   no grand-staff case, which is why this item needed the corpus.
2. **The MNX verdict** — standard objects throughout (`staves`, `staff`); nothing proposed.
3. **The dependency budget** — none added.
4. **The matrix row** — regenerated; `staff-number` improved, `staff` blocked on layouts.
5. **The losslessness bar** — the grand-staff scenario's sequences and clefs come back
   identical.

## Result

| | |
|---|---|
| Converter suite | 104 → **107** tests |
| Oracle | 24 / 27 — unchanged (no grand-staff comparison exists) |
| Matrix | 36 supported — unchanged, for the reason above |

**Layouts** are now the visible next thing: they are what keeps `staff` and
`system-layout` red, and nothing in the converter touches them.
