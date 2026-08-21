# The last system borrows its stretch from the page

> **Status: BUILT 2026-08-21, awaiting the `/verify` sweep.** One exported
> helper, `capLastRowStretch` in `spacing.ts`, applied in `packSystems` (so
> the ladder, `packedRowMeasures` and every plan agree by construction) and
> again on the ink-priced re-justification path, which computes its own row
> stretches. `MAX_STRETCH`/`MIN_SQUEEZE` are now exported for the harness.
>
> **Corpus effect, measured:** `update:primitives` moved **5 scenarios, all
> multi-system, none single-system** — `lab/00-document/03-navigation-playground`,
> `lab/10-durations/01-rest-gallery` and `spec/tie-targets` demoted
> `verified → rendered` (records kept, so the queue reads *stale*);
> `lab/00-document/04-twelve-bar-blues` and `spec/multimeasure-rests` were
> already `rendered`. Every changed primitive sits in a final system — with
> one nuance the proposal did not spell out: `multimeasure-rests` has
> per-system layouts, and each layout segment is its own packing, so each
> multi-row **segment's** last row caps independently. That is the rule
> applied at the unit the packer already works in, not an exception to it.
> **The three demotions are the `/verify` sweep this item still owes.**
>
> Five assertions in `harness/conformance/ragged-last.test.ts`: the rule's
> own table (floor at 1, never raised, others untouched, one system is not a
> page); corpus-wide at 40sp and 80sp, including that the packer's numbers
> equal the helper applied to an uncapped mirror (no second copy of the rule);
> the reported case on `twelve-bar-blues` swept 50–140sp, asserting the
> uncapped last row *was* the cap and the rule pulled it to the page; a
> single-system score byte-equal to the raw formula; and the ink-priced path
> obeying the same ceiling, read back off the plan through the leading spring.
>
> Originally: **PROPOSED 2026-08-20.** Found in the same tab-view session as
> [core-ink-priced-columns.md](../complete/core-ink-priced-columns.md): a score whose
> first system runs at stretch ≈ 1 and whose leftover final bar is set at the
> `MAX_STRETCH = 2.5` cap — two and a half times the note spacing of the row
> above it, and *still* short of the right margin. Different mechanism than
> the sibling (the justifier's cap, not the scale), and the opposite golden
> story: this change **moves goldens by design** and runs through the
> `/verify` queue.

## The symptom

`packSystems` justifies **every** row toward the full line width
independently: `stretch = clamp((lineWidth − rowRigid) / rowSpring, 0.35,
2.5)` ([spacing.ts:282-284](../../src/engine/layout/spacing.ts)). A full row
lands near 1. A final row holding the leftovers computes a huge stretch and
slams into the cap — which is doing its job (*"sparse rows stay natural
rather than stretching one bar across the page"* — except it doesn't stay
natural, it stays at 2.5× natural). The reader gets the worst of both worlds:
the last system's texture disagrees with the whole page above it, **and** it
doesn't reach the margin anyway, so the disagreement buys nothing. Small
stretch differences between full rows are inherent to justification and read
fine; 2.5-vs-1 is a different engraving on the same page.

## The rule: page-relative, not a threshold

The conventional fix is a fill threshold — justify the last system only when
it is ≥ ~70% full, else set it natural (LilyPond's `ragged-last`, TeX's
`\parfillskip`). It works, but it introduces a magic constant and a
discontinuity: a score hovering at the threshold flips between two spacings
as the viewport resizes.

The principled rule derives the answer from the score instead:

> **The last row may not be stretched looser than the loosest other row on
> the page.**
>
> `stretchLast = min(computedStretch, max(1, …other rows' stretch))`

If the full rows run at 1.1, the leftover bar sets at 1.1 and reads as the
same texture — which is what "consistent spacing" *means*, so the definition
is the implementation. No constant to tune, no flip point; the reference
moves continuously as bars re-wrap under resize and density. The `max(1, …)`
floor keeps a page of over-full squeezed rows (stretch < 1) from squeezing
the last row below natural — compression is a necessity the full rows were
forced into, not a texture to propagate.

**Scope: `rows.length ≥ 2` only.** A single-system score has no page to
disagree with, so the rule does not fire and today's behavior stands. This is
principled (the rule is *page consistency*; one system is not a page) and it
is also what contains the golden churn: most corpus scenarios are
single-system, and re-spacing all of them for a rule about page texture would
be evidence-free demotion at scale.

Where it lives: inside `packSystems`
([spacing.ts:273-286](../../src/engine/layout/spacing.ts)) — the one place
row stretch is decided, shared by `planHorizontal`, the density ladder and
`packedRowMeasures`, so every consumer (including the pad's rung signatures,
which hash `densityH × stretch`) sees the same answer by construction. A few
lines of change; the review is in the corpus, not the diff.

## Goldens move, and that is the process working

Every multi-system scenario's final system respaces. `npm run
update:primitives` demotes their `verified` records to `rendered` (the
verification record is kept, so the queue reads **stale**, not never-seen),
and the `/verify` sweep re-approves with eyes on each engraving. That is
exactly what the queue exists for: this is a deliberate engraving change and
a human asserts it scenario by scenario. Budget the sweep as part of the
item, not as fallout.

The density ladder is a second, quieter consumer: rung signatures include
stretch, so ladders on multi-system scores may gain or lose rungs. Not a
correctness issue — the ladder's contract is "every value that draws
differently", and the set of such values legitimately changed — but the
conformance ladder assertions should be re-derived, not patched to pass.

## Gates

- `npm run update:primitives`; the diff touches **only** final-system
  coordinates of multi-system scenarios — any single-system scenario moving
  is a bug in the scope rule.
- Conformance: last-row stretch ≤ max(1, other rows' stretch) across the
  corpus; single-system scores byte-identical; `MIN_SQUEEZE` still governs
  overfull last rows (the rule only ever *lowers* stretch, never raises it).
- `/verify` sweep of the demoted scenarios.

## Not this

- **Not a fill-threshold constant.** Rejected above; if the page-relative
  rule ever proves insufficient the threshold debate reopens with evidence.
- **Not global line breaking.** The root cause of orphan bars is greedy
  packing; a Knuth–Plass-style breaker would balance rows so a sparse last
  system rarely exists. That is a real, separate item (engine-wide, moves
  every multi-system golden, interacts with forced breaks and the ladder) and
  should be proposed on its own evidence if raggedness keeps hurting after
  this lands.
- **Not `MAX_STRETCH` itself.** 2.5 remains the cap for rows that *are*
  trying to reach the margin; this rule only decides which rows owe the
  margin anything.

✔ when: the screenshot score's final bar sets at its page's texture, the
corpus diff is confined to final systems, the sweep is re-approved, and the
conformance assertions are mutation-checked (delete the `min`, watch the
corpus assertion fail).
