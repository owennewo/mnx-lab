# Onset granularity — why the second note of a run came out wrong

> **Status: built 2026-08-14.** Campaign:
> [core-campaign-element-ops.md](core-campaign-element-ops.md), item 11b's first
> half. The containers (tuplet, grace, tremolo) and the rest-duration verb it
> uncovered stay open — see below.
>
> Item 11 tried to record a beam trace and could not, for a reason that had
> nothing to do with beams: **a run of short notes was unenterable.** This is
> that bug, diagnosed and fixed.

## What was actually wrong

Entering eight 32nds into a fresh 4/4 bar produced
`C5/32nd, D5/quarter, E5/quarter…` — the first note right, every one after it
wrong. Two mechanisms, compounding:

1. **The duration keys never reached the pending duration.** `shorterDuration`
   stepped `entryDuration` only on an *entry ghost* (a position with no event at
   all). A padded bar is full of **rest events**, so the keys re-valued the rest
   under the cursor instead, leaving every later rest a quarter.
2. **Entry inherited the rest's duration.** `insertPitchNote` turned a rest into
   a note in place, keeping the rest's `duration` and ignoring the one the op
   was given. So even with the right pending duration, the note came out as long
   as whatever it landed on.

## The fix, and the principle behind it

**A rest is absence (§8.11)** — the campaign's own founding rule, already used to
decide that the walker enumerates ink rather than JSON nodes. Applied here it
settles both halves:

- There is nothing *there* to re-value, so the duration keys step the **pending
  entry duration** over a rest exactly as over an entry ghost.
- Entry does not inherit a rest's duration: the note takes the pending one, and
  the surplus stays as rest **after** it. Never by shortening in place — MNX
  sequence content is sequential, so shrinking an event drags every later event
  earlier, which would silently re-time the bar.

`restsSpanning` (the ladder `padMeasureRests` already used, factored out) fills
the gap in place, so the full-bar invariant holds through every entry.

## What it cost, and what it uncovered

- **One recorded trace changed, correctly**: `from-scratch` now yields notes at
  the duration the trace *asked for*, with rests filling the remainder — the
  campaign's parked "intended semantic changes break traces correctly" case,
  arriving for the first time. Regenerated through `npm run update:edit-traces`;
  every bar still sums to its meter, checked explicitly.
- **Rests are now un-re-valuable by keyboard**, which is the honest consequence
  of treating them as absence — and it surfaces the next blocker immediately.
  `spec/beams-secondary-beam-breaks-implied` writes its tail as **one half rest**;
  entry pads with **two quarter rests** (`padMeasureRests` spends beat rests
  first). Both are legal and sum identically, but they draw different glyphs, so
  the scenario is still not traceable — now for a rest-*spelling* reason rather
  than a note-duration one.

That is the finding this item hands on: **rest durations are currently a
consequence of padding, not a choice.** Reproducing an authored rest pattern
needs either a rest-duration verb or a smarter normalization in
`padMeasureRests` (an engraver writes one half rest, not two quarters). It joins
the containers in item 11b's remainder.

## What 11b's remainder actually costs (measured 2026-08-14)

Two attempts at the remainder ended in findings rather than code, and both are
worth more than a half-migration would have been.

**Rest spelling cannot be fixed where it appears to live.** Making
`padMeasureRests` engraver-correct (one half rest rather than two quarters, by
only letting a rest be as long as its own starting boundary allows) works — and
immediately broke two recorded traces, because **the cursor grid is derived from
rest events**. Coarse rests delete the positions the cursor needs: an empty 4/4
bar spelled as one whole rest offers exactly one place to aim. So the beat-rest
padding is not naive, it is the entry grid, and the real fix is to decouple grid
positions from rest events — a bigger change than the spelling it would enable.
Reverted; the finding stands.

**Container descent is a key-scheme migration, not a walker change.** The
blocker is not the goldens (7 scenarios, 32 noteheads, an accepted demotion):
it is that the renderer indexes `sequence.content` per item, so a container's
inner events would all synthesize the SAME key under
`syntheticNoteKey(measure, voice, eventIndex, noteIndex)`. Descent therefore
needs a nested key form (`@m0.v0.e2.c1.n0`) landed simultaneously in
`model/noteKeys.ts`, `model/jsonView.ts`, `edit/cursor.ts`,
`engine/layout/notation.ts` and `engine/layout/tabStaff.ts` — the five
traversals CLAUDE.md requires to stay in lockstep, with the goldens as the
witness. Half a migration would put the overlay, the document pane and the
render out of step with each other, so it wants doing whole.

Tuplet and tremolo content is *timed* (`itemSpan` already scales it), so their
onsets fall out; grace content is un-timed and would share its host's onset,
which the grid's slot list supports. Neither is the hard part.

## Move 1 landed (2026-08-14)

The five-traversal problem above is retired:
[core-note-address.md](core-note-address.md) makes `model/noteWalk.ts` the one
place coordinates are produced, with a corpus-wide join proving the renderer
agrees. Container descent is now a change to **one function**, and the nested key
form stays inside it. What remains for 11b is the descent itself plus the cursor
discriminator (move 2), not a migration.

## Container descent landed (2026-08-14)

With one enumeration in place, descent was a change to that enumeration plus the
consumers that need more than identity — and it went in without drama:

- **`model/noteWalk.ts` descends**, minting the nested key
  (`@m0.v0.e2.c1.n0`) that tells a container's inner events apart. The form
  stays inside `noteKeys.ts`/`noteWalk.ts`; nothing else knows it.
- **The ops layer follows for free** (`findKeyedNote` reads the shared walk), so
  `deleteNote` and every note-attached verb reach container notes. `LocatedNote`
  now carries its owning `event` rather than re-deriving it from
  `seq.content[eventIndex]` — which for a container returns the container, and
  was a bug waiting to happen.
- **The grid descends**: a tuplet's inner events get real scaled onsets (its
  written durations in the outer's time) and become their own columns; grace and
  tremolo content shares the host moment, which is reachable precisely because
  move 2 gave the cursor a discriminator. **Move 2 was the prerequisite nobody
  planned** — coincidence turned out to be rare in the corpus but structural for
  containers.
- **The renderer stamps the same keys**, so the overlay can highlight what the
  cursor can now reach. Each container emitter filters its content before
  drawing, so the key factory works from the **raw** index — the one the walk
  counts. The key-agreement join is what would have caught getting that wrong.

**Result: 32 container notes became addressable and removable** — notes removed
640 → 672, total removable 1057 → 1089. Seven scenarios' goldens gained
`sourceId`s where ink was previously anonymous; **no geometry moved**, and they
are demoted `verified → rendered` awaiting `/verify`.

Still `no-op`, honestly: the container *elements* themselves (tuplet, grace,
tremolo) have no wrap verb yet. That is now an ordinary op-family item with
nothing structural riding on it — the point of doing the addressing first.
**Built 2026-08-15 — see the two sections at the end.**

## The wrap verbs, and what they decided (2026-08-14)

The containers get their removal verb, and the semantics is the interesting
part: **a container is removable only once it holds no ink** — the campaign's
container rule, third application after measures and parts.

**Unwrapping is the tempting reading and it is refused.** "Remove the tuplet"
usually means keep the notes and drop the ratio — but three eighths written in
the time of two become three plain eighths, and the bar overfills. An editor may
not reshape time as a side effect of removing a bracket. That is the same
argument that refused a time-signature removal which would have reshaped bars,
and it is why the fifteen containers now report **`refused`** rather than
`no-op`: the verb exists and declines, which is a different fact and the report
distinguishes them.

Their route to removability is the one the campaign already has: delete the ink
first, then the empty container goes — exactly as an emptied bar and an emptied
part do.

**`space` refuses for a different reason, and it is the third sighting of one
gap.** A space holds no ink but IS time, and `itemSpan` still counts it as zero,
so removing one silently shortens the bar and the renderer says so
(`spec/tie-targets`: diagnostics 0 → 2). It has now surfaced three times — here,
in the time-signature removal, and in the rest-spelling attempt. **That span is
the single fix that would close all three**, and it is small; it is left
deliberate rather than sneaked into an unrelated item.

## The construction half, built 2026-08-15

`Shift+R` — **rhythm…** — the fourth typed popover family, holding the four
things that are content but not events: the three containers and authored
silence. Nine of the sweep's sixteen blocked scenarios open with it
(**blocked 16 → 7, ops-reachable 80 → 89**).

**One verb for three kinds, by item 7's family test.** Tuplet, grace and
tremolo share an owner — a run of one sequence's content — and differ only in
the declaration wrapped around it, so `wrapInContainer` takes a `ContainerSpec`
rather than three verbs taking nothing. `space` is deliberately NOT in it: it
shares the containers' shape (a non-event item in content) and none of their
act, because it holds no events to wrap. It gets `insertSpace`.

**Wrapping may re-time the bar; unwrapping may not.** That reads like a
contradiction of this item's own removal rule and is not: three eighths becoming
a triplet shortens the bar, and *that is the request*, not a side effect an
editor slipped in. Removal has no such request behind it, which is why it stays
refused. The bar-duration diagnostic is what tells the author either way.

**No anchor gesture — the declaration already says how much music it takes.**
Slurs and beams need press-navigate-press because a span is genuinely open;
a container's extent is written into it. A tuplet consumes the events that
exactly fill its inner value (`3 eighth in 2 eighth` takes three eighths — and
also the quarter-plus-eighth `spec/tuplets` actually holds), a tremolo its two,
a grace one unless told `grace 2`. Where the run does not fill the value, the
wrap refuses rather than guess. `wrapExtent` is that rule, and it is why this
family needed no new gesture at all.

**Addressed by content indices, not event ids.** `setBeam` mints ids because a
beam *references* its events; a wrap *moves* them, so minting would write names
the document never asked for — and the round-trip test below would have caught
it instantly.

**The evidence is a round trip, not a trace.** For each of the six containers
the corpus holds, `harness/conformance/rhythm-wrap.test.ts` unwraps it out of
its own scenario, navigates back with `driveToElement`, types the declaration,
and demands the whole document return byte-identical. That is a stronger claim
than a recorded trace: the target is a human-verified scenario rather than
whatever the ops happened to produce. It caught the tremolo's `outer` — the two
events are each WRITTEN with the total duration while `outer` is what is
PERFORMED, so the value is the written one divided by the count (two written
halves → `2 × quarter`), which no amount of copying the first field would have
produced.

## Rest spelling: a verb, not a policy (2026-08-15)

The finding above said rest durations were "a consequence of padding, not a
choice", and that making `padMeasureRests` engraver-correct broke the cursor,
because the grid's positions ARE the rest events.

Both facts survive if spelling is a **verb**. `rest half` at the cursor joins the
run of rests starting there into one, refusing unless they sum to it exactly —
respelling may not change how long the bar is silent. Padding keeps writing beat
rests, so the entry grid is untouched; an author who wants the engraver's
spelling says so, after the fact, which is also how they would think about it.
The grid-decoupling work the earlier attempt implied is no longer owed by this
item — it is a nicety about defaults, not a blocker.

## Scope boundary

Unchanged from the granularity half: the grid still skips non-timed items, so
tuplet, grace and tremolo content remains unaddressable. This item makes *runs* enterable, not containers
enterable — the two were tangled in item 11's row and are now separately
diagnosed.
