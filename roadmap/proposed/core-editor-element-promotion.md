# Promoting the editor into `elements/` — the second-consumer move

> **Status: proposed (2026-08-09), deliberately parked.** Split out of
> [core-editor-input-layer.md](../complete/core-editor-input-layer.md) as its one remaining
> item, so that doc could close at its real scope (everything else shipped). This
> doc owns the move that makes the editor consumable outside the workbench —
> and, just as deliberately, the reasons not to make it yet.

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
   [core-viewer-surface.md](core-viewer-surface.md)'s layered rule (engine options →
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

## Not this

- **No emulation presets** — still a keymap-table concern, unlocked but not
  scheduled by promotion.
- **No persistence** — the element edits in memory and emits; storage remains
  its host's problem (studio's seams).
- **No new trace machinery** — traces stay intent-based harness fixtures;
  promotion must not add a second capture path.
