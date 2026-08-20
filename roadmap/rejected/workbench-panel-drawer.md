# The score panel as a drawer, below 360px

> **Status: REJECTED (2026-08-20; drafted 2026-08-15 as "possible — not
> recommended").** First occupant of `rejected/` — the doc's own case against
> building was already decisive, so the filing now says what the analysis says.
> The two findings under
> [what to keep](#what-to-keep-even-if-this-is-never-built) remain current
> regardless.
> Row 8 of [core-campaign-modernist.md](../complete/core-campaign-modernist.md).
>
> This is a design that is ready to build and probably should not be. It is
> written down because the question that blocked it finally got an answer, and
> an answered question is worth keeping even when the feature it unblocks turns
> out not to earn its place — so that whoever raises "the panel should collapse
> on a narrow window" in six months finds the analysis instead of redoing it.
>
> **Read [the case against](#is-this-worth-building) first.** The two findings
> that are worth something regardless of whether this ships are the Escape tier
> and the swallowed click; both generalise beyond the drawer.

## What it is

Not a new surface. The score panel
([workbench-score-panel.md](../complete/workbench-score-panel.md)) — description, ops,
hud, compare, json — in a second **layout mode**. Docked, it is a column. As a
drawer it would float over the score, full height, right-anchored, same five
bands, hidden until asked for.

The design's one line on it: *"Panel width 420px, min 360, max 560; below 360
the panel becomes a drawer over the score."* It says nothing about how the
drawer opens or closes, which is what left this row undrafted twice.

## Is this worth building?

**Probably not.** The squeeze it relieves is real, arrives late, and already has
two escape valves.

Docked chrome is 270px of rail plus 360–560px of panel:

| Window | Score gets, rail open | Rail folded (Ctrl+B) |
|---|---|---|
| 1920 | 1230px | 1500px |
| 1440 | 750px | 1020px |
| 1280 | 590px | 860px |
| 1100 | 410px | 680px |
| 900 | 210px | 480px |

So it is comfortable to about 1280, tight around 1100, and bad below 900 — a
half-screen window on a large monitor. At exactly that point the reader already
has **Ctrl+B**, which reclaims 270px in one keystroke, and the **drag handle**,
which takes the panel to its 360 floor. Between them the narrow case is covered
without a new mode, a new breakpoint, a new control, or a second set of
positioning bugs.

Three more reasons to leave it:

- **The workbench is a review bench on a developer's desktop**, by rule
  ([lab-structure-lab.md](../complete/lab-structure-lab.md)). It is not a responsive
  product and has no mobile story; this would be the only concession to one.
- **Nobody has hit it.** No note, no ticket, no scenario. It comes from a line
  in a mock, not from using the thing.
- **It was the only campaign row nobody could specify** — deferred at proposal
  time and again when the panel was built. A design that resists being written
  twice is usually answering a question nobody is asking.

**Recommendation: do not build. Leave this row as a possible.** If it is ever
picked up, everything below is ready.

## The design, if it is ever wanted

### Closing: decided

**Escape, or a click outside the drawer.** Both. Neither needs new machinery,
which is the pleasant part of the answer.

**Escape is an `overlay`, slot 2.** `src/edit/keymap.ts` states the precedence
once and calls the order the whole contract:

```
popover → overlay → relaxSelection → deselect
```

A drawer is a thing you are *in*, so it backs out before the ladder widens the
selection — the same tier as the selection tray and the command palette. No new
tier, and `key-scope.test.ts` needs no edit. **That test staying untouched is
the evidence the design is right**; if it needs changing, the drawer is not an
overlay and this analysis is wrong.

It also settles tray-inside-drawer without a rule. The mechanism that tier
relies on is that **overlays own their own keydown and `preventDefault()` before
the page-level listener runs**, so the ordered list describes what the DOM
already guarantees rather than a branch anyone writes. If both are open,
whichever holds focus consumes Escape — and that is the one you just opened.

**Click-away reuses the palette's backdrop.** `<mnx-command-palette>` already
spans its overlay with a `.backdrop` and `@click=${() => this.close()}`. Use
that shape rather than an outside-click listener; one pattern, one place to get
the stacking right.

**The dismissing click is swallowed** — it closes the drawer and does nothing
else. Today this is invisible: clicking the score does nothing at all, because
the residue ledger's *"clicking a note to move the selection"* row is still open
and `note-selected` has no consumer. The moment that row closes, a dismissing
click would otherwise close the drawer *and* move the cursor — one gesture doing
two things the reader asked for once.

### Opening: recommended, not decided

A drawer closed by default needs an opener, and the design draws none.

**The tab strip stays.** Below the breakpoint the body and footer slide away and
the five tab labels remain pinned to the edge as a thin rail; tapping one opens
the drawer on that tab. It reuses a control that already means "show me this",
keeps the narrow layout's *addressing* identical to the wide one's (the way to
the HUD is to press `hud`, at any width), and spends no keystroke — the free-key
budget belongs to the element-ops campaign, and `Ctrl+B`'s symmetry is a
tempting-looking answer that would spend a key on a mode most sessions never
enter.

Left open: whether the strip runs along the top edge or down the right, and
whether the drawer animates or simply appears.

## What to keep even if this is never built

Two findings outlive the feature, which is the main reason this doc exists:

1. **Any future overlay gets Escape for free.** The `overlay` tier is not
   tray-and-palette-specific; it is the slot for "a thing you are in". A new
   overlay needs no keymap change and no arbitration code — it needs to own its
   keydown. Worth knowing before someone adds a fifth tier.
2. **A dismissing click should be swallowed**, and that is worth deciding
   *before* `note-selected` gets a consumer rather than after, because
   afterwards it presents as an intermittent "the cursor jumped" bug.

## Not this

- **Not a second panel.** Same tabs, same bands, same state; only positioning
  changes. If a drawer ever needs different content, the breakpoint was the
  wrong idea.
- **Not a mobile layout.** The rail, the head and the score all assume a
  desktop.
- **Not a change to `PANEL_MIN`.** 360 stays the docked floor; the drawer is
  what would happen *below* it, driven by the viewport rather than the drag
  handle, which cannot reach there.

## Verification, if built

- Goldens unaffected (chrome only); the campaign's standing argument applies.
- `key-scope.test.ts` passes **unchanged** — see above.
- Hands-on over CDP at a narrow viewport: the breakpoint crossed both ways
  without losing the active tab, Escape with the drawer alone, Escape with the
  tray open inside it, a click on the score dismissing without selecting, both
  themes.
- One specific regression to watch: the setup popover is a page-level overlay at
  bottom-left of `.main` and the tray docks bottom-centre. A right-anchored
  drawer must cover neither, or the reader can open a popover they cannot see.
