# Beam geometry — shorter beamed stems, beams that sit on the staff, and a flat-beam style

> **Status: COMPLETE 2026-09-09** — built and landed the day it was proposed, worktree retired.
> **Amended the same day** on review of the Guitar Pro score that raised it: the per-level
> step is now **0** (every beamed group bottoms out at 2.5sp), and the default slant leans
> flat — see *Amendment* below. Every
> beamed golden moved and the batch is registered in
> [lab-verify.md](../inprogress/lab-verify.md#beam-geometry--2026-09-09). Three
> corrections to the proposal as written are recorded in *What building it taught*.
>
> Raised from a side-by-side of a Guitar Pro score
> against Soundslice's engraving of the same file. Beams themselves are done
> ([core-musicxml-beams.md](../inprogress/core-musicxml-beams.md); inference by position
> landed 2026-09-09) — this doc owns the *geometry* of a beamed group, which no doc has
> owned since [core-render-density-zoom.md](core-render-density-zoom.md) named
> a stem-length clamp and [core-vertical-density.md](core-vertical-density.md)
> found it did not need one. Three items, in a fixed order; the first is the fix, the
> other two are the polish it makes safe.

## The complaint

Beamed stems come out too long. In the opening bar of the test score (sixteenths, E G G D
under one two-beam group) the D stem is an octave and the E stem is an octave and a half;
Soundslice draws the same group with every stem visibly shorter. The reviewer's read —
"our stems are generally too long when beamed" — is correct, and the cause is one rule.

## Why: the shortest stem is the normal stem

`emitBeamRun` in `src/engine/layout/notation.ts` places a beam in three steps:

1. every stem's *ideal* tip is `STEM_LENGTH_SP` (3.5 spaces, one octave) from its head;
2. the slant follows the two outer heads, capped at `BEAM_MAX_SLANT_SP` (1 space) across
   the group;
3. the whole line **slides outward until every stem reaches at least the full 3.5**.

Step 3 makes 3.5 spaces the length of the *shortest* stem in the group and lets every
other stem grow from there. Over E→D the slant absorbs 1 of the 3-space interval, so D
gets 3.5 and E gets 5.5. The same three steps are copied for grace beams
(`GRACE_STEM_LENGTH_SP`) and tremolo groups, so the fix has three call sites, not one.

Engraving practice runs the other way round. The octave is the normal length of a
*flagged* stem. Inside a beamed group the stems nearest the beam are allowed to shorten
so that the group as a whole stays near normal — Gould's figures are roughly **2.5 spaces
minimum under one beam, 3 under two**, each further beam adding half a space so the
innermost beam never crowds a head. Soundslice is plainly using a smaller minimum than
ours; that, not its beam slant, is why its stems read shorter.

## Not the cause: flattening

Soundslice has a "flatten beams" preference that draws every beam horizontal. It is a
house style (jazz and handwritten-look conventions favour it), and it is worth having —
but it does **not** shorten stems. A flat beam over E→D must still clear the D by the
minimum, so the E stem carries the whole interval on top of it; several stems in the
flattened engraving are *longer* than our slanted ones. Item 3 below ships it, after
item 1, because on our current minimum it would make the long-stem problem more visible.

## The three items

### 1. Per-level minimum stem in beamed groups

Replace the fixed shortest-stem of 3.5 with a minimum that depends on the group's
deepest beam level: **2.5 for one beam, 3.0 for two, 3.5 for three or more**, i.e.
`2.5 + 0.5 × (levels − 1)`, capped at the normal length. The outer stem the slant is
anchored to still *targets* 3.5; the slide in step 3 then only runs as far as the
per-level minimum demands. Net effect on E G G D: D shortens to 3.0, E to 5.0, and the
group reads a half-space lighter — the whole of the visible difference.

Constraints the change has to keep:

- **Deeper levels stack toward the heads** (`BEAM_THICKNESS_SP + BEAM_GAP_SP` per
  level), so the minimum is measured from the head to the *innermost* beam's near edge,
  not the primary. That is why the minimum rises with the level count.
- **Cross-staff and mixed-direction groups** keep the current direction choice; only
  length changes.
- **Grace beams** scale the same minimum by `GRACE_SCALE`. (Tremolo bars were listed
  here in the proposal; see *What building it taught* for why they are not a caller.)
- Flagged stems are untouched — `STEM_LENGTH_SP` stays the normal length everywhere else.

This moves every golden with a beam in it. That is the point, and it is why the item is
gated on the ledger below.

### 2. Snap the beam to the staff

Convention is that a beam **sits on, straddles, or hangs from** a staff line rather than
landing wherever the arithmetic puts it; Soundslice does this and it is a large part of
why its beams look settled. After item 1 has placed the line, round the primary beam's
near edge at the anchor stem to the nearest of those three positions (a quarter-space
nudge at most, always outward so no stem drops below its minimum), then let the slant
carry the far end. Only inside the staff; a beam entirely above or below the lines has
nothing to snap to and is left alone.

### 3. A flat-beam display option

`BEAM_MAX_SLANT_SP = 0` is the whole mechanism. Expose it as a pure display option
alongside the ones [core-display-settings.md](core-display-settings.md)
defined in `src/engine/displayOptions.ts` — `beams: 'slanted' | 'flat'`, default
`slanted` — with the same contract that doc set: options are pure, defaults render
byte-identically, the alternative output is tested option-aware, and the workbench
persists the preference as a UI preference. No document field: this is a viewer's
choice about a score, not a fact about it, and it must **not** become an `_x.mnxLab`
field or be taught to the assist loop.

## Evidence

- **Reference**: the Guitar Pro score's Soundslice engraving, both default and flattened,
  captured in the review that raised this. Keep the two crops in `notes.md` of the new
  scenario.
- **A new lab scenario** under `scenarios/lab/11-rhythm/` — sixteenth groups whose outer
  heads span a third, a fifth and an octave, one, two and three beams deep — so the
  minimum-per-level rule and the slant cap are both pinned by one golden rather than
  inferred across the spec mirrors.
- **The spec mirrors already covering beams** (`beams`, `beam-hooks`,
  `beams-across-barlines`, `beams-inner-grace-notes`, `beams-secondary-beam-breaks`,
  `beams-secondary-beam-breaks-implied`, `grace-notes-beamed`) are the regression set:
  after item 1 they should differ from `main` only in stem length and beam height, never
  in beam membership, level count, hooks or slant direction. `harness/conformance/beaming.test.ts`
  asserts membership and is expected to stay green untouched.

## Gates

- Items 1 and 2 each move goldens and each **register a batch in
  [lab-verify.md](../inprogress/lab-verify.md)** before closing — cause, the beam
  scenario set, and what a reviewer should look for (shortest stem per level; beam edge
  on a line/space boundary). Registration is not approval; the hand-edit ban on
  `verification:` blocks is unchanged.
- Item 3 changes no golden at its default and adds one option-aware harness test per
  view.
- The three items land in order. Item 3 may not ship before item 1.

## What building it taught

- **One placement, three callers.** The three copies of the slant-and-slide code
  (principal, grace, tuplet) collapsed into `placeBeamLine`, which takes the stems, the
  normal and minimum lengths, the slant cap and an optional staff to settle on. Grace
  beams pass everything at `GRACE_SCALE`. The tuplet's inner beam is drawn one level deep
  whatever its durations, so it takes the one-beam minimum.
- **Tremolos are not beamed groups.** The proposal listed tremolo bars as a fourth
  caller. They are not: a multi-note tremolo's stems are flagged stems of normal length
  with the bars floating between them, and nothing about a shortest stem applies. Left
  alone.
- **The snap nudge is up to 0.37sp, not a quarter.** A beam centre is settled when it
  is within half a beam plus half a staff line of a line's centre (0.315sp); the widest
  mid-space gap is therefore 1 − 2 × 0.315. The nudge is outward only, and only for
  beams whose centre lies within that margin of the staff — everything else has nothing
  to settle on. Only the anchor end is settled; the slant carries the far end.
- **The scenario, as evidence.** `lab/rhythm/beamed-stem-lengths` pins the rule by
  numbers, not by eye: `harness/conformance/beam-geometry.test.ts` asserts the shortest
  stem per row is exactly 2.5 / 3 / 3.5 spaces from the head, that every primary beam
  has at least one settled stem, that `beams: 'flat'` draws every beam horizontal on
  principal, grace, tuplet and Both beams, and that the default is byte-identical to the
  omitted option. Seventeen existing scenarios moved, three of them `verified`, all with
  beam membership unchanged.

## Not this

- **Stem direction**, cross-staff beaming, or the middle-line rule for far ledger notes.
  Those are their own docs if wanted; nothing here changes which way a stem points.
- **Beam thickness and gap** — ours match the usual half-space / quarter-space figures
  and the reviewer did not raise them.
- **The tab staff** (`tabStaff.ts`) draws no beams at all — tuplets there are always
  bracketed for that reason — so nothing here touches it.

## Amendment — 2026-09-09, the same day

The reviewer looked at the score that raised this under item 1 and saw half a space of
difference, which is all the two-beam minimum of 3.0 could give it. Two changes, both
asked for in the review:

**The per-level step is 0.** `BEAMED_STEM_MIN_STEP_SP` was 0.5 (Gould's half space per
extra beam); it is now 0, so the shortest stem in *any* beamed group is 2.5sp. The cost is
the one the proposal named: under three beams the innermost beam's near edge is only
0.75sp from the anchor head. The 32nd groups in the exhibit show it; it is readable, and
the knob is one constant if it ever is not.

**"Flat-topped" beams, by the engraver's rules.** `beamSlant` now draws a beam **flat**
when any of Gould's three conditions holds — the outer heads are at the same height; the
heads form a repeating pattern (E G E G, or E G G D E G G D); or the head nearest the beam
is an *inner* one, so a slope would only carry the beam away from it — and otherwise
slants **a quarter space per staff step** of the outer interval, capped at
`BEAM_MAX_SLANT_SP`, now **0.75** (was 1). A step rises a quarter, a third a half, a
fourth or more the cap. `display.beams: 'flat'` still forces the cap to zero.

The exhibit gained three bars to pin this: the first four bars are all alternating
patterns and beam flat now; bar 5 holds a rising fifth (capped), an inner-extreme group,
a falling fourth and a falling step; bar 6 a rising fourth and a group whose inner head
is level with the nearer outer one; bar 7 a falling step in eighths. Writing it caught
one wrong assumption on the first try — E F E D is *not* a falling-step group, because F
is its highest head and it sits inside, so the rule correctly flattens it. The
`harness/conformance/beam-geometry.test.ts` expectations are now a list of exact slants
per group in document order.

On the reference score (bar 1, first half-bar, G B♭ B♭ D G B♭ B♭ D under two beams) the
stems went 5.07 / 4.21 / 4.36 / 3.50 → 4.57 / 3.71 / 3.86 / 3.00 with item 1, and now
**4.5 / 3.5 / 3.5 / 2.5, flat**: the shortest stem at Soundslice's length, and the beam
horizontal because the inferred half-bar group is a repeating pattern — the flat-topped
look the review asked for, arrived at by rule rather than by the display option. The verification batch in
[lab-verify.md](../inprogress/lab-verify.md#beam-geometry--2026-09-09) is updated in
place; nothing in it had been reviewed yet.

