# MusicXML render assessment — from external fixtures to an evidenced gap proposal

> **Status: in progress, 2026-09-22.** Side quest, item 18 of
> [core-campaign-musicxml.md](../inprogress/core-campaign-musicxml.md). Serves the implementation loop.
> Requested 2026-09-22: if each external MusicXML fixture were loaded into our editor,
> would each feature render correctly? The deliverable is an assessment and a new,
> bounded proposal to fill the gaps it discovers.

## The agreement block

1. **The oracle** — the pinned W3C/LilyPond MusicXML test suite's source and feature
   descriptions, checked against the MusicXML specification where interpretation needs
   resolving. Available upstream engravings provide visual reference, not pixel goldens:
   different spacing and line wrapping can both be correct. Semantic checks and visual
   assessment are separate evidence; successful import or nonempty SVG proves neither.
2. **The MNX verdict** — inspect the imported MNX for every failing feature before
   assigning a renderer defect. Classify representation gaps separately; any proposed
   extension follows the campaign's spec-loop contract and names its proposal topic.
   This assessment adds no vocabulary.
3. **The dependency budget** — no new runtime dependency. Reuse item 13's pinned corpus
   and existing browser/render harnesses. Any optional reference tool is dev-only,
   pinned and documented; the assessment must not require a LilyPond converter we write.
4. **The matrix row** — this report measures end-to-end rendering per fixture and feature,
   complementing the converter matrix. No support cells change just because a screenshot
   exists. Converter behavior changes belong to implementation items and regenerate the
   matrix there.
5. **The losslessness bar** — every inventoried fixture receives an explicit disposition;
   every in-scope feature receives an evidence-backed verdict or an explicit unresolved
   verdict. Completion means the report and gap proposal are delivered, not every gap
   fixed. No automatic human-verification claims.

## Corpus and scope

Share the fixture/feature inventory and evidence identifiers with the companion
[write-path assessment](core-musicxml-write-assessment.md), campaign item 19. Rendering
and authoring verdicts remain separate; link shared root causes in the resulting proposals.

Depends on item 13 for the licensed, pinned corpus from
[W3C's LilyPond-derived suite](https://github.com/w3c-cg/musicxmlTestSuite).
Inventory the entire pinned suite, including files not selected for converter accuracy
checks, so curation cannot silently remove difficult rendering features. Record upstream
path, revision, feature description and exclusion reason where applicable. Keep fixtures
under converter/harness ownership; do not hand-edit mirrored `scenarios/spec/`.

Assess each feature named by a fixture's description, including negative cases. Pure
MIDI/playback properties are explicitly nonvisual; intentionally invalid input is judged
on expected rejection or diagnostic behavior. Neither counts as a rendering pass.
Exercise notation for all applicable scores, and tab/both only when the document declares
known strings and the view is relevant. Never assume guitar tuning to manufacture a view.

Use the actual workbench and studio mouse/keyboard browser editor file-open path with the shared importer and editor/viewer
surface. Record shell, viewport, staff scale, view, browser version and application commit.
Touch editing is out of scope. Headless batch rendering may accelerate the assessment,
but cannot substitute for proving that the corresponding fixture loads and displays
through the real editor path. Reuse existing harness conventions and document the command
that reproduces each capture.

## Assessment procedure and report

For each fixture:

1. Identify the intended features from the upstream source/description before inspecting
   our output. State the expected visible behavior; cite the relevant reference.
2. Load the original MusicXML through the editor. Capture import warnings/errors,
   imported MNX, render diagnostics and screenshots covering all relevant measures,
   staves and pages/systems. Preserve enough context to detect clipping and collisions.
3. Inspect the feature in the imported MNX and in the displayed result. Check identity,
   pitch/rhythm where visible, attachment, endpoints, placement and legibility as relevant.
   An unsupported placeholder is a diagnosed gap, not a correct rendering.
4. Record one verdict per fixture × feature × applicable view: **correct**, **partial**,
   **missing**, **incorrect**, **blocked**, **unresolved**, or **not applicable**. Record
   why and link the evidence. Crashes and import rejection block affected rendering
   checks; they do not establish whether the renderer supports the absent content.
5. Attribute failures to **importer**, **MNX representation**, **layout/SVG engine**,
   **editor integration**, **source/reference ambiguity**, or **not yet isolated**.
   Multiple causes may apply. Where necessary, use a minimal independently authored MNX
   probe to separate renderer capability from information lost on import, keeping that
   evidence distinct from the original end-to-end result.

Commit a machine-readable report and a readable assessment summary with an evidence
index and reproducible capture instructions. Store reviewable captures using the existing
harness artifact conventions; state where they are retained. Include both fixture and
feature totals, exclusions, unresolved cases, and grouped root causes. Do not turn a
feature-count percentage into a claim about all MusicXML.

Agent assessments are explicitly labelled as such. Scenario `verified` status and
verification provenance remain human assertions written only through `/verify`. Existing
approved goldens remain untouched by the assessment.

## Output: a proposal to fill the gaps

The first bounded proposal became [item 22](../complete/core-musicxml-render-gaps.md)
and its selected fixes landed. The corpus-wide assessment is still open. When
remaining evidence reveals additional actionable gaps, file a new, deduplicated
proposal under `roadmap/proposed/` and link it from the index and campaign.
The requested follow-up contains:

- A finite, deduplicated list of observed gaps, with fixture/feature evidence and ownership.
- Priorities based on missing or misleading musical content, affected cases and dependency
  order; cosmetic layout differences alone are not musical failures.
- A minimal regression case and observable acceptance criteria for each selected fix,
  including the relevant editor smoke and structural assertion where pixels cannot judge.
- Separate importer prerequisites and spec questions, plus explicit deferrals with reasons.
- The campaign agreement block and required golden/verification-debt handling for fixes.

Do not implement those fixes during the assessment or promise exhaustive MusicXML support.
If no actionable rendering gaps are found, record that result with evidence rather than
inventing work; document importer/spec blockers and unresolved coverage honestly.

## Completion

The pinned suite is fully inventoried; applicable cases have been exercised in the editor;
feature verdicts and causes are evidenced; unresolved cases and exclusions are explicit;
and any further gap proposal is linked from the roadmap and campaign when warranted.
Append findings to the campaign's progress log. This item can finish with
known gaps: fixing selected gaps is what the resulting proposal is for.

## Initial evidence landed, 2026-09-22

See [the assessment report](../../docs/musicxml-editor-assessment.md) for the complete
both-shell browser sweep, selected findings, retained evidence and reproduction. The
requested initial gap proposal exists, but detailed feature/task coverage remains open.
This item is not complete.

## Meter follow-up, 2026-09-22

[All 12 meter sources](../../docs/musicxml-meter-assessment.md) now have explicit
variant findings and retained visible-meter captures in both shells. Five Workbench
meter commands have structural/history evidence, four rejected forms have UI traces,
and the final state has MNX reopen evidence. Initial captures hid time signatures;
absence there is not a rendering verdict. Gap proposals include exact meter import,
display losses and representable inspector ranges. Other families and remaining
meter policy/task/persistence combinations stay open; this item remains in progress.

## Handoff, 2026-09-24

The 183-source sweep is a historical load/display baseline, not a current
fixture-feature verdict sheet. Item 22 fixed selected import and render failures.
Start the next evidence batch with `01a`–`01h` pitches/accidentals: derive
feature variants from source and manifest descriptions, inspect imported MNX,
recapture relevant notation in both shells on the current app, and record
explicit feature × view verdicts and causes. Carry the same IDs into item 19.

## Pitch/accidental batch, 2026-09-24

[The 01a–01h report](../../docs/musicxml-pitch-assessment.md) now records 11
shared feature IDs, stable source-note variants and 22 current Notation
feature × shell × view verdicts. Both-shell captures, imported MNX and
source-to-import comparisons are retained. No source declares strings; Tab/Both
are inapplicable. Explicit enclosure and named-glyph losses support
[proposed item 24](../proposed/core-musicxml-accidental-fidelity.md); `01d`
fractional-pitch diagnostics remain item 22's completed scope. Default
cautionary/editorial styling is unresolved where the original does not
specify an enclosure. This is one eight-fixture slice, not completion of the
183-fixture assessment.

## Rest rendering batch, 2026-09-24

[The 02a–02f report](../../docs/musicxml-rest-assessment.md) adds six original
rest fixtures, 13 shared feature IDs, 113 source note/range variants and 26
current Notation feature × shell × view verdicts. Original-file browser
imports, MNX, complete SVG/PNG captures, display settings and diagnostics
are retained for both shells. No strings are declared, so Tab/Both do not
apply. Missing multimeasure groups, explicit rest positions and 256th–1024th
values support [proposed item 25](../proposed/core-musicxml-rest-fidelity.md).
This is a render-only slice; item 19's tasks and persistence for these IDs
remain open. Item 18 remains in progress for the rest of the suite.

## Rhythm rendering batch, 2026-09-24

[The seven 03-series originals](../../docs/musicxml-rhythm-assessment.md)
now have 14 stable feature IDs, 110 source-note and 41 source-control
variants, and 28 current Notation feature × shell × view verdicts. Both-shell
original-file imports, complete visible captures and an independent-MNX
engine probe are retained. Note-value and unwritten-gap losses support
[proposed item 26](../proposed/core-musicxml-rhythm-fidelity.md); `03d`'s
one-bar rest cases extend [proposed item 25](../proposed/core-musicxml-rest-fidelity.md).
The `03e` no-divisions music21 metric disagreement stays explicitly
unresolved despite the correct visible whole note. No authoring or
persistence result is inferred; item 18 remains open for the rest of the
suite.
