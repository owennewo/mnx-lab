# Ink offsets are a field, not a convention

> **Status: BUILT 2026-08-21.** The structural half of a bug class that had
> already been fixed four times by hand and kept coming back: the rigid columns
> ([core-ink-priced-columns.md](core-ink-priced-columns.md)), the note
> clusters, the tab fret mask, and — the one that prompted this — the compound
> barlines, whose two strokes had come to **overlap** at 640% staff scale and
> drew as a single fat line.

## The class

Every horizontal distance in a layout is one of two currencies:

- a **musical position** — where an event sits on the line. Scales with the
  horizontal scale, because the spacing plan decided it.
- an **ink offset** — the distance from a position to a mark, or between two
  marks: half a notehead, a stem anchor, the gap between the strokes of a
  double barline. This is ink, and ink scales with the **vertical** scale so
  it stays proportional to the staff.

Written into `x`, an ink offset is scaled as a position and the mark drifts
away from what it belongs to as the staff grows. Measured on the reported
case at 640% on a fitted line: strokes 6.4px wide, separated by 3px of
position-scaled gap — 3.4px of overlap.

Only the horizontal axis can be got wrong. A vertical position and a vertical
ink offset both scale with the vertical scale, so they coincide.

## Why it kept coming back

Two reasons, and the second is the important one.

1. The fix was "multiply by `inkRatio` at this site", applied by hand, with
   nothing to force it. Four sites found, each by a human noticing a
   screenshot.
2. **The corpus cannot see it.** Every committed golden is rendered at a
   square scale, where the ratio is 1 and the mistake is arithmetically a
   no-op. The goldens are the crown jewels and are structurally blind to this
   entire class.

The primitive model already carried a one-off patch of exactly this shape —
`RectPrim.spanW`, a flag meaning "this width is a span, not ink", added when
the same bug bit the multirest bar. One field, one flag, no generalisation.

## What was built

**The currency is in the type.** `dx` on glyph/text/rect, `dx1`/`dx2` on line.
The emitter computes position × horizontal + offset × vertical, so the call
site decides the currency by which field it types into:
`{ x: barlineEnd, dx: -gapSp }`, never `x: barlineEnd - gapSp`.

**The barlines use it** — every style in `barlines.ts`, and the repeat clusters
in `notation.ts`, which had the same bug in their thin stroke and their dots.

**The non-square sweep** (`harness/conformance/non-square-scale.test.ts`)
renders the corpus at ratios 1, 4 and `MAX_STAFF_SCALE` and asserts
relationships rather than coordinates — a coordinate at ratio 4 is not
reviewable by a human, but "a barline cluster is pure ink, so its extent
scales with the ratio" is, and no scale may break it. It carries its own
counterfactual: the same strokes recomputed in the old currency, asserted to
overlap.

The assertions are deliberately stated as **comparisons against ratio 1**. An
absolute claim ("the strokes never touch") trips over things that have nothing
to do with scale — coincident group barlines in `spec/orchestral-layout`, where
`spec/repeats` anchors a repeat cluster — which are the same at every scale and
are a different argument. Scale-invariance isolates exactly the bug this file
exists for.

## Two things worth keeping

**Goldens did not move — and nearly did.** Splitting `x - gap` into `x` and
`dx` changes no coordinate a reader can see, but it changed the serialized
*representation*: 99 primitives files, and 59 SVGs by float noise in the
fifteenth digit, because the golden rounds `x` and `dx` separately and the
emitter re-adds them. That would have demoted 54 human approvals for nothing.
`rounded()` in `headless.ts` now folds every ink offset into its position
before rounding — lossless at the square scale goldens are rendered at — so a
golden stays a statement about the engraving rather than about the engine's
internal representation.

**The migration is partial, on purpose.** The three earlier fixes remain
hand-priced (they multiply by `inkRatio` and produce an absolute `x`). They
are correct, they are covered by their own assertions, and rewriting ~40 call
sites in `notation.ts` would be churn with real regression risk and nothing to
show for it. What the field buys is that *new* code cannot make the mistake,
and the sweep catches it if it does. Migrate opportunistically when a site is
being touched anyway.

## Not this

- **No `dy`.** Vertical positions and vertical ink offsets scale together; the
  asymmetry is horizontal only.
- **Curves keep hand-priced endpoints** (`emitSlursAndTies`). Fewer sites, and
  `points[]` would need a parallel offset array to express it.

## Appendix (2026-08-21): the other end of the range

The same screenshot pair that produced this doc also showed the barlines going
faint at a SMALL staff, and the first reading was that it was the same bug
mirrored — vertical zoom changing a horizontal dimension. It is not, and the
distinction is worth keeping.

A barline's thickness *is* ink, so it scales with the staff, and that is
correct: staff-line thickness uses the same scale, so the two always match, and
the alternative (thickness following the horizontal scale) gives a big bold
staff strung with hairline barlines. The principle is **ink scales with the
staff, positions scale with the line** — not "vertical never touches
horizontal".

What was actually wrong is that ink runs out of PIXELS before it runs out of
correctness. At 60% a tab staff line and a tab barline are both 0.1sp × 6px/sp
= **0.60px**, which a renderer can only draw as grey. The giveaway was in the
screenshot: the staff lines were exactly as faint, which no barline-specific
bug could cause.

So `svg.ts` floors every stroke at one device pixel (`MIN_INK_PX`). It changes
no position, fires only below ~100px/sp of staff, and cannot move a golden —
they emit at 16px/sp where the thinnest ink is 1.6px. It also cannot re-close a
compound barline: flooring widens a stroke about its own centre, but at the
bottom of the supported range the double barline still keeps 0.8px of clear
space, and the two would only meet below ~33% staff scale, which
`MIN_STAFF_SCALE` never reaches. All three claims are asserted, the last one
against the very geometry this doc's main change fixed.
