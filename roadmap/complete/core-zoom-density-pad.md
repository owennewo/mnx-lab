# The zoom/density pad — two axes, one crosshair, quiet until wanted

> **Status: BUILT 2026-08-15.** All four stages landed. `src/workbench/ZoomPad.ts`
> (the mark, the pad, the gestures), the engine wiring (`zoom` → `pxPerSp`,
> numeric `density-h`, `render-scale`, `src/engine/render/scale.ts`), the mount
> in `ScenarioPage` at z-index 4, and `harness/conformance/zoom-density.test.ts`
> (8 assertions, mutation-checked). 670 tests pass, `git diff -- scenarios/` is
> clean, `npm run build` and `check:boundaries` are green.
>
> Verified hands-on over CDP in a real browser, both themes: idle mark measures
> **24×24 inside a 44×47 hit area**; hover expands to **76×100** anchored on its
> top-right corner; stepping UP twice takes the staff 100→105→110 and the SVG
> from 1004px to 1105px tall; dragging left to the floor drops the score from
> 1004px to 744px (the music genuinely repacks) and shows `SPACE 50 MIN` on the
> ink band with the exhausted arm greyed; the magnifier returns both to fitted;
> idle-off-default prints `100 / 50` beside the mark with the changed axis in
> the accent; values survive a reload and a stored `99` **clamps to 1.6 rather
> than resetting**; and opening the tray drops the pad to 0.28 and keeps it
> there even under the pointer.
>
> **One gap found and fixed on the way in:** the standalone **tab** view never
> received `densityH` at all — `layoutTab` called `planHorizontal(mnx, widthSp)`
> with no options, so `density=` was silently ignored on tab-only scores from
> the day the axis shipped. The pad, having to drive all three views, is what
> surfaced it. Now wired and asserted; verified in the browser (viewBox width
> 335.6 → 410.4 across the range) where it was previously identical.
>
> **Campaign item.** Item 9 of
> [core-campaign-modernist.md](core-campaign-modernist.md); inherits its shared
> contract, and the agreement block below is what that contract requires before
> any code is written.
>
> **Also closes the UI half of**
> [core-render-density-zoom.md](../complete/core-render-density-zoom.md), whose status line names
> exactly what is missing: *"Remaining: the vertical axis and zoom."* This doc
> supplies **zoom**, gives the shipped horizontal axis a control surface, and
> **formally cuts the vertical axis from this control** (see Ruling 4).

**Design provenance.** `Zoom Control.dc.html` ("SPEC · v1") in the same Claude
Design project that specified the tray and the score panel, over the same
`modernist` bundle — read through the design MCP, transcribed here, not
committed. Three options were explored (`Zoom Control explorations.dc.html`);
**1a, the crosshair pad, is locked**. The design's own summary: *up and down are
**staff** — a true scale on line spacing, glyphs and text; left and right are
**spacing** — horizontal distance between events only, glyphs untouched. The
magnifier where the arms cross resets both to 1:1.*

## The agreement block (contract rules, answered before code)

1. **Tokens over literals.** The mock is hard-coded hex throughout and every one
   has a home already: `#ec3013`→`--accent`, `#201e1d`→`--ink`,
   `#fce7e3`→`--row-current`, `#efedea`→`--line`, `#8a8582`→`--ink-3`,
   `#f5f3f1`→`--bg-context`, `#c3bfbb`→`--ink-faint`, `#ff8f78`→ the accent's
   dark-half lightening. This matters more here than in any prior item: the pad
   is an overlay **on the score card**, and `scoreTokens` decided on 2026-08-14
   that the paper goes dark with the theme. A literal `#fff` pad would be a
   white card on a dark page. No new token is expected; if one is needed it goes
   in the sheet with a justification, never at the use site.
2. **Zero radius, rules via `--rule-w`.** The pad is a 2px ink border, zero
   radius, one hairline splitting the readout. Straight from the scale.
3. **The embeddable surface keeps its contract.** The pad itself is workbench
   chrome and ships nowhere near the embed. What *does* touch the surface is the
   engine wiring (`zoom`, `density-h`), and it only **adds**: no public
   `--mnx-*` name changes, no removals.
4. **`src/engine/render/svg.ts` is untouchable.** Not touched. `fitPxPerSp` is
   *read*, never edited.
5. **Selection-red and error-red stay separable.** The pad puts accent-red on the
   score canvas for the first time outside the enclosure. Checked at review
   against a diagnostic-carrying scenario — and the pad's red is *type and a
   filled arrow inside a bordered card*, a third form again, not a stroked rect
   and not a filled disc.
6. **Goldens byte-identical.** `npm run update:primitives`, then a clean
   `git diff -- scenarios/`. The engine change here is real (a new numeric input
   path), so this gate is load-bearing rather than ceremonial: the assertion is
   that the **defaults** are unchanged, not that the code is.

## The two axes, and what they already are

The design's two axes map onto shipped code almost exactly — which is why this is
a control-surface item and not an engine effort.

| Design axis | Engine reality | State |
|---|---|---|
| **← →  spacing** | `PlanOptions.densityH` — a multiplier on the **springs only** ([spacing.ts:826-837](../../src/engine/layout/spacing.ts)) | **shipped 2026-08-14.** The design's "glyphs untouched" is verbatim the invariant `viewer-surface.test.ts` already asserts. |
| **↑ ↓  staff** | `pxPerSp` — the single scalar the whole sp-unit layout multiplies by | exists in the engine; the element's `zoom` prop **never reached it**, sizing only the paper card. |

## Five rulings

The mock is spec-grade about appearance and under-specified about the two places
it meets this engine. Recorded here so the build doesn't relitigate them.

### 1. The horizontal floor is a legibility constant, not a computed collision floor

The design's central horizontal claim — *"the tightest ratio at which no two
glyphs in the current system overlap, recomputed each layout pass"* — specifies
machinery for a problem this architecture **already eliminates**, and eliminates
**twice**:

1. `densityH` scales springs; the rigid columns (`CORE_SP`, accidental slots,
   dots, the clef/key/time prefix) are never scaled.
2. The **justifier** is a second, independent guard: when a row's rigid sum
   shrinks, `voiceStretch` grows and hands the width straight back to the
   springs.

The second one was found by mutation-checking the conformance test rather than
assumed, and it is worth recording because it changes what can be *proved*.
Deliberately breaking guard 1 — scaling the rigid core along with the spring —
moves the tightest column gap on `twelve-bar-blues` from 1.745sp to 1.540sp and
**still** does not breach `CORE_SP`. So the collision guarantee is
over-determined: no plan-level assertion can isolate springs-only as its sole
cause, and `zoom-density.test.ts` therefore pins the guarantee while pointing at
`viewer-surface.test.ts`'s prefix assertion for the mechanism. The ruling stands
and is in fact stronger than drafted; the *evidence* for it is narrower than
first written.

So the floor is a **legibility** floor — a chosen constant, and it already
exists: `MIN_DENSITY = 0.5` ([spacing.ts:133](../../src/engine/layout/spacing.ts)).
The pad exposes the existing clamp rather than inventing a new number, and the
mock's `74` is not adopted — it was picked to illustrate a computation that
isn't happening.

This dissolves the design's own open question (*"whether the floor should be
per-system or per-score"*) instead of answering it. It also removes exploration
1b's hatched no-go zone from ever being wanted.

**What survives, and it is the design's real contribution here:** the floor
becomes *visible*. Clamping is currently silent — a host asking for 0.2 gets 0.5
and is never told. The pad's `MIN` chip is the first time the engine's clamp
surfaces to a human.

> Retuning `MIN_DENSITY` is legitimate and probably wanted once the pad makes the
> bottom of the range easy to look at. It is **not** this item: the constant is
> shipped behavior, and moving it is a judgement about engraving that deserves
> its own evidence rather than riding in on a control.
>
> **It happened the same day, exactly that way** — 0.5 → 0.02, with the
> evidence the pad made visible (0.5 and 0.25 both leave `twelve-bar-blues` a
> system longer than 0.1 does, and 0.02 is where packing bottoms out), recorded
> in
> [core-render-density-zoom.md](core-render-density-zoom.md)'s closing status.
> The pad also produced a second finding this ruling did not anticipate: most
> density values engrave *identically*, so the arms now walk a ladder of the
> ones that don't. The `MIN` chip survives unchanged and gained a sibling —
> `TIGHTEST`/`WIDEST` for an arm that runs out inside the engine's range, since
> saying `MAX` there would claim a clamp that isn't there.

### 2. Staff scale: fitted until first touched

Every renderer does `const fitted = opts.pxPerSp === undefined`
([notationRenderer.ts:44-49](../../src/engine/notation/notationRenderer.ts)) — an
explicit value **pins** the scale and disables the fit-to-width that short scores
rely on (`fitPxPerSp` scales them *up* to fill the viewport). The mock never
mentions this, and it makes "STAFF 100" ambiguous: pinned at 10px/sp, or
untouched? On most corpus scenarios those differ visibly.

Ruled: **unset means fitted**, per the surface's own precedence chain (*unset
defers downward, it does not mean the default value*). The readout prints the
**derived** percentage on load — what the score is actually being drawn at — and
the first click pins. `zoom` therefore becomes `number | null`, `null` being
auto, matching `capoOverride` on the same element.

For the pad to print a derived number it has to be *told* it, so the three
renderers return their effective `pxPerSp` and the element re-broadcasts it as a
`render-scale` event. This is the only surface addition beyond the two knobs, and
it earns its place: **a host cannot compose a scale control without knowing the
scale.** Returning a value that callers may ignore breaks nobody.

### 3. `zoom` is repurposed, not duplicated

`zoom` currently computes `min(100%, 820 * zoom px)` — the **paper card's
width**. That is the wiring core-render-density-zoom.md calls out as wrong:
*"the element's `zoom` prop only sizes the paper card; wiring it to the glyph
scale…"*. So `zoom` becomes the staff-scale multiplier on `pxPerSp`, and the
paper card goes back to a plain `min(100%, 820px)`.

Verified safe: **`zoom` has zero consumers repo-wide** outside its own
declaration — not the workbench, not `embed.html`, not `apps/viewer-embedded`,
which drives `density` alone. Adding a second knob for the same idea would have
left the wrong one holding the good name.

### 4. Vertical density is cut from this control, deliberately

core-render-density-zoom.md has **three** axes; the design has two, and its
"staff" is uniform *scale*, not vertical *density* (systems packing closer
without shrinking the staff). The pad's up/down arms are spent on scale, so
axis 3 has no seat at this control and cannot be added to it later without
redesigning the mark.

Accepted rather than worked around. That axis was already the one deliberately
not started, on its own doc's advice — `ROW_HEIGHT_SP` is a module-level
constant derived from the row pads, and the stem-length clamp should land first
or alongside. When it lands it needs a different control, and that is a better
outcome than four arrows meaning three things.

### 5. No keystroke, and the design's second open question answers itself

The mock asks *"whether staff zoom should also be reachable by ⌘+/⌘− (the
browser's own zoom is the competing meaning)"*. The repo has already ruled on
that exact tension: [keymap.ts:188-196](../../src/edit/keymap.ts) rejects `Ctrl+K`
because Chrome's omnibox owns it. Same reasoning, same answer — **don't take
them**. No binding in `src/` sets `meta` at all today, so ⌘0/−/= are free in our
tables and browser-claimed outside them; and bare `Minus`/`Equal` already mean
shorter/longer duration in the edit layer, so the modified chord would read as a
variant of a different verb.

Reset lives on the magnifier, plus a command-palette entry if the palette's
table takes one cheaply. Should a stroke ever be wanted,
`harness/conformance/keymap-docs.test.ts` asserts the binding↔`KEY_DOCS` join in
both directions, so it cannot ship undocumented.

## The idle mark — the one place the design is revised (twice — see below)

The mock's idle state is the **full 3×3 grid**, laid out at 72×72 and dropped to
opacity 0.28. That is roughly a bar of music, and 0.28 opacity makes it faint,
not absent — over an engraving, a faint 72px object is still 72px of competing
structure. The design already shrank once (from 104×133) and named the problem
in its own subhead; it did not go far enough.

Revised: **idle draws the crosshair as one 24×24 SVG glyph** — the same
four-arrow mark, drawn once at mark scale, rather than a laid-out grid of cells
that happens to have no borders. 72×72 → 24×24 is **89% less area**. Hover
expands to the full 76×99 pad specified.

Why this and not the alternatives:

- **Not magnifier-only.** It is smaller still, but it discards the four-arrow
  mark the spec calls *"locked"* — the user's own icon, and the thing that says
  *two axes* before anything is hovered.
- **Not a 20px grid.** 60×60 buys only ~30% and makes the cells worse targets.

Everything else about the quiet states is kept verbatim: 0.28 idle, 1.0 on hover
over 120ms, a 44px hit area so it is grabbable before it is visible, the floor
rising to 0.55 while either axis is off default with the changed number printed
in the accent, holding 1.0 while dragging even if the pointer leaves, and
dropping to 0.28 whenever the selection tray is open.

**Second revision (2026-08-20): the two states became one geometry, so they
morph.** As built, idle and hover were a hard DOM swap of two unrelated layouts
(single 24×24 glyph vs grid-over-readout), so no transition between them was
possible. Revised: the **readout moved from below the grid to its left** —
exactly where the idle numbers already sat — and idle is now the *same* pad
with its chrome transparent, its STAFF/SPACE labels closed to 0 height and its
grid tracks collapsed (3×8px) until the four arrow *buttons* form the 24×24
crosshair; the separate idle glyph is deleted. Expansion is a transition on
grid tracks, transforms and opacity — a real morph, not a crossfade — and the
open pad now costs **72px of height instead of 100**, spending width instead
(~110px), which is cheap for a right-anchored overlay on a wide score.
Consequences kept deliberately: the first revision's 24×24 idle footprint is
preserved exactly (this does *not* reopen the faint-full-grid question); the
arms exist in both poses so keyboard focus never lands on a vanishing element;
the clamp band became **per-axis** — the half that hit its wall turns ink while
the other axis stays readable, which the old full-width chip could not do; and
`prefers-reduced-motion` snaps between poses with no transition.

## Where it attaches

`.main` in [ScenarioPage.ts:2001-2005](../../src/workbench/ScenarioPage.ts) is
already `position: relative` — its comment says *"the selection tray overlays the
score and positions against this box"* — and the score scrolls **itself**
(`overflow: auto` on the viewer's own host), one level down. So an absolutely
positioned sibling of the viewer pins to the top right and does not scroll with
the music: the mock's *"pinned while the score scrolls"*, for free.

Z-order works as specified. Census: panel drag `1`, setup-popover layer `5`,
tray `30`, palette `40` → the pad sits at **`4`**, under everything that can
cover it. "Never overlaps the right-hand panel" needs no enforcement at all: the
panel is a **grid column**, not an overlay. One inset detail — the viewer draws
its focus ring at `outline-offset: -2px`, so 14px from the edge must clear it.

Persistence follows `storedPanelWidth()`
([ScenarioPage.ts:193-200](../../src/workbench/ScenarioPage.ts)) and its
"**clamp, don't reset**" read: `mnx-lab.zoom` and `mnx-lab.density-h`,
`localStorage`, never the document store — this is a UI preference, and the
score is not edited by looking at it.

**The pad is workbench chrome, not element surface.** It composes attributes;
it implements nothing. `apps/viewer-embedded` will plausibly want it too — that
is the promotion trigger into `elements/`, a deliberate reviewed move when a
second shell actually asks, not now.

## Order of work

1. **Engine/element wiring** — renderers return effective `pxPerSp`; `zoom`
   becomes `number | null` reaching `pxPerSp`; `density-h` numeric attribute
   overriding the preset; `render-scale` event. Conformance assertions on the
   defaults.
2. **`src/workbench/ZoomPad.ts`** — the mark, the pad, the gestures, tokens only.
3. **Mount + persist** in `ScenarioPage`.
4. **Goldens + hands-on review** across notation/tab/both, light and dark, with a
   selection live and a diagnostic-carrying scenario for rule 5.

✔ when: the pad idles at 24×24 over an unobstructed score, both axes drive the
real engine through `RenderOptions`, the staff readout is honest on first paint,
`MIN` fires at the existing clamp, the whole thing survives a theme flip without
a literal, and `git diff -- scenarios/` is clean.

## Not this

Not the vertical axis (Ruling 4). Not retuning `MIN_DENSITY` (Ruling 1). Not a
keystroke (Ruling 5). Not promotion into `elements/`. Not pagination — still
core-render-density-zoom.md's "Not this", and still true.

## Appendix (2026-08-20): the collision guarantee acquired a premise

Ruling 1 argued collisions are eliminated twice over — density scales springs
only, and the justifier hands reclaimed width straight back. Both guards price
widths in **horizontal** staff spaces, and hours after this doc closed,
`fd6b06e` (*"Staff scale stops dragging the horizontal axis behind it"*) made
every ink *dimension* follow the **vertical** scale instead, so the guarantee
now holds **at square scale only**. Under a pinned staff scale on a fitted
wide score the ink ratio reaches ~1.4 at the arm's first click, and rigid
columns overflow into their neighbours — first visible as the TAB clef
running into the time signature (observed 2026-08-20, tab view). The commit
named this cost and left it *"for a decision"*; the decision is
[core-ink-priced-columns.md](core-ink-priced-columns.md): rigid
columns are ink and get priced on the ink scale, with packing frozen square
so this doc's Ruling 2 keeps its substance. The ruling's text above stands as
written — it was true of the engine it described.

## Appendix (2026-08-21): the open pad was translucent whenever it had something to say

Reported from use: *"I find the zoom control difficult to read. When hovered the
numbers are too small to read and the background under the numbers is a
distraction."* Two causes, one of them a plain CSS defect:

1. **`:host([data-off]) .pad { opacity: 0.55 }` outweighed `.pad.expanded`** —
   (0,3,0) against (0,2,0) — so the raised idle floor also applied to the OPEN
   pad. The rule only ever bit **off default**, which is exactly when the
   readout has numbers worth reading, so hovering a zoomed or respaced score
   gave a 55%-opaque card: the staff lines and fret digits showed through the
   panel and through its type. That is the "background under the numbers", and
   it was the score. Fixed by scoping the floor to `:not(.expanded)`, which is
   what it always meant.
2. **9px was the whole readout, in both poses.** Right for the idle whisper
   beside a 24×24 mark, too small to read in the pose the pointer is in. The
   size is now part of the morph — 13px open, 9px idle (the label 8px, from
   6.5px), the column 42px → 60px, which is also what `TIGHTEST` needs. Idle
   cannot simply inherit 13px: two halves of it stand taller than the crosshair
   and the mark would stop being 24×24.

Also, while the fill was opaque it was **the same value as the paper**:
`--surface` and `--paper` are equal in both themes by the token sheet, so the
card had only its border to distinguish it and the staff lines read as running
under it. The open readout column now takes `--bg-context` and the pad a real
drop shadow (`--shadow-far`, not the white-in-dark `--shadow-near` glow), so the
numbers sit on a ground of their own. Verified over CDP in both themes across
the default, off-default, clamped (`TIGHTEST`) and idle poses.
