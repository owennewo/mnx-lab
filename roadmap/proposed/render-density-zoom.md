# Configurable render density / zoom levers

> **Status: proposed (2026-07-17), not started.** A user-facing goal, not yet designed.

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

- Presets (`compact` / `normal` / `spacious`) vs. continuous sliders vs. both?
- Do the three axes couple (a single "density" control) or stay independent (H / V / zoom)?
- Where do they live — viewer toolbar, embed attributes, `RenderOptions`, or all three?
- Interaction with justification (does horizontal density change the justification target, or
  the pre-justification spring plan)?
- Adjacent engraving refinements that affect vertical rhythm should land first or alongside —
  e.g. the stem-length "reach-to-the-middle-line" clamp (currently a fixed `STEM_LENGTH_SP`),
  since stem headroom feeds vertical spacing.

## Not this

Not a reflow/pagination engine and not print layout — just density levers over the existing
single-flow renderer. Pagination (page breaks, margins) is a separate, later concern.
