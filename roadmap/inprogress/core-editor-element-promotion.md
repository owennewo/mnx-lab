# Promoting the editor into `elements/` — the second-consumer move

> **Status: in progress — slice 1 (keyboard only) built 2026-09-17; slices 2–3 not started.** See
> *Slice 1* at the end. Originally **proposed (2026-08-09), deliberately parked.** Split out of
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

- **The workbench still has its own mount.** Work-list item 5 — *one editor surface, not
  two* — is not done: the scenario page keeps its window listener, HUD, tray, palette,
  clipboard, lyric editor and rail escalation. What it shares today is the selection
  translation and the scope tests. It adopts `bindEditor` when slices 2–3 give the binding
  the surfaces the workbench's mount has; promoting the inspector now would have made an
  in-progress surface's churn public API.
- **Unbound here, rather than half-working:** Enter's rung inspector and the typed popovers
  (slices 2–3), the lyric text editor, copy/cut/paste, the command palette, and ↑/↓ at the
  document rung (the neighbouring *document* is the host's collection).
- **No touch.** Keys only; campaign item 8.
- **Every edit re-hands the document to the player**, which recompiles and stops playback.
  Correct, and heavy for a keystroke; a lighter hand-off is still owed.
- **Clicking a note does not move the cursor** — it never did in the workbench either.
