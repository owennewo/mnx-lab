# Modernist: the token contract

> **Status: COMPLETE 2026-08-15**, same day as proposed. Item 1 of
> [core-campaign-modernist.md](core-campaign-modernist.md) — **the contract**. Everything else
> in the campaign blocks on this. Inherits the campaign's shared contract.

## The problem

`src/elements/tokens.ts` and `src/workbench/SelectionTray.ts` describe two different
applications. The token sheet is warm-neutral OKLCH, IBM Plex, a muted slate-blue accent
and seven distinct corner radii; the tray is paper-and-ink, Archivo, one red, and zero
radius everywhere. Both are deliberate, and the split was recorded as temporary when the
tray shipped. This item ends it in the direction the tray chose.

The work is mostly *arithmetic and search-and-replace*. What makes it worth a proposal
is the three decisions underneath: how to say Modernist in the repo's existing
vocabulary rather than pasting the design's, what one accent costs when the old palette
used five, and where the restyle is not allowed to reach.

## Say it in the repo's vocabulary, not the design's

The design bundle ships `--color-neutral-100…900` and `--color-accent-100…900` — machine-
generated OKLCH ramps on a shared lightness scale. **Do not import them.** The repo's
vocabulary is *semantic* (`--bg`, `--surface`, `--line`, `--ink`, `--ink-2`, `--ink-3`),
those names are the contract with the public `--mnx-*` overrides and with every
consumer, and two vocabularies in one sheet is worse than either alone. Numeric ramps
also invite use-site guessing — `--color-neutral-400` means nothing about *what it is
for*, which is precisely the property that lets a palette drift.

So: **map the design's ramp positions onto the existing semantic names**, and add only
what genuinely has no home. About five names:

| New token | Design value | Role |
|---|---|---|
| `--bg-context` | `#faf9f8` | the five-band frame's context bar; also the shared hover fill |
| `--row-current` | `#fce7e3` | current-row fill — ops head, active ladder rung, the tray's active tile |
| `--row-done` | `#dcd9d6` | the resolved / matching left edge |
| `--rule-w` | `2px` | the ink rule width, as one knob |
| `--radius-*` | `0` | see the staging below |

Method, so later values stay in family: hold hue near the neutral axis (the repo
currently sits at 75–88; Modernist's neutrals are a touch cooler, roughly 60–70), keep
neutral chroma at or below 0.005, and derive `--ink-2` / `--ink-3` as **lightness steps
off `--ink` at constant hue and chroma** — which is how the current ramp is already
built. Derive `--row-current` as `color-mix(in oklab, var(--accent), var(--bg) 88%)`
rather than pinning the hex, so a future accent change carries its tint along instead of
leaving a stale pink behind.

Starting points for the conversion, **each to be verified with a converter before
committing** — these are the shape of the answer, not the answer:

| Design hex | ≈ OKLCH | Maps to |
|---|---|---|
| `#f3f2f2` | `oklch(0.957 0.001 90)` | `--bg` |
| `#faf9f8` | `oklch(0.978 0.002 80)` | `--bg-context` / `--surface` |
| `#201e1d` | `oklch(0.243 0.004 60)` | `--ink` |
| `#8a8582` | `oklch(0.602 0.005 60)` | `--ink-3` |
| `#dcd9d6` | `oklch(0.882 0.004 70)` | `--line` / `--row-done` |
| `#ec3013` | `oklch(0.583 0.221 30)` | `--accent` |
| `#fce7e3` | `oklch(0.939 0.024 25)` | `--row-current` (derive, don't pin) |

## One accent, and what it costs

The campaign's decision is **red everywhere** — one value across chrome, the score's
selection enclosure and the status pips. Today `designTokens` composes `scoreTokens`
(`tokens.ts:86`), so a single `--accent` already serves chrome and score; the flip is
mechanically a one-line change and semantically the largest decision in the campaign.

Three bills come due, and this item pays two of them.

**The enclosure meets the error badge.** Fully argued in the campaign doc's tripwire 2:
`diagnostics.ts` hard-codes `validation: '#b91c1c'`, and because it is emitted as a
`fill` attribute it is frozen in 10 committed goldens. So the selection enclosure and
the "you made a mistake" badge will share a canvas and nearly share a hue, and only the
accent is movable.

**The rule this item lands:** selection-red and error-red must be separable by *value*
and by *form*. Form is already handled and should be left alone — a diagnostic badge is
a filled circle carrying a white glyph; the enclosure is a stroked rectangle and a
tinted notehead. Value is this item's job: pick the accent's lightness and chroma with
`#b91c1c` explicitly in view, and check the pair on a real score at the hands-on review
rather than in a swatch. `oklch(0.583 0.221 30)` against `#b91c1c`'s ≈ `oklch(0.505 0.19
27)` is a visible step, but "visible in a swatch" and "unmistakable on a stave at 16px
per staff space" are different claims.

**The embed keeps its own accent.** Contract rule 3. `<mnx-score-viewer>` declares
`viewerTokens` on its own host, and a closer host beats an inherited value, so the
public `--mnx-accent` override surface is untouched by anything this item does to
`designTokens`. Note for whoever writes the code: the comment at `tokens.ts:44-49`
currently asserts the viewer's light values are *identical* to `designTokens`'. After
this item that is false by design. **Rewrite the comment, don't delete it** — it is
load-bearing documentation, and the new invariant is worth stating: *the viewer and the
chrome now deliberately diverge on the accent's provenance; every other light value
stays in step.*

**The queue's five states are the third bill, and item 6 pays it.**
`--st-draft/valid/rendered/verified/gap` encode five queue states in five hues; one
accent cannot express five states, and `--st-verified` (blue) sitting beside a red accent
will read as an accident rather than a signal. That is a change to the workbench's
primary information display and it deserves its own review —
[workbench-queue-pips.md](workbench-queue-pips.md). **This item does not touch the pip ramp.**
Its job is to flip the surface without changing what anything *means*; re-encoding the
queue's semantics inside a repaint is exactly how meaning gets lost.

## Staging

**Stage 1 — tokenize radius. No visual change.** Add the scale the app *currently* uses
— `--radius-pill: 999px`, `--radius-card: 12px`, `--radius-panel: 10px`,
`--radius-control: 7px`, `--radius-tab: 6px`, `--radius-chip: 5px` — and replace the ~35
literals across `tokens.ts`, `ScenarioPage.ts`, `WorkbenchApp.ts`, `QueueHome.ts`,
`ObjectsPage.ts`, `CommandPalette.ts`, `ScoreHud.ts`, `ScoreViewer.ts`. Values unchanged;
the diff should be reviewable as a no-op.

This stage exists so stage 2 is a **one-file diff**. Flipping radius and palette
together would put the interesting decision (the palette) inside a 35-file
search-and-replace, where nobody can see it.

**Stage 2 — flip the palette in `designTokens`.** One commit; the whole workbench
changes. The OKLCH re-cut, `--rule-w`, the five new names, the accent, radius values to
`0`. The work here is the review, not the diff.

**Stage 3 — the shared row-state primitives.** Promote what `ol.ops` already does into
`sharedChrome` as `.row-current` / `.row-past` / `.row-done`, so the ops rows, the HUD's
active rung and (later) the tray's tiles cite one definition. Today `ScenarioPage.ts`'s
`li.current` and `li.future` and `ScoreHud`'s `.row.active` are three independent
spellings of two states.

**Stage 4 — `color-scheme` and the anti-flash colour.** `src/entries/workbench.css`
hard-codes `background: oklch(0.967 0.005 88)` for the pre-mount flash; update it to the
new `--bg` or it becomes a flash of the *old* design. Leave `color-scheme` to item 2,
which owns the theme wiring.

## Not this

- **Not the pip ramp** — item 6.
- **Not the fonts** — item 3. `--sans`/`--mono`/`--serif` keep their current values here;
  this item is colour, radius and rules only.
- **Not the dark half.** Item 2 owns it. This item should leave the existing
  `:host([resolved-theme='dark'])` block *alone rather than half-converting it* — a
  partially-Modernist dark block is worse than an unwired one, because it looks
  maintained.
- **Not the tray's de-hexing** — item 4, which needs this item's tokens to exist first.
- **Not the emitter.** Contract rule 4.

## Verification

- `npm run update:primitives` then a clean `git diff -- scenarios/`. **This should be
  provably empty**, and the reason is worth stating once for the whole campaign:
  `update:primitives` runs through `harness/helpers/corpusPrimitives.ts` →
  `src/engine/layout/*`, which are pure functions over SMuFL metrics and a fixed
  viewport — no CSS, no tokens, no DOM. `expected.svg` goes through
  `src/engine/render/svg.ts`, whose only style-ish output is the frozen
  `FONT_FAMILY_BODY`. So nothing in `tokens.ts`, `src/workbench/*` or
  `src/entries/workbench.css` can move a golden byte. The assertion is cheap; run it
  anyway, because the claim is what licenses the rest of the campaign to move fast.
- **New: `harness/conformance/design-tokens.test.ts`.** `groups.test.ts` is the
  precedent for asserting a display invariant from the harness, and
  `viewer-surface.test.ts` for reading source files with `fs`.

  **Correction (found at build time):** an earlier draft of this doc said the harness
  could simply *import* `tokens.ts`, since it pulls in nothing but `css` from lit. It
  cannot — `.dependency-cruiser.cjs`'s **`harness-not-into-shells`** rule bans
  `harness/ → src/(workbench|entries|elements)/` outright, at `severity: error`, and
  `npm run check:boundaries` fails the build on it. The ban is about **layering, not
  resolvability**: "the harness exercises machinery headlessly, never the app shells."
  So the test parses `tokens.ts` from source text instead, expanding the `${…}`
  compositions (`viewerTokens` composes `scoreTokens` and `radiusTokens`) so composed
  tokens don't read as undeclared. This is the same technique the test already needed
  for components, which cannot be imported anyway because `@customElement` wants a DOM
  — so the constraint cost nothing and the test reads more consistently for it.

  Assert:
  1. **Every `var(--x)` referenced by `ScoreViewer.ts` is declared in `viewerTokens`.**
     Read the component as *text* (not an import — `@customElement` needs a DOM), regex
     out the references, check each against `viewerTokens.cssText`. CSS is untyped and a
     `var(--typo)` silently computes to nothing — which is exactly the bug `tokens.ts`
     records the viewer having shipped once, where *the staff lines were not drawn at
     all*. This is the highest-value assertion in the campaign and it would have caught
     that outright.
  2. Every public `--mnx-*` override still appears in `viewerTokens` — the embed
     contract, contract rule 3.
  3. **Radius is a token decision**: every corner cites `--radius-*`, and the scale is
     composed into *both* token blocks so the embed cannot drift from the app. The
     exemptions are named in the assertion rather than left to judgement —
     `border-radius: 50%` on `.pip` / `.vchip .vdot` and the `1px` on `.gapdia` are
     **shapes that carry meaning** (the rail's dots vary shape as well as colour so
     *stale* cannot read as *never seen*), not corner treatments. The design system
     agrees: its own stylesheet keeps `border-radius: 50%` on radio dots while every
     radius token is `0`. Stage 1 leaves no numeric corner literal at a use site; stage
     2 changes the values in the one block.
- **Hands-on, headless Chrome over CDP**, per the tray and HUD precedent — zero console
  errors. Beyond the usual sweep, one check belongs to this item specifically: **a
  selected note and a validation badge, on the same system, must be tellable apart.**
  Use a scenario that carries diagnostics (`lab/24-tab-spec-gaps/*`) and select a note
  next to a badge.
