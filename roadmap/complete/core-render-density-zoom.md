# Configurable render density / zoom levers

> **Status: COMPLETE 2026-08-15.** Both axes this doc could honestly finish are
> shipped — horizontal density (2026-08-14), uniform zoom and the control
> surface ([core-zoom-density-pad.md](core-zoom-density-pad.md), 2026-08-15),
> and on the same day the two corrections below that came out of *using* the
> pad. The third axis, **vertical density**, was never started here and is
> handed on whole to [core-vertical-density.md](../complete/core-vertical-density.md)
> rather than kept as an open line on a doc whose other work is done.
>
> **Closing increment 1 — the floor moved 0.5 → 0.02.** Ruling 1 of the pad doc
> reserved this retune for its own evidence, and using the control supplied it:
> on `twelve-bar-blues` at the workbench's own line width, 0.5 and 0.25 both
> pack into three systems, 0.1 into **two**, and 0.02 puts a **seventh bar on
> the first system**. Each of those is a page turn's worth of music. The old
> floor was bounding the *control*, not legibility — it stopped a reader well
> short of what the engraver draws perfectly well (both settings checked in the
> browser).
>
> 0.02 is not an arbitrary "very small": it is where **packing bottoms out**.
> Springs shrink and rigid columns do not, so a line ends up holding every bar
> its notehead columns will fit and no lower value adds another — nine bars on
> the first system at 80sp, unchanged at a quarter of the floor, and that is
> the assertion in the harness. Below it the knob is not inert, which is why a
> floor still exists at all: what keeps changing is *raggedness*, since springs
> that short can no longer reach the right margin within `MAX_STRETCH`, so
> tightening only draws the same bars narrower with more white at the end of
> the system. The ladder honestly reports those values as distinct; they are
> simply not worth offering. (First cut of this retune stopped at 0.1 and was
> argued from "the model runs out on its own" — measuring the ladder's bottom
> showed it doesn't, and the reasoning was corrected rather than the number
> being quietly kept.)
>
> The other cost at the bottom is *proportional* notation: springs carry
> duration, so below ~0.2 a quarter's space and an eighth's are no longer
> distinguishable and rhythm is read from noteheads and beams. That is a trade
> a reader on a tablet is allowed to make; it is not one a constant should make
> for them. The collision guarantee is untouched — density never scales a rigid
> column, at any value.
>
> **Closing increment 2 — the density ladder, and it is the more interesting
> one.** The reported symptom was that clicking *tighter* usually did nothing.
> It was not a control bug. Every horizontal coordinate is
> `spring × densityH × stretch`, and inside the justifier's linear range
> `stretch` is inversely proportional to `densityH` — so tightening the springs
> and stretching them back are **the same operation**, and the engraving is
> *exactly* unchanged. Density only bites where it moves a barline to another
> system, or where a row is against `MAX_STRETCH`/`MIN_SQUEEZE` and the
> proportion breaks. Most of the range is therefore degenerate, and a control
> stepping a flat 4% spends most of its clicks there.
>
> So the engine now answers the question directly. `packSystems()` is the
> packing pass, factored out of `planHorizontal` (which now *calls* it — not a
> parallel copy; the corpus goldens are the proof it moved nothing), and
> `densityLadder()` re-packs a ready-made input across the range to return
> **every density that draws something different**. It rides out through
> `LayoutResult.packings` → `RenderOutcome` → the element's `densitySteps()`,
> and the pad's ← → arms walk *that* — the next rung at least the design's 4%
> away, so a dense ladder never turns a 4% step into 1%. An arm greys when it
> has nothing left to reach, which can happen inside the engine's range; the
> chip says `TIGHTEST`/`WIDEST` there and keeps `MIN`/`MAX` for the real clamp,
> because claiming a wall that isn't there would be the same dishonesty the
> chip was built to fix.
>
> Verified in a real browser over CDP: on `twelve-bar-blues`, six consecutive
> tighter clicks each changed the engraving (1.00 → 0.71 → 0.67 → 0.40 → 0.36 →
> 0.32 → 0.28, every SVG distinct), widening retraced the same rungs exactly,
> the bottom arm greyed at 0.10 and a drag to it read `SPACE 10 MIN`, the top
> arm greyed at the ladder's last rung — 1.23 at that line width — reading
> `SPACE 123 WIDEST`, and all three views produce a ladder. In the harness (`zoom-density.test.ts`, +5 tests, mutation-checked):
> the ladder is swept at its own resolution across three line widths with
> **zero** missed changes and **zero** flat rungs, and the reported bug is
> pinned as a test — a 4% step off the default engraves identically, byte for
> byte.
>
> Goldens byte-identical throughout; 675 tests, `npm run build` and
> `check:boundaries` green.

<details>
<summary>The status through 2026-08-15, before the close</summary>

> **The HORIZONTAL axis built 2026-08-14.** Unblocked by
> [core-viewer-surface.md](../complete/core-viewer-surface.md)'s layering rule, which
> settled where the levers live. Shipped: `PlanOptions.densityH` (a multiplier on the
> springs, clamped 0.5–2), threaded through `layoutNotation`/`bothSystem` and both
> renderers, bound by the element as `density="compact|normal|spacious"` — a preset,
> because the element binds behavior rather than implementing it, and these are the
> three values worth naming (a numeric `density-h` can widen the vocabulary later
> without breaking anyone).
>
> **Springs only, never the rigid columns.** A notehead, an accidental stack and a
> clef occupy the width they occupy at a given staff size; squeezing those would be
> shrinking the music, i.e. zoom wearing density's name. That invariant is asserted
> (`harness/conformance/viewer-surface.test.ts`: the clef anchor's offset is identical
> at every density) and confirmed in the browser — glyph font-size stays 40px from
> compact to spacious while the music repacks.
>
> Density is applied in ONE pass over the finished metrics, before anything reads a
> spring: scaling at the four `springSp()` call sites would rely on them staying in
> step, and scaling at consumption would desync the per-event cursor from the measure
> widths, since both read springs independently. Default (`1`) is byte-identical to
> today's engraving — asserted, and the corpus goldens never moved.
>
> **Zoom landed 2026-08-15**
> ([core-zoom-density-pad.md](../complete/core-zoom-density-pad.md)), and with it the
> control surface for both shipped axes. The fit-to-width vs pinned-scale choice this
> doc flagged as "a real choice rather than a wiring job" was decided **fitted until
> first touched**: `zoom` is `number | null`, unset sends no `pxPerSp` so the renderer
> still fits, and the element reports what it actually used via `render-scale` so a
> control can print a true number instead of assuming 100%. `density-h` added the
> numeric form this doc reserved. That item also found and fixed a real gap — the
> standalone **tab** view never received `densityH` at all, so `density=` had been
> silently ignored on tab-only scores since the axis shipped.
>
> **Remaining: the vertical axis only.**
> Deliberately not started, on this doc's own advice: `ROW_HEIGHT_SP` is
> a module-level constant derived from the row pads, so per-layout scaling is a real
> refactor — and the note below says the stem-length clamp should land first or
> alongside, since stem headroom feeds vertical spacing. It also needs a **control of
> its own**: the pad's four arms are spent on the two shipped axes, a cut that item
> recorded rather than worked around.

</details>

## The goal

Let the viewer expose **density** as a first-class, configurable dimension of rendering:
horizontal and vertical "zoom" levers so a reader can **see more music on less page, or
less music with more room** — the digital-score equivalent of pinch-zoom, but musically
aware. As people play from screens/tablets, adjustable density (fit-more-bars vs.
easier-to-read) is a core affordance, not a nicety.

Three distinct axes, deliberately separated:

1. **Uniform zoom** — scale everything together (glyphs + spacing). Already trivial: the whole
   layout emits **staff-space (sp) units** and the SVG emitter multiplies by a single
   `pxPerSp`. A zoom control is essentially a `pxPerSp` knob today.
2. **Horizontal density** — bars-per-system / note spacing *without* shrinking glyphs. This
   lives entirely in [src/layout/spacing.ts](../../src/layout/spacing.ts) — the deterministic
   springs-and-rods model whose named knobs (log₂ duration springs, min column widths,
   justification cap) already own all horizontal geometry. A horizontal-density lever scales
   the spring softness / minimum spacing, so tighter = more bars per line.
3. **Vertical density** — systems-per-page / whitespace *without* shrinking the staff. This is
   the layout's vertical padding/gap constants in [src/layout/notation.ts](../../src/layout/notation.ts)
   (`ROW_PAD_TOP_SP`, `ROW_PAD_BOTTOM_SP`, `INTER_STAFF_GAP_SP`, lyric spacing) plus stem-length
   / collision headroom. Tighter = systems pack closer.

## Why the architecture already fits

- **Everything is in sp units** → uniform zoom is one scalar; nothing in layout hard-codes px.
- **All horizontal geometry is centralized** in `spacing.ts` (CLAUDE.md: "tune spacing via the
  named knobs, never per-renderer grid math") → horizontal density = parameterize those knobs.
- **Embeddable + themed via `--mnx-*` custom properties / attributes** (see `embed.html`) →
  density levers are a natural fit for the same attribute/custom-property surface (e.g.
  `density="compact"` or `--mnx-h-density` / `--mnx-v-density`), and a named container query
  already drives compact embed chrome.

## Open questions (design later)

- ~~Presets vs. continuous sliders vs. both?~~ **Presets first** — the element binds
  a multiplier the engine owns, so presets are names for numbers and a numeric
  attribute stays open without a breaking change.
- ~~Do the three axes couple or stay independent?~~ **Independent in the engine**
  (three scalars), and the user-facing control may couple them later if a reader
  wants one "fit more music" knob. Coupling is reversible; conflating them in the
  engine would not be.
- ~~Where do they live — viewer toolbar, embed attributes, `RenderOptions`, or all three?~~
  Answered by [core-viewer-surface.md](../complete/core-viewer-surface.md): all three, layered — the lever enters
  `RenderOptions` (behavior ground truth), the element binds it as an attribute, the
  toolbar composes the attribute.
- ~~Interaction with justification (does horizontal density change the justification target, or
  the pre-justification spring plan)?~~ **The pre-justification spring plan — and the
  consequence is the whole story of this axis.** Justification then hands the width straight
  back: `stretch` is inversely proportional to `densityH` in its linear range, so the two
  cancel *exactly* and density is invisible until it repacks a system. That is not a flaw to
  fix (the alternative — density moving the justification target — would mean tightening a
  score and getting ragged rows instead of more bars, which is the opposite of the goal). It
  is a fact a **control** has to know, and `densityLadder()` is how it knows: see the closing
  status above.
- Adjacent engraving refinements that affect vertical rhythm should land first or alongside —
  e.g. the stem-length "reach-to-the-middle-line" clamp (currently a fixed `STEM_LENGTH_SP`),
  since stem headroom feeds vertical spacing. **Carried to
  [core-vertical-density.md](../complete/core-vertical-density.md)**, which owns that axis now.

## Not this

Not a reflow/pagination engine and not print layout — just density levers over the existing
single-flow renderer. Pagination (page breaks, margins) is a separate, later concern.
