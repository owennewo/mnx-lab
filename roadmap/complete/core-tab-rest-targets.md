# A rest in tab is somewhere you can stand

> **Status: complete 2026-10-14.** Implementation loop. No golden moved; no verification debt.
> **Overturns** one clause of the 2026-09-20 rest-pill decision (`379042d2`, "Player: the
> playhead stands in the rests too"): that a tab rest "joins no selection and answers no click".

## Why

The tab draws no rest — a convention this does not change. But the cursor, a press and the
selection's enclosure all find things by the selection keys drawn ink carries, and a tab
rest carried none. Each consumer grew its own way round the gap: the ghost interpolated a
fraction of the bar, then borrowed the notation staff's column (which a tab-only view does
not have); a press on a rest found no column (four bugs, [core-rung-insert](core-rung-insert.md)).
The owner hit it again on 2026-10-14 in a triplet of a chord and two rests: on the rests
the cursor drew itself bunched behind the chord. Their direction: "rests are drawn
invisibly so that they are in the correct place and can be clicked".

The 2026-09-20 pill already put an invisible mark on every tab rest — for the playhead
only, by decision: a `sourceId` "would join the enclosure … and become a click target the
reader cannot see". That reasoning is reversed: the reader addresses a tab rest by its gap,
and the enclosure is exactly what was missing. And the same commit passed over rests inside
containers, because their keys carried no container index — every rest of a triplet would
have answered to one name.

## What was built

- **`layout/tabStaff.ts`**: beside the playback pill (unchanged, `playbackId` only, spanning
  the rest), a rest gets an invisible TARGET — a one-digit mask's size, on the centre band,
  where its digit would stand — carrying the rest's `sourceId` (`rest tab-rest`). Emitted
  under `durationSpans`, the viewer's flag, so no golden sees it.
- **Rests in tuplets are each their own**: the tab target, the cursor grid's event key
  (`edit/cursor.ts`) and the playhead's rest spans (`model/restSpans.ts`, now at played
  offsets and lengths) spell a contained rest with its container index — the spelling the
  session's anchor lookup already used. Notation still draws a tuplet's rests under no key
  (giving them one would move goldens); a top-level rest's key is unchanged everywhere.
- **The viewer** keeps the target unpainted — selected, inactive or under the playhead — so
  it has a box to measure and never shows.
- **The inspector's `at`** reads as played: an event in a triplet ends a twelfth later, not
  an eighth (`playedSpan`, `edit/cursor.ts`) — it read `3/4 → 7/8` for a triplet eighth.

Unchanged: the tab convention (no visible rests), the pill and its playhead styling, and the
borrowed-column fallback, which remains the last resort for a moment with no event at all.

## Proof

- `harness/conformance/pointer-placement.test.ts` — *a rest in tab is a place you can stand
  on and click*, on a tab-only bar of a quarter, a triplet (note, rest, rest) and a half
  rest: every rest has a target, a triplet's each its own, in onset order right of the note
  before it, and none without the viewer's flag; the grid names the same keys and a press on
  each lands on its onset; the rest spans carry them at 1/3 and 5/12, a twelfth long; the
  inspector reads `1/4 → 1/3`. All four fail on the code before this change.
- A scratch probe of the owner's bar in the built studio, tab view: the cursor on the two
  triplet rests and the quarter rest after stood at 409/423/437 px before (bunched behind the
  chord at 399) and at 428/450/473 px after, on their columns; pressing each target landed
  on that rest.

## Follow-up the same day: two marks too many, and a range box too wide

The owner, on the built change: with the cursor on a triplet rest "there is also a blue
thing … in the center of the staff line … It looks like there are two", and a two-event
range "starts before the first event".

- **A solid blue block was the target, lit.** The playback paint lights everything carrying
  a `data-source-id`, and its colour rule outranks the target's transparent fill.
  `paintPlaybackInk` now skips `.tab-rest`; the pill is the rest's playback mark.
  Pinned in `playback-ink.test.ts`.
- **The dashed outline was the pill**, lit because the paused playhead stands where the
  cursor does (core-single-cursor). Paused under a bound editor the cursor already marks
  the rest, so the viewer sets `data-cursor-is-playhead` then and the pill shows only while
  playing (or with no editor bound, where the playhead is all there is).
- **The range box** added a linear onset estimate for every member of a range, to keep
  rest-only endpoints inside it; on a bar whose early notes spread out, the estimate for
  the first event fell left of its digits (385 px against digits at 401). With tab rests
  inked, the estimate is now used only for a cell with no ink here or anywhere in the
  system: the same two-event range measures 397–436, its left edge where the single event's
  is. Notation's tuplet rests are still unkeyed, so a range ending on one hugs the ink
  before it — the tab beside it, in the combined view, still reaches it.
