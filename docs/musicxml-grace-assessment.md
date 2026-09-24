# MusicXML 24a–24h grace rendering assessment

**Implementation loop. Agent assessment, application `72b21d71`, 2026-09-24.** Eight unchanged originals from the pinned 183-fixture W3C/LilyPond suite were opened in Workbench and editable Studio. The [machine report](../harness/reports/musicxml-grace-assessment.json) gives 40 stable feature IDs, 157 source note/group/control variants and 80 feature × shell × Notation rows: **62 correct, 8 incorrect, 8 missing, 2 not applicable**. These are slice counts. [Render item 18](../roadmap/inprogress/core-musicxml-render-assessment.md) remains open.

## Evidence and method

The [pinned manifest](../converters/fixtures/musicxml-suite/manifest.json) supplies original paths, descriptions, hashes and the suite revision. The [verifier](../harness/verify/musicxml-grace-assessment.py) derives IDs directly from each original, such as `24a-GraceNotes/p01/m02/n05`, `24a-GraceNotes/p01/m02/g02` and `24g-GraceNote-Dynamics/p01/m01/d02`. It inventories 75 source notes (72 pitched, 3 rests), 24 consecutive grace groups and 58 grace/spanner/direction controls. It compares every source pitch, pitched-note value, rest count, explicitly typed rest value and grace count with the browser-imported MNX by part and measure, checks the [retained capture hashes](../harness/fixtures/musicxml-grace-evidence/manifest.json), and asserts the spanner links and selected SVG geometry behind the failure verdicts. The two shells imported identical MNX. Each fixture has its complete imported document, observation JSON, Notation SVG and PNG in both shell directories. All 16 PNGs were visually inspected.

Both captures used Chrome 153.0.8010.36, a 1440×1000 viewport, staff scale 1 and density 2. Clefs and time signatures were set to **Show**. There are no lyrics that the Current verse preference could hide. Every complete score fits its captured viewport: the observations record no horizontal or vertical score scroll remainder, import error, render error or console error. Studio's imported XML versions were made current/editable through Versions before capture. This establishes the render session; it does not establish direct authoring or GP storage fidelity. None of these originals declares known strings, so Tab and Both are inapplicable.

To recapture after `npm ci` and `npm run build` in an isolated worktree:

~~~sh
MUSICXML_CAPTURE_FILTER='^24[a-h]-' MUSICXML_CAPTURE_TIME_SIGNATURES=show MUSICXML_CAPTURE_DIR=/tmp/mnx-musicxml-grace-workbench node harness/verify/musicxml-editor-capture.mjs
MUSICXML_CAPTURE_SHELL=studio MUSICXML_CAPTURE_FILTER='^24[a-h]-' MUSICXML_CAPTURE_TIME_SIGNATURES=show MUSICXML_CAPTURE_DIR=/tmp/mnx-musicxml-grace-studio node harness/verify/musicxml-editor-capture.mjs
python3 harness/verify/musicxml-grace-assessment.py
~~~

The first two commands create temporary captures; the verifier checks the committed copies. Official MusicXML [grace semantics](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/grace/) define the optional slash and playback stealing attributes. A [grace note has no duration](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/note/). Grace and principal notes may therefore occupy one metric position while requiring different visual attachments. The `24f` manifest explicitly leaves an omitted slash to application interpretation; the drawn slash is not failed. Three `24a` bar-3 graces also omit the attribute, so their default slash policy remains unjudged.

## Source → imported MNX → visible Notation

Each verdict below applies to **both** actual desktop shells. The report contains one row per feature and shell with evidence paths and attributed causes. Surviving pitch and written value do not approve a missing link, wrong staff or misplaced direction.

| Feature IDs | Source, imported MNX and visible result | Verdict and cause |
|---|---|---|
| `24a.pitch-written-values`, `24a.p01.m01.g01–m03.g03` | All 26 pitches, one rest and eleven grace groups retain source order, values, explicit slash choices, small heads and accidentals. The final grace in bar 2 remains before the barline; bar 3 includes the grace before a rest. | **Correct** for pitch/value and each grace group. Omitted slash defaults are not decided. |
| `24a.grace-to-main-slurs` | Three source grace-to-principal slurs resolve to MNX note targets, but neither SVG contains their connecting curves. | **Missing** / layout/SVG engine. |
| `24b.pitch-written-values`, `24b.p01.m01.g01–g03` | All 14 pitches and three grace chord groups retain membership, beaming, order and explicit slashes. | **Correct**. |
| `24b.grace-chord-ties` | Both source ties, one between grace chords and one into the principal chord, resolve in MNX; neither curve appears. | **Missing** / layout/SVG engine. |
| `24c.pitch-written-values`, `24c.p01.m01.g01` | Two small beamed grace notes follow the two principal half notes and precede the barline. The source supplies no steal-time attribute. | **Correct** for visible placement; playback policy is not inferred. |
| `24d.pitch-written-values`, `24d.p01.m01.g01–g02` | Five graces in runs of three and two stay visibly between/after the principal half notes in source order. | **Correct** for visible order, pitch, size and grouping. |
| `24d.steal-time-percentages` | The original names two 20-percent stealing directives. The importer collapses the first run to `stealPrevious` and loses the numeric percentages. | **Not applicable** to rendering / importer representation loss for a separate playback and write-path review. This is not a pass. |
| `24e.pitch-written-values`, `24e.p01.m01.g01–g02` | All five pitches and one source measure rest survive, and the three grace events retain `staff: 2` in MNX. Both shells draw those graces on the upper staff 1 instead of the declared lower staff. | Pitches/rest count **correct**; both group placements **incorrect** / layout/SVG engine. |
| `24f.pitch-written-values`, `24f.p01.m01.g01` | Small grace and principal heads render at their pitches. Source omits `slash`; the manifest allows application choice. | **Correct** for judged ink; slash choice unresolved. |
| `24f.grace-to-main-slur` | The grace event retains the target note ID in MNX, but no slur curve is drawn. | **Missing** / layout/SVG engine. |
| `24g.pitch-written-values`, `24g.p01.m01.g01` | Four small graces and one principal quarter remain, with source pitch/value order. | **Correct**. The source itself fills only one beat of 4/4, so the underfill diagnostic is source-faithful. |
| `24g.grace-and-main-dynamics`, `24g.diminuendo` | Original `f` is at the first grace, a diminuendo spans the run, and `p` belongs to the main beat. MNX keeps the marks but puts all at fraction zero. Both glyphs draw at the identical SVG x/y and overprint; the hairpin has no visible ink. | Dynamic attachment **incorrect** / importer, MNX representation and layout; wedge **missing** / importer and representation. |
| `24h.pitch-written-values`, `24h.p01.m01.g01–g02`, `24h.p02.m01.g01`, `24h.voices-without-grace` | Both parts and five source staves appear. Three grace groups remain on their proper part/staff, while P1 voice 3 starts later and P2 voice 2 has no invented graces. | **Correct** for notes, grace groups and empty voices. |
| `24h.fp-on-main` | The `fp` survives import but draws about four SVG units from the grace head and over 25 from the main head identified by the manifest. | **Incorrect** / importer, MNX position carrier and layout/SVG engine. |

The published MNX [dynamic-group position](../spec/mnx-schema.json) is a rhythmic fraction. The present importer gives grace-attached and principal-attached directions at that same fraction, so source order cannot be recovered from the current imported object alone. The carrier decision for grace-local dynamics and wedges needs a named spec-loop question; simply moving glyphs in the renderer cannot recover the lost attachment. Conversely, the `24a`/`24b`/`24f` MNX spanner targets and `24e` staff numbers already exist, making their missing ink and staff projection concrete renderer gaps.

## Ownership and remaining work

[Proposed item 32](../roadmap/proposed/core-musicxml-grace-fidelity.md) owns the grace-origin spanner, staff and dynamic-placement gaps. [Completed item 22](../roadmap/complete/core-musicxml-render-gaps.md) covers ordinary clef/meter containment, not these failures. [Completed item 23](../roadmap/complete/core-musicxml-write-gaps.md) enables the editable Studio XML version used for capture; it does not prove a grace edit or preserve it through Studio GP storage. [Proposed item 31](../roadmap/proposed/core-musicxml-tuplet-fidelity.md)'s staccato/tremolo work is separate.

This slice raises detailed current render coverage to **70/183 originals; 113 remain**. The older all-183 both-shell sweep is a historical load/display baseline, not a feature-by-feature verdict. [Write item 19](../roadmap/inprogress/core-musicxml-write-assessment.md) still requires create/inspect/change/remove tasks for these same feature IDs, real controls, structural before/after, undo/redo and separate save/reopen routes. No scenario verification or golden status changed here.
