# Rhythm declarations — beams, and the bars that declare their own rest

> **Status: built 2026-08-14, same day as proposed.** Campaign:
> [core-campaign-element-ops.md](core-campaign-element-ops.md), item 11, taken
> at a **deliberately narrower scope than its index row** — see below. The row's
> remaining half (tuplets, grace, tremolo) becomes its own item, for a reason the
> code decides rather than taste.

## The scope decision, and why the code makes it

Item 11's row lists eight kinds. They split cleanly in two, and the split is
forced by one fact: **the cursor grid skips items that are not timed events**
(`forEachKeyedNote` and `buildGrid` both test `isTimedEvent`), so **notes inside
a container are invisible to the editor**.

- **Declarations that leave ink where it is** — `beam` (a reference over events),
  `full-measure-rest`, `measure-repeat`. Ink stays addressable; ops can land now.
- **Containers that swallow ink** — `tuplet`, `grace`, `tremolo`. A verb that
  wraps a run in a tuplet would *remove those notes from the addressable
  surface*, and the destruct sweep would immediately report them unaddressable.
  Shipping that verb before the grid can descend would trade a green scoreboard
  for a worse editor — exactly the gaming the campaign's honesty rules exist to
  prevent.

So this item takes the first group. The second waits for the grid work the index
row itself names ("changes what an onset is"), which is now a *prerequisite*
rather than a footnote. `space` (no ink, but needs onset addressing without a
slot) and `multimeasure-rest` (lives in `scores[]`, wants item 13's structural
surface) go with it.

## The agreement block

### 1. The op pair

| | construct | destruct |
|---|---|---|
| beam | `setBeam {measureIndex, eventIds[]}` | `removeBeam {measureIndex, index}` |
| full-measure rest | `setFullMeasureRest {measureIndex}` | `removeFullMeasureRest {measureIndex}` |
| measure repeat | `setMeasureRepeat {measureIndex, number}` | `removeMeasureRepeat {measureIndex}` |

**Removal classes, two of them.** A beam is a **reference** — it names event ids,
so removing it unlinks a grouping and touches no ink, and `deleteNote`'s beam
cascade (item 2) is the same rule from the other side. The two rest declarations
are **annotations**: strip the key, no tombstones, and the bar returns to whatever
its content says.

`setBeam` mints deterministic event ids where they are missing, exactly as
`setSlur` does — beams and slurs both name events, so they share the minting and
the residue already recorded in item 10.

**Only top-level beams get a verb.** `beam-hooks` and
`beams-secondary-beam-breaks` nest a second level (16th/32nd subdivisions, and a
one-event nested beam is a legal hook). Nesting is a *rendering* subdivision of an
already-authored group, so it earns its own gesture later; this item authors the
outer beam and says so, which will show up as those scenarios becoming
`ops-reachable` without becoming traceable — the kind-shaped optimism item 3
taught the campaign to expect and report.

### 2. The shortcut — `B`, polymorphic by projection

Item 10 established the pattern and this item is its second customer: **`B` beams
in the notation projection and bends in tab** (item 9's reserved letter). One key,
two dialects, chosen by the active projection.

The gesture is item 10's anchor, **reused verbatim** — the same
`spanAnchorKey`, because "press here, press there" is one mechanism whatever the
span turns out to mean:

```
B at the first note   → arms the anchor (shared with slurs)
B at the last note    → beams every event between them, in that voice
B on a beam's start   → removes that beam
Escape                → drops the anchor
```

The two rest declarations are setup-tier, joining the **bar popover** (`Shift+B`):
`full-measure rest`, `measure repeat`, `measure repeat 2`, and `no full-measure
rest` / `no measure repeat`. Worth stating plainly: that popover now writes both
global-measure and part-measure keys, because **a popover is a surface, not a
data-owner** — the user's question is "what about this bar?", and which object
holds the answer is our problem, not theirs.

### 3. The rung — measure, and event→event

The rest declarations sit at the **measure** rung like every other bar attribute.
The beam gesture is **event→event**, one rung up from item 10's note→note: a beam
groups events, not notes, so the anchor resolves to its event.

### 4. The evidence

- **Construct**: 10 scenarios are blocked only by these three kinds — the six beam
  documents plus `full-measure-rests`, `rest-gallery`, and the two
  `measure-repeats`. Reachable scenarios 45 → 55.
- **Destruct**: 48 elements (beam 40, measure-repeat 6, full-measure-rest 2) move
  `no-op` → `removed`, judged by the six oracles.
- The blocking histogram's top entry (beam, 10) is cleared, and what remains is a
  long tail of 5s and 6s — the point at which "ordered by evidence" stops
  distinguishing much, and the campaign's remaining items become a matter of
  which surface you want next.
- Goldens byte-identical throughout.

## What the build measured (2026-08-14)

- **Construct: reachable scenarios 45 → 55**, the predicted +10 exactly. The
  blocking histogram's head is gone: what remains is a flat tail (layout 6,
  score 6, direction 5, dynamic 5, staves 5, technique 5), which is the point
  where "ordered by evidence" stops distinguishing and the remaining items become
  a question of which surface you want next.
- **Destruct: 820 → 842 removable elements** — 14 beams, all 6 measure repeats,
  both full-measure rests. The other **26 beams report `no-op` honestly**: nested
  levels (no verb by design) and beams in a second part or on staff 2.
- **The scope split was not a judgement call — the code made it, twice.**
  1. The grid skips non-timed items, so container content is invisible to the
     cursor. A `wrapInTuplet` verb would have *removed ink from the addressable
     surface*, and the sweep would have reported those notes unaddressable.
  2. Then, trying to record a beam trace, the entry surface refused to lay a run
     of 32nds at all: after the first note, `nextPosition` lands on the original
     quarter rest, so every subsequent note inherits *that* duration
     (`C5/32nd, D5/quarter, E5/quarter…`). **No beam scenario is traceable
     today, and beams are not the reason** — onset granularity is.
- So the deferred half now has evidence rather than a hunch: what blocks tuplets
  also blocks a plain run of short notes, and the index gains a row for it.
- **The anchor generalized on first contact.** Item 10 built "press here, press
  there" for slurs; beams reuse the same `spanAnchorKey` unchanged, resolving to
  events instead of notes. Two verbs, one gesture, no new state — which is the
  argument for having built the gesture as its own thing.
- **`B` is the second customer of item 10's projection rule**: beam in notation,
  bend in tab. The pattern is now a convention rather than a one-off.

## Open questions

- Should `setFullMeasureRest` clear the bar's content, or refuse on a bar that
  holds ink? Proposed: **refuse** — the full-measure rest is a declaration *about
  an empty bar*, and silently deleting notes to make room would be the coarse-op
  cheating the campaign's anti-cheat rule forbids.
- A beam whose run crosses a barline (`beams-across-barlines`) is authored as one
  `beams` entry on the first measure naming events in both. The op takes a
  measure index for the entry's home; the gesture will need to allow an anchor in
  one bar and a completion in the next, which falls out of the cursor being free
  to move.
