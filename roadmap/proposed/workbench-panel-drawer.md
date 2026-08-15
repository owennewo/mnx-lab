# The score panel as a drawer, below 360px

> **Status: proposed 2026-08-15.** Item 8 of
> [core-campaign-modernist.md](../inprogress/core-campaign-modernist.md); inherits its shared
> contract. Drafted because the question that blocked it got an answer:
> **the drawer closes on Escape or on a click outside it.**
>
> Split from [workbench-score-panel.md](../complete/workbench-score-panel.md), which built
> the five-band frame and the 360/420/560 widths and deferred this deliberately:
> the design says *"below 360 the panel becomes a drawer over the score"* and
> then specifies neither how it opens nor how it closes. Half of that is now
> settled; the opening gesture is the one thing still to decide, and this doc
> recommends an answer rather than leaving another blank.

## The problem

`PANEL_MIN` is 360px, so the panel can never be dragged narrower than the width
its tab strip needs. That is the right floor for a *panel* and it leaves the
narrow case unhandled: on a small viewport the score gets whatever is left after
360px of chrome, which on a 900px window is most of the page given over to
description text you are not reading while you look at an engraving.

The design's answer is that below 360px the panel stops being a column and
becomes a **drawer over the score** — full height, right-anchored, the same five
bands, but floating rather than displacing. Nothing else about it changes; this
is a layout mode, not a second panel.

## Closing: decided

**Escape, or a click outside the drawer.** Both, not either — they are the two
gestures a reader already has for "I am done with this thing", and the app
already answers to both elsewhere.

### Escape is an `overlay`, slot 2

`src/edit/keymap.ts` states the precedence once and calls the order the whole
contract:

```
popover → overlay → relaxSelection → deselect
```

**The drawer is an overlay.** It takes Escape at the same tier as the selection
tray and the command palette, which is what "innermost open thing first" already
implies: the drawer is a thing you are *in*, so it backs out before the ladder
widens the selection. No new tier, no change to `ESCAPE_PRECEDENCE`, and nothing
for `key-scope.test.ts` to relearn.

The mechanism is the one that tier already relies on, and it is worth restating
because it is why this needs no arbitration code: **overlays own their own
keydown and `preventDefault()` before the page-level listener runs**, so the
ordered list is a description of what the DOM already guarantees rather than a
branch anybody has to write. A drawer with focus inside it consumes Escape by
existing.

That also settles tray-inside-drawer without a rule: if both are open, whichever
holds focus consumes Escape first, and the tray is the thing you just opened. It
falls out of the mechanism instead of being legislated.

### Click-away is the palette's backdrop, reused

`<mnx-command-palette>` already does exactly this — a `.backdrop` spanning the
overlay's box with `@click=${() => this.close()}` — and the drawer should use
the same shape rather than inventing an outside-click listener. One pattern, one
place to get the stacking right.

**The dismissing click is swallowed.** It closes the drawer and does nothing
else: it does not also land on whatever was under it. This is the standard
behaviour and it is worth writing down here because of what is coming — the
residue ledger's *"clicking a note to move the selection"* row is still open
(`note-selected` has no consumer), so **today a click on the score does nothing
anyway and the question is invisible**. The moment that row is closed, a
dismissing click would otherwise both close the drawer and move the cursor,
which is one gesture doing two things the reader only asked once for. Deciding
it now costs a sentence; deciding it later costs a bug report.

## Opening: the one thing still open

A drawer that is closed by default needs something to open it, and the design
draws nothing. Recommended, and cheap:

**The tab strip stays.** Below the breakpoint the panel's body and footer slide
away but its tab strip remains pinned to the right edge as a thin rail of the
five labels. Tapping one opens the drawer on that tab; Escape or a click outside
closes it back to the strip.

Three reasons to prefer it over a new button or a keystroke:

- It reuses a control that is already there and already means "show me this" —
  the reader is not learning a new affordance, they are using the one they know
  at a smaller size.
- It preserves the *addressing*: at any width, the way to reach the HUD is to
  press `hud`. The wide and narrow layouts stay the same product.
- It needs no keystroke, and the free-key budget belongs to the element-ops
  campaign. (`Ctrl+B` folds the rail; a symmetrical `Ctrl+`-something for the
  panel is a tempting-looking answer that spends a key on a mode most sessions
  never enter.)

Left genuinely open, because it wants a hands-on look rather than a ruling here:
whether the strip is horizontal along the top edge or vertical down the right,
and whether the drawer animates in or simply appears.

## Not this

- **Not a second panel.** Same tabs, same five bands, same state — only the
  positioning changes. If the drawer ever needs different content, the
  breakpoint was the wrong idea.
- **Not a mobile layout.** The rail, the head and the score all still assume a
  desktop; this is one narrow-window behaviour, not a responsive pass. The
  workbench is a review bench on a developer's desktop
  ([lab-structure-lab.md](../complete/lab-structure-lab.md)).
- **Not a change to `PANEL_MIN`.** 360 stays the floor for the docked panel; the
  drawer is what happens *below* it, driven by the viewport rather than by the
  drag handle, which cannot reach there.
- **Not a new Escape tier.** See above — the whole point is that `overlay`
  already fits.

## Verification

- Goldens unaffected: chrome only, and the campaign's standing argument applies
  (`update:primitives`, then a clean `git diff -- scenarios/`).
- `key-scope.test.ts` should keep passing **unchanged** — that it needs no edit
  is the evidence the drawer really is an `overlay` rather than a new tier. If
  that test needs touching, this design was wrong.
- Hands-on over CDP at a narrow viewport: the breakpoint crossing in both
  directions (a docked panel must become a drawer and back without losing the
  active tab), Escape with the drawer alone, Escape with the tray open inside
  it, a click on the score dismissing without selecting, and the drawer in both
  themes.
- One regression to watch specifically: the setup popover is a page-level
  overlay in `.main` (bottom-left) and the tray docks bottom-centre. A
  right-anchored drawer must not cover either, or the reader can open a popover
  they cannot see.
