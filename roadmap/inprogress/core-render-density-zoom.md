# Configurable render density / zoom levers

> **Status: in progress — the HORIZONTAL axis built 2026-08-14.** Unblocked by
> [core-viewer-surface.md](../inprogress/core-viewer-surface.md)'s layering rule, which
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
  Answered by [core-viewer-surface.md](core-viewer-surface.md): all three, layered — the lever enters
  `RenderOptions` (behavior ground truth), the element binds it as an attribute, the
  toolbar composes the attribute.
- Interaction with justification (does horizontal density change the justification target, or
  the pre-justification spring plan)?
- Adjacent engraving refinements that affect vertical rhythm should land first or alongside —
  e.g. the stem-length "reach-to-the-middle-line" clamp (currently a fixed `STEM_LENGTH_SP`),
  since stem headroom feeds vertical spacing.

## Not this

Not a reflow/pagination engine and not print layout — just density levers over the existing
single-flow renderer. Pagination (page breaks, margins) is a separate, later concern.
