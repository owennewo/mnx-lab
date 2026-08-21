# Vertical density — systems per page, without shrinking the staff

> **Status: BUILT 2026-08-15**, the same day it was proposed — because the
> refactor this doc expected turned out not to be needed (see *What actually
> happened*). `src/engine/layout/verticalDensity.ts` (the pass, the clamp, the
> coupling), `densityPad` threaded through both layouts, the three renderers
> and `spacing.ts`'s page margin, `density-pad` on `<mnx-score-viewer>`, and
> `harness/conformance/vertical-density.test.ts` (16 assertions). 706 tests
> pass, `git diff -- scenarios/` is clean, `npm run build` green.
>
> Split out of
> [core-render-density-zoom.md](../complete/core-render-density-zoom.md) on the day that
> doc closed. Two of its three axes shipped; this was the third, and it was
> never started — carrying it as an open line on a finished doc would have made
> that doc look unfinished and this work look like an afterthought.

## The goal

Tighter = systems pack closer, **without** the staff getting smaller. The
horizontal axis's twin: `densityH` decides how much music fits on a *line*,
`densityV` would decide how many lines fit on a *screen*. On a tablet on a
music stand that is the difference between one page turn and three.

It is a real gap and not a symmetry exercise. The two shipped axes can already
fit a twelve-bar blues into two systems; what they cannot do is stop those two
systems from carrying the fixed vertical headroom every row reserves for
ledger lines, stems and lyrics whether or not that row uses it.

## Why it was not done with the other two

Both reasons are still true.

**1. `ROW_HEIGHT_SP` is a module-level constant.** Horizontal density had one
seam — every spring is computed in one pass in `spacing.ts` and could be scaled
there, once, before anything read one. Vertical geometry has no equivalent
choke point: `ROW_HEIGHT_SP` is derived at module scope from the row pads
(`ROW_PAD_TOP_SP`, `ROW_PAD_BOTTOM_SP`, `INTER_STAFF_GAP_SP`, the lyric band),
and read from wherever a row's y is needed — including `tab.ts` and the `both`
system composer, which must keep agreeing with it. Making it per-layout is the
work, and it is the kind of change the goldens will judge harshly, which is
exactly as it should be.

**2. Stem headroom feeds vertical spacing.** The stem-length
"reach-to-the-middle-line" clamp is still a fixed `STEM_LENGTH_SP`. Row
headroom is sized for the worst case that constant allows, so tightening the
rows before the clamp lands means tuning against a number that is about to
move. That refinement should land first or alongside — inherited verbatim from
the parent doc's own open questions.

## It needs a control of its own

The zoom/density pad's four arms are spent: ↑↓ is staff *scale*, ←→ is
horizontal spacing. That was ruled deliberately in
[core-zoom-density-pad.md](../complete/core-zoom-density-pad.md) (ruling 4) —
"four arrows meaning three things" was rejected rather than worked around. So
this axis arrives with a control question already open, and the honest answer
is probably *not another pad*: a reader who wants more music on screen wants
one intent, not three sliders. Worth considering when it lands: whether the
user-facing control couples the axes ("fit more music") over three independent
engine scalars — coupling in the control is reversible, conflating them in the
engine would not be.

## What the horizontal axis learned that this one should reuse

- **One pass over finished metrics, never at the source.** Density was applied
  in a single pass after every spring was computed; scaling at the four
  `springSp()` call sites would have relied on them staying in step.
- **Default must be byte-identical.** `densityH: 1` reproduces the committed
  goldens exactly, and that is asserted, not assumed. The same gate applies
  here and will be harder to pass.
- **Ask whether the knob is even visible.** The horizontal axis shipped, was
  given a control, and only *then* was discovered to be degenerate across most
  of its range (see the parent doc's density ladder). Vertical density has a
  justifier of its own in spirit — rows are placed by a running cursor, so
  there may be no equivalent cancellation — but the question is now a required
  one: *which values of this knob draw a different page?* If the answer is
  "most of them", say so with evidence; if it is "few", the ladder machinery
  (`packSystems`/`densityLadder`) is the pattern to copy, not reinvent.

## Not this

Not pagination — page breaks and print margins remain out of scope, as they
were for the parent doc. Not the stem-length clamp itself, which is its own
engraving refinement and only a dependency here.

## What actually happened

Asked for as **option A** of a four-way choice about where a third axis could
live on the zoom pad: *widen what ←→ means — SPACE stops meaning springs and
starts meaning all whitespace, one intent.* Both of this doc's two reasons for
deferring dissolved rather than being paid.

### 1. The refactor did not happen, because the pass is a post-pass

`ROW_HEIGHT_SP` is still a module-level constant, still read from `tab.ts` and
the `both` composer, still agreeing with itself. Vertical density runs **after**
a layout is finished, over the `LayoutResult`: `rows[]` says where each system
band sits, the primitives say where that system's ink actually reaches, and a
row moves by translating its primitives. Nothing inside the row's arithmetic
had to become per-instance.

That shape also collapsed three implementations into one — notation, tab and
the combined system all return a `LayoutResult`, so all three got the axis from
two call sites and `layoutBothSystem` needed no code at all.

### 2. The stem-length clamp was not a dependency, because the floor is ink

The doc expected to tune row headroom against a `STEM_LENGTH_SP` that is about
to move. It never needed to: the axis does not scale toward a chosen constant,
it tightens toward **each row's measured ink** and stops. Whatever
`STEM_LENGTH_SP` becomes, the pass measures the result rather than predicting
it. The clamp can land whenever it likes.

Measuring was also what made the case. Across the committed goldens:

| view | ink above the staff | ink below | reserved |
|---|---|---|---|
| notation (101) | median 0.5sp, p90 5.5sp | median 1.0sp, p90 4.5sp | 6 + 6 |
| tab (20) | median 0.0sp, p90 1.1sp | median 0.5sp, p90 2.3sp | 4 + 4 |

Which killed the obvious implementation. A plain multiplier on the pads, scaled
far enough to help the median score, clips the p90 one — and clipping here is
not the graceful degradation `densityH` enjoys. **`densityH` cannot make ink
collide structurally** (springs scale, rigid columns do not); the row pads
*are* the vertical clearance. So the guarantee is asserted rather than argued:
`vertical-density.test.ts` checks consecutive systems never overlap at, and
past, the clamp, on both views.

Ink extents come from `computeBoundsSp` — the same measurement the snug-crop
viewport already uses, with real SMuFL glyph boxes. Anchors would not do: a
treble clef's baseline sits on the G line and its ink reaches 2.5sp above the
staff, so an anchor-measured floor would tighten one system straight through
the clef of the next.

### The control question answered itself

This doc predicted *"it needs a control of its own"* and guessed the answer was
"probably not another pad". It turned out to need **no control at all**. The
coupling lives on the element: unset, `density-pad` is derived from the
effective `density-h`, so the pad's existing ←→ arms — which already write
`density-h` — now move both axes. Ruling 4 of
[core-zoom-density-pad.md](../complete/core-zoom-density-pad.md) said the mark
could not take a third arm pair without being redesigned. It still can't, and
it didn't have to.

Square root, not linear: `density-h` runs usefully to 0.02, padding is spent by
~0.3, so a linear coupling would park the pads on their floor for nearly the
whole travel of the arm driving them — an exhausted control that reads as a
broken one.

**The coupling is at the surface, not in the engine.** The two scalars stay
independent below `ScoreViewer`, and an explicit `density-pad` separates them
again. That was this doc's own rule, kept verbatim: *coupling in the control is
reversible, conflating them in the engine would not be.*

### What it buys

`twelve-bar-blues` at 80sp, staff size untouched:

| `density-h` | `density-pad` | tab | notation |
|---|---|---|---|
| 1 | 1.000 | 43.0sp (3 sys) | 82.0sp (3 sys) |
| 0.5 | 0.707 | 34.8sp (−19%) | 70.3sp (−14%) |
| 0.25 | 0.500 | 20.0sp (−33%, 2 sys) | 44.1sp (−21%, 2 sys) |
| 0.02 | 0.141 | 14.6sp (−51%) | 42.0sp (−25%) |

The asymmetry is the feature, not an artifact: tab reclaims twice what notation
does because tab reserves headroom it almost never uses. The space that
disappears is the space nothing was in.

### "Which values of this knob draw a different page?"

The doc made that a *required* question, having been burned by the horizontal
ladder. The answer here is **all of them, continuously** — row placement is a
running cursor with no justifier to cancel against, so there is no ladder to
build and none was. The horizontal arm still walks `densityLadder`'s rungs;
padding rides along as a continuous function of the value at each rung.

### Default is byte-identical, by construction

At `densityPad === 1` the pass **returns null and does not run** — not "computes
the same numbers". `npm run update:primitives` leaves `git diff -- scenarios/`
clean, and the test pins the mechanism as well as the result.

## Still open

- **Inter-staff gaps within a system** (`INTER_STAFF_GAP_SP`, the grand-staff
  gap) are untouched. A post-pass over `rows[]` sees a system's outer band, not
  its individual staves, so tightening inside a system needs per-staff bands
  that `LayoutResult` does not carry. The same ink-floored rule should apply
  when it does.
- **The density ladder is still horizontal-only.** Values it prunes as
  identical now differ vertically, so the ←→ arms step in slightly coarser
  jumps than the engraving strictly distinguishes. Harmless today because the
  bottom of the ladder and the bottom of the padding range arrive together;
  worth revisiting if either range moves.
- **`compact`** (tighter paper padding, an element-level attribute) now
  overlaps this axis conceptually. Not merged — one is chrome, one is
  engraving — but they should not both grow.

## Appendix (2026-08-21): the coupling is reversed — vertical space follows vertical zoom

The surface coupling (`density-pad` unset ⇒ `√density-h`) was argued as "one
reader-facing intent over two scalars" and deliberately kept *at the surface
so it stays reversible*. Reversed today, on the owner's ruling after a tab-only
score at SPACE 200 drew its systems 11sp apart: the reader does not expect
vertical air to grow when they open the horizontal spacing, and above 1 the
coupling did exactly that — multiplied every inter-system pad by √2 on a staff
with no ink to clear. Vertical distance is a function of **vertical** zoom,
and the engine already delivers that without any coupling: every gap is in
staff spaces and staff scale multiplies staff spaces. So `density-pad` unset
now means 1. `padDensityFor` stays exported (the mapping is still a reasonable
thing for a host to *choose* to apply, and its tests pin its shape); nothing
applies it by default. The inter-system distance itself — still the fixed pads
at density 1 — is stage D of
[core-ink-measured-gaps.md](../inprogress/core-ink-measured-gaps.md).
