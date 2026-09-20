# Entry without a keyboard — the editor on a tablet

> **Status: built, then REJECTED by the owner on 2026-09-20**, the same day, after using
> pass one on the tablet. The bar is removed (`src/elements/EntryBar.ts` and its mount are
> deleted) and the verdict is now a product rule: **on a touch device studio plays, it does
> not edit.** The piece page does not bind the editor at all where the primary pointer is
> coarse — see [apps/studio/README.md](../../apps/studio/README.md).
>
> What decided it: **a bar over the score is a bar over the score.** It sat at the foot of
> the pane whether or not anything was being edited, and the tablet's reason for existing
> is focus mode — full screen, the chrome gone, the music the whole page. An editor in
> permanent residence at the bottom of that is the wrong trade even when the verbs work.
> Hiding it behind a mode would have been the rule this repo has rejected before.
>
> Kept as the case against, per `rejected/`'s purpose: the whole design survey is below,
> unchanged, because **the next person to want touch entry needs the traps and the shapes**
> — and needs to know that shape B was not rejected on a guess but on a build.
> [Studio authoring campaign](../inprogress/studio-campaign-authoring.md) item 8, closed
> this way. Implementation loop; no golden ever moved.

## What was built, and what removing it took

`<mnx-entry-bar>` was an editor surface beside the rung inspector, mounted by `bindEditor`
into `<mnx-editor-surfaces>` wherever `(pointer: coarse)` matched, emitting the same
intents a key does. It worked, and `smoke:entry-bar` proved it with real touch events and
no keystroke at all. That is not what it was judged on.

Removing it was a clean subtraction — the element, the `entryBar` binding option, the
`syncEntryBar` call in `draw`, the pointer-down exclusion and the smoke — because
everything went through `dispatch` and nothing else had grown to depend on it. The one
thing kept is the `undoAction`/`redoAction` pair in `editorHost.ts`, which is a plain
de-duplication the bar happened to occasion.

The rule that replaced it has a proof of its own: **`npm run smoke:play-only`** drives
studio as a tablet and asserts the absence — no editor bound, the editor chunk never
fetched, a tap leaving no cursor, no Keys sheet, and the chip and the Details sheet saying
why. An absence needs a test more than a feature does; nothing else would notice a refactor
that quietly re-bound.

**Pointer placement (item 9) stays.** A press placing the edit cursor is a mouse feature
that a tap also reaches, it is already filed complete, and on a play-only device the same
tap still seeks playback. Nothing about this rejection touches it.

## Why not just keep it for the people who want it

Considered and refused: a setting. A per-device toggle would make the bar's presence a
preference to remember, a row in the settings card, and a second answer to "can this
device edit" — for a surface the owner does not want on the device it was built for. The
single answer is cheaper and it is the truthful one.

## Where this started

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

**The owner chose B on 2026-09-20.** The reason that decided it: the tablet edits in focus
mode, focus mode is browser fullscreen, and the tools row is not rendered there — so a
palette in the chrome is a palette for a different device. A remains the cheaper and more
consistent option and is kept here because that trade is real; if covering music turns out
to cost more than the width would have, this is the doc that says what A was.

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

## What pass one actually was — kept for the record, and deleted from the tree

Everything below describes the bar **as it was built and removed on 2026-09-20**. None of
these files exist any more; they are described because the shape and its traps are the
value this doc keeps.


`src/elements/EntryBar.ts` — `<mnx-entry-bar>`, an editor surface beside the rung
inspector and the lyric editor, mounted by `bindEditor` into `<mnx-editor-surfaces>` and
therefore present in **both** shells from one implementation. Neutral like the inspector:
it renders what the binding hands it and emits the intent the user asked for, and touches
no document.

- **It follows the pointer, not a setting.** Undefined, the `entryBar` binding option shows
  the bar wherever the primary pointer is coarse — a finger has no keyboard. A host may
  force it either way, which is also how a shell opts out.
- **The fingerboard is one tap per fret**, 0–12 with a shift to 12–24. Deliberately not the
  keyboard's two-digit timing window: that is a keystroke device, and a pad has room to
  show the number. On a notation staff the row becomes the staff verbs instead — toggle a
  note, then nudge it by semitone or octave — because there is no "type a pitch" intent and
  never was.
- **Durations are destinations, not directions**: five typed values plus a dot, rather than
  the shorter/longer ladder, which is a keyboard shape. Then tie, delete, undo, redo.
- **Every control refuses focus on the press.** `hasKeyboard()` is "focus is inside the
  viewer or the surfaces", so a button that took focus would dim the cursor it is about to
  move. The smoke asserts the cursor is never drawn dimmed.
- **Tapping the bar does not close the rung inspector.** The binding's window-level
  listener closes it on any press outside it; the bar is an editing surface, not
  "somewhere else", so it is excluded. That listener is on capture, so the bar could not
  have opted out by stopping propagation.
- **Everything goes through `dispatch`**, the same funnel as a key — so read-only, the
  refusal report and the delete notice all behave identically whether a verb arrived by
  thumb or by keystroke, and nothing the bar can do is unreachable from the keyboard.

### Proof

`npm run smoke:entry-bar` drives the workbench with **real touch events and no keystroke at
all**: the bar is absent on a mouse, appears on a coarse pointer with no setting anywhere,
a tap places the cursor, a tap on fret 5 puts a 5 on the fingerboard, a duration re-values
it, undo walks it back, and the cursor is never dimmed. It counts the fret **in the music,
not in the op log** — `enterFret` is the intent and `insertNote` is the op it records, and
only one of those is evidence.

### Known at the time, and deliberately left

- **The bar covers the bottom of the score.** Reveal-scroll does not know about it, so a
  cursor near the foot of the pane can end up behind it. The fix is an inset the viewer
  honours when revealing; it is not in pass one because it touches the reveal path, which
  is already carrying `smoke:selection`'s unrelated failures.
- **The upper fingerboard is a shift, not a second row.** Twenty-five thumb-sized targets
  do not fit a tablet's width.
- **Techniques, tuplets, grace notes, slurs, beams and lyrics are not here.** Every one has
  an intent ready; none earns width until the bar itself has been used in anger.
- **`keys()` still cannot generate a palette**, and pass one does not try: the buttons are
  written out, because the useful set for a thumb is not the same set as the keyboard's and
  an auto-generated bar would be a worse bar. The export is still the right idea the day a
  second palette wants it.
