# Vertical density — systems per page, without shrinking the staff

> **Status: proposed 2026-08-15.** Split out of
> [core-render-density-zoom.md](../complete/core-render-density-zoom.md) on the day that
> doc closed. Two of its three axes shipped; this is the third, and it was
> never started — carrying it as an open line on a finished doc would have made
> that doc look unfinished and this work look like an afterthought. It is
> neither: it is the axis with an actual refactor in front of it.

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
