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

## Scope boundary

Unchanged: the grid still skips non-timed items, so tuplet, grace and tremolo
content remains unaddressable. This item makes *runs* enterable, not containers
enterable — the two were tangled in item 11's row and are now separately
diagnosed.
