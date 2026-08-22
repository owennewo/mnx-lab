# The chip is one rung of the ladder

> **Status: COMPLETE 2026-08-22**, against the Claude Design spec *"SPEC · v1 —
> SELECTION MODE CHIP → TRAY"*, drawn 1:1 over crops of this build. Supersedes
> the tab-strip half of
> [core-selection-tray-visuals.md](core-selection-tray-visuals.md)
> and gives [workbench-rung-legibility.md](workbench-rung-legibility.md)'s
> chip its ▲▼ pair. **No golden moved** — this is workbench chrome only, so
> there is no debt for [lab-verify.md](../inprogress/lab-verify.md).

## The problem

The rung chip and the selection tray were built two days apart and did not
know they were the same object. Closed, the selection's level read as a
lowercase mono word in a small box under the selection. Open, that word
reappeared **re-cased to `NOTE`** in an uppercase tab strip across the tray's
top, at a different size, in a different typeface, several pixels to the right
of where it had been. Nothing carried across the transition, so opening the
tray read as *a panel appeared* rather than *the thing I was looking at grew*.

The spec's thesis, and the whole of this item: **closed, the chip IS the
current rung.** Everything follows from taking that literally.

## Decisions

- **The scope selector is a vertical ladder column, not a tab strip.** 74px at
  the tray's leading edge, lowercase mono rungs at the chip's own 8px indent,
  the current one lit with a 2px accent edge and `--accent-fg` type on
  `--row-current`. An uppercase tab row cannot contain the chip's word without
  re-casing it, which is the one thing the transition may not do.
- **Four things survive the open**: the word, its x position, its box (same
  padding rhythm, same height to within a pixel), and the red. The tray's left
  edge lands on the selection's left edge exactly as the chip's did, so the
  ladder column occupies the chip's own x.
- **The ladder reads narrowest-first** — `note` at the top, `global` at the
  bottom — because that is what lets the ladder *unroll downward out of the
  chip's box* in the common case, which is the spec's drawn geometry. It is
  the HUD's column inverted, and see the open question below.
- **The chip grows a ▲▼ pair, and it is the ladder.** A 16×11 stacked pair on
  the chip's outer edge, drawn only on hover or focus — idle, the chip is one
  lowercase word at 0.75 opacity. ▲ climbs, ▼ descends, and both walk through
  the same `walkToLevel` the ladder's rungs and the HUD's rows already use, so
  ▲ and clicking `voice` in the open tray are literally the same act and land
  in the trace as the same ladder move.
- **The exhausted end greys to 40% rather than disappearing**, so the chip
  never changes width as the ladder is climbed. Hovering either button prints
  the destination as a tag on the chip's far side: *the label is the whole
  affordance*, so nobody has to learn what a triangle means.
- **Edge-anchoring, never centring.** Prefer left. If the tray's right edge
  would pass the score's right edge minus 16px — and there is genuinely room
  to the left — the whole object mirrors: chip right edge on the selection's
  right edge, ▲▼ to the left of the word, ladder column to the right of the
  tiles, rung text flush right, accent edge on the right. The tiles grow
  leftwards into the room that exists.
- **The side is decided by the PAGE, once, and held.** `ScenarioPage` owns
  `mirrorAt()`; the closed chip asks it every render (closed, it is free to
  follow the selection), and `openTray()` snapshots the answer into
  `trayMirrored`, which the tray consumes as a property. The spec forbids
  flipping mid-interaction, and the chip and the tray cannot be allowed to
  disagree about the side — they are one object.
- **The connector shrinks from 30px to 8px.** The tray now sits one small gap
  below the selection's lower bound and the shaft fills exactly that gap, so
  the ladder grows out of the selection instead of dangling from it. The
  plinth is gone with it — at 8px there is nothing left to cap. Flipped above,
  the shaft becomes a capital on the tray's top edge and the ladder still
  reads top-to-bottom.

## What the spec was not followed on, and why

- **The tile panel is 396px, not the drawn 222px.** The spec's panel held the
  six tiles it mocked. Our `event` scope carries **eighteen** (and four other
  scopes carry 7–11), so at the drawn three columns the tray runs six tile
  rows past the bottom of its own ladder and outgrows the score pane it floats
  over. The panel keeps the 470px total the previous tray established — five
  columns of the spec's **own** 60px tiles, 6px gap, 9px padding — and every
  other metric in the METRICS cell is the spec's exactly.
- **The search line stays.** The spec draws meta bar + tiles and is silent on
  the rest; the second-`/` widen gesture and type-to-search are live
  functionality, not decoration, and removing them was not what the spec
  asked for.
- **The hover readout band goes, replaced by a tooltip.** The band spent a
  whole row printing a label and a shortcut, and the shortcut is already
  stamped on every tile — so it was spending a band on the label alone. The
  tooltip answers the **keyboard cursor** as well as the pointer, which a
  native `title` cannot, or the keyboard path would lose information the
  pointer path keeps.

  One thing had to be learned by looking at it: a cursor always sits
  *somewhere*, so a naive `.cursor .tip` rule leaves the tooltip standing open
  over the meta line for the entire life of the tray — which is not what a
  tooltip is. `cursorMoved` fixes it: the cursor captions itself only once it
  has been **moved**, never merely for defaulting to the first tile on open.
  The ring already says where Enter lands; the *name* is what you ask for by
  navigating.

## Open questions the spec raised, and one it did not

Kept from the spec's own OPEN QUESTIONS cell, unresolved and deliberately so:

- Whether **`global` belongs on the ladder at all** — it is not a selection
  scope, and ▲ walking into it means the micro buttons can leave the score
  behind. Today it is the last rung and `committable: false`, which is the
  status quo from
  [core-selection-tray-global-tab.md](core-selection-tray-global-tab.md).
- Whether rungs **above** the current one should show a count of what they
  would select (`bar · 4 events`), which would help the preview state but
  roughly doubles the column's width.

And one the spec did not raise, found in the building:

- **▲ moves the highlight DOWN the drawn column.** The spec states the climb
  order (`note → event → … → global`) and draws the ladder note-at-top, so
  the two together mean the up-triangle walks downward. It is internally
  consistent — ↑/↓ in the tray match the chip's ▲▼ exactly, and both match the
  existing Shift+↑/↓ widen/narrow keys — but it is the **inverse of the HUD's
  column**, which lists `score` at the top and where widening moves the
  highlight up. Two ladders on one screen now run opposite ways. Implemented
  as drawn, because the spec is emphatic and draws it twice; flagged here
  because whoever reviews it hands-on may well decide the HUD's direction
  should win instead, at which point the fix is one `reverse()` and the
  ArrowUp/Down mapping beside it.

## What changed

- `src/workbench/SelectionTray.ts` — the tab strip becomes `.ladder`; `TrayTab`
  → `TrayRung` and `tabs` → `rungs`, with `tray-tab-*` events renamed to
  `tray-rung-*` (the vocabulary is load-bearing here); a `mirrored` property;
  the readout band removed and a tooltip added; the plinth removed; the shaft
  and every tile/meta/search metric moved to the spec's numbers.
- `src/workbench/ScenarioPage.ts` — the chip becomes a three-button group
  (word + ▲ + ▼) with a destination tag; `mirrorAt()` and `chipNeighbours()`;
  `mainWidth` tracked beside `mainHeight` for the mirror test; the tray's
  width, gap and shaft height imported from the component rather than
  restated.

Both files still consume tokens only — no colour literals, no local
`designTokens` — so the tray went dark and light on the first try and
`harness/conformance/design-tokens.test.ts` stays green.
