# The selection tray's global tab — one command surface, not two

> **Status: BUILT 2026-08-15, same day as proposed.** Shipped: the
> `CommandScope = SelectionLevel | 'document'` axis (`rungs` → `scopes`
> throughout the registry), nine document-scope commands, the always-present
> `global` tab with the page's own chrome tiles (copy trace, revert) joining
> it under a `page:` prefix the page dispatches itself, `//` retargeted to the
> tab rather than the palette, and **Ctrl+Shift+K retired** from
> `SHELL_BINDINGS` and `KEY_DOCS`. Verified over CDP: the tab row reads
> note · event · voice · part · bar · section · score · **global**, `//`
> lands on it, "Append a bar" fired from it takes the score 8 → 9 bars with
> the tray staying open, and Ctrl+Shift+K now does nothing. 625 tests green.
>
> One thing the build taught: the global tab must be **non-committable**. The
> tray computed "a scope is being previewed" from *any* tab that is not the
> one holding the selection, so `global` inherited the "↵ to widen selection"
> hint — and Enter then silently did nothing, because there is no rung to
> walk to. `TrayTab` grew a `committable` flag: a tab outside the ladder is a
> place to run commands, not a scope to select, and Enter there fires the
> focused tile instead.
>
> Originally proposed 2026-08-15. A fourth item behind the tray trio —
> [visuals](../complete/core-selection-tray-visuals.md) (complete),
> [mechanism](../inprogress/core-selection-tray-mechanism.md) (stages 1–4 built),
> [residue](core-selection-tray-residue.md) (the ledger). Raised from a
> question asked while using the tray: should the command palette simply be
> another tab?
>
> The answer this doc argues is **half yes, and the half matters** — which is
> only visible once you notice that the palette is already two things.

## What the palette actually is

One widget, two jobs, told apart by a prefix:

| Query | Job | Shape |
|---|---|---|
| `>` … | **commands** — undo, redo, add bar, staff kind, the setup popovers | a small fixed set |
| bare text | **destinations** — 106 scenarios, bars in this score, `def:` objects | a ranked, unbounded finder |

Those are not the same kind of thing, and the merge question has a different
answer for each. Treating "the palette" as one object is what made the
question look like a coin flip.

## The ruling

**The command half becomes a tab in the tray. The destination half stays on
Ctrl+G.**

The line that falls out is short enough to say in one breath, which is the
best evidence it is the right one:

> **`/` is commands, escalating outward. Ctrl+G is destinations.**

### Why the commands belong in the tray

- **The design spec already put them there.** Its command-registry note reads:
  *"Global commands are the same registry with scope `document`, excluded from
  the tray body and reachable through search."* The scope axis was designed;
  this doc only promotes it from a search filter to a visible tab.
- **It completes the ladder.** The tabs are the containment chain — note →
  event → voice → part → bar → section → score. What contains the score is the
  document. A `global` tab is the top rung, not a special case, and arrowing
  `↑` past `score` reaching it is exactly the gesture the ladder already
  teaches.
- **The tray already has the right presentation.** Global commands carry
  labels and values rather than distinctive glyphs, which is the **rows
  variant** the part tab already uses.
- **It makes the escalation one surface.** `/` opens on the selection; a second
  `/` currently *switches widgets*. With the tab it moves one step outward and
  stays put — the same gesture, a better destination, and no context lost.

### Why go-to does not follow

- **It must work where the tray cannot exist.** The tray needs a session and
  an anchor; go-to has to run on the attention queue and the coverage map,
  where there is no score at all.
- **It is a finder, not a command set.** Ranked, capped, unbounded in
  principle — a different interaction from browsing a grid of verbs.
- **It would blur the distinction that makes the tray legible.** "Commands that
  apply to what is selected" and "search everything" are the two halves of the
  tray's whole claim; folding them together dissolves it.

## What changes

1. **A scope axis in the registry.** `rungs: SelectionLevel[]` becomes
   `scopes: (SelectionLevel | 'document')[]` — the spec's own word. Document
   commands are ordinary rows: id, glyph, label, shortcut, tier, action.
2. **An always-present `global` tab**, appended after the ladder's rungs. Unlike
   the rungs it is never presence-filtered: the document is always there.
3. **The page contributes its own chrome commands** to that tab — copy trace,
   revert — as neutral tiles the page handles itself. `edit/` keeps only editor
   verbs; the tray stays dumb; nothing learns about the other.
4. **`//` switches to the global tab** instead of opening the palette.
5. **Ctrl+Shift+K retires.** The global command list is a tab now, and remains
   reachable off-editor through Ctrl+G's `>` prefix — the palette's existing
   grammar, unchanged.

### Deliberately not changed

- **Undo/redo stay `available` with an empty history.** The tile states mean
  *does this verb exist* (`unavailable` = not built, with a residue row), not
  *would it do something right now*. Ctrl+Z on a fresh document is a no-op
  rather than an error, and the tile should read the same way. Enablement is a
  different axis and would need its own state; it is not worth one.
- **The palette itself.** It keeps go-to, its grammar and its own Escape and
  click-away. Only its `>` half loses its dedicated chord.
- **No new ops.** Every command on the global tab exists today.

## Testing

The joins already written cover this once the scope axis lands: shortcuts
resolve to real bindings, surfaces exist, intent types are ones the session
handles, glyph names carry bounding boxes. Two additions:

- the document scope offers commands, and none of them leak into a ladder rung;
- the rung-vs-cheatsheet agreement test skips `document`, which has no rung and
  therefore no per-rung `KEY_DOCS` meaning to contradict.

## Staging

1. The scope axis and the document commands, with the tests.
2. The tab: always present, page-contributed chrome tiles, rows presentation.
3. The `//` escalation retargeted; Ctrl+Shift+K retired from `SHELL_BINDINGS`
   and `KEY_DOCS`.
4. Hands-on review — the campaign's posture, and the last three items' habit.
