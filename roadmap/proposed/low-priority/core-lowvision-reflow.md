# Reflow at high staff scale — should the line width know how big the ink is?

> **Status: PROPOSED 2026-08-21.** Split out of the same session that raised
> the staff-scale ceiling to 640% and the density ceiling to 8 for low-vision
> readers. That change is landed and works; this is the one gap it leaves, and
> it is a decision rather than a defect.

## The gap, measured

The horizontal axis is always **fitted**: `ScoreViewer` sends no `pxPerSp`, so
the plan is laid out to the viewport width and `fitPxPerSp` floors the scale at
the 10px/sp baseline. Staff scale then multiplies only the ink. With rigid
columns priced on the ink scale ([core-ink-priced-columns.md](../../complete/core-ink-priced-columns.md))
nothing collides — but the system gets wider than the line it was packed for:

| setting | system width vs line | what the reader does |
|---|---|---|
| staff 640%, density 1 | **×2.6** | scrolls sideways, every system |
| staff 640%, density 8 | **×1.1** | scrolls down; one bar per system |

So the two arms together already give the accessible reading mode, and the
conformance suite pins exactly that. The gap is that the reader has to know to
use *both* — pushing only the vertical arm, which is the obvious thing to do
when you want things bigger, gives sideways scrolling per system, which is the
worst reading experience of the three.

## The question

Should the plan's line width be measured in **ink**, so that growing the ink
reflows the music (fewer bars per system) instead of overflowing it? Concretely:
`widthSp = viewportPx / pxPerSp / inkRatio`, computed before packing.

**For:** it makes the vertical arm alone do the right thing, which is what a
low-vision reader will actually reach for. It is what proportional zoom means
everywhere else. And the reader's real intent — "make this bigger and keep it
readable" — is one intent, exactly the shape of argument that produced the
original pad coupling.

**Against, and this is the live tension:** it re-couples the axes that
[core-zoom-density-pad.md](../../complete/core-zoom-density-pad.md) ruling 2
deliberately separated, and that
[core-ink-priced-columns.md](../../complete/core-ink-priced-columns.md) went out
of its way to keep separated by freezing packing at ratio 1 so bars never jump
systems under the vertical arm. It would also reverse the *direction* of the
2026-08-21 pad-decoupling ruling (vertical zoom must not move horizontal
things) — though note it reverses the mirror image of it, not the ruling
itself: that ruling banned a *horizontal* value moving *vertical* space.
Whether "vertical zoom may re-wrap the music" is the same mistake or its
opposite is precisely the thing to decide.

## Options

1. **Do nothing.** Document that low vision wants both arms; possibly have the
   pad hint it. Cheapest, and the measured numbers say the outcome is already
   good when both are used.
2. **Reflow above a threshold** — ink-measured line width only past, say, ratio
   2. Keeps every ruling intact in the normal range and fixes the extreme.
   Discontinuity at the threshold is the cost.
3. **Always ink-measured line width.** Cleanest rule, biggest reversal; every
   multi-system golden's packing moves at non-square scales only (goldens are
   square, so the corpus would not move — worth confirming).
4. **Couple in the control, not the engine** — the pad raises density as staff
   scale rises. Reversible, no ruling touched, and it is where the last two
   couplings were argued to belong. Least principled, most easily undone.

Option 4 has the best precedent (`padDensityFor` lived exactly there) and
option 2 the best behaviour; they are not exclusive.

✔ when: a decision is recorded with its reasoning, and if it is 2 or 3, the
packing-freeze clause of core-ink-priced-columns.md is amended rather than
quietly contradicted.
