# The W3C comparison oracle — 27 pairs the spec wrote for us

> **Status: BUILT 2026-09-04**, corrected twice the same day (below). Item 1 of
> [core-campaign-musicxml.md](../proposed/core-campaign-musicxml.md), and the item that
> reports the campaign's baseline. **The baseline is 0 match / 1 spacing / 26 content**,
> and the 26 collapse into roughly eight causes, two of which account for eleven
> scenarios. Kept in `inprogress/` while the campaign's early items consume it.

## What this is

The MNX spec ships 27 `spectools.exampledocumentcomparison` records: one worked example
in MNX, and the same music written in MusicXML 3.1, both authored upstream. We already
mirror the MNX half as `scenarios/spec/<slug>/`, with layout goldens and human
verification records attached.

So for 27 slugs there is a canonical answer to "what should importing this MusicXML
produce", **and we did not write it**. That is the only oracle in the converter's life
that is not our own opinion, and it was sitting unused in the tree.

## The agreement block

Per the campaign's shared contract:

1. **The oracle** — itself. The structural diff it cannot see is named below.
2. **The MNX verdict** — none needed. This item adds no converter features, so it
   proposes no `_x.mnxLab` and touches no schema.
3. **The dependency budget** — no new dependency of any kind, runtime or dev.
4. **The matrix row** — none yet; item 2 consumes this report as its first input.
5. **The losslessness bar** — not applicable to a measuring instrument. The bar this
   item is held to instead: **the baseline is committed and moving it in either
   direction is a red test.**

## Why the comparison is at the primitives layer

The obvious assertion is that the imported document deep-equals the reference MNX. It
cannot pass, and writing it would have been the campaign's first mistake. **MusicXML →
MNX is not a bijection**: ids, voice numbering and ordering, beam nesting and how a
sequence is split all admit several correct encodings. An assertion that fails for
reasons nobody cares about gets weakened until it means nothing.

Primitives are geometry plus SMuFL glyph names, so two documents that lay out
identically are the same music, whatever they called their notes. The oracle is:
import → `layoutNotation` (via `engine/headless.ts`, through
`harness/helpers/corpusPrimitives.ts`) → diff the committed golden.

**One correction to the original framing.** This item was written believing the goldens
carry no ids at all. They carry one: `sourceId`, the note key each mark came from — 450
of them across the spec goldens — which is the note↔JSON cross-highlight hook, not
engraving. It is **normalised, not ignored**: an order-preserving bijection to
first-appearance index, the same move `guitarpro-mnx`'s parity suite makes. That keeps
what `sourceId` actually asserts (which marks share a source) while dropping the naming,
so a renamed note is not a failure and a note collapsed into its neighbour still is.
Before normalisation, eleven scenarios sat at `spacing` with **byte-identical
coordinates** and differing ids alone.

**Its limit, stated so no later item forgets it:** the comparison is renderer-mediated
and cannot see what layout ignores. Anything the engine does not draw is invisible here
and needs a structural check of its own. That is why a near-miss is *graded* rather than
just failed:

| Verdict | Meaning |
|---|---|
| `match` | the whole notation system is identical, coordinates included |
| `spacing` | same glyphs in the same order, different positions — same music, spaced differently |
| `content` | different music, reported as the glyph multiset delta |
| `import-failed` / `layout-failed` | threw, with the message |

## What was built

| Piece | |
|---|---|
| `spec/tools/specSource.mjs` | `loadMusicXmlComparisons()` — keeps all `data.json` reading in the module that already owns it |
| `spec/tools/sync-musicxml-comparisons.mjs` | mirrors the 27 into `converters/fixtures/w3c-comparisons/`, prunes orphans, writes the attribution README. `npm run sync:musicxml-comparisons` |
| `converters/fixtures/w3c-comparisons/` | the committed fixtures — **generated, do not hand-edit** |
| `harness/conformance/musicxml-oracle.test.ts` | the oracle, plus the pairing tripwire |
| `harness/reports/musicxml-oracle.json` | the committed baseline. `npm run update:musicxml-oracle` |

**The fixtures are committed on purpose.** `git worktree add` does not populate
`vendor/mnx` and a fresh clone has it empty, so a test that read the submodule directly
would be a test that most checkouts skip. This is the same reasoning that has
`sync:spec` commit `scenarios/spec/` rather than deriving it at run time.

## The baseline, and what it found

**7 match, 20 content, 0 crashes** at the time this item closed — every one of the 27
parses and lays out, and seven reproduce a human-verified golden byte for byte after
`sourceId` normalisation. Item 2 closed the four ties/slurs scenarios the same day,
taking it to **11 match / 16 content**; the table below is what remained after that.

That number is the *second* baseline. The first was 0 match / 1 spacing / 26 content,
and most of the gap was **not the converter** — see the two corrections below. What
remains:

| Cause | Scenarios | Evidence |
|---|---|---|
| **`<beam>` not imported** | 6 — `beams`, `beam-hooks`, `beams-across-barlines`, `beams-inner-grace-notes`, `beams-secondary-beam-breaks`, `parts` | beam `line`s missing, flag glyphs in their place. The single biggest remaining cause |
| **final-barline default** | 5 — `hello-world`, `two-bar-c-major-scale`, `three-note-chord-and-half-rest`, `repeats-alternate-endings-simple`, `repeats-alternate-endings-advanced` | one extra `rect`, nothing missing (below) |
| **jumps** | 2 — `jumps-dal-segno`, `jumps-ds-al-fine` | `segno` glyph and *D.S.* / *fine* text missing |
| **ottava** | 1 — `ottavas-8va` | `text:8va` missing, bracket lines extra |
| **accidental spelling** | 1 — `accidentals` | a natural read as a flat |
| **tuplet number** | 1 — `tuplets` | draws *3* where the reference draws *6* |

### The `rect` is a defaults disagreement, not a bug

The five `rect` scenarios all say the same thing: our import draws a **final (thick)**
barline where the reference draws a **regular** one. Their MusicXML carries no
`<barline>` at all, and the W3C's own MNX writes `barline: {type: "regular"}` explicitly
on the last measure. So MusicXML's default (absent = light) and MNX's default
(absent = final, as our engine renders it) **disagree**, and a faithful importer has to
say which it means.

It is deliberately left open, because the fix is not one-sided: making import explicit
without making export explicit moves the asymmetry rather than removing it, and the
guitar fixtures currently round-trip only because both directions drop it — the same
symmetric blindness described below. It wants its own item, and possibly a question
upstream about what an absent MNX barline means.

## Two corrections the oracle made to itself

Both were found by *using* it, within an hour of it existing, and both had inflated the
first baseline.

### The fixtures carried the spec site's diff markup

24 of the 27 documents wrap elements in `<metadiff>` — the docs site's
diff-highlighting wrapper, marking what changed relative to a related example. It is not
MusicXML. 116 occurrences, around precisely the elements that matter most here:
`<beam>` 48, `<notations>` 17, `<barline>` 11, `<time-modification>` 11, `<direction>` 7,
`<tie>` 5.

A `<notations>` nested inside `<metadiff>` is invisible to any parser looking for it as a
child of `<note>` — so **the converter read as having dropped features it had never been
shown.** The first baseline's headline causes (`<beam>` worth 7 scenarios, ties and slurs
worth 4, key and time signatures, jumps, dots) were substantially this.

`loadMusicXmlComparisons` now unwraps it. This is the XML twin of `stripDocsAnnotations`,
which the MNX side of the same fixture has always had — the tell was there, and the
lesson is that **a fixture from a documentation system carries the documentation's
presentation, and the first job of an oracle is to be right about its own inputs.**

### The goldens are not id-free

The oracle was built believing `expected.primitives.json` carried no ids. It carries
`sourceId` on 450 primitives. After the fixture fix, eleven scenarios sat at `spacing`
with **byte-identical coordinates and different ids alone** — a verdict that read as "the
music is right but the spacing moved" when the spacing had not moved at all.

Normalising `sourceId` (order-preserving bijection, per the Guitar Pro parity precedent)
turned all eleven into `match`. The original claim came from grepping a golden for the
key `"id"`, which `sourceId` does not match. **A negative established by one grep is not
established.**

## The finding that matters most

`tied` appears **zero times** in `converters/musicxml-mnx/src/` — neither import nor
export. `beam` appears once, in export only. And **none of the three guitar fixtures
contains a single tie.**

So the converter's 46 round-trip invariant tests pass, over three fixtures, across a
feature that is not implemented in either direction. That is not a gap in the tests'
rigour; it is the shape of the oracle. **A round trip is blind to a symmetric omission** —
drop a feature on import and on export and the round trip is perfectly lossless and
perfectly empty — and **fixtures drawn from one genre cannot find what the genre does not
contain.** The campaign wrote both of those down as arguments on 2026-09-04; the oracle
demonstrated both on live code the same day.

This is the concrete case for the campaign's ordering: item 1 before item 4, and the
support matrix (item 2) before any feature item, because "the round trip is green" was
never evidence of support.

## What this item deliberately does not do

**No converter code changed.** The point of a measuring instrument is that it is built
before the thing it measures is touched, so the baseline is a fact about the code as it
was found. Every cause in the table above is a future item's evidence, not this item's
work list.
