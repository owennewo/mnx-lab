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
   the support matrix (item 8), and **never hand-edits a cell**. Cells are derived from
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
deliberately **not** enumerated in advance: item 8 decides them from evidence.

| # | Item | Scope | Objective | Oracle | Status |
|---|------|-------|-----------|--------|--------|
| 1 | [Tier-1 W3C oracle](../inprogress/core-musicxml-w3c-oracle.md) | The 27 comparisons mirrored into committed fixtures (`sync:musicxml-comparisons`) and judged **through the layout engine**: import → `layoutNotation` → diff `expected.primitives.json`, graded `match`/`spacing`/`content`. Baseline committed at `harness/reports/musicxml-oracle.json`; moving it either way is a red test. | accuracy | itself | **built 2026-09-04** |
| 2 | [Ties and slurs](../inprogress/core-musicxml-spanners.md) | The first features the oracle asked for, both directions. MNX states a spanner once as an id reference; MusicXML states both ends and numbers its slurs. Import pairs markers and resolves in a final pass (the `linkTechniqueTargets` idiom); export inverts and allocates numbers by interval colouring. Narrowing to `startNote`/`endNote` only when the source narrows. | accuracy | item 1 + round trip | **built 2026-09-04** |
| 3 | [Beams](../inprogress/core-musicxml-beams.md) | The same shape as item 2 one level up: MNX nests beams, MusicXML numbers them, so beam number N is nesting depth N and each direction is one recursive scan. Hooks are one-event groups with a direction; a cross-barline group is filed on its first event's measure. | accuracy | item 1 + round trip | **built 2026-09-04** |
| 4 | [Repeat barlines](../inprogress/core-musicxml-repeat-barlines.md) | A `<bar-style>` on a barline that also carries a `<repeat>` is how the repeat is drawn, not a barline of its own — we drew both. Also **measured and reverted** the final-barline default: it fixed 3 and broke 8, because the spec's own examples resolve the absent-barline case two different ways. A spec question, not a bug. | accuracy | item 1 | **built 2026-09-04** |
| 5 | [Support flags](../inprogress/core-musicxml-support-flags.md) | `<accidental>` was read inside an `if (notationsEl)` guard though it is a child of `<note>` — the third wrong-parent bug of the campaign. And `mnx.support` was never emitted, so the renderer inferred accidentals and beams and **overruled the source**. Declared when we actually read some. | accuracy | item 1 | **built 2026-09-04** |
| 6 | [Jumps](../inprogress/core-musicxml-jumps.md) | Segno, Fine and D.S., read from `<sound>` rather than the printed caption. MusicXML writes the same `<sound dalsegno>` whether or not it is *al Fine*; the score settles it — a D.S. is al Fine exactly when there is a Fine. Export needs `<offset>`, since a D.S. sits at the end of its measure. | accuracy | item 1 + round trip | **built 2026-09-04** |
| 7 | [Ottavas, tuplet units, note ids](../inprogress/core-musicxml-ottavas-tuplets.md) | Ottava sign flip and an end that names the last shifted note's ONSET; tuplet units taken from `<normal-type>` so 6:4 does not print as 3:2; and note ids made document-unique — `parts` was minting 14 ids over 9 values. | accuracy | item 1 + round trip | **built 2026-09-04** |
| 8 | [Converter support matrix](../inprogress/lab-converter-matrix.md) | Rows = MNX `$def` (193, minus plumbing) + `_x.mnxLab` keys; columns = converter × direction. **Cells derived, never declared** (below). Generated, committed artifact; hand-edit is a red test. Extends `src/corpus/defIndex.ts` and the `#/objects` page rather than building a second thing. | both | the corpus itself | **built 2026-09-04** |
| 9 | [Export crash on anonymous parts](../inprogress/core-musicxml-export-crash.md) | `id` and `name` are optional on an MNX part and the exporter assumed neither was — it threw on two corpus scenarios and wrote `<part-name>undefined</part-name>` for a third case. Found by the matrix on its first run. **Matrix supported 24 → 36**, because a crash costs every cell that document could have proved. | accuracy | the matrix | **built 2026-09-04** |
| 10 | W3C/LilyPond corpus | Vendor a curated subset of `w3c-cg/musicxmlTestSuite`. **License verified before a byte lands** — the MIT claim is unchecked and the LilyPond lineage makes it worth confirming. Assertions per file: parses, drops no notes, measure durations sum to the meter, part/voice counts correct. | accuracy | itself | proposed |
| 11 | Aligner generalization | Separate general part/measure/voice parsing from the guitar standard+TAB merge in `aligner.ts`; multi-part ensembles (N parts), grand staff (2 staves, 1 part). The largest single item, and item 1 gates it — `parts` and `multiple-voices` are both in the 27. | accuracy | 1 + 3 | proposed |
| 12 | Zero-dep XML layer | **A hand-written pull parser, not a `DOMParser` shim.** Node has no global `DOMParser` (confirmed on v22), so an adapter yields "optional Node dep", not zero; and the hard part is *serialization* parity on export (self-closing tags, entity escaping, whitespace text nodes), which a shim does not solve. MusicXML's grammar is fixed and shallow — the same clean-room move as the GP5 binary reader. Retires `@xmldom/xmldom`. | zero-dep | 1 + 3 as regression | proposed |
| 13 | `.mxl` container | **Not the copy-paste it looks like.** `converters/guitarpro-mnx/src/gpif/container.ts` is `node:zlib` `inflateRawSync`/`crc32` — synchronous, no browser branch; the browser path is `DecompressionStream`, which is async, so the read API becomes async and that ripples through import. Also needs a shared converter package, which `converters/` does not have yet. Read `META-INF/container.xml`; stored-zip emission on write. | zero-dep | round trip + item 3's `9x` files | proposed |
| 14 | Differential oracle | music21 as a dev-only subprocess emitting a note table (part, voice, onset, duration, pitch, tie, lyric), diffed against the same table from our MNX. The independent implementation the campaign otherwise lacks. Dev/test only, never shipped. | accuracy | itself | proposed |
| 15 | XSD export validation | W3C MusicXML 4.0 XSD over every generated document in CI. A floor, explicitly not counted as an accuracy tier. | accuracy | itself | proposed |
| 16 | Browser import surface | MusicXML file import in the workbench, parallel to the Guitar Pro worker; `.xml`/`.musicxml`/`.mxl` through the CLI and `localFile.ts`. Depends on 5 and 6 — it is the item that makes the zero-dep objective pay. | zero-dep | `smoke:csp` + existing import path | proposed |
| — | Feature parity | Dynamics, wedges, spanners, ottavas, articulations, SMuFL glyph names, percussion, layout breaks. **Deliberately unenumerated**: item 8 turns these into a ranked queue with evidence, and each becomes its own row when picked up. Note the schema already has `dynamic-*`, `ottava`, `slur` and `wedge-type` as standard objects — but **no pedal def**, so pedal is contract clause 2's first real test. | accuracy | 1 + 2 + 3 | not yet rows |

### Item 8's derivation rule

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

### 2026-09-04 — item 9: the matrix pays for itself in one run

**Matrix supported 24 → 36**
([core-musicxml-export-crash.md](../inprogress/core-musicxml-export-crash.md)).

- **`id` and `name` are optional on an MNX part, and the exporter assumed neither was.**
  It threw on two corpus scenarios and would have written
  `<part-name>undefined</part-name>` for any nameless part that got past it. Both are now
  minted positionally, which is what the importer already did — the two halves disagreed
  about what an anonymous part is called and nothing had ever asked them.
- **Nothing had caught it because nothing had pointed the converter at the corpus.** Its
  own tests use `converters/fixtures/`, all authored in Guitar Pro where parts always have
  names; the corpus belongs to the renderer. The matrix is the first thing that ran one
  through the other.
- **A crash is not one red cell, it is every cell that document could have proved.**
  Twelve rows moved from lossy to supported on this one fix, because a document that
  throws counts as losing everything it carried. That is why `error` sorts above `lossy`
  on the page.

### 2026-09-04 — item 8: the matrix, and the answer to the question that started this

**MusicXML: 24 supported, 82 lossy, 6 extension, 3 untested**, over 125 documents
([lab-converter-matrix.md](../inprogress/lab-converter-matrix.md)). `#/converters` renders
it.

- **Derived beats declared, and the campaign had already proved why.** Item 5 showed a
  green round trip is not evidence of support; item 2 showed 46 passing tests over a
  feature implemented in neither direction. A typed table would have said "ties: ✅" that
  whole time. Every cell here is a round trip over committed documents, and hand-editing
  the file is a red test.
- **It needed its own answer to "what does this document contain".** `coversDefs` exists
  only for spec scenarios, so the matrix could not use it. The walker that replaces it is
  held to upstream's join across all 52 mirrored scenarios — and is deliberately
  **stricter**: upstream credits what a used object *could* carry, this credits what is
  written. For "did it survive", only what was written can survive.
- **It found a crash on its first run.** Two lab scenarios cannot be exported at all
  (`Cannot read properties of undefined (reading 'replace')`, on tab labels and tab
  verses). Nothing else had pointed the whole corpus at the converter, so nothing else
  could have found it.
- **The two gap kinds separate by construction, as designed.** Six `extension` rows —
  `capo`, `fret`, `harmonies`, `string`, `strings`, `tab` — are the things MNX cannot say,
  arrived at from evidence rather than from `docs/mnx-extensions.md`, and they agree. That
  agreement is the argument that the derivation is sound.
- **Evidence is what makes it a queue.** Every non-supported cell names a document. 82
  lossy rows sounds like a wall; grouped by the document that first lost them, the largest
  cluster is 8. **A cell without evidence is a scoreboard entry.**

### 2026-09-04 — item 7: the oracle finds a bug it cannot see, and the feature gaps close

**Oracle 21 → 24 of 27, `spacing` to zero**
([core-musicxml-ottavas-tuplets.md](../inprogress/core-musicxml-ottavas-tuplets.md)).
Every scenario the 27 can still fault is the deferred barline question.

- **The `sourceId` normalisation earned itself back.** `parts` was `spacing` — identical
  glyphs at identical coordinates — and the real defect was that the importer minted **14
  note ids over 9 distinct values**, colliding across parts. An MNX id is document-wide, so
  that breaks ties, slurs, technique targets and the note↔JSON highlight. The oracle could
  not see the ids; it saw that the *sharing structure* of `sourceId` differed. Stripping
  `sourceId` instead of normalising it would have reported a clean match and left the bug.
  **Normalise what you cannot compare; do not discard it.**
- **Equal arithmetic is not equal notation.** Six quarters in the time of four reduces to
  three halves in the time of two, and the unit search preferred the shorter form —
  printing a 3 where the source prints a 6. `<normal-type>` already said which unit was
  meant. The engraved number is content, not a rendering detail.
- **A spanner's end is where the last note starts, not where it finishes.** MusicXML puts
  `<octave-shift type="stop">` after the last covered note; MNX names that note's onset.
  Same class as the jump `<offset>` from item 6: **position conventions differ at the
  ends, and both formats look right in isolation.**

### 2026-09-04 — item 6: jumps, and a format that states the same thing twice

**Oracle 19 → 21 of 27** ([core-musicxml-jumps.md](../inprogress/core-musicxml-jumps.md)).

- **When a format says a thing twice, read the machine half.** MusicXML writes a jump as
  printed `<words>` *and* as `<sound dalsegno>`. The words are free text in any language;
  the sound attribute is unambiguous. Reading captions would have worked on these two
  fixtures and failed on the first real score.
- **Some distinctions the source cannot make, the score still can.** MNX separates
  `dsalfine` from `segno`; MusicXML writes the same `<sound dalsegno>` for both. Rather
  than guess from the caption, the resolver asks whether the score contains a Fine — which
  is what the distinction *means*.
- **Position is part of the mark.** A D.S. sits at the end of its measure (`[1,1]`), and
  export writes directions at the head, so it needs `<offset>` — which the importer
  already read for `<harmony>`. Without it the round trip silently moved every jump to the
  downbeat, and no layout test would have caught it because the glyph was still there.

### 2026-09-04 — item 5: the third wrong-parent bug, and a document that failed to say what it stated

**Oracle 18 → 19 of 27**
([core-musicxml-support-flags.md](../inprogress/core-musicxml-support-flags.md)).

- **Three wrong-parent bugs now, and they all failed silently.** `<beam>` and
  `<accidental>` are children of `<note>`, not `<notations>`; beamed **rests** are built
  in a different branch from notes. Each was read from the wrong place and each broke only
  the subset of cases lacking the assumed parent, which is why none showed up as an
  obvious failure. **Before reading a MusicXML element, check what it is actually a child
  of** — the content model is not intuitive and the failure mode is partial.
- **`mnx.support` is the difference between stating and being second-guessed.** Two
  documents that were byte-identical apart from ids rendered differently, because the
  reference declared `useAccidentalDisplay` and ours did not: the renderer inferred
  accidentals and reprinted one the source deliberately left off. MusicXML always states
  accidentals and beams outright, so a document converted from it is stating them too and
  must say so.
- **A missing declaration is invisible until the thing it governs is unusual.** All six
  beam scenarios matched *without* `useBeams`, because our beams agreed with what the
  engine infers. The declaration only bites where source and inference disagree — so the
  beams item, which should have found this, could not have.

### 2026-09-04 — item 4: one symptom, two causes, and the campaign's first spec finding

**Oracle 16 → 18 of 27**
([core-musicxml-repeat-barlines.md](../inprogress/core-musicxml-repeat-barlines.md)).

- **Five scenarios with an identical symptom had two different causes.** All five differed
  by one extra `rect` and nothing missing. Two were a real bug (a `<bar-style>` beside a
  `<repeat>` is how the repeat is drawn, and we drew both); three were a defaults
  disagreement. **A shared symptom is not a shared cause**, and the tell was in the
  reference documents — two of the five had no `barline` in the reference at all, so they
  could not have had the same explanation as the three that did.
- **The obvious fix was written, measured, and reverted — 18 match down to 10.** Making
  the importer say `regular` out loud fixed the three that motivated it and broke eight
  that were already passing. **The spec's own corpus contradicts itself**: three
  comparisons convert an absent MusicXML barline into an explicit `regular`, ~15 convert
  the same absence into nothing and are engraved thick. No importer rule satisfies both.
- **So the campaign has its first spec-loop finding, and it is not a vocabulary gap.**
  MNX can express every barline anyone needs; what is undecided is what an *absent* one
  means on a last measure. Contract clause 2 was written for missing vocabulary, and this
  is the other kind of spec question — worth noticing that the clause did not anticipate it.
- **A measurement that reverses a decision is the cheapest thing here.** Building the fix
  cost minutes because the oracle scored it instantly. Without it this would have shipped
  on reasoning that was locally sound and globally wrong, and the eight regressions would
  have surfaced as mystery failures much later. **Argue less, measure more.**

### 2026-09-04 — item 3: beams, and three bugs the fixtures found that review did not

**Oracle 11 → 16 of 27 match**, both directions, round trip held
([core-musicxml-beams.md](../inprogress/core-musicxml-beams.md)).

- **The model mapped cleanly and the edges did not.** "Beam number N is nesting depth N"
  is the whole conversion, and it was right first time. What was wrong three times was
  everything around it: a beamed **rest** (built in a different importer branch, so the
  group split around it), a **grace note** inside a beam it does not join (the spec's own
  fixture carries a comment saying so), and **one-event groups** being emitted as beams
  when a beam needs two notes — except a hook, which is exactly a one-event group.
  **Each was found by a scenario, none by reading the code.**
- **"Notes" is a category error waiting to happen.** Twice now — lyrics on rests in
  MusicXML, and now beams on rests — the answer has been that a rest is a note as far as
  the file format is concerned. Worth asking of the next feature before writing it.
- **The oracle keeps choosing the work.** It named beams as the largest cause at 6, and
  on closing names the next: the final-barline default at 5, then jumps at 2. It also
  moved `parts` from `content` to `spacing`, which makes it the campaign's first genuine
  *layout* disagreement rather than a missing feature — a different kind of question, and
  the graded verdict is what makes that visible.

### 2026-09-04 — item 2: ties and slurs, and the argument stops being an argument

**Oracle 7 → 11 of 27 match**, both directions, round trip held
([core-musicxml-spanners.md](../inprogress/core-musicxml-spanners.md)).

- **The features were absent from the data model, not merely unimported.** `MnxNote` had
  no `ties` field and `MnxEvent` no `slurs`; `tied` appeared zero times in the converter.
  So the round-trip suite was not lax — it was *structurally unable* to notice, because
  both directions dropped the same thing and no guitar fixture contains a tie. The
  campaign asserted that on day one from a grep; this item is the repair.
- **The oracle chose the item.** Not intuition, not a feature list — four named
  scenarios with `curve` primitives missing. And it chose the *next* one too: `<beam>`
  is now the largest single cause at 6 scenarios. This is what item 1 was for.
- **The judgement call was narrowing, and both answers were already pinned.**
  `slurs-chords` puts one `<slur>` on the first note of a chord and means the chord;
  `slurs-targeting-specific-notes` puts three on three members and means the members.
  A rule of "narrow when it's a chord" gets the first wrong; "never narrow" gets the
  second wrong. **When two fixtures disagree about the obvious rule, the rule is the
  deliverable** — here: narrow when the event starts more than one slur, or when the
  slur hangs off a note that is not the first.
- **Our own exporter set the trap.** It writes an unmatched `<slur type="start">` to mark
  a legato slide; reading it as a musical slur would have invented one in every guitar
  score. Pairing-based resolution avoids it for free — an unmatched start resolves to
  nothing — but it is now a test rather than an accident.

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
