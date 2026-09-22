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

**Current state, 2026-09-22.** The converter has zero runtime npm dependencies,
including compressed `.mxl`, and its browser import path is shared by workbench and
studio. The 27 paired W3C comparisons score 24 exact layout matches; the three remaining
final-barline discrepancies are retained explicitly, not papered over. The generated
converter matrix currently records 43 supported / 66 lossy / 7 extension / 3 untested.
These are bounded measurements, not a promise of complete MusicXML support.

**Resumed implementation.** Item 13 now pins the complete 183-fixture external suite with
MIT notices, stable IDs and an import/export observation baseline. Items 14 and 15 now provide independent
semantic and XSD measurements; their mismatch baselines identify further work. Render and write-path assessments (18 and 19) consume the same inventory and
produce separate, evidenced gap proposals; implementing those proposals is subsequent
work. The historical log below records how the earlier baseline was reached.

### The oracle we already own, and the assertion that would waste it

`vendor/mnx/doctools/data.json` holds **27 `spectools.exampledocumentcomparison`
records**, each carrying complete MusicXML 3.1 source, and every one of their slugs
already exists as a mirrored `scenarios/spec/<slug>/`. All 27 carry an
`expected.primitives.json`. At campaign inception, 18 had human verification; that
historical count is not a claim that all current fixtures are approved. Item 1 now uses
this paired corpus as a renderer-mediated oracle.

The obvious assertion — `importMusicXML(xml)` deep-equals the reference MNX — **would
fail on all 27 for cosmetic reasons and must not be written.** MusicXML → MNX is not a
bijection: ids, voice numbering and ordering, beam nesting and sequence splitting all
admit several correct encodings. An assertion that fails for reasons nobody cares about
gets weakened until it means nothing.

**Compare through the layout engine instead.** Primitives are geometry plus SMuFL glyph
names. So the comparison is: import the MusicXML, run `layoutNotation` through
`engine/headless.ts`, diff against the scenario's existing golden. **Identical
primitives demonstrate equal output for what this renderer exposes**, immune to id choice and JSON shape. It reuses the
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
| 1 | [Tier-1 W3C oracle](core-musicxml-w3c-oracle.md) | The 27 comparisons mirrored into committed fixtures (`sync:musicxml-comparisons`) and judged **through the layout engine**: import → `layoutNotation` → diff `expected.primitives.json`, graded `match`/`spacing`/`content`. Baseline committed at `harness/reports/musicxml-oracle.json`; moving it either way is a red test. | accuracy | itself | **built 2026-09-04** |
| 2 | [Ties and slurs](core-musicxml-spanners.md) | The first features the oracle asked for, both directions. MNX states a spanner once as an id reference; MusicXML states both ends and numbers its slurs. Import pairs markers and resolves in a final pass (the `linkTechniqueTargets` idiom); export inverts and allocates numbers by interval colouring. Narrowing to `startNote`/`endNote` only when the source narrows. | accuracy | item 1 + round trip | **built 2026-09-04** |
| 3 | [Beams](core-musicxml-beams.md) | The same shape as item 2 one level up: MNX nests beams, MusicXML numbers them, so beam number N is nesting depth N and each direction is one recursive scan. Hooks are one-event groups with a direction; a cross-barline group is filed on its first event's measure. | accuracy | item 1 + round trip | **built 2026-09-04** |
| 4 | [Repeat barlines](core-musicxml-repeat-barlines.md) | A `<bar-style>` on a barline that also carries a `<repeat>` is how the repeat is drawn, not a barline of its own — we drew both. Also **measured and reverted** the final-barline default: it fixed 3 and broke 8, because the spec's own examples resolve the absent-barline case two different ways. A spec question, not a bug. | accuracy | item 1 | **built 2026-09-04** |
| 5 | [Support flags](core-musicxml-support-flags.md) | `<accidental>` was read inside an `if (notationsEl)` guard though it is a child of `<note>` — the third wrong-parent bug of the campaign. And `mnx.support` was never emitted, so the renderer inferred accidentals and beams and **overruled the source**. Declared when we actually read some. | accuracy | item 1 | **built 2026-09-04** |
| 6 | [Jumps](core-musicxml-jumps.md) | Segno, Fine and D.S., read from `<sound>` rather than the printed caption. MusicXML writes the same `<sound dalsegno>` whether or not it is *al Fine*; the score settles it — a D.S. is al Fine exactly when there is a Fine. Export needs `<offset>`, since a D.S. sits at the end of its measure. | accuracy | item 1 + round trip | **built 2026-09-04** |
| 7 | [Ottavas, tuplet units, note ids](core-musicxml-ottavas-tuplets.md) | Ottava sign flip and an end that names the last shifted note's ONSET; tuplet units taken from `<normal-type>` so 6:4 does not print as 3:2; and note ids made document-unique — `parts` was minting 14 ids over 9 values. | accuracy | item 1 + round trip | **built 2026-09-04** |
| 8 | [Converter support matrix](lab-converter-matrix.md) | Rows = MNX `$def` (193, minus plumbing) + `_x.mnxLab` keys; columns = converter × direction. **Cells derived, never declared** (below). Generated, committed artifact; hand-edit is a red test. Extends `src/corpus/defIndex.ts` and the `#/objects` page rather than building a second thing. | both | the corpus itself | **built 2026-09-04** |
| 9 | [Export crash on anonymous parts](core-musicxml-export-crash.md) | `id` and `name` are optional on an MNX part and the exporter assumed neither was — it threw on two corpus scenarios and wrote `<part-name>undefined</part-name>` for a third case. Found by the matrix on its first run. **Matrix supported 24 → 36**, because a crash costs every cell that document could have proved. | accuracy | the matrix | **built 2026-09-04** |
| 10 | [Zero-dep XML layer](core-musicxml-zero-dep.md) | **A hand-written pull parser, not a `DOMParser` shim.** Node has no global `DOMParser` (confirmed on v22), so an adapter yields "optional Node dep", not zero; and the hard part is *serialization* parity on export (self-closing tags, entity escaping, whitespace text nodes), which a shim does not solve. MusicXML's grammar is fixed and shallow — the same clean-room move as the GP5 binary reader. Retires `@xmldom/xmldom`. | zero-dep | the oracle and matrix, required unmoved | **built 2026-09-04** |
| 11 | [`.mxl` container](core-musicxml-mxl.md) | **Not the copy-paste it looks like.** `converters/guitarpro-mnx/src/gpif/container.ts` is `node:zlib` `inflateRawSync`/`crc32` — synchronous, no browser branch; the browser path is `DecompressionStream`, which is async, so the read API becomes async and that ripples through import. Also needs a shared converter package, which `converters/` does not have yet. Read `META-INF/container.xml`; stored-zip emission on write. | zero-dep | cross-checked against Python's zipfile, both directions | **built 2026-09-04** |
| 12 | [Multi-staff parts](core-musicxml-staves.md) | `<staves>`, a `<clef number>` per staff tracked independently, `<staff>` per note. Grand staff round trips. The matrix did **not** move, because `staff` is shared with `layouts` — a def used by two features scores as the worse of them. | accuracy | the corpus, via spec/grand-staff | **built 2026-09-04** |
| 13 | [W3C/LilyPond corpus](../complete/core-musicxml-external-corpus.md) | Complete pinned 183-fixture suite, MIT notices, source inventory and deterministic import/export observation report. Keeps invalid and compatibility inputs explicit; does not turn our imports into independent ground truth. | accuracy | pinned upstream bytes + observation baseline | **built 2026-09-22** |
| 14 | [Differential oracle](../complete/core-musicxml-differential-oracle.md) | Locked dev-only music21 reads original sources and our exports; independent MNX adapter compares rational note tables. 344 cases with explicit mismatch/limitation verdicts and reproducible captures. | accuracy | independent external tools | **built 2026-09-22** |
| 15 | [XSD export validation](../complete/core-musicxml-xsd-validation.md) | Verbatim pinned MusicXML 4.0 XSD; local-only lxml validation of every generated export across external fixtures, W3C comparisons, scenarios and reference scores. Existing failures recorded explicitly. | accuracy | independent external tools | **built 2026-09-22** |
| 16 | [Browser import surface](core-musicxml-browser-import.md) | MusicXML file import in the workbench, parallel to the Guitar Pro worker: `.musicxml`/`.mxl`/`.xml` through **Open…**, in a lazy worker of its own that imports the converter's core modules directly (the package index re-exports Node-only `fs`). The worker protocol is now format-neutral. | zero-dep | `smoke:csp`, extended to open a `.musicxml`, a deflated `.mxl` and a `.gpx` through the real file input under the deployed CSP | **built 2026-09-11** |
| 17 | [Dynamics](core-musicxml-dynamics.md) | `<dynamics>` and `<wedge>`, both directions. The enum values map to `value`; the sforzando family to MNX's accent structure, whose parts concatenate to exactly the MusicXML element name (s+f+z = `sfz`), so one table serves both directions; the rest to SMuFL `glyphs`. Hairpins pair by wedge `number`, item 2's shape again. Relative dynamics have no MusicXML element and warn. | accuracy | the corpus's dynamics scenarios + round trip (no W3C comparison carries a dynamic) | **built 2026-09-10** |
| 18 | [Render assessment](core-musicxml-render-assessment.md) | Side quest over item 13’s pinned external corpus: load fixtures through the desktop editor, assess each visible feature, isolate importer/representation/rendering/integration gaps, and produce an evidenced, bounded render-gap proposal. | accuracy | upstream feature descriptions + semantic checks + visual references and editor captures | **in progress 2026-09-22** |
| 19 | [Write-path assessment](core-musicxml-write-assessment.md) | Companion to item 18: assess whether desktop users can create, inspect, change and remove each corpus feature through the editor, with undo/redo and separate persistence evidence; produce a bounded proposal for missing operations and UX surfaces. | accuracy | real UI tasks + structural before/after checks + applicable save/reopen | **in progress 2026-09-22** |
| 20 | [XSD element ordering](../complete/core-musicxml-xsd-ordering.md) | Pitch/tuning alterations before octaves; separate rehearsal and section directions. XSD-valid exports 292 → 336/344, semantic verdicts unchanged. | accuracy | independent XSD + regression tests | **built 2026-09-22** |
| 21 | [Exact short durations](../complete/core-musicxml-short-durations.md) | Divisions account for written-duration denominators as well as tuplets; no zero-length metric notes in the measured corpus. XSD validity 336 → 340/344; three external export note tables now match. | accuracy | music21 + XSD + regression tests | **built 2026-09-22** |
| 22 | [Render gaps](../inprogress/core-musicxml-render-gaps.md) | Preserve piano staves; diagnose microtonal/staff-line losses; contain unsupported-clef projection failures. Meter follow-up adds exact duration and display losses; not an exhaustive backlog. | accuracy | original XML + imported MNX + both-shell captures | **in progress 2026-09-22** |
| 23 | [Write gaps](../proposed/core-musicxml-write-gaps.md) | Resolve missing title metadata before making an imported Studio version current, without bypassing the shared editor or GP storage policy; expose representable numeric meter ranges. | authoring | real Versions controls + refusal + persistence checks | **proposed 2026-09-22** |
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

### 2026-09-22 — item 22: unsupported clefs stay local

All four known projection crashes now render with local question-mark placeholders and
part/staff diagnostics; valid staves and later supported-clef intervals survive. Import
reports unsupported clefs and existing unpitched pitch fallbacks; it does not claim
schema-valid percussion. The generic failure panel no longer guesses schema validity.
Twelve renderer regressions failed before and pass after; core goldens, W3C layout
baseline and support matrix remain unchanged. [Both-shell evidence](../../docs/musicxml-import-fixes.md#unsupported-clef-containment-follow-up)
also exposed a capture issue: **a tall Studio viewer scrolls inside the frame**. The
harness now follows that inner scroll extent and fingerprints itself. Earlier full-corpus
PNGs require recapture before lower-staff visual verdicts. Item 22 still needs meter import;
items 18/19 still need their complete feature/task assessments.


### 2026-09-22 — item 22: separate converter correctness from load-time migration

The original piano import retains both notes; `upgradeTabExtension` then erased staff 2
because it treated every second staff as old guitar tab. Restricting migration to actual
legacy markers **per part** preserves modern piano even beside a legacy guitar part.
The recovered bass staff exposed a second error: clef line numbers and MNX staff positions
use different origins/units. Fix both directions, including same-sign line changes;
never use our own inverse as the only oracle. The independent alto/tenor export now
matches music21 instead of failing to parse. Fractional pitch and staff-line losses now
have location-specific diagnostics. [Both-shell evidence](../../docs/musicxml-import-fixes.md)
is retained. Core goldens, W3C layout baseline and support matrix are unchanged; XSD
validity remains 340/344. Item 22 remains open for unsupported-clef containment and meters.


### 2026-09-22 — items 18/19: meter variants and real inspector limits

Reviewed all 12 meter sources in both shells with time signatures explicitly shown;
[retained evidence and variant/task dispositions](../../docs/musicxml-meter-assessment.md).
The initial sweep hid meters: **check effective display preferences before calling a
missing glyph a defect**. Additive numerators and later fractions disappear on import;
common display is lost despite an existing carrier. Five actual Workbench inspector
commands pass exact history/preservation checks; count 33 and denominator 128 reject
although standard MNX permits them. Rest padding changes are intentional related data,
not unrelated mutation. Items 22/23 now contain the bounded follow-ups. Both assessments
remain open, including ambiguous symbols and persistence beyond the tested MNX route.


### 2026-09-22 — items 18/19: both-shell sweeps and first bounded authoring evidence

[Assessment and reproduction](../../docs/musicxml-editor-assessment.md): all 183 sources
through both shells, 219 view observations each, 245 Workbench and 432 Studio screenshot
tiles. Imported documents agree across shells. Four fixtures fail entire projections;
nonempty output elsewhere is not a feature pass. Selected source/document/capture review
finds piano-note loss plus invented tuning, truncated fractional pitches, and discarded
staff-line configurations. Items 22/23 contain the requested initial gap proposals.

Studio can view the unmodified XML as an operator-imported original via Versions, but
177 untitled sources fail Make current and remain uneditable; six succeed. A separate
normal Studio editor smoke passes GP save/reload. Workbench's imported chord supports
actual keyboard change/remove/create with exact undo/redo, unrelated-data preservation,
schema validation and JSON clipboard → MNX reopen. These scopes do not imply arbitrary
feature support. Both assessments stay in progress pending variant-level review and tasks.

Lessons: wait for paint before reading diagnostics; tile the shell's actual scroll
container; a bound Studio editor may be suspended on a viewed version; the importer may
fabricate the strings that make Tab look available. A source-level capability audit must
not mistake those artifacts for source intent or user-facing editing support.

### 2026-09-22 — item 21: denominators exist outside tuplets too

The exporter chose divisions for tuplet ratios but assumed plain written values already
fit an eight-tick quarter. Dotted short values and 128ths disproved that assumption.
Raising the written grid before applying tuplet ratios removes all measured zero-duration
exports: XSD validity 336 → 340/344, three external export note tables different → match.
The remaining four XSD failures are empty parts and rootless harmony, which need explicit
representation policy. Smaller-than-supported tuplet normal units also remain a distinct
limitation, not quietly folded into the divisions claim.

### 2026-09-22 — item 20: grammar fixes without musical changes

Three small emitter fixes take XSD-valid exports from 292 to 336 of 344 while every
independent note-table judgment stays unchanged. Regression tests fail on the old output;
pitch and tuning have the same ordering defect. Rehearsal and section labels now use
separate typed directions so both grammar and the existing reader preserve them. The
remaining eight failures group into zero durations, empty parts and rootless harmony.

### 2026-09-22 — items 14 and 15: independent readers expose what round trips conceal

[Semantic and XSD checks](../../docs/musicxml-oracles.md) cover 344 cases. A locked,
dev-only Python environment replaces the historical missing-tool blockers. Root tests
bind cached external judgments to exact current XML and tool/schema hashes; a live command
reruns music21 and libxml2. Initial source-note matches are 132/177 feature cases; 37
differ and 8 are oracle-limited. These are scoped note-table results, not feature parity.

XSD initially accepts 292/344 generated exports. Alterations after octaves and mixed
rehearsal/words direction types are clear grammar defects. The source tuplet duration
quantization is a different kind of finding: the external reader and our importer follow
different available information. Exact rational timing preserves that disagreement for
review. Default notation/TAB duplication remains explicitly unassessed where part
correspondence is not mapped; it is not labelled semantic loss.


### 2026-09-22 — item 13: corpus first, and why no exception is not accuracy

The [external corpus](../complete/core-musicxml-external-corpus.md) pins all 183 upstream
fixtures rather than curating away hard cases. The upstream MIT licence and README are
retained verbatim. Of 177 feature inputs, all complete import/export/re-import, but 13
produce MNX that fails published or extension validation. Three negative and three
compatibility fixtures are scored separately. [Report and reproduction](../../docs/musicxml-suite.md).

- **No exception is a weak success criterion.** The new cases expose invalid clefs,
  unrecognized published fields and a harmony missing required extension data.
- **Imported data is not independent truth.** The external report records observed defs
  and loss, but the old matrix is unchanged: feeding our own imports back as expectations
  would conceal initial import loss. Independent semantics belong to item 14.
- **The whole suite is small enough to keep.** Stable IDs and upstream descriptions now
  let render and write-path assessments share evidence without sharing verdicts.


### 2026-09-22 — write-path assessment side quest scoped

[Item 19](core-musicxml-write-assessment.md) complements rendering coverage with authoring
coverage over the same fixture/feature inventory. A feature may import and render without
any way to create or change it; an internal operation may exist without a reachable UI.
The assessment separates those failures and also records undo/redo and save/reopen losses.
Its deliverable is an evidenced report and a new proposal for missing editing capabilities
and UX surfaces. No assessment has run yet.

### 2026-09-22 — render assessment side quest scoped

[Item 18](core-musicxml-render-assessment.md) asks whether the external MusicXML fixtures
actually display their intended features when opened in our editor. Its output is a
per-feature assessment and a new gap-filling proposal, not fixes during the audit. Import
loss must be isolated before attributing missing marks to the renderer; screenshots alone
cannot establish semantic fidelity. The entire pinned suite receives a disposition so a
curated converter subset cannot conceal rendering gaps. No assessment has run yet.

### 2026-09-04 — where the campaign stands

**Twelve of sixteen items built, both objectives substantially met.**

| | |
|---|---|
| Oracle | **24 of 27 exact matches** against human-verified goldens, from a baseline of 0 |
| Matrix | 36 supported / 70 lossy / 6 extension / 3 untested, over 125 documents, at `#/converters` |
| Runtime dependencies | **zero**, in Node and the browser, including `.mxl` |
| Converter suite | 49 → **107** tests |

The three scenarios the oracle still faults are all the **final-barline default**, which
item 4 measured and proved is a question for upstream rather than a bug here: the fix
gains 3 and costs 8, because the spec's own examples resolve it two ways.

**The four unbuilt items are not next-in-line, they are blocked or unwarranted**, and the
index says which for each: two need resources this environment does not have (music21,
`xmllint`), one needs a license verified before vendoring anyone else's fixtures, and one
is blocked by a live collision — `src/workbench/localFile.ts` is held uncommitted by
another session, and that is exactly the file the browser surface touches. That last one
is the parallel-work contract doing its job rather than an obstacle.

**What the campaign actually demonstrated**, beyond the numbers:

- **Instruments before features.** Nine of the twelve items were chosen by the oracle or
  the matrix rather than by intuition, and both instruments found things the other could
  not — the oracle has no grand staff, the matrix has no notion of *correct*.
- **Measure, then decide.** Two items reversed a decision that was locally sound: the
  barline default (18 match down to 10) and the Guitar Pro zip reuse (would have undone
  the platform independence just won). Both cost minutes because something scored them.
- **A green round trip is not evidence of support**, and this campaign has the receipts:
  `tied` appeared zero times in the converter while 46 round-trip tests passed over it.


### 2026-09-11 — item 16: the browser surface, and the app's compiler as a new reviewer

MusicXML opens in the workbench
([core-musicxml-browser-import.md](core-musicxml-browser-import.md)),
prompted by a real Soundslice export being refused.

- **A block is a fact about a moment.** The row said BLOCKED on a live collision; by the
  time anyone asked, the file was clean on `main`. Re-check the collision, not the row.
- **The app build is a stricter reader than the package's own.** Pulling the import path
  into `src/`'s `tsc` subjected it to `noUnusedLocals` for the first time: six dead
  symbols, one a whole private method. A converter entering a new build inherits that
  build's rules — worth running before assuming the campaign's code is clean.
- **Module-level independence is not package-level.** Items 10 and 11 made the modules
  platform-free, but `index.ts` still re-exports the CLI's `fs` helpers, so the worker
  imports past it — the move the Guitar Pro worker already makes with `cleanRoom.ts`.
- **The oracle a surface needs is the surface itself.** `smoke:csp` only booted the app;
  neither import worker had ever been loaded under the deployed policy by any test. It now
  opens one file per path through the real input.

### 2026-09-10 — item 17: dynamics, found from outside the campaign

**Matrix supported 36 → 42**, the first *Feature parity* row
([core-musicxml-dynamics.md](core-musicxml-dynamics.md)).

- **The matrix had the finding and nobody was reading it for this.** `dynamic-group` sat at
  7 carried / 0 surviving from the first run; what prompted the work was an audit of the
  Guitar Pro importer, which dropped a forte the same way. A lossy cell is a queue entry
  only if someone works the queue — **the instrument is necessary, not sufficient.**
- **Where two encodings share a spelling, make the table the spelling.** MNX's accent
  structure concatenates to exactly the MusicXML element name (s+f+z = `sfz`), so import and
  export are one table read two ways rather than two mappings kept in agreement by hand.
  The spec's defaults (`s`, `z`) are the trap: every part is written explicitly, or `fz`
  reads back as `sfz`.
- **The oracle is blind here, and the item says so.** None of the 27 comparisons carries a
  dynamic, so item 1 cannot score this; the evidence is the corpus's own five dynamics
  scenarios, three of them deep-equal through the round trip. An item whose primary oracle
  cannot see it states which one it used instead.
- **Item 2's spanner shape a fourth time.** A hairpin is stated once in MNX and twice,
  numbered, in MusicXML — the same pair-and-resolve as ties, slurs and ottavas.


### 2026-09-04 — item 12: multi-staff parts, and a limit of the matrix worth more than the feature

Grand staff round trips ([core-musicxml-staves.md](core-musicxml-staves.md)).
**The matrix score did not move**, and that is the finding.

- **`staff` is used by two features, so it scores as the worse of them.** It appears on
  sequences and clefs — now supported — and inside `layouts`, which the converter does not
  touch at all. The row cannot improve until both work. That is the honest consequence of
  choosing schema objects as rows, the same choice that makes the two *kinds* of gap
  separate cleanly, and it means **a flat `lossy` cell can hide a feature that works.**
  Recorded so the next reader does not conclude the work did nothing.
- **The oracle could not have found this either** — none of the 27 comparisons is a grand
  staff. The corpus had the case (`spec/grand-staff`) and the matrix pointed at it. The
  two instruments cover different ground, which is the argument for having both.
- **Where one format can express a distinction the other cannot, the conversion has to
  manufacture the carrier.** MNX tells two sequences apart by staff alone; MusicXML only
  by voice. Exporting both hands with no voice merged them, and eleven notes came back as
  one stream. Third time this shape has appeared, after the jump `<offset>` and beam
  nesting.

### 2026-09-04 — item 11: `.mxl`, and why not reusing code was the right call

**Zero runtime dependencies still**, in Node and the browser
([core-musicxml-mxl.md](core-musicxml-mxl.md)).

- **The campaign's own plan said "reuse the Guitar Pro zip reader", and that was wrong.**
  That reader is `node:zlib`, synchronous, Node-only — reusing it would have carried the
  Node-only assumption into the converter that had just been made platform-independent,
  undoing item 10 in the name of not repeating code. `DecompressionStream('deflate-raw')`
  is what both platforms have. **Sharing code is not free when the code encodes an
  assumption you have just removed.**
- **The async ripple was containable.** `readMxl` is a promise because streams are;
  `importMusicXML` is untouched and `importMxl` wraps it. The asynchrony stops at the
  container.
- **Writing needed no compressor.** Stored entries are legal zip; the only arithmetic is
  CRC-32. Cheaper output for bigger files, and every reader takes them.
- **The tests that matter cross an implementation boundary.** Python's `zipfile` writes a
  deflated container our reader must read identically to the plain file, and opens ours
  with `testzip()` — a real per-member CRC check. Round-tripping against yourself proves
  a zip is self-consistent, not that it is a zip.

### 2026-09-04 — item 10: zero dependencies, and nothing moved

**`converters/musicxml-mnx` has no runtime dependency at all**, and the oracle (24/27) and
matrix (36 supported) are unchanged to the cell
([core-musicxml-zero-dep.md](core-musicxml-zero-dep.md)).

- **The inherited plan was wrong twice, and this is the item that proved it.** An
  isomorphic `DOMParser` adapter keeps xmldom as a Node dependency forever (Node has no
  global `DOMParser`), and it does nothing about serialization, which is where the real
  divergence lives. Writing both halves was less work than the adapter would have been.
- **The bar was byte equality, not validity.** `converters/fixtures/*.xml` are committed
  derived files, so a writer that produced merely valid XML would have shown the corpus as
  wholly changed on the next re-derivation. Meeting it required preserving the `<?xml …?>`
  declaration verbatim rather than regenerating it — 37 bytes, and the entire difference on
  the first attempt.
- **"Nothing moved" is the result, and only the instruments make it meaningful.** A month
  ago the same claim would have rested on 46 round-trip assertions over three guitar
  scores. It now rests on 27 layout comparisons against human-verified goldens and a
  125-document support matrix, both required to be unchanged.
- **The API survey missed `nodeName` because it only looked at `src/`.** The tests used
  it, four failed, and the failure mode is the quiet one: a missing DOM member does not
  throw, it reads `undefined` and takes the other branch. **Survey the tests too.**

### 2026-09-04 — item 9: the matrix pays for itself in one run

**Matrix supported 24 → 36**
([core-musicxml-export-crash.md](core-musicxml-export-crash.md)).

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
([lab-converter-matrix.md](lab-converter-matrix.md)). `#/converters` renders
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
([core-musicxml-ottavas-tuplets.md](core-musicxml-ottavas-tuplets.md)).
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

**Oracle 19 → 21 of 27** ([core-musicxml-jumps.md](core-musicxml-jumps.md)).

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
([core-musicxml-support-flags.md](core-musicxml-support-flags.md)).

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
([core-musicxml-repeat-barlines.md](core-musicxml-repeat-barlines.md)).

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
([core-musicxml-beams.md](core-musicxml-beams.md)).

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
([core-musicxml-spanners.md](core-musicxml-spanners.md)).

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
([core-musicxml-w3c-oracle.md](core-musicxml-w3c-oracle.md)). No converter
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
