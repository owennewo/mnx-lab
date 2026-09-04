# Campaign: MusicXML — zero dependencies, provable accuracy

> **A campaign** (see CLAUDE.md → Conventions): this doc is an index over many normal
> proposals, the shared contract they follow, and the running log of progress and
> learnings as items land. Indexed items are ordinary `core-*` (and one `lab-*`)
> proposals that name this campaign; rows below without a link are undrafted.

## The goal

Two objectives, and every item serves one of them:

- **Zero dependencies.** `converters/musicxml-mnx` runs with no runtime npm dependency,
  in Node and in the browser, on `.xml`, `.musicxml` and `.mxl`.
- **Provable accuracy.** Every claim the converter makes is backed by an oracle that
  is not us — not a round trip against our own assumptions, and not visual inspection.

Neither is where the doc that started this campaign assumed. The two halves fail in
opposite directions, and the campaign exists because fixing each one changes the other's
plan.

**What is true today.** The converter is already clean-room: 4,872 lines of internal
TypeScript across `converters/musicxml-mnx/`, no notation library, one runtime
dependency (`@xmldom/xmldom`, ~124 KB). It parses uncompressed `score-partwise` and is
pinned against four guitar fixtures. Its core alignment pass
(`src/import/aligner.ts`, 1,504 lines) assumes either a single notation part or the
specific standard+TAB guitar pairing; multi-part ensembles and grand staff are not
handled, and neither is `.mxl`.

**The objective is no longer academic.** `src/workbench/guitarProImporter.worker.ts`
already pulls alphaTab *and* a converter into a browser worker chunk, and
`.dependency-cruiser.cjs` was widened to permit it (`alphatab-only-in-file-codecs`).
Converters reach the browser now — CLAUDE.md's "Node-only, never in the app build" is
stale — so a browser MusicXML import path is coming and its bundle weight is real.

### The oracle we already own, and the assertion that would waste it

`vendor/mnx/doctools/data.json` holds **27 `spectools.exampledocumentcomparison`
records**, each carrying complete MusicXML 3.1 source, and every one of their slugs
already exists as a mirrored `scenarios/spec/<slug>/`. All 27 carry an
`expected.primitives.json`; **18 of the 27 are `status: verified`**. That is a
canonical, paired, human-signed-off corpus sitting in the tree unused.

The obvious assertion — `importMusicXML(xml)` deep-equals the reference MNX — **would
fail on all 27 for cosmetic reasons and must not be written.** MusicXML → MNX is not a
bijection: ids, voice numbering and ordering, beam nesting and sequence splitting all
admit several correct encodings. An assertion that fails for reasons nobody cares about
gets weakened until it means nothing.

**Compare through the layout engine instead.** Primitives are geometry plus SMuFL glyph
names. So the comparison is: import the MusicXML, run `layoutNotation` through
`engine/headless.ts`, diff against the scenario's existing golden. **Identical
primitives ⇒ musically identical**, immune to id choice and JSON shape. It reuses the
goldens, the headless entry and the human verdicts that already exist.

The one id primitives *do* carry is `sourceId` (the cross-highlight hook), which is
**normalised** by an order-preserving bijection rather than ignored — see item 1.

Its one limit, stated up front so no item forgets it: the comparison is
*renderer-mediated* and cannot see what layout ignores. It is the primary gate, not the
only one — each item names the narrow structural diff covering what layout drops.

### Why the other tiers rank where they do

- **Round-trip invariance is blind to symmetric bugs.** A wrong import plus an
  inversely-wrong export round-trips perfectly and is perfectly wrong. It is a sharp
  self-check and no kind of proof, so it lands *after* the Tier-1 oracle, never instead.
- **XSD validation is a floor, not an accuracy tier.** A document of all rests
  validates. Worth having on export; worth nothing as evidence of musical fidelity.
- **A third-party implementation is the real analogue of the alphaTab oracle** — the
  thing that made the Guitar Pro retirement provable was that the reference was
  *someone else's code*. Prefer **music21** (BSD, semantic model) over OSMD
  (engraving-oriented, hard to diff): a dev-only subprocess emitting a note table —
  part, voice, onset, duration, pitch, tie, lyric — diffed against the same table
  derived from our MNX. That catches exactly the divisions and backup-cursor class of
  bug that `aligner.ts`'s stateful cursor is exposed to.

### LilyPond: the corpus, not a converter

The `musicxmlTestSuite` (Reinhold Kainhofer's, originally for LilyPond's `musicxml2ly`,
now under the W3C CG) is ~100+ categorised MusicXML files. **That corpus is wanted; a
LilyPond ⇄ MNX converter is not.** An oracle has to be independent, and a second
converter we write shares our own understanding of MNX — common-mode bugs cancel and
agreement proves nothing. `.ly` is also an engraving DSL with embedded Scheme, a far
bigger parsing job than MusicXML, encoding appearance rather than the semantics we
would want to check.

The one form that would earn its keep is a **write-only MNX → `.ly` exporter** used as a
*rendering* oracle — LilyPond being the best free engraver alive makes a side-by-side
against our SVG real signal. That serves the engine loop, not this campaign; it is
recorded here so the idea is not re-argued, and belongs in its own proposal if wanted.

## The shared contract

**No item writes code before its agreement block is written down.** Each indexed
proposal opens with, and is reviewed on:

1. **The oracle** — which tier proves this item, named before the code exists, plus the
   structural diff covering what a renderer-mediated comparison cannot see. "Round trip
   passes" is never sufficient on its own (see above). An item whose oracle is only a
   round trip has not found its oracle yet.
2. **The MNX verdict** — for every feature the item carries: does a standard MNX object
   express it, or does it need `_x.mnxLab`? **A feature that needs an extension is a
   spec-loop event, not an implementation task**: the item names its `proposal:` topic
   under `spec/proposals/` and the extension is shaped like the standard object it
   drafts, per CLAUDE.md's extension rule. Silently inventing a vendor key to make a
   fixture pass is the failure this clause exists to prevent.
3. **The dependency budget** — **no new runtime npm dependency, ever.** Dev
   dependencies for oracles and fixtures are fine and expected. An item that believes
   it needs a runtime dependency stops and argues the case here first.
4. **The matrix row** — every item that changes what a converter supports regenerates
   the support matrix (item 2), and **never hand-edits a cell**. Cells are derived from
   evidence or they are not written.
5. **The losslessness bar** — the item states what "done" means as an assertion, in the
   shape the Guitar Pro work used ("held to losslessness through both readers"). An
   item without a stated bar has no way to be finished.

Deliberately out of contract: `score-timewise` (rejected with an actionable message, or
a mechanical in-memory regroup — not a parsing path of its own), and MusicXML 1.x/2.0
(the format is backwards-compatible and 4.0 is an additive superset, so a 4.0-shaped
reader reads 3.0 and 3.1 without branching).

## The index

The oracle first — it reports the real pass rate and re-ranks everything under it —
then the matrix, which turns fixtures into a map of what to build. Feature items are
deliberately **not** enumerated in advance: item 2 decides them from evidence.

| # | Item | Scope | Objective | Oracle | Status |
|---|------|-------|-----------|--------|--------|
| 1 | [Tier-1 W3C oracle](../inprogress/core-musicxml-w3c-oracle.md) | The 27 comparisons mirrored into committed fixtures (`sync:musicxml-comparisons`) and judged **through the layout engine**: import → `layoutNotation` → diff `expected.primitives.json`, graded `match`/`spacing`/`content`. Baseline committed at `harness/reports/musicxml-oracle.json`; moving it either way is a red test. | accuracy | itself | **built 2026-09-04** |
| 2 | Converter support matrix (`lab-converter-matrix.md`) | Rows = MNX `$def` (193, minus plumbing) + `_x.mnxLab` keys; columns = converter × direction. **Cells derived, never declared** (below). Generated, committed artifact; hand-edit is a red test. Extends `src/corpus/defIndex.ts` and the `#/objects` page rather than building a second thing. | both | the corpus itself | proposed |
| 3 | W3C/LilyPond corpus | Vendor a curated subset of `w3c-cg/musicxmlTestSuite`. **License verified before a byte lands** — the MIT claim is unchecked and the LilyPond lineage makes it worth confirming. Assertions per file: parses, drops no notes, measure durations sum to the meter, part/voice counts correct. | accuracy | itself | proposed |
| 4 | Aligner generalization | Separate general part/measure/voice parsing from the guitar standard+TAB merge in `aligner.ts`; multi-part ensembles (N parts), grand staff (2 staves, 1 part). The largest single item, and item 1 gates it — `parts` and `multiple-voices` are both in the 27. | accuracy | 1 + 3 | proposed |
| 5 | Zero-dep XML layer | **A hand-written pull parser, not a `DOMParser` shim.** Node has no global `DOMParser` (confirmed on v22), so an adapter yields "optional Node dep", not zero; and the hard part is *serialization* parity on export (self-closing tags, entity escaping, whitespace text nodes), which a shim does not solve. MusicXML's grammar is fixed and shallow — the same clean-room move as the GP5 binary reader. Retires `@xmldom/xmldom`. | zero-dep | 1 + 3 as regression | proposed |
| 6 | `.mxl` container | **Not the copy-paste it looks like.** `converters/guitarpro-mnx/src/gpif/container.ts` is `node:zlib` `inflateRawSync`/`crc32` — synchronous, no browser branch; the browser path is `DecompressionStream`, which is async, so the read API becomes async and that ripples through import. Also needs a shared converter package, which `converters/` does not have yet. Read `META-INF/container.xml`; stored-zip emission on write. | zero-dep | round trip + item 3's `9x` files | proposed |
| 7 | Differential oracle | music21 as a dev-only subprocess emitting a note table (part, voice, onset, duration, pitch, tie, lyric), diffed against the same table from our MNX. The independent implementation the campaign otherwise lacks. Dev/test only, never shipped. | accuracy | itself | proposed |
| 8 | XSD export validation | W3C MusicXML 4.0 XSD over every generated document in CI. A floor, explicitly not counted as an accuracy tier. | accuracy | itself | proposed |
| 9 | Browser import surface | MusicXML file import in the workbench, parallel to the Guitar Pro worker; `.xml`/`.musicxml`/`.mxl` through the CLI and `localFile.ts`. Depends on 5 and 6 — it is the item that makes the zero-dep objective pay. | zero-dep | `smoke:csp` + existing import path | proposed |
| — | Feature parity | Dynamics, wedges, spanners, ottavas, articulations, SMuFL glyph names, percussion, layout breaks. **Deliberately unenumerated**: item 2 turns these into a ranked queue with evidence, and each becomes its own row when picked up. Note the schema already has `dynamic-*`, `ottava`, `slur` and `wedge-type` as standard objects — but **no pedal def**, so pedal is contract clause 2's first real test. | accuracy | 1 + 2 + 3 | not yet rows |

### Item 2's derivation rule

The reason the matrix is worth building is that **it can be derived, and a declared
support table is a lie within two weeks.** Every status is mechanically observable from
a round-trip differ over the corpus:

| Cell | Observation |
|---|---|
| **supported** | the def survives the round trip |
| **extension** | it survives only carried under `_x.mnxLab` — the key is right there in the output |
| **not implemented** | the converter emits nothing, or throws, on a document containing it |
| **lossy** | present going in, absent coming out — its own status, because it is the dangerous one |
| **untested** | no scenario in the corpus exercises the def at all — the honest cell a declared table always fakes |

And the property that makes it worth a page rather than a report: **it separates the two
kinds of gap by construction.**

- A feature a format expresses but MNX can only hold under `_x.mnxLab` is a **spec gap**,
  and feeds `spec/proposals/` directly — the campaign's contribution to the spec loop.
- A def MNX has and a converter drops is an **implementation gap**, and feeds the work
  queue.

So "implemented as extension" is not a footnote status. It is the spec-loop input, which
is why clause 2 of the contract makes every item declare it before writing code.

The frontend is a `#/converters` page in the same five-band frame as the rest of the
panel, cells linking to the scenario that proves each claim — provenance, not assertion,
exactly as `verified` already works here. No backend: a generated JSON artifact
committed to the repo, like `worker/models.json`.

## Progress + learnings

### 2026-09-04 — item 1 lands, and both of the campaign's arguments are proven on live code

**Baseline: 7 match, 20 content, 0 crashes** over the 27
([core-musicxml-w3c-oracle.md](../inprogress/core-musicxml-w3c-oracle.md)). No converter
code was touched — a measuring instrument is built before the thing it measures.

That number arrived in three steps, and the first two are the story: the oracle's first
reading was **0 match / 1 spacing / 26 content**, and almost all of the gap was the
instrument, not the converter.

- **The fixtures carried the docs site's own diff markup, and it inflated everything.**
  24 of the 27 wrap elements in `<metadiff>` — 116 occurrences, around exactly the
  elements that matter: `<beam>` 48, `<notations>` 17, `<barline>` 11,
  `<time-modification>` 11. A `<notations>` nested inside it is invisible to a parser
  looking for a child of `<note>`, so **the converter read as having dropped features it
  was never shown.** Unwrapping it took the baseline from 0 match to 7. The MNX side of
  the same fixture has always had `stripDocsAnnotations` for the identical reason — the
  precedent was there and went unread. **A fixture from a documentation system carries
  the documentation's presentation, and an oracle's first job is to be right about its
  own inputs.**
- **The goldens are not id-free, and the claim that they were came from one grep.** They
  carry `sourceId` on 450 primitives. Eleven scenarios sat at `spacing` with
  byte-identical coordinates and different ids alone — a verdict reading "the spacing
  moved" when it had not. Normalising `sourceId` by order-preserving bijection (the
  Guitar Pro parity precedent, cited in this campaign's own opening entry and then not
  applied) resolved them. **A negative established by one grep is not established** —
  `"id"` does not match `sourceId`.
- **What actually remains is fewer, larger causes.** `<beam>` unimported is 6 scenarios;
  the final-barline default is 5; jumps 2; ottava, accidental spelling and tuplet
  numbering 1 each.
- **The symmetric-blind-spot argument is not theoretical.** `tied` appears **zero
  times** in the converter's source, import *and* export; `beam` once, export only. And
  none of the three guitar fixtures contains a tie. So 46 round-trip invariant tests
  pass over a feature implemented in neither direction. The campaign asserted that a
  round trip cannot see a symmetric omission, and that genre-bound fixtures cannot find
  what the genre lacks; the oracle demonstrated both the same day the arguments were
  written down.
- **The layer choice was load-bearing, and nearly went the other way.** Before item 1
  existed, an ad-hoc probe counted parts/measures/events/notes and reported 22/27
  "structurally matching" — a number that felt like good news and was mostly an artifact
  of a counter that did not descend into containers. It could not distinguish a
  flattened tuplet from its own blind spot; the reference documents had to be opened by
  hand to tell which. The primitives comparison has no such ambiguity. **A comparison you
  have to interpret is a comparison at the wrong layer.**
- **The graded verdict paid for itself twice.** `spacing` — right glyphs, wrong
  positions — is what made both corrections visible: a plain pass/fail would have shown
  26 failures before and 20 after and taught nothing about why.
- **Committed fixtures, not submodule reads.** `git worktree add` leaves `vendor/mnx`
  empty, so an oracle reading the submodule directly is an oracle most checkouts skip.
  Same reasoning that has `sync:spec` commit its output.


### 2026-09-04 — the campaign opens: two objectives, opposite failure modes

Written from an assessment of a prior research document (`musicxml_converter_research_
and_plan.md`, authored outside this repo). Its research was accurate — the structure,
dependencies and line counts all check out against the tree — but its two halves needed
opposite corrections, and that is the shape of the campaign.

- **The accuracy half was stronger than it knew, and stated its assertion wrongly.**
  It found the 27 W3C comparisons, which is the best idea in it. It then proposed
  asserting imported MNX deep-equals the reference MNX, which cannot pass, because the
  mapping is not a bijection. Checking `scenarios/spec/tuplets/expected.primitives.json`
  settled it: **the primitives goldens carry no ids** — they are geometry and glyph
  names. Comparing through the layout engine makes the same 27 fixtures a working
  oracle instead of a brittle one, at almost no cost, and 18 of them already carry a
  human verdict. **When an assertion is about to be weakened to make it pass, the
  comparison is being made at the wrong layer.**
- **The zero-dep half was overclaimed in two specific places**, both of which look like
  copy-paste and are not: the `DOMParser` shim (Node has no global `DOMParser`, and the
  cost is on the serialization side anyway) and the "reuse the clean-room zip" claim
  (`node:zlib`, synchronous, no browser branch, and no shared package to promote it
  into). Both are now items with their real scope written down.
- **Tier ordering was inverted.** Round-trip invariance sat high and a third-party
  implementation sat last, marked optional — but round trips are blind to symmetric
  bugs and the third-party oracle is the only tier that is genuinely independent. The
  Guitar Pro retirement worked *because* alphaTab was someone else's code; the lesson
  did not survive being written down as a methodology.
- **The plan had no acceptance bar per phase**, which is why contract clause 5 exists.
- **A LilyPond converter was considered and rejected as an accuracy measure** — the
  corpus is wanted, the converter would not be independent. Recorded in the goal section
  so it is not re-argued.
- **Nothing was enumerated for feature parity on purpose.** The prior plan listed
  features by intuition and phase; the matrix ranks them by evidence. Building the map
  before choosing the route is the whole point of item 2 coming second.
