# MusicXML 12-series clef rendering assessment

**Implementation loop. Agent assessment, application `090c441e`, 2026-09-24.**
The two unchanged 12-series originals in the pinned 183-fixture W3C/LilyPond suite were opened through the current Workbench and Studio. This extends [render item 18](../roadmap/inprogress/core-musicxml-render-assessment.md), not human scenario verification or a whole-suite verdict. The [machine report](../harness/reports/musicxml-clef-assessment.json) contains 7 stable feature IDs, 19 source measure contexts and 14 feature × shell × view verdicts.

## Evidence and method

The [suite manifest](../converters/fixtures/musicxml-suite/manifest.json) provides original paths, descriptions, revision and SHA-256 hashes. The [source/import verifier](../harness/verify/musicxml-clef-assessment.py) checks each original clef, line, octave change, C4 whole note, omitted key/clef, browser-imported MNX and retained artifact hash. The [browser evidence](../harness/fixtures/musicxml-clef-review-evidence/manifest.json) retains original-file imports, MNX, observations, complete Notation SVGs and screenshots in both shells. Captures used Chrome 153.0.8010.36 at 1440×1000, device scale 1, staff scale 1 and density 2. Clefs and time signatures were explicitly **Show**. All score rows fit each captured tile, and there were no projection errors. Both Studio XML originals became current through Saved → Versions → View → Make current, with bound desktop editors. No source string tuning is declared; neither shell offered Tab or Both.

Reproduce in a fresh worktree after `npm ci` and `npm run build`:

~~~sh
MUSICXML_CAPTURE_FILTER='^12[ab]-' MUSICXML_CAPTURE_TIME_SIGNATURES=show MUSICXML_CAPTURE_DIR=/tmp/mnx-musicxml-clef-workbench node harness/verify/musicxml-editor-capture.mjs
MUSICXML_CAPTURE_SHELL=studio MUSICXML_CAPTURE_FILTER='^12[ab]-' MUSICXML_CAPTURE_TIME_SIGNATURES=show MUSICXML_CAPTURE_DIR=/tmp/mnx-musicxml-clef-studio node harness/verify/musicxml-editor-capture.mjs
python3 harness/verify/musicxml-clef-assessment.py
~~~

The official [MusicXML clef definition](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/clef/) combines sign, line and octave change. Its [octave-change definition](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/clef-octave-change/) gives -1 for a tenor treble clef. The [clef-sign definition](https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/clef-sign/) says TAB indicates tablature and deprecated `none` puts notes as if in treble clef.

## Source → MNX → visible result

Every verdict below applies to **Notation in both shells**. The machine report has one row for each shell and stable source context IDs in the form `12a-Clefs/m01/clef-context`. Its row reasons are agent visual judgments supported by the captures, not automatic correctness assertions.

| Feature ID | Original, imported MNX and both-shell result | Verdict / cause |
|---|---|---|
| `12a.ordinary-clef-lines` | Ten G/C/F changes use the stated lines, including G1, F3 and C1/2/4/5. Their MNX `staffPosition` values and visible C4 heights change with the clef. Bar 17 restores G2. | **Correct.** The ordinary coordinate repair in item 22 holds. |
| `12a.octave-clefs` | Bars 6, 7, 13 and 14 state G2/F4 with -1/+1 `clef-octave-change`. All four import as ordinary G/F with no `octave`. Both shells show no 8 figure and place sounding C4 at the unshifted height. Published MNX has `clef.octave`, and existing engine code/scenarios render octave clefs. | **Incorrect / importer.** |
| `12a.percussion-clef` | Bar 5 retains `sign: percussion` and receives a source-located warning. Both shells show local question-mark clef/note placeholders while later valid bars survive. | **Partial / MNX representation and layout.** This is item 22's intended containment, not percussion glyph support. |
| `12a.tab-clef-without-strings` | Bar 15 requests TAB on line 5 but declares no strings. The importer omits the sign without warning, so the preceding F clef remains in force and C4 is given its F-clef height. | **Incorrect / importer and representation.** A fret/string position is unresolved; Tab/Both are inapplicable without known strings. |
| `12a.none-clef` | Bar 16 requests `none`. Import retains it with a warning; both shells show question marks. MusicXML specifies no clef sign and treble positioning for the note. | **Incorrect / representation and layout.** Item 22 contains the failure but does not implement that deprecated sign's visual meaning. |
| `12b.implicit-treble-and-key` | Neither bar has a key or clef element. MNX preserves both absences; both shells show the default treble clef, no key accidentals and two C4 whole notes. | **Correct.** |
| `12b.explicit-four-four` | The first bar explicitly states 4/4. MNX retains it, and both shells show it with the preference set to Show. | **Correct.** |

The `12a` percussion measure has a pitched C4 with no kit or display-step, so the source does not establish a unique percussion note height. The TAB measure likewise has no string definitions from which to infer a fret. The machine report preserves these two **unresolved placement questions** while giving definite verdicts about the missing or placeholder clef signs. No Tab/Both view was manufactured.

## Ownership and remaining work

[Completed item 22](../roadmap/complete/core-musicxml-render-gaps.md) fixed ordinary clef coordinates and contained unsupported clefs locally; its selected implementation is not reopened. [Completed item 23](../roadmap/complete/core-musicxml-write-gaps.md) fixed the Studio version-title route used by this capture. The four lost octave changes and undiagnosed TAB omission justify the bounded [proposed item 27](../roadmap/proposed/core-musicxml-clef-fidelity.md). Full percussion and `none` representation remains the carrier-dependent work that item 22 explicitly deferred.

This is a render assessment only. It does not credit create/change/remove, undo/redo or save/reopen for [write item 19](../roadmap/inprogress/core-musicxml-write-assessment.md). The rest of the suite still needs current source-feature dispositions; render item 18 remains open.
