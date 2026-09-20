# Pointer placement — a click or a tap puts the edit cursor where it landed

> **Status: built 2026-09-20.** Serves the **implementation loop**.
> [Studio authoring campaign](../inprogress/studio-campaign-authoring.md) item 9, and the
> named prerequisite of item 8 (touch entry): the pickup note's
> *there is no click-to-place*. Inherits the campaign contract; clauses 12–14 are the ones
> that bite here. Independent of everything else in the index.

## The gap, exactly

The owner met it on 2026-09-20 with a synced, click-track-based recording and an empty
28-bar score of whole-bar rests: the chorus starts at bar 9, the frets go there, and the
only way to get there is the arrows. **A click never moves the edit cursor.**

- The viewer emits `note-selected {noteId, projection, ordinal}` only from ink that carries
  a `data-source-id` (`src/engine/render/svg.ts`). Empty staff space is not a target at
  all. A notation rest carries its synthetic key, so clicking it fires the event; the tab
  staff draws no rest, so an empty bar on the tab is entirely inert.
- Both shells turn the event into a **playback seek** (`bindPlayback`'s `select`,
  `ScenarioPage.onNoteSelected`). The editor's own handler (`editorHost.ts`
  `onNoteSelected`) reads only the projection, to decide which rendering owns spatial
  input in the combined view. No intent moves the cursor to a note, and there is no
  intent that takes a rhythmic position at all — `goToMeasure` and `goToEdge` are the
  whole pointer-shaped vocabulary (`src/edit/intents.ts`).
- Nothing shows, before the click, where a click would put the cursor.

## The decisions, taken 2026-09-20

Recorded from the conversation that opened this, so the design below is not re-argued:

1. **The two cursors stay two.** The edit cursor is a written address
   (`src/edit/cursor.ts`); the playback position is performance time resolved to an
   ordinal and a highlight set; the inspection iteration is a third. The player campaign's
   contract clause 3 chose this and every reason still holds (written vs performed time,
   the cursor's vertical and voice, the settle path's cost per move, live edit, undo, the
   `elements → edit` boundary). What feels like one cursor in other editors is a set of
   **seeding rules** between two states. This item is the first two of them:
2. **A click on a note places the cursor *and* seeks playback**, as it does everywhere
   else. In a viewer with no editor bound there is no cursor, and the click seeks only —
   the read-only face changes nothing.
3. **A click in empty space places the cursor and seeks playback to that bar**, so the
   two positions stay together until play is pressed.
4. **Anywhere in the bar is a target.** The cursor goes to the nearest string (tab) or
   staff position (notation) under the pointer, and to the nearest event column; in an
   empty or rest-only bar that is the rest at beat one and the ghost remainder after it,
   which is exactly where the first fret of the chorus goes.
5. **A hover ghost shows the landing place** on a mouse. Touch has no hover, so the tap
   must be self-evident without it — the snap makes it so.

Not this item, named so they are not lost: *play starts from the edit cursor*, and *an
explicit stop parks the cursor at the playhead* — the remaining seeding rules. The owner
is living with the two cursors for a while before deciding on those.

## Design

> **As built, three refinements to what follows.** The intent is
> **`goToPointer`**, not `goToPosition` — the name says what produced it, and the
> session already has `goToMeasure` for the deliberate kind. Its `at:` union
> collapsed to a flat optional `noteKey` beside an always-present `fraction`: a
> superset, and simpler, because the fraction is measured anyway and a rest
> needs no key when the snap already lands on it. And the geometry helpers the
> hit-test wanted were all private to `enclosure.ts`, so they moved wholesale
> into **`src/elements/scoreGeometry.ts`**, which both readers now import —
> the enclosure asks these questions forwards and the hit-test asks them
> backwards, and two copies would drift.

### The intent — `goToPosition`, and the session snaps

One new navigation intent, beside `goToMeasure`:

```ts
| { type: 'goToPosition';
    measureIndex: number; partIndex: number; staffIndex: number;
    /** The vertical line in the PROJECTION's own terms: a string number (tab) or a
     *  staff position in half-spaces from the middle line (notation). */
    line: number; projection: Projection;
    /** Where along the bar: a note or rest the pointer was nearest to, or, where the
     *  cell has no ink to name, the pointer's fraction of the bar's usable span. */
    at: { noteKey: string } | { fraction: number } }
```

**The session resolves it against its own grid**, never the viewer: `noteKey` finds the
grid stop whose slots carry that key (rests included — `EventSlot`s are on the grid for
exactly this reason); `fraction` × the measure's metric span becomes an onset and snaps
to the **nearest stop**, the ghost remainder included. The line is remapped through the
projection the click named, so a click on the notation staff of a tab part lands on a
staff position and the tab line follows, as `setProjection` already does. Voice: the
stop's first voice on that line, else the cursor's current voice — the voice-sticky walk
is unchanged. This is the inverse of `selectionContextFor`, and it lives in `src/edit/`,
pure, with the same corpus-wide test the note keys have.

Why the split between `noteKey` and `fraction`: spacing is not linear in music, and the
enclosure code says so where it falls back to `measurePositionX` only when a cell has no
ink. So where there is ink the viewer names the nearest glyph column and the onset is
exact; only an inkless cell is measured by the fraction, and there the grid has one or
two stops, so nearest is unambiguous.

### The hit-test — geometry the viewer already has

A pointer becomes `{system row, measure cell, staff, line, nearest column}` from the same
reads the enclosure builder makes today (`src/elements/enclosure.ts`): `line.barline`
gives the cells per row, `line.staff-line` gives each staff's lines and therefore which
staff and which line or space the pointer is over, and the glyph boxes give the columns.
The inverse of `measurePositionX` (a `measurePositionAt(left, right, x, staffSpace)`)
goes beside it in `src/engine/render/selectionGeometry.ts`, DOM-free, so the arithmetic
has a unit test.

**Built once per paint, not per event.** A `pointerMap` cached with the render outcome,
invalidated where the enclosure's geometry is; the hover path must never query the SVG on
`pointermove`. In the combined view the click also names its projection, exactly as the
note click does today, so the editor's existing projection switch runs first.

### The press, not the click — measured, not chosen

The plan said "a click". A click is the wrong event here, and the reason is
worth keeping because nothing in the code says it out loud.

Selecting a note can re-engrave the score: in the combined view a press decides
which rendering owns spatial input, the session settles, and the viewer repaints
— `container.innerHTML = ''` and a fresh SVG. That happens **during the
pointerdown**, so by the time the mouse-up arrives the element under the pointer
no longer exists. Mouse-down and mouse-up land on different nodes and the
browser synthesises **no `click` at all**. Traced in a real browser on
2026-09-20:

```
pointerdown -> text.notehead
mousedown   -> DIV            (the SVG was rebuilt in between)
mouseup     -> text.notehead
```

Not one `click` reached even a capture-phase listener on `document`. So
placement listens on `pointerdown`, primary button only — which is what
`engine/render/svg.ts` already does for note selection, for its own stated
reason ("deliberately not deferred, because a 300ms lag on note selection is a
worse defect"). The same rule, met from the other side.

The same trap governs the smoke: a rect measured a round trip before the press
may name a different note by the time it lands, because placing the cursor can
reveal-scroll the score. The test therefore captures what was under the pointer
*in the dispatch* and asserts the placement named that, rather than trusting
coordinates read in advance.

### The event — the viewer stays ignorant of `edit/`

The viewer emits **`position-selected`** with the intent's fields (plus the
`note-selected` it already emits when the pointer was on ink — that event does not
change, so nothing that listens to it today moves). It fires only when a host has turned
placement on: `bindEditor` sets a `pointerPlacement` property on the viewer and clears it
on dispose. The read-only viewer, the embed and the player-only piece page never fire it
and never draw the ghost (clause 12: the boundary stays where item 7 opened it).

- `bindEditor` (`src/elements/editorHost.ts`) handles `position-selected` → flush the
  tab digits, `handleIntent(goToPosition)`, `settle()`. A refused intent (the bar has no
  cell for that part, say) is reported through `onRefused` like any other.
- `bindPlayback` (`src/elements/playbackHost.ts`) handles the same event for a click
  that was **not** on ink: resolve the measure's ordinals through the active iteration
  (`resolveIteration` + `activeIteration`, both in `src/model/playback.ts`), choose with
  `chooseOrdinal` as the note click does, seek. A click on ink is already a seek and gains
  nothing here. `ScenarioPage`'s own seek handler follows the same shape.

### The hover ghost

The existing `CursorGhost` drawing, driven by the pointer instead of the session: on
`pointermove` with `pointerType === 'mouse'`, the cached map yields the landing place and
a hollow ghost is drawn in its own layer (`g.pointer-ghost`, beside the enclosure and
the cursor ghost, so neither is disturbed), throttled to one frame, cleared on
`pointerleave` and on every paint. It uses the ghost's existing tokens at the
`--row-current` weight the dimmed cursor uses, so it reads as *would go here*, not as a
second cursor. Not drawn while the keys go elsewhere (`selection-inactive`), for the
reason the dimmed cursor exists.

### Touch

A tap is a click. The gesture layer (`src/elements/gestures.ts`) claims double tap,
double-tap-drag, two-finger tap and pinch and leaves a single tap alone, so placement
needs nothing from it. The first tap of a double tap will also place the cursor before
the zoom resets; harmless, and simpler than a 300 ms placement delay that would make every
tap feel late. The score frame's rule that **a tap on the score is never a chrome toggle**
is untouched.

## Proof (clause 13)

- Conformance, `src/edit/`: over every corpus scenario, every grid stop round-trips
  through `goToPosition` by `noteKey` and by `fraction` (its own `measurePositionX` value
  inverted) to itself; an inkless bar by any fraction lands on its rest or ghost; a
  fraction past the last stop lands on the ghost remainder, never past the bar.
- Unit, `selectionGeometry.ts`: `measurePositionAt` inverts `measurePositionX` across the
  inset clamp.
- Smoke: `smoke:workbench-editor` and `smoke:studio-editor` gain the owner's scenario —
  an empty 28-bar tab score, click bar 9 on the third line, type a fret, assert the note's
  string and onset; and a click on empty space seeks the player's readout to that bar.
  Run `smoke:selection` and `smoke:player` after, by hand, as the convention says.
- **No golden moves.** The ghost and the map are viewer overlays over the finished SVG,
  like the enclosure; `engine/headless.ts` emits nothing new.

## Not in scope

- Drag to select a range (the range grain is
  [core-selection-range-grain](../inprogress/core-selection-range-grain.md)'s).
- The touch entry surface itself (item 8) — this is its first piece, not its design.
- The remaining seeding rules named above.
- A pointer-shaped `goToNote` by id alone: `goToPosition` with `at.noteKey` covers it.
