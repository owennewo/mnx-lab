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

## Clef rendering batch, 2026-09-24

[The 12a–12b report](../../docs/musicxml-clef-assessment.md) adds two
originals, 7 stable feature IDs, 19 source contexts and 14 current Notation
feature × shell × view verdicts. Source/import comparisons and both-shell
complete captures are retained. Four octave changes vanish on import, and
the `12a` TAB sign is silently dropped; [proposed item 27](../proposed/core-musicxml-clef-fidelity.md)
owns those bounded follow-ups. Item 22's ordinary clef coordinates and
unsupported-sign containment hold. No strings are declared, so Tab/Both
are inapplicable. Item 18 remains open for the rest of the suite.

## Key-signature rendering batch, 2026-09-24

[The seven 13-series originals](../../docs/musicxml-key-assessment.md) now
have 15 stable feature IDs, 167 source variants and 30 current Notation
feature × shell × view verdicts. Both-shell original-file captures include
the full tall `13a` ladder. Traditional ±8…±11 values survive import but
draw only seven symbols; nontraditional keys, cancellations and later
midmeasure changes vanish; `13f` prints its hidden key. Mode data has
nonvisual dispositions and remains an import/authoring concern. [Proposed
item 28](../proposed/core-musicxml-key-fidelity.md) names the bounded
follow-up. No strings are declared, so Tab/Both are inapplicable. Item
18 remains open for the rest of the suite.

## Current meter rendering batch, 2026-09-24

[The twelve 11-series originals](../../docs/musicxml-meter-current-assessment.md)
now have 34 stable feature IDs, 40 source contexts and 68 current Notation
feature × shell × view rows. Original-file browser imports, imported MNX,
full SVG/PNG score captures and meter preference are retained in both
shells. No source declares strings; Tab/Both are inapplicable. Every score
fits one tile. Exact totals, compatible common display and independent
piano staves confirm item 22's selected repairs. Grouping, hidden/local,
single-number, unmetered and alternate information remains absent on import;
source-located warnings and unresolved source policies are explicit. These
are item 22's documented deferrals, so this repeat evidence does not file
a duplicate proposal. Item 18 remains open for the remaining sources;
item 19 gets no authoring or persistence pass from these captures.

## Staff-line rendering batch, 2026-09-24

[The current 14a original](../../docs/musicxml-staff-lines-assessment.md)
has eight stable feature IDs, 17 source-control/note variants and 16
Notation feature × shell × view rows. Both-shell original-file imports,
MNX, complete SVG/PNG and Show display settings are retained. Ten pitches
and values survive, while all nondefault or hidden staff-line geometry is
lost before MNX. The four source-located warnings confirm item 22's
containment; full geometry and staff-relative note placement remain its
documented carrier/engraving deferral. No new duplicate proposal or
authoring claim is filed. Item 18 remains open for the rest of the suite.

## Chord rendering batch, 2026-09-24

[The nine 21a–21i originals](../../docs/musicxml-chord-assessment.md) now
have 27 stable feature IDs, 167 source variants and 54 current Notation
feature × shell × view verdicts. Original-file browser imports, matching
imported MNX, complete SVG/PNG and Show display settings are retained for
both shells. No source strings permit Tab/Both. Ordinary chord grouping,
pitch/rhythm and tie targets survive; forced tie shape, the `21d` accent and
fermata, five member-specific tremolos and implicit pickup state disappear.
`21i` moves two cross-voice chord notes one quarter late. `21h`'s
cautionary/editorial question extends existing proposed item 24; [proposed
item 29](../proposed/core-musicxml-chord-fidelity.md) owns the other new
gaps. Item 18 remains open for the rest of the suite, and no item 19
authoring or persistence pass is inferred.

## Notehead rendering batch, 2026-09-24

[The four 22a–22d originals](../../docs/musicxml-notehead-assessment.md)
now have 62 stable feature IDs, 490 source variants and 124 current
Notation feature × shell × view verdicts. Complete original-file captures
show clefs and meter and explicitly set Lyrics to All verses; `22a` needs
overlapping scroll tiles in both shells. No source declares strings.

All source pitches and event groups survive, but 114 explicit `22a`
noteheads, eleven per-chord `22c` heads and eight `22d` parentheses
disappear before MNX. `22b` loses two slash spans and eight hidden-note
flags, while keeping its lyric texts. `22c` loses eight numbered
chord-member labels even when all verses are shown. [Proposed item
30](../proposed/core-musicxml-notehead-fidelity.md) owns the new gaps.
Item 22 already owns the `22b` zero-line warning and full-geometry
deferral; item 25 already owns the `22d` positioned rest. Item 18
remains open, and no item 19 authoring or persistence pass follows.

## Tuplet rendering batch, 2026-09-24

[The six 23a–23f originals](../../docs/musicxml-tuplet-assessment.md)
now have 65 source-derived feature IDs, 268 note/group/control variants and 130
current Notation feature × shell × view rows. Original-file Workbench and
editable Studio imports, identical imported MNX, complete SVG/PNG captures,
Show settings and no-score-scroll observations are retained. No strings
permit Tab/Both. `23a` keeps all seven ratios; `23b`/`23c` lose explicit
display requests; `23c` turns three four-quarter bars into 18-quarter
imports; `23d` drops all seven nested groups and overfills all three
bars with source-located warnings. `23e` retains tuplet timing while losing
staccato and single-note tremolo ink. `23f` adds a bracket to an unmarked
group and splits the manifest's sextuplet into two triplets. [Proposed
item 31](../proposed/core-musicxml-tuplet-fidelity.md) owns the new gaps.
The `23b` 17:2/17:3 source-description conflict and `23f` grouping
ambiguity remain explicit. This raises detailed current render coverage to
62/183 originals; item 18 and item 19 remain open.

## Grace rendering batch, 2026-09-24

[The eight 24a–24h originals](../../docs/musicxml-grace-assessment.md)
now have 40 source-derived feature IDs, 157 note/group/control variants and
80 current Notation feature × shell rows. Original-file Workbench and editable
Studio imports, identical MNX, complete SVG/PNG captures, Show settings and
no-scroll observations are retained. No known strings permit Tab/Both. All
72 pitches and three rests survive. `24a`, `24b` and `24f` retain
grace-origin slur/tie targets in MNX but draw no curves. `24e` retains staff 2
on three grace events but draws them on staff 1. `24g` overprints distinct
grace/main dynamics at fraction zero and omits the wedge; `24h` places its
main-note `fp` under a preceding grace. [Proposed item 32](../proposed/core-musicxml-grace-fidelity.md)
owns these new gaps, with a named carrier decision for zero-time direction
attachment. `24d`'s two 20-percent playback attributes remain nonvisual and
unassessed for playback; `24f`'s omitted slash is an allowed application
choice. This raises detailed current render coverage to 70/183 originals;
item 18 and item 19 remain open.

## Direction rendering batch, 2026-09-24

[The five 31a/31b/31c/31d/31f originals](../../docs/musicxml-directions-assessment.md)
now have 86 source-derived feature IDs, 357 note/direction/lyric variants and
172 current Notation feature × shell rows. Original-file Workbench and editable
Studio imports, identical MNX, complete SVG/PNG captures, Show clefs/meters,
All verses and tiled `31a` scroll coverage are retained. No known strings
permit Tab/Both. Ordinary dynamic glyphs, the `31a` hairpin/8vb, segno
and two dotted metronome marks survive. Other directions show distinct
failures: `31a` drops most specialist signs and three of four first-bar
rehearsals; `31b` loses tempo offset/parentheses and omits an imported
end-of-bar hairpin; `31c` drops metric relations; `31d` splits or
overprints compound text/dynamics; `31f` collapses a retained three-line
text into one unboxed line and draws an above dynamic below. [Proposed item
33](../proposed/core-musicxml-direction-fidelity.md) owns these new gaps.
The referenced `nestedboxes.png` is absent from the pinned suite and
its image ink is blocked; the first `molto` space is source-ambiguous.
Detailed current render coverage is 75/183 originals; item 18 and item 19
remain open.
