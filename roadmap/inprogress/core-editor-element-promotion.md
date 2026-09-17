# Promoting the editor into `elements/` — the second-consumer move

> **Status: built — slices 1–3 (2026-09-17) and work-list item 5, the workbench's adoption of the
> binding (2026-09-17): one editor surface, not two.** See *Slice 1*, *Slices 2–3* and *Work-list
> item 5* at the end. Originally **proposed (2026-08-09), deliberately parked.** Split out of
> [core-editor-input-layer.md](../complete/core-editor-input-layer.md) as its one remaining
> item, so that doc could close at its real scope (everything else shipped). This
> doc owns the move that makes the editor consumable outside the workbench —
> and, just as deliberately, the reasons not to make it yet.
>
> **Trigger 2 met, 2026-09-17.** Studio is the second consumer: this doc is item 7 of the
> [studio authoring campaign](studio-campaign-authoring.md) and inherits its contract. The
> campaign sequences it last (creation, the save pipeline and sync come first), recommends
> promoting in three slices with the rung inspector last, keeps `elements → assist` closed,
> and opens `apps/studio → src/edit` earlier, at its item 3. The re-check below is kept as
> the record of how the gate stood until then.
>
> **Trigger re-check, 2026-08-14** (prompted by
> [core-editor-focus-scope.md](../complete/core-editor-focus-scope.md), whose stage 2 is
> blocked on this doc and cannot proceed without it):
>
> - **Trigger 1 — the intent vocabulary: MET, on the trigger's literal terms.**
>   The whole history of `src/edit/intents.ts` is **five changes, all purely
>   additive: zero renames, zero removals, zero meaning changes** (the only
>   deletions in the diffs are the union's trailing `;` becoming `|`). It has
>   grown 16 → 26 types through rests, ties, setup, the palette, the selection
>   ladder and `{}` genesis without one existing member moving. The trigger
>   asks that the vocabulary *survive new features without renames or meaning
>   changes* — that is exactly what happened, and growth is not churn: adding
>   a union member is a non-breaking API change, which is the property that
>   actually matters once these become public.
> - **Trigger 2 — a real second consumer: NOT MET, and it is now the sole
>   blocker.** No consumer is asking. `apps/studio/` is a README; the embed
>   face registers viewers only. This is a product decision, not an
>   engineering one, and it cannot be resolved by more building.
> - **Cost 2 is substantially retired.** The doc recorded "the shadow-DOM
>   focus story comes due immediately" as a reason to wait; that story is now
>   designed and half-built ahead of the move
>   ([core-editor-focus-scope.md](../complete/core-editor-focus-scope.md): the scope
>   ladder, `keyScope.ts`, the ring, the ownership predicate, the
>   binding-split assertion). What remains of it *is* item 3 below. The
>   promotion is therefore **cheaper than when this doc was written** — the
>   gate held while the expensive part got paid down early, which is the
>   incubation design working as intended.
> - **Caveat that cuts the other way**: the
>   [element-ops campaign](../complete/core-campaign-element-ops.md) will add
>   intents for ~10 more item families. All additive on current evidence, but
>   promoting mid-campaign means each item's new verbs land on a *public*
>   surface. Not a blocker — additive is non-breaking — but it argues for
>   promoting either early (few verbs, cheap to shape) or after a campaign
>   milestone, not randomly in the middle.

## The trigger (a check, not a debate)

The promotion runs when **both** are true:

1. **The intent vocabulary has stabilised** — it survives new features (rests,
   ties, setup, palette all landed without reshaping it) *and* a stretch of
   hands-on use without renames or meaning changes. Bindings may keep churning;
   the keymap is data and rebinding is free. It is the *intents* that become
   API on promotion.
2. **A real second consumer needs editing** — the embed face or studio, asking
   for it, not hypothetically. Same graduation philosophy as the package split
   (CLAUDE.md): a check, not a debate.

Until then the editor mount stays in `workbench/`, where churn is free because
it is a leaf. Moving early buys nothing (no consumer exists to serve) and costs
three real things, recorded here so the gate isn't re-litigated from scratch:

- **API pressure**: `elements/` is the public surface (the embed artifact
  registers it; the `mnx-lab` package exports it). Every intent/keymap churn
  becomes surface churn there, instead of a private workbench detail.
- **The shadow-DOM focus story comes due immediately** (survey §6.3): key
  events, focus containment and `:focus-visible` inside shadow roots — work the
  light-DOM workbench mount legitimately defers.
- **Bundle weight**: keymap + session + ops land in the embed bundle for pure
  viewers unless the editor element is code-split from the viewer path.

**Testing is unchanged either way** — `harness-not-into-shells` forbids harness
imports of `elements/` just like `workbench/`, so promotion buys no
testability. The logic is tested where it lives, in `src/edit/` (DOM-free,
trace fixtures, root vitest), before and after.

## What moves, what doesn't

- **Moves**: mount-point code only — the edit strip, the cursor/selection
  overlay, the copy-trace control, the keymap's event wiring — today mounted by
  the workbench scenario page. It becomes an editor element (or an editing mode
  of `<mnx-document-viewer>` — a real design decision, see below).
- **Does not move**: stages 1–2 (`src/edit/{intents,keymap,cursor,session}.ts`
  and friends) stay in `edit/` as pure modules. The promotion relocates DOM
  wiring, not logic — that was the incubation design's whole point.

## The work (the promotion review)

1. **The boundary change**: allow `elements/ → edit/` in
   `.dependency-cruiser.cjs` (today `elements/` may import only
   `model`/`engine`/`audio`). This is the deliberate, reviewed move the layer
   docs prescribe — the review *is* this list.
2. **The element contract**: editor element vs editing mode on
   `<mnx-document-viewer>`; its attributes/properties/events, designed under
   [core-viewer-surface.md](../complete/core-viewer-surface.md)'s layered rule (engine options →
   element bindings → workbench chrome). Intents become the event vocabulary;
   the op log / trace capture needs a host-visible seam.
3. **The shadow-DOM focus story** (survey §6.3), now unavoidable: where key
   listeners attach, focus containment, `:focus-visible`, and the one smoke
   test the real components get.
4. **Code-splitting**: pure viewers must not pay for the editor in
   `dist/embed/mnx-lab.js`.
5. **Workbench consumes the promoted element** and its own mount code is
   deleted — one editor surface, not two.
6. **The palette question travels along**:
   [core-editor-ai-prompt.md](../proposed/low-priority/core-editor-ai-prompt.md) already flags that a promoted
   palette pulls the `elements → assist` boundary into question (embeds
   probably should **not** ship an AI prompt; that mode may stay
   workbench-only by configuration). Decide it here if the palette is part of
   what moves.
7. **So does the model picker** (added 2026-08-22).
   [core-assist-model-selector.md](../complete/core-assist-model-selector.md) closed with
   `<mnx-model-picker>` incubating in `workbench/` on exactly this gate — both
   shells want the selection mechanism, and trigger 2 is unmet for the same
   reason. It rides the same `elements → assist` decision as the palette and
   should be decided with it, not separately: one boundary question, one
   review. Its cost is the lowest of the three, because the scoring core
   (`src/assist/modelSelect.ts`) is pure, DOM-free and fetchless — whatever
   the boundary answer, only the dialog moves.

## Getting it moving (2026-08-14)

> **Answered the same day**: option 1 was taken —
> [core-viewer-embedded-app.md](../complete/core-viewer-embedded-app.md) establishes
> **embeds view; studio edits**. So trigger 2 is *not* met by the new
> `viewer-embedded` app (a read-only consumer needs no editing) and now belongs
> squarely to **studio**, when studio is real. The gate did not move; what
> moved is that it is no longer ambiguous what would open it. The viewer app
> did, however, immediately pay for itself elsewhere: it exposed the embed's
> broken asset contract (`/smufl` fetched from the *host's* origin) and forced
> the fix, plus the first cross-origin test the embed face has ever had.

Only trigger 2 stands. Three honest ways forward, in ascending commitment —
the choice is a product call:

1. **Answer the consumer question explicitly: should the embed face offer
   editing at all?** This is the fork. If *yes*, the embed becomes the real
   consumer, the trigger is met by decision rather than by waiting, and the
   promotion runs on its work list below. If *no* — embeds are read-only
   viewers by design — then say so here, and the focus-scope doc's stage 2
   stops being "pending" and becomes "not wanted": an embedded viewer needs
   no key handling beyond not stealing the host's keys, **which stage 1
   already delivers**. Either answer unblocks something; only silence leaves
   both docs open forever.
2. **Scope-only promotion** (if the answer is "maybe, later"): give
   `<mnx-document-viewer>` ownership of *input scope* without the editor —
   it already has `tabindex` and the ring, so it listens on itself and
   re-emits scoped key events; the workbench keeps the session and consumes
   those instead of `window`. Buys per-element correctness (two viewers on a
   page stop fighting) and deletes the window listener, at the price of one
   event hop. **Needs no boundary change and no API commitment** — the viewer
   re-dispatches events, it does not *interpret* them, so the keymap stays
   the only KeyboardEvent interpreter. A genuine intermediate, not a
   half-measure: it retires the mechanism risk while the product question
   stays open.
3. **Full promotion** — the work list below, unchanged.

The recommendation is **(1) first**, because (2) and (3) are both answers to a
question nobody has asked yet, and (1) is cheap: it is a decision, not a
build.

## Not this

- **No emulation presets** — still a keymap-table concern, unlocked but not
  scheduled by promotion.
- **No persistence** — the element edits in memory and emits; storage remains
  its host's problem (studio's seams).
- **No new trace machinery** — traces stay intent-based harness fixtures;
  promotion must not add a second capture path.

## Slice 1 — the keyboard's core (built 2026-09-17)

Item 7 of the [studio authoring campaign](studio-campaign-authoring.md), which sequences the
promotion in three slices. The owner's call on the open question: **slice 1 ships
keyboard-only**; touch entry is its own item (campaign item 8).

### The decision this doc left open: a binding, not an element and not a viewer mode

The work list asked *editor element vs editing mode on `<mnx-document-viewer>`*. Neither.
The drawing was already in the viewer — it has taken a `.selection` and drawn the cursor,
the enclosure and the span since the selection ladder — so there was nothing to put in a
new element but event wiring, and the repo already has the shape for that:
`bindPlayback(host, viewer, player)`. So the mount is **`bindEditor(scope, viewer, document,
options)`** in `src/elements/editorHost.ts`: a plain-DOM host binding that owns an
`EditorSession`, listens on the host's own element, and sets `viewer.selection`. It satisfies
both of this doc's constraints at once — *viewers must not pay* (nothing the viewer or the
player imports reaches it; it is its own chunk behind a dynamic `import()`, and the built
embed bundles contain no editor code — checked: no `enterFret`, no `tabDigit`) and *the
editing logic does not move* (it is still `src/edit/`, untouched).

### What moved, and what both mounts now share

- **`src/elements/editorHost.ts`** — the binding. Navigation and the selection ladder, fret
  entry through `TabDigitResolver` with its 500 ms window, pitch entry, durations, ties,
  slurs, beams, transposition, insert, delete, undo/redo, and Escape/Enter's pending pair
  (a half-typed fret first; then Escape puts the cursor away). The pane-owned layer rule
  (digits are frets only while a tab pane is on screen and the part has strings), the
  projection following the pane, and the system-row resolution of ↑/↓ at the bar rungs all
  came across. `readOnly()` holds a binding to navigation only; `suspended()` takes the
  cursor and the keys away while the viewer shows some other document; `keys()` is the
  keymap's meaning table filtered to the rung, the pane **and the keys this mount really
  binds**, so a host's key list never advertises a surface that is not mounted.
- **Scope is structural now** (work-list item 3). The listener is on `scope`, not `window`;
  a key reaches the editor because focus is inside it. `keyScope.ts` moved to `elements/`
  with it; the binding uses `focusWithin` for the dimmed-cursor rule and needs neither
  `focusUnclaimed` nor the window listener.
- **`src/elements/editorSelection.ts`** — `selectionContextFor(session, view)`: the body of
  the workbench's `syncFromSession`, with the enclosure-by-level table, the rest-key
  channel and the presentation span, moved out **verbatim**. The workbench's scenario page
  now calls it (−230 lines there), so a cursor looks the same wherever it is drawn and
  there is one copy of the translation. This is the one module in `elements/` that knows
  both vocabularies; the viewer still knows shapes and never editor levels.
- **The boundary** (work-list item 1): `elements → edit` is open in
  `.dependency-cruiser.cjs`. `elements → assist` stays closed: the AI palette and the model
  picker stay in the workbench (items 6–7, decided *not now*).
- **`setWork` is an intent.** Studio had its own `EditHistory` for the Details sheet; two
  histories on one page would have made Undo mean two things. The sheet's edits now go
  through the session, so notes and metadata share one undo stack. A merge that changes
  nothing is not an edit.

### Studio

`apps/studio/src/PiecePage.ts` loads the binding for a piece that can be saved, hands it the
viewer as both scope and surface, and takes every document change through the save pipeline
it already had — `SaveSession.adopt()` tells the session which object *is* the saved one,
because an editor copies what it is given. A **Keys** sheet lists what the keyboard can do on
the rung the cursor is on. A change to the score's **shape** — a bar added, a repeat, a
meter — is checkpointed at once rather than after the pause: the structural-op trigger the
save pipeline owed.

### Proof

`harness/verify/studio-editor-smoke.mjs` (`npm run smoke:studio-editor`), real key events
through the DevTools protocol in a real browser against the local Worker: a dimmed cursor
made live by focusing the score; fret 3, then a two-digit fret 12 inside the window; Ctrl+Z
and Ctrl+Y; **the Details sheet's Undo taking back an artist and then a fret** — one history;
**a digit typed into a text field not reaching the editor** — structural scope; the Keys sheet
naming the rung and listing no unmounted surface; Escape and back; a bar added saved at once;
and after a reload the notes read back from the stored `.gp`. Run and passed 2026-09-17,
with `smoke:inspector`, `smoke:focus`, `smoke:piece-create`, `smoke:save-pipeline`,
`smoke:piece-lifecycle` and `smoke:sync-rederive`. The harness may not import `elements/`
(`harness-not-into-shells`), so the binding's proof is this smoke and the workbench's own
smokes over the shared selection code; `testing is unchanged either way`, as this doc said.

**Pre-existing, not from this work:** `smoke:selection` fails two reveal-scroll checks
(*the selection is off screen at the first/last bar*, a 218 px selection in a 191 px
viewport) — identically on a clean build of `main` at `261a3398`. Reported, not chased here.

### What slice 1 deliberately is not

- **The workbench still had its own mount** at this point (work-list item 5, since done —
  see the end). What it shared then was the selection translation and the scope tests;
  promoting the inspector in slice 1 would have made an in-progress surface's churn public
  API.
- **Unbound here, rather than half-working:** Enter's rung inspector and the typed popovers
  (slices 2–3), the lyric text editor, copy/cut/paste, the command palette, and ↑/↓ at the
  document rung (the neighbouring *document* is the host's collection).
- **No touch.** Keys only; campaign item 8.
- **Every edit re-hands the document to the player**, which recompiles and stops playback.
  Correct, and heavy for a keystroke; a lighter hand-off is still owed.
- **Clicking a note does not move the cursor** — it never did in the workbench either.

## Slices 2–3 — the surfaces (built 2026-09-17)

### Slice 2 had already happened

The campaign planned *slice 2: the setup popovers* and *slice 3: the lyric editor and the rung
inspector*. Reading the workbench first showed the first of those was gone: the
[one-surface campaign](../complete/workbench-campaign-one-surface.md) retired every
Shift+letter popover **into the rung inspector** — `SETUP_POPOVER_COMMANDS` has one row
left, and it is the lyric text editor. Time, key, clef, tuning, part, bar attributes,
adornments and rhythm are all the inspector's words now. So the two slices are one: promote
the inspector and the setup verbs come with it.

### What moved

- **`src/elements/RungInspector.ts`**, **`inspectorRows.ts`**, **`hudRows.ts`**,
  **`overlayPlacement.ts`** and **`LyricTextEditor.ts`** — moved, not copied; the workbench
  imports them from `elements/`. `hudRows.ts` now owns the `HudRow`/`HudPart` types it used
  to import from the workbench's HUD element (which re-exports them), so nothing in
  `elements/` looks up at a shell.
- **`src/elements/inspectorMount.ts`** — what a mount does with the inspector besides
  showing it: `inspectorLineIntent` (the typed line read against where the cursor stands),
  `fireFromInspector` (the intent fired *and the ladder put back on its rung*, so applying an
  event pill does not drop the cursor to the note rung under the pills) and `mirrorOverlayAt`.
  The scenario page calls all three; they were its method bodies.
- **`src/elements/EditorSurfaces.ts`** — `<mnx-editor-surfaces>`, the layer the surfaces
  live in, which exists for one reason: **the inspector inherits the palette rather than
  declaring it** (a `designTokens` block inside it would pin it light, and
  `design-tokens.test.ts` holds it to that). In the workbench the tokens come down from the
  app host; studio declares other tokens. This element is the ancestor that declares them.
- **`bindEditor` mounts them** when the host gives it somewhere to (`overlay`): **Enter**
  with nothing pending opens the inspector at the selection's anchor (from the viewer's
  `selection-anchored`, in the overlay's coordinates); **Shift+L** the lyric text editor,
  whose clean parses draw live on a scratch copy through `onPreview` — *drawn, never told to
  the host as a change* — and land as one `applyLyricPlan`; **copy / cut / paste** when the
  host supplies a `SelectionClipboardStore`, with the planner's sentence through `onNotice`.
  A read-only binding refuses the inspector's mutations with a sentence; a suspended one
  closes both surfaces. The cursor stays lit while the inspector has the keyboard — it is
  ours. `keys()` lists Enter, Shift+L and the clipboard only when they are mounted.

### Studio

The piece page gives the binding an overlay over the score pane — a sibling of the viewer in
the frame's slot, *not* a wrapper, because the frame measures its slotted scroller — a
per-tab clipboard store (a bar copied in one piece pastes into the next), a lyric preview
that draws without touching the save session, and a status line for what a paste did.

### Proof

`npm run smoke:studio-editor`, extended: Enter at the bar rung opens the inspector with its
crumbs, an anchor and **a resolved `--surface`** (the palette reached it); the cursor is not
dimmed while it has the keyboard; `time nonsense` is a sentence and `time 3/4` is an edit
that leaves the ladder on the bar rung and — a change of shape — is saved at once; a real
Escape typed into it closes it and hands the keyboard back. Shift+L opens the lyric editor;
`sing song` shows in the score **while the editor's document has no lyrics and the chip
stays clean**, then Apply makes it one edit. Ctrl+C, two arrows, Ctrl+V: a third note, and
the page says so. After a reload the stored `.gp` gives back the 3/4 and the lyrics.
With it: `smoke:inspector` and `smoke:focus` (the workbench, now importing the moved
elements), the four other studio smokes and both sync smokes. The built embed bundles
contain no `mnx-rung-inspector`, no `mnx-lyric-text-editor` and no `enterFret`.

## Work-list item 5 — the workbench adopts the binding (built 2026-09-17)

*One editor surface, not two.* `src/workbench/ScenarioPage.ts` no longer has a mount: no key
listener, no fret resolver, no pending pair, no inspector or lyric-editor template, no
clipboard verbs, no focus tracking — the page is some 480 lines shorter and the binding 130
longer. It calls `bindEditor(this, viewer,
…)` with its `.main` as the overlay, and keeps what is genuinely the workbench's.

### What the binding grew, and what it did not

The scoping note asked for three things. Two were needed; one had retired before it was built.

- **Replace the session → `options.session`, and dispose-and-rebind.** A binding holds one
  session for its whole life. The page states WHICH session is in force (`this.session` — a
  load, a revert and a construct replay each build a new one, the last through
  `replayIntents`, which is why the binding *adopts* a session rather than being told how to
  make one) and `syncBinding()`, run after every render, rebinds when the session, the viewer
  element or the overlay is a different object. The rail's carried rung needs nothing: the
  page builds the session with its `level`.
- **The document-rung hook → `onEscalate(delta)`.** A hook and not an intent — it leaves the
  document, so there is nothing for a trace to replay. Studio can bind the same gesture to
  the library when it wants to.
- **A host-owned preview channel → not built.** Its only other user was the tray's rung
  preview, and the tray retired in the one-surface campaign; `previewScope()` had been
  returning the lyric caret and nothing else. The binding already owns that.

And four the note did not list, found by reading the page against the binding:

- **`claimUnfocused`** — the window fallback, decided deliberately: the binding's listener
  stays on the host element, and a host that opts in also gets keys typed while *nothing* is
  focused, plus the window-level focus and pointer tracking that keeps the dimmed cursor
  honest. It is the leniency an embed must not have, so it is asked for by name.
- **`inspector.extend` / `inspector.apply`** — the `iteration` word addresses the workbench's
  pass model, not the document, so it is the host's word: added to the view, and offered
  every typed line first.
- **`onRefused`** — the chip's refusal flash for a rung the document does not present, now
  wired where the digit keys actually land; and **delete's sentence** goes out through
  `onNotice`, so studio says it too.
- **`sessionMoved()`**, for a host that drove the session directly (the destruct sweep, the
  ops panel's walk through the queue), plus `openInspector()`, `openLyrics()` and
  `closeSurfaces()` for the chip and the palette, and `cursorHidden` / `hasKeyboard` for the
  HUD and the chip that draw the ladder.

Two behaviours moved INTO the binding so both shells have them: a **pointer outside the
inspector closes it**, as does losing the keyboard; and a **click in the combined score
chooses the projection** (the viewer's `note-selected`), without being a reason to show a
hidden cursor. The seek on that click stays the workbench's.

### Proof

`npm run smoke:workbench-editor` (`harness/verify/workbench-editor-smoke.mjs`), new, for the
seams nothing else touched: an arrow typed with nothing focused; a fret shown by the page
and walked from the ops panel; **revert and construct replay rebinding the editor to a new
session** with one surfaces layer and live keys; the destruct sweep; delete's sentence; a
refused rung flashing the chip; the inspector closed by a pointer outside and opened from
the chip's word; and ↑/↓ at the document rung walking the rail **with the rung carried
across**. With it, unchanged and green: `smoke:inspector`, `smoke:focus`, `smoke:player`,
`smoke:studio-editor` (the binding changed under studio too). `smoke:selection` fails the
same two reveal-scroll checks it fails on `main`, to the pixel (*190…408 in a viewport of
190…381*) — pre-existing, see *Slice 1*.

**Found by the new smoke, fixed here:** the destruct sweep dissolves the score to `{}`, and
`compilePerformance({})` threw on `doc.parts.map` — inside the page's document sync, so the
page silently kept showing the last score while the session held an empty one. On `main`
too; nothing drove the sweep in a browser. A document under construction now compiles as
silence (`performance.test.ts`).

### Still not here

The **command palette** (the workbench's own, and the only path to the AI prompt, which
stays behind the closed `elements → assist` boundary), **touch** (campaign item 8), and
**click-to-place** — a click still selects for playback and does not move the cursor, in
either shell.
