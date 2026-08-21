# Vertical distance is measured ink to ink — cohesion and separation as two constants

> **Status: IN PROGRESS — stages A and B built 2026-08-21; C and D open.**
>
> **Stage A (`da6534c`).** Labels and tempo marks sit `COHESION_CLEAR_SP = 1`
> above the highest ink under their *own footprint* (± `TEXT_SIDE_CLEAR_SP`
> = 0.5), or at `TEXT_MIN_RISE_SP = 1.5` over a clear staff — measured through
> SMuFL boxes, so stems count. Two things the proposal had not spelled out:
> the window is the text's footprint, not the bar (a tempo mark at the bar's
> start does not climb over a segno at its end — the whole-bar version was
> tried and looked exactly that silly); and text is drawn at a provisional
> baseline then placed once its real extent exists, so engine and test measure
> the same window. The tempo hands its box to the label pass explicitly,
> because lifted over a stem it can climb past `rowTop`. `tightenRows` now
> runs at every density: at 1 its formula only ever widens a gap whose ink
> overran the pads, and every golden outside the text set staying put is that
> claim checked corpus-wide. Goldens: exactly the **9** text-bearing scenarios
> (the estimate said 8; `spec/tempo-markings` is the ninth); **6 demoted** to
> stale for the `/verify` sweep.
>
> **Stage B.** The assembler runs twice: a *probe* pass opens every
> to-be-measured gap to 100sp — at the real gap, nearest-band attribution
> misfiles a verse row hanging 7sp under a notation staff as the tab's, and
> ink extents are translation-invariant so the probe's answer is exact — then
> a second pass sets each tab-adjacent gap, per row, to
> `max(inkBelow + inkAbove + SEPARATION_CLEAR_SP (3), MIN_STAFF_GAP_SP (4))`,
> `padDensity` scaling the two constants. Segments with nothing to measure
> return the probe pass, which IS the provisional layout. Goldens: **20 of 21
> `expected.both.svg`**, no standalone golden; **no demotions**, because no
> record carries a `bothHash` yet — the both system earns its hash only
> through a real approval, and that approval is what the sweep now gives it.
> `LayoutResult.displays` (per row, per display band) is new metadata for the
> harness. Assertions in `ink-measured-gaps.test.ts`: every tab-adjacent gap
> equals the rule (attributing ink by a *different* method — class vocabulary
> + nearest band — so the two can only agree by both being right), separation
> holds, both narrowing and widening occur, notation↔notation gaps stay at 6.
>
> Originally: **PROPOSED 2026-08-21.** Raised from two screenshots of the same
> score: in the `both` view the section label sits almost on the treble
> stems and the tab staff crowds the notation above it while the bass staff
> below floats in empty air; in the tab-only view the same label floats high
> above a staff that has no stems to clear. Asked as a question — *is there a
> principled way to keep related things together and unrelated things apart?*
> — and the answer is one the engine already uses in one of its three
> vertical decisions.
>
> Lineage: [core-vertical-density.md](../complete/core-vertical-density.md)
> built the mechanism (`tightenRows`: *"the frame follows the ink instead of
> predicting it"*) and confined it to the space **between systems** at
> non-default density. This doc generalizes it to the two decisions it left
> out — the label row and the staves within a system — and proposes making it
> the default. Sibling of the ink-pricing work on the horizontal axis
> ([core-ink-priced-columns.md](../complete/core-ink-priced-columns.md)):
> that one said rigid *widths* are ink; this one says vertical *distances*
> are measured from ink.

## What the engine does today — three decisions, three methods

1. **Label above the staff** ([scoreText.ts:153-206](../../src/engine/layout/scoreText.ts)).
   A section/rehearsal label sits at a fixed `SCORE_LABEL_BASE_RISE_SP = 2.8`
   above the top line, unless something already occupies that space, in which
   case it stacks above it. The occupancy scan reads `p.y` — and **stems are
   `line` primitives with `y1`/`y2`, so the scan cannot see them**. That one
   fact is both screenshots: on notation the label lands 2.8sp up regardless
   of stems reaching 3.5sp up (too close); on tab there are no stems and it
   still lands 2.8sp up (floating). The tempo mark has its own fixed rise
   (`TEMPO_BASELINE_RISE_SP = 2.7`) with no scan at all.

2. **Staff to staff inside a system** ([notation.ts:1041-1044](../../src/engine/layout/notation.ts)).
   `INTER_STAFF_GAP_SP = 6`, fixed; content-aware only for lyric blocks above
   a tab staff. Measured on the first screenshot: notation→tab is ≈6.6sp
   line-to-line, and tab→bass is ≈11.7sp *from the tab's top* — the tab's
   5.7sp height plus the same 6sp gap. **The two gaps are geometrically
   identical.** They read as wildly different because the notation→tab gap is
   full of ink (down-stems, the 8vb clef tail) and the tab→bass gap is pure
   air (fret digits sit *on* the strings; the bass notes hang *below* their
   staff). Equal line-to-line distance, unequal ink-to-ink distance — which is
   the only distance a reader perceives.

3. **System to system** ([verticalDensity.ts:147-163](../../src/engine/layout/verticalDensity.ts)).
   Done right: each gap is `max(ink below + ink above + MIN_CLEAR_SP,
   gap × padDensity)`, measured from the primitives actually emitted. But
   `tightenRows` returns null at `padDensity = 1` — the golden-safety ruling
   — so **the default paint never benefits**.

## The principle

> **Vertical distance is measured ink to ink, never line to line, with two
> clearance constants: a small one between things that belong together and a
> larger one between things that do not.**

It dissolves the cohesion-vs-separation tension instead of balancing it:

- A section label **belongs to** its staff: *cohesion clearance*
  (`COHESION_CLEAR_SP`, ≈1sp) above whatever ink is there. On tab nothing
  rises above the top string, so the label hugs it. On notation with high
  stems it sits 1sp above the tallest stem in the bar — as close as it can be,
  never closer. The same constant places a tempo mark, and stacks a label
  over a tempo mark.
- A tab staff **does not belong to** the notation staff above it:
  *separation clearance* (`SEPARATION_CLEAR_SP`, ≈2.5–3sp) between the
  notation's lowest ink and the tab's highest. Where the treble hangs
  down-stems the gap grows by exactly their reach; where the bass carries
  nothing above its staff the gap collapses to the constant, and the empty
  band in the screenshot disappears.
- Two systems do not belong together either — `tightenRows`' `MIN_CLEAR_SP`
  *is* the separation constant, already; it just needs to be the same number
  and to run by default.

This is Gestalt proximity written as arithmetic: related = small ink gap,
unrelated = larger ink gap, and no gap is ever measured from an abstract line
the reader cannot see. The codebase has made the call three times in smaller
ways — `tightenRows`, `ensureTopMargin`, the lyric-aware tab gap — without
unifying them.

## Mechanism: the post-pass, one level down

The chicken-and-egg (positions are chosen before ink exists) is solved the
way `tightenRows` solves it: **lay out with provisional gaps, measure each
band's ink, re-place by translation.** Today that runs over *rows*; this runs
it over the *display staves within a row* too. A display band is the tuple
the both-view assembler already builds (`displayTopOf`, `displayHeights`),
and `computeBoundsSp` over the primitives a band owns gives its ink reach,
through the same SMuFL bounding boxes the snug crop and `tightenRows` trust.
Ownership of a primitive by band uses the same midpoint rule `tightenRows`
uses for rows.

Two decisions to fix before code, because they are engraving judgements and
not implementation details:

1. **Staff gaps are per-system; label rises are per-bar.** Staff lines are
   straight, so an inter-staff gap is the *maximum* ink demand along the
   whole system — exactly how `tightenRows` treats a row. Labels avoid ink
   locally, bar by bar, which is what the current scan already does and what
   engravers do for rehearsal marks. A per-system label baseline (Gould's
   "align across the system") is the alternative and is deliberately **not**
   chosen: one tall stem would lift every label on the line.
2. **Ink-measured becomes the definition of density 1.** Today density 1
   means "fixed pads, goldens frozen" — `tightenRows`' does-not-run clause.
   This doc proposes that the *default* gap be the ink-measured one, with
   `padDensity` scaling the **clearance constants** rather than the fixed
   pads (so the pad still means "how much air", and the floor is still
   collision-free by construction). That reopens core-vertical-density's
   golden-safety ruling **on purpose**; the staging below is what keeps the
   reopening legible, one `/verify` sweep at a time. The fixed pads survive
   only as the *provisional* layout the post-pass measures against, so a
   band that carries nothing still gets a sane minimum (`max(ink + clear,
   MIN_GAP)`).

## Staging — three sweeps, widening blast radius

Each stage is its own landing with its own `update:primitives` diff and
`/verify` sweep; none may move a golden outside its stated set.

- **Stage A — the label row.** Fix the occupancy scan to see `line`
  primitives (stems, ledgers, beams) through `computeBoundsSp` rather than a
  `.y` read, and replace `SCORE_LABEL_BASE_RISE_SP` / `TEMPO_BASELINE_RISE_SP`
  with *ink above + `COHESION_CLEAR_SP`*, floored at a small rise so a bare
  tab staff still gets a label with air under it. Moves only scenarios that
  carry a section, rehearsal or tempo mark — **8 documents** in the corpus
  today. Both screenshots are fixed by this stage alone: the tab label drops
  to the strings, the notation label clears the stems.
- **Stage B — display staves in the `both` view.** Ink-measured gap above
  each injected tab staff and above the notation staff that follows one.
  Moves `expected.both.svg` only — the both system is deliberately not in the
  primitives file, so the standalone goldens cannot move. **21 both goldens**
  exist today. This is the tab-crowds-notation / bass-floats symptom.
- **Stage C — grand-staff and multi-part gaps in plain notation.** The same
  rule for `INTER_STAFF_GAP_SP` between notation staves. Widest radius: every
  multi-staff notation golden. Last, and only after A and B have shown the
  rule reads well in review.
- **Stage D (decision, not code) — density 1 becomes ink-measured** between
  systems too, i.e. `tightenRows` runs by default with `padDensity` scaling
  the clearances. Moves every multi-system golden's row pitch. Taken only
  once A–C are verified, on their evidence.

## Gates

- Per stage: `update:primitives`; the diff confined to the stated set (a
  golden moving outside it is a scope bug, not a surprise); `/verify` sweep
  of the demotions; `npm test`, `check:scenarios`, `build`.
- Conformance, per stage: the clearance actually holds — for every label,
  `labelBottomInk − topInkBelowIt ≥ COHESION_CLEAR_SP − ε` and `≤ COHESION +
  small`, corpus-wide (the upper bound is what proves cohesion, not just
  non-collision); for every adjacent display pair, `inkGap ≥
  SEPARATION_CLEAR_SP − ε` and equal to it somewhere on the system (the
  maximum demand is met exactly, nothing is padded beyond it).
- Mutation-checked like the horizontal work: break the line-aware scan and
  the label test fails; freeze a display gap and the pair test fails.

## Not this

- **Not per-system label alignment** (decision 1 above).
- **Not a collision solver.** Labels stack above ink in one dimension; this
  does not shove tempo marks sideways or re-flow directions. Horizontal
  collisions stay the spacing plan's business.
- **Not touching `ROW_PAD_*` as numbers.** They become the provisional frame
  the post-pass measures against, not the answer.
- **Not stage D by stealth.** Running `tightenRows` at density 1 is a ruling
  reversal and is taken as one, after A–C, not folded into A.

✔ when: stage A lands and both screenshots read right — the tab label within
a staff space of its top string, the notation label one clearance above its
tallest stem — with the corpus diff confined to label-bearing scenarios and
re-approved; then B and C on the same terms; D as a recorded decision.
