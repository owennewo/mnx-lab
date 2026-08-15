# Promoting the editor into `elements/` — the second-consumer move

> **Status: proposed (2026-08-09), deliberately parked.** Split out of
> [core-editor-input-layer.md](../complete/core-editor-input-layer.md) as its one remaining
> item, so that doc could close at its real scope (everything else shipped). This
> doc owns the move that makes the editor consumable outside the workbench —
> and, just as deliberately, the reasons not to make it yet.
>
> **Trigger re-check, 2026-08-14** (prompted by
> [core-editor-focus-scope.md](core-editor-focus-scope.md), whose stage 2 is
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
>   ([core-editor-focus-scope.md](core-editor-focus-scope.md): the scope
>   ladder, `keyScope.ts`, the ring, the ownership predicate, the
>   binding-split assertion). What remains of it *is* item 3 below. The
>   promotion is therefore **cheaper than when this doc was written** — the
>   gate held while the expensive part got paid down early, which is the
>   incubation design working as intended.
> - **Caveat that cuts the other way**: the
>   [element-ops campaign](../inprogress/core-campaign-element-ops.md) will add
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
  of `<mnx-score-viewer>` — a real design decision, see below).
- **Does not move**: stages 1–2 (`src/edit/{intents,keymap,cursor,session}.ts`
  and friends) stay in `edit/` as pure modules. The promotion relocates DOM
  wiring, not logic — that was the incubation design's whole point.

## The work (the promotion review)

1. **The boundary change**: allow `elements/ → edit/` in
   `.dependency-cruiser.cjs` (today `elements/` may import only
   `model`/`engine`/`audio`). This is the deliberate, reviewed move the layer
   docs prescribe — the review *is* this list.
2. **The element contract**: editor element vs editing mode on
   `<mnx-score-viewer>`; its attributes/properties/events, designed under
   [core-viewer-surface.md](../inprogress/core-viewer-surface.md)'s layered rule (engine options →
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
   [core-editor-ai-prompt.md](core-editor-ai-prompt.md) already flags that a promoted
   palette pulls the `elements → assist` boundary into question (embeds
   probably should **not** ship an AI prompt; that mode may stay
   workbench-only by configuration). Decide it here if the palette is part of
   what moves.

## Getting it moving (2026-08-14)

> **Answered the same day**: option 1 was taken —
> [core-viewer-embedded-app.md](core-viewer-embedded-app.md) establishes
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
   `<mnx-score-viewer>` ownership of *input scope* without the editor —
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
