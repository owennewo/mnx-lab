# Click targets — what a press on the score means, and what hover promises

> **Status: IN PROGRESS — built 2026-10-19, awaiting the owner's hands-on check.** Opened from
> a design conversation with the owner the same day; the recommendations below were made in
> that conversation and the owner asked for them to be planned and built ("write a plan and
> implement all of this"). Refines, and in one place narrows,
> [core-editor-pointer-placement](../complete/core-editor-pointer-placement.md). Stays open
> as the home of the element vocabulary, which grows one kind at a time (*What this does not
> do*, below).

## The owner's direction (2026-10-19)

> Stepping back a user might want to: 1. click on a note in tab view, 2. click a note in
> notation view, 3. click a lyric which sits above the system, 4. click something else to
> change it e.g. repeat end bar (e.g. change repeat from x3 to x4). At the moment 1 and 2 are
> possible, 3 and 4 are not. Also clicking on white space always seems to do something e.g.
> find the closest event/note. I think clicking white space should often do nothing.
> This is a direction of travel — particularly part 4 — we might not know all the best
> behaviours or appropriate svg targets straight away.

## Why white space did something

Deliberately. Pointer placement's decision 4 (2026-09-20) was **"anywhere in the bar is a
target"**: an empty 28-bar tab skeleton had nothing to click, and the chorus at bar 9 was
reachable only by the arrows. `hitTest` (`src/elements/pointerHitTest.ts`) therefore took the
nearest system, the nearest staff, the nearest bar and the nearest column — it returned
`null` only for a page with no score. The fix was right and too wide: a press in an empty bar
is not a press on white space, it is a press on a **slot** — a place a note can go.

## The model: three kinds of target

Every point on the page is exactly one of:

1. **An element** — ink the document chose (the vocabulary is `src/edit/elementWalk.ts`'s
   `ElementKind`). A press **selects** it.
2. **A slot** — inside a staff band, or within ledger reach of it, inside a bar. A press
   **places the cursor**, exactly as before.
3. **Dead space** — the gutter between systems, the margins, the gap between staves beyond
   ledger reach, the title block. A press **changes nothing**.

And one rule ties them to the mouse: **hover shows what the press will do; no hover feedback
means the press does nothing.** The landing ghost appears only over slots; an element under
the pointer is outlined; dead space shows nothing.

## The decisions (recommended 2026-10-19, adopted by the owner's go-ahead)

1. **Where a slot ends.**
   - *Tab:* the outer string lines plus half a line gap either side. Tab has no ledger
     lines, so further out is not a place a fret can go.
   - *Notation:* the staff plus **three ledger lines** either side (plus half a staff
     position, so a press that rounds onto the third ledger line still counts).
   - Where a neighbouring staff is closer than that — the `both` view's tab staff hangs just
     under its notation staff — each reach stops **halfway** to the neighbour, so two slots
     never overlap.
   - *Horizontally:* from the system's left edge to its right edge. The part-name margin is
     dead. A clef, key or time signature at the head of a line is still a slot in the first
     bar until those kinds become elements.
   - **Ink outranks reach**: a notehead five ledger lines up is a note, and a press on it
     selects it — the reach limits only the empty paper.
2. **A press on dead space changes nothing** — no cursor move, no seek, no collapse of a
   range. It may still hand the keyboard back to the score (focus is not an edit; the
   pointer-down path that closes an open inspector is unchanged). Escape remains the way to
   collapse a range. *Why not deselect, as MuseScore does:* here the cursor always exists and
   IS the playback position, so a stray press costing a range or moving the music is worse
   than a stray press doing nothing; and "nothing, except it collapses" would be the first
   exception to a rule just written — the owner's standing preference is a simple rule over
   stacked fallbacks.
3. **Lyrics are elements.**
   - A press on a syllable (or on a verse row's empty place under a note — the lamp's
     `lyric-gap`) puts the cursor on that note, in **the visit that sings that verse**: verse
     N is pass N, the lamp's own rule, so clicking verse 2 of a repeated bar lands on its
     second visit. In the unrolled view the ink already names its visit.
   - With the lyric panel already open, the caret follows to that word (the reverse of the
     caret→cursor link the panel already has). A syllable of another part reopens the panel
     on that part.
   - **Double-press, or Enter while the syllable is selected, opens the lyric panel** with the
     caret on that word. No on-score editing: the panel owns the grammar (hyphens,
     extenders, skips, elisions), the preview and one-undo-per-visit, and a second editor
     would drift from it.
4. **Other elements: press selects, double-press or Enter edits.**
   - A press moves the cursor to the element's address **at its rung** (a repeat end is a
     bar-rung thing: the bar, at the `measure` level) and outlines the element; playback
     seeks like any cursor move.
   - Double-press, or Enter while the element is selected, opens **the rung inspector with
     that element's pill opened and its value selected** — changing ×3 to ×4 is: double-press,
     type 4, Enter.
   - Direct manipulation (scroll to step a count, drag a volta's end) waits until use shows a
     particular kind needs it, and then sits on top of this, not instead of it.
   - The element vocabulary grows **one kind at a time**: a kind is clickable once its ink is
     tagged with its model address and the inspector has a pill to open for it.
5. **Hit areas and priority.** Small element ink is padded to at least one staff space each
   way. Where targets overlap the order is **note ink → lyric (attached) → bar-level element
   → slot**.

## The stages (all three built 2026-10-19)

The rules are DOM-free in **`src/engine/render/clickTargets.ts`**: slot reach (`staffReach`,
`slotAt`), the element vocabulary (`CLICKABLE_KINDS`, `PILL_OF`), target choice (`reachBox`,
`targetAt`), press counting (`PressCounter`) and the lyric visit (`lyricVisit`). Reading targets
off a drawn page and drawing outlines is **`src/elements/clickTargetPaint.ts`**. The engine is
where the rules live because the headless suite may not import `elements/`
(`harness-not-into-shells`), and the viewer may not reach `edit/`.
`harness/conformance/click-targets.test.ts` holds the rules. The
`workbench-editor` smoke proves the chain in a real browser: dead paper, a repeat count
×3→×4, and a syllable opened in the panel.

### Stage 1 — slots and dead space

- `hitTest` (`src/elements/pointerHitTest.ts`) resolves the staff by **reach**, through
  `slotAt` over the pointer map's `slots`. With no note under the pointer, a point inside no
  reach returns `null`, so the press emits nothing and the hover draws nothing. A note under
  the pointer keeps the old nearest-band resolution, so **ink outranks reach**.
- **The note under the pointer is found by geometry, not by the DOM.** This was the other
  half of "white space finds a note". `noteTargetAt` (`src/engine/render/noteTarget.ts`)
  already had a forgiving radius around each note's ink. When nothing was near, though, it
  fell back to the DOM's own hit, and **a glyph's DOM hit area is its whole font em**, far
  past the ink. So a press on empty paper beside a note was a press on that note: it seeked
  playback and moved the cursor. The fallback now keeps only non-note ink (stems, rests,
  ties). The viewer's press and hover both ask `noteTargetAt` instead of the raw event
  target, so the hover never promises a note the press would not land on.

### Stage 2 — lyric targets

- Lyric syllables and verse-row gaps are targets (their `data-playback-id` +
  `data-lyric-line`). A press emits `element-selected`. The binding lands `goToPointer` on
  the note with the verse's visit (`lyricVisit`), steps to the note rung, and remembers the
  element as **selected**: outlined (`g.element-focus`, via `SelectionContext.focusedElement`)
  until the cursor stands anywhere else.
- The second press of a double press emits `element-activated`, and so does Enter on a
  selected element. Either one opens the lyric panel with the caret on the word.
  The panel gained `showWord(noteKey, ordinal)`, also used to move its caret when a
  syllable is pressed while it is open; a syllable of another part reopens the panel there.
- **Found and fixed: the panel had never opened at the word.** `firstUpdated` set the
  selection on the still-empty textarea, and the render that filled it put the caret at the
  end. Nothing tested it. It now places the caret after that render.

### Stage 3 — the element mechanism, proven on repeats and voltas

- Under `elementTargets` (set by the viewer, never by the goldens), the layout tags
  **`repeat-end`** (the `N×` count, the end-repeat dots and strokes), **`repeat-start`** (its
  dots and strokes) and **`ending`** (the volta bracket and label) with
  `element: { kind, measureIndex }`, emitted as `data-element` / `data-measure`. The suite
  checks that the tag is purely additive: with it, every other primitive is identical.
- A press selects (the bar, at the bar rung, outlined). A double press or Enter opens the
  inspector with that element's pill opened and its value selected
  (`RungInspector.openPill`).
- **Opening waits a task.** It runs after the press that asked has been fully delivered.
  The press's own mouse-down focuses the score when it finishes, and opening any sooner
  lost the keys from the pill to the score: the 4 typed to make ×4 went in as a fret.

### What building it showed

- **Tight systems leave no dead paper between them.** Three ledger lines of reach each way
  covers a gutter of up to about 6.5 staff spaces. In the workbench's twelve-bar blues the
  systems stand about 6 sp apart, so the whole gutter is still a slot. Dead space between
  systems appears only where they stand further apart: lyrics, chord rows, a roomier
  clearance. If that still feels too eager in use, the lever is `NOTATION_REACH_GAPS`, one
  number. The decision belongs to the owner's hands-on check.
- A double press is counted, not heard: presses are numbered as a browser numbers clicks,
  so a third press is the gesture's tail and asks for nothing.

## What this does not do (named so it is not lost)

- More element kinds (tempo, section, rehearsal, dynamics, clef/key/time at a line head,
  ties, techniques): each is the stage-3 recipe — tag, pill, test.
- Direct manipulation of any kind.
- Touch: studio plays and does not edit on a coarse pointer
  ([studio-editor-touch](../rejected/studio-editor-touch.md)); nothing here changes that.

## Progress

- 2026-10-19 — plan written; stages 1–3 built and landed in one branch
  (`core-editor-click-targets`). Awaiting the owner's hands-on check, especially on the reach
  (*What building it showed*).
