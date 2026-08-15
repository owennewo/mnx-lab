# The queue's colours after "red everywhere"

> **Status: proposed 2026-08-15.** Item 6 of
> [core-campaign-modernist.md](core-campaign-modernist.md). Blocks on
> [core-modernist-tokens.md](core-modernist-tokens.md), which deliberately does **not** touch the
> pip ramp — this is the bill that item runs up.

## The problem the restyle creates

The workbench encodes state in colour in two places, and both were designed against a
palette that had hues to spare:

- **Scenario status** — `--st-draft`, `--st-valid`, `--st-rendered`, `--st-verified`, plus
  `--st-gap` for the spec-gap diamond. Rendered as `.pip[data-st]` in `sharedChrome`,
  so they appear anywhere a scenario is listed.
- **Queue state** — `classify()`'s `blocked | stale | never-seen | current`, drawn as the
  rail's dot.

Modernist admits **one accent**. Its readme is explicit that the system is *"mostly ink
on ground"* with red *"used sparingly, for the primary action and small emphasis"*. Four
status hues and four queue states do not fit through that.

Worse than not fitting: after item 1, `--st-verified` is blue and `--st-gap` is an
orange-red sitting next to a red accent. The first will read as a leftover from the old
design; the second will read as an *accident* — two nearly-identical reds meaning
entirely different things, one of which ("spec gap") is not even a problem with the
scenario.

## Why this is separate from the token flip

Item 1's job is to flip the surface **without changing what anything means**. The queue
is the workbench's primary information display — home is the attention queue, the rail's
dots are how you scan 100+ scenarios, and the whole corpus contract is built on the
distinction between *stale* and *never seen*. Re-encoding that inside a repaint is
exactly how meaning gets lost: the diff looks like colour, so nobody reviews it as
semantics.

So the ramp survives item 1 untouched and gets its own review here.

## The material already available

**Shape is already load-bearing, and that is the opening.** CLAUDE.md records the rule
for the rail: the dot is queue state *"(shape as well as colour, so **stale** stops
looking like **never seen**)"*. The redundant encoding was added because colour alone
already failed once — for accessibility and for scanning. Half the work is done, and it
was done for the right reason.

**Lightness is a second axis Modernist explicitly supports.** The design ships neutral
and accent ramps *"generated in OKLCH on one shared lightness scale, so the same step of
any role matches the others in visual value"*. A four-step ink ramp is inside the art
direction, not a deviation from it.

**And the tiers already exist elsewhere.** `#/objects` tiers coverage as *never exercised
→ one example → covered*, which is the same ordinal shape as the queue. Whatever encoding
lands here should be reusable there.

## The direction to try

Not a decision — this item's job is to make it, and a mock would help. But the shape the
material suggests:

- **Reserve saturated red for `blocked`.** One accent, spent on the one state that means
  *stop*. This is the design's own instruction about using red sparingly, applied to the
  place where it is most true.
- **Carry the rest on ink lightness plus shape.** `stale`, `never-seen` and `current` are
  an ordinal sequence — approved-then-changed, never-approved, fine — and an ordinal
  sequence is what a lightness ramp is for.
- **Keep `--st-gap` categorically apart.** A spec gap is not a scenario problem; it is a
  statement about the standard. It already has a distinct *form* (the diamond), so lean
  on that and take its colour out of the red family entirely — an ink diamond reads as
  "different kind of thing" better than a second red does.
- **Verified may not need a colour at all.** It is the resting state of most of the
  corpus; the queue counts current scenarios but deliberately does not show them. A pip
  that means "nothing to do here" is a candidate for the quietest treatment in the sheet.

## Where it has to hold up

Three surfaces, and the third is the hard one:

1. **The rail** — 100+ rows, scanned vertically, dots at ~8px. The scanning case.
2. **The queue home** — grouped by state, so the grouping already carries the meaning and
   the pip is confirmation rather than the only signal. The easy case.
3. **`#/objects`** — the coverage map's three tiers, plus counts that read *verified /
   total*. The hard case, because it mixes the status vocabulary with a second ordinal
   (coverage) in one view.

Check all three at real density with real corpus data, not swatches. A ramp that reads
cleanly in a design mock and fails at 8px in a scrolling list has failed.

## Not this

- **Not changing what the states mean.** `classify()` and its four states stay exactly as
  they are; this is presentation only. If the states themselves want revisiting, that is
  the corpus machinery's business, not the restyle's.
- **Not removing colour from the queue.** Redundant encoding is the point — shape *and*
  value, per the existing rule.
- **Not the diagnostic palette.** `diagnostics.ts`'s red/blue/amber are emitted into the
  SVG and frozen in the goldens (campaign tripwire 2). They are engine output, not
  chrome, and they are out of reach by contract rule 4.

## Verification

- Goldens unaffected — chrome only.
- Extend `harness/conformance/design-tokens.test.ts` if the ramp gains or loses tokens, so
  the light and dark halves stay in step (item 2's assertion).
- **Hands-on** at real density: the rail scrolled through the full corpus with a mixed
  set of states; the queue home with all three groups populated; `#/objects` across all
  three coverage tiers. Then the one check that matters most — **grayscale**. If the
  states are still distinguishable with colour removed, the shape encoding is doing its
  job and the ramp is honest.
