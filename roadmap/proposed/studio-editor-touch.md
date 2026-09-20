# Entry without a keyboard — the editor on a tablet

> **Status: proposed 2026-09-20 — a design to agree, not a plan to run.**
> [Studio authoring campaign](../inprogress/studio-campaign-authoring.md) item 8, the last
> item between the campaign and its goal. Needs
> [core-editor-pointer-placement](../complete/core-editor-pointer-placement.md) (item 9,
> complete), which was its stated blocker. Inherits the campaign contract; clauses 12–14
> are the ones that bite.
>
> **Nothing here should be built before the owner has picked between the two shapes in
> *The one real decision*.** The campaign's own note says so, and the record says why:
> several tray designs have been rejected on sight.

## Where this starts

Item 9 closed the gap that made touch impossible: **a tap is a press, and a press places
the cursor**. On the tablet today you can already open a piece, tap a bar, and have the
cursor land on the string and beat you tapped — including in an empty bar of rests, which
is the case the owner hit. The hover ghost is mouse-only on purpose; the snap is what
makes the tap self-evident without one.

So what is missing is no longer *where do I edit*. It is **the verbs**: a fret, a duration,
a tie, a rest, delete, undo. Today every one of those is a keystroke.

## What already works in our favour

- **`binding.handleIntent(intent)` is not gated on the keyboard.** A button can fire an
  intent while focus is anywhere. Read-only and suspension are respected, navigation still
  allowed — the same funnel a key goes through (`src/elements/editorHost.ts`).
- **Studio already has the funnel.** The Details sheet mutates the score through
  `applyIntent`, and the page comments that "a sheet's edit goes through the same funnel
  as a key". A palette is another sheet, not a new architecture.
- **The panel idiom is settled.** Source, Instruments, Details, Keys and Save are each a
  380px column in the frame's `side` slot, owning nothing and emitting events. One panel
  at a time.
- **Single tap and long press are unclaimed** on the score. The gesture layer claims only
  double tap, double-tap-hold-drag, pinch and two-finger tap — three of those are zoom and
  transport. One-finger vertical drag must stay native scrolling.
- **The intents already exist** for everything a first pass needs: `enterFret{fret}`,
  `toggleNote`, `shorterDuration`/`longerDuration`, `setEventDuration{base,dots}`,
  `toggleDots`, `toggleTie`, `delete`, `undo`/`redo`, `insertAtRung{side}`,
  `wrapInContainer{spec}` for a triplet or a grace. No new edit verb is needed.

## The one real decision

Two shapes. They differ in where the palette lives, and everything else follows.

### A — the side panel (the idiom the shell already has)

A `<mnx-studio-entry>` in the `side` slot, opened from a tools-row button like every other
panel: a fret pad 0–12 with a shift to the upper frets, a duration row, and a small verb
row (tie, dot, rest, delete, undo).

- **For:** it is the pattern five panels already follow, so it costs no new layout
  thinking; the score narrows rather than being covered, so the cursor stays visible; it
  needs no gesture at all.
- **Against:** it eats 380px of a tablet's width, which is most of a portrait screen. And
  the tools row **is hidden in focus mode**, which on Android is also browser fullscreen —
  so the way you would actually play from this score is the way you could not reach the
  palette. That is not fatal (the button could move) but it is the thing to notice.

### B — a bar over the score, inside the editor's own overlay

A palette layered in `.editor-overlay`, where the rung inspector already lives: anchored
low, the width of the pane, appearing when the editor has a cursor and gone when it does
not.

- **For:** it survives focus mode, because it is inside the pane rather than the chrome;
  it costs no width, only height; it sits in the surfaces layer that already exists and
  already knows how to anchor to the selection.
- **Against:** it covers music. It needs a rule for when it shows and hides, which is
  exactly the kind of rule that has been rejected before. And it must not take focus, or
  the cursor dims and the inspector closes (see the traps below).

**My recommendation is B**, for one reason: the tablet is used in fullscreen, and a
palette you cannot reach in fullscreen is a palette for a different device. But A is
genuinely cheaper and more consistent, and this is the owner's call, not mine.

A third option exists and I do not recommend it: **no palette at all**, with long-press on
the score opening a radial or context menu at the cursor. It keeps the score uncovered and
uses the one free gesture, but it makes every edit a two-step gesture, and fret entry —
the most common act by far — deserves one tap, not two.

## What a first pass should contain, once the shape is chosen

Ordered by how often a guitarist actually uses them:

1. **Frets 0–12, one tap each**, plus a way to reach 13–24. Not the keyboard's two-digit
   timing window: that is a keystroke device, and a pad has room to just show the numbers.
   One tap is `handleIntent({ type: 'enterFret', fret })`.
2. **Duration**, as five or six typed buttons (`setEventDuration`) rather than the
   shorter/longer ladder — on a pad the value is a destination, not a direction. Plus a
   dot toggle.
3. **Tie, rest, delete, undo.** Delete is the one verb that says what it did; its notice
   already flows through `onNotice` and studio already shows it.
4. **Nothing else in pass one.** Techniques, tuplets, grace notes, slurs and beams all
   have intents ready, and all of them can wait for the pad to prove itself.

## The traps, each of which will bite

Found while surveying the surfaces, and none of them is guessable from the outside:

- **A control that takes focus dims the cursor and closes the inspector.** The binding
  computes "do I have the keyboard" as focus inside the viewer or inside
  `<mnx-editor-surfaces>`; anything else makes the cursor draw dimmed and, one task later,
  closes the rung inspector. **Every palette control must refuse focus**
  (`preventDefault()` on `pointerdown`) or live inside the surfaces layer.
- **A window-level capture listener closes the inspector on any press outside it.** So a
  palette tap while the inspector is open will close the inspector unless the palette is
  inside it.
- **`binding.openInspector()` is itself gated on having the keyboard**, so a palette
  button that has just taken focus will call it and silently get nothing.
- **`keys()` returns labels, not actions.** The pickup note suggests generating the
  palette from the same table the Keys sheet uses, and that does not work as written:
  `CheatRow` is `{keys, meaning}`, both display strings. The intent-bearing join exists
  inside the binding and is thrown away. **Generating a palette needs a new export** —
  either the resolved intent on the row, or a sibling of `cheatsheet()` that returns
  intents. That is a small, real piece of work this item owns.
- **The per-rung table is a map, not an oracle.** It says which verbs are meaningful at a
  rung, not which will succeed right now. A palette built from it will offer verbs the
  session refuses; refusals come back as `handleIntent() === false`, and the palette should
  show that rather than pretend.
- **There is no `(pointer: coarse)` branch anywhere in the tree.** This item would
  introduce the first one, which is a decision about the whole shell, not just this panel.

## Proof (campaign clause 13)

- The palette is UI, so its proof is a real-browser smoke in the manner of
  `smoke:studio-editor`: place the cursor by tap, enter a fret, change its duration, undo,
  and assert the document each time — driven with touch-type pointer events, not mouse.
- Whatever is added to make the palette generable from the keymap gets a conformance test,
  because it is pure.
- No golden should move. If one does, the batch registers in
  [lab-verify](../inprogress/lab-verify.md) first.

## Not in scope

- The workbench. It is keyboard-first by design and has a HUD, not a panel.
- Techniques, tuplets, grace notes, slurs, beams, lyrics — all have intents and can come
  later, once the shape is proven.
- Handwriting or audio input of any kind.
