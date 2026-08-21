# The density ladder is computed on a square page

> **Status: PROPOSED 2026-08-21.** Found while chasing a report that the
> spacing arms do nothing at a large staff scale
> ([core-ragged-last.md](../inprogress/core-ragged-last.md) appendix fixed the
> half of that which was a real engraving defect). What is left is this: the
> ladder answers about a page the renderer does not draw.

## The gap

`densityLadder` re-packs `PackingInput`, and `PackingInput` is captured
**before ink pricing** — deliberately, so row membership stays square
([core-ink-priced-columns.md](../complete/core-ink-priced-columns.md), and
`planHorizontal` says so at the capture site). Under an ink ratio the drawing
then diverges from the ladder's model in both directions:

- **The ladder claims changes that are invisible.** At staff 640%, tab view,
  1440px window: rungs at 0.85 / 0.82 / 0.78 draw pages 1868px and 1866px wide
  — two pixels apart on a 1868px page.
- **The ladder misses changes that are visible.** 0.10 and 0.18 sit inside one
  run — the ladder calls them the same engraving — and draw 2739px and 2754px.

Both come from the same place: under pricing the engine re-derives each
measure's governing voice (`voiceRigid + voiceSpring` picks a different voice
once rigids grow), so the priced page's rigid AND spring naturals differ from
the square ones the ladder holds.

## Why it is not a one-line fix

A priced `PackingInput` is not well defined at density 1. The ink pass runs
*after* the density pass, and the governing-voice comparison reads the
density-scaled spring — so "the priced naturals" depend on the density you
priced at. An exact ladder would have to re-derive event columns per grid
value (~800 `planHorizontal` runs), against the ~800 cheap re-packs it does
now, and the ladder is computed per paint.

## Options, roughly costed

1. **Do nothing, and say so.** The axis is honest at ratio 1 (every staff scale
   the fit chooses) and approximate above it. Cheapest; the arms still walk
   real packing changes up there, because packing is square by design.
2. **Price the packing at the paint's density.** Capture a second
   `PackingInput` after the ink pass and scale its springs by `d / dPaint` when
   re-packing. Wrong only in the governing-voice second order, and exact at the
   density you are actually looking at — which is where a control's next click
   lands. Probably the right trade.
3. **Re-plan per rung.** Exact, and roughly 100× the cost. Would need caching
   per (document, width, ratio) to be viable at all.
4. **Perceptual tolerance in `packingSignature`.** Quantize the drawn quarter
   gap rather than the multiplier, so sub-0.05sp differences stop counting.
   Orthogonal to 1–3 and worth doing anyway — it is what stops a rung meaning
   "two pixels".

## Not this

Not re-coupling the axes — that is [core-lowvision-reflow.md](core-lowvision-reflow.md)'s
question, and it is a different one: reflow asks whether the LINE should be
measured in ink, this asks whether the LADDER should be.
