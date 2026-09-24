# MusicXML 14a staff-line rendering assessment

**Implementation loop. Agent assessment, application `8994dacc`, 2026-09-24.**
The unchanged `14a-StaffDetails-LineChanges` original in the pinned 183-fixture W3C/LilyPond suite was opened through current Workbench and Studio. This adds eight stable feature IDs, 17 source-control/note variants and 16 feature × shell × Notation verdicts to [render item 18](../roadmap/inprogress/core-musicxml-render-assessment.md). It does not claim human scenario verification or authoring support.

## Source and evidence

The [pinned manifest](../converters/fixtures/musicxml-suite/manifest.json) supplies the original path, SHA-256, revision and feature description. The [machine report](../harness/reports/musicxml-staff-lines-assessment.json) records each `staff-details` declaration at its part, measure and quarter onset, both hidden-line controls and all ten source notes. The [verifier](../harness/verify/musicxml-staff-lines-assessment.py) checks source and capture hashes, matching browser imports, exact G4 pitches and whole/half durations, warning text, display preferences and the complete visible tile. The [capture manifest](../harness/fixtures/musicxml-staff-lines-evidence/manifest.json) retains both shells' imported MNX, observations, SVG and PNG.

[MusicXML staff details](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/staff-details/) can specify a staff's line count; [staff-lines](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/staff-lines/) is its numeric child. [Line detail](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/line-detail/) identifies a line from bottom to top and permits `print-object="no"` for an individually hidden line. The [LilyPond suite description](https://lilypond.org/doc/v2.26/input/regression/musicxml/collated-files) describes this source's one-, five-, four- and three-line phases and its last-bar suppression of lines 2 and 4. Exact horizontal spacing is not the verdict.

Chrome 153.0.8010.36 ran at 1440×1000, device scale 1, staff scale 1 and density 2. Clefs and time signatures were set to **Show**. Both original-file opens succeeded without projection or console errors; the whole four-bar, two-part score fits one viewport tile in each shell, with no hidden scroll content. Studio made the imported XML version current and bound the desktop editor. No source strings are declared; Tab and Both are inapplicable.

Reproduce after `npm ci` and `npm run build` in an isolated worktree:

~~~sh
MUSICXML_CAPTURE_FILTER='^14a-' MUSICXML_CAPTURE_TIME_SIGNATURES=show MUSICXML_CAPTURE_DIR=/tmp/mnx-musicxml-staff-lines-current-workbench node harness/verify/musicxml-editor-capture.mjs
MUSICXML_CAPTURE_SHELL=studio MUSICXML_CAPTURE_FILTER='^14a-' MUSICXML_CAPTURE_TIME_SIGNATURES=show MUSICXML_CAPTURE_DIR=/tmp/mnx-musicxml-staff-lines-current-studio node harness/verify/musicxml-editor-capture.mjs
python3 harness/verify/musicxml-staff-lines-assessment.py
~~~

The capture commands write scratch data; the verifier checks the committed, hash-pinned evidence. Both shells imported identical MNX and gave the same four source-located warnings.

## Source → imported MNX → visible result

Each verdict is recorded separately for **Notation in Workbench and Studio** in the machine report. Stable IDs such as `14a-StaffDetails-LineChanges/p02/m03/sd01` follow original part, measure and declaration order; `p02/m04/sd01/ld02` identifies the second fourth-bar hidden-line control.

| Feature ID | Source and imported/visible result | Verdict / cause |
|---|---|---|
| `14a.upper-one-line-staff` | Part 1 declares one line at the opening, lasting all four bars. Import warns, retains no staff-line carrier, and both shells draw five lines in every bar. | **Incorrect / importer and MNX representation.** |
| `14a.lower-initial-five-lines` | Part 2 starts with five lines; its first bar shows five. | **Correct** for this bounded geometry. |
| `14a.lower-four-line-change` | Part 2 changes to four lines at bar 2 and keeps them through the first half of bar 3. Import warns and both shells retain five. | **Incorrect / importer and MNX representation.** |
| `14a.lower-midmeasure-three-lines` | After the first half note of bar 3, part 2 changes to three lines at quarter onset 2. The MNX has no midbar staff instruction, and the second half still shows five lines. | **Incorrect / importer and MNX representation.** The warning names part and measure, though not the in-bar onset. |
| `14a.lower-five-line-reset` | Part 2 returns to a five-line coordinate system at bar 4. The five-line fallback matches that count alone. | **Correct** for line count; the separate visibility feature fails. |
| `14a.lower-hidden-inner-lines` | Fourth-bar `line-detail` elements hide lines 2 and 4 while preserving their positions. Import warns but drops both controls; all five lines print. | **Incorrect / importer and MNX representation.** |
| `14a.pitched-note-data` | Ten G4 notes across two parts and four bars retain their source whole/half values and onsets in MNX; all ten are visible. | **Correct** for note data and presence only. |
| `14a.staff-relative-note-placement` | The intended relation of notes to one-, four-, three- and selectively hidden-line geometry cannot be checked in the five-line fallback. | **Blocked by import/representation prerequisite.** Visible G4 notes do not prove source-relative placement. |

Six rows are **correct**, eight **incorrect** and two **blocked** across the two shells. The blocked rows prevent a whole-fixture pass. The original four unsupported changes each produce a warning; the ordinary initial five-line declaration does not.

## Ownership and next work

[Completed item 22](../roadmap/complete/core-musicxml-render-gaps.md) added source-located warnings for this fixture's unsupported staff configurations. It explicitly deferred a variable/hidden staff-line carrier and engraving design. The present capture confirms both the delivered containment and the remaining visible loss, so no duplicate proposal is filed. [Completed item 23](../roadmap/complete/core-musicxml-write-gaps.md) makes the imported Studio version editable, but this render capture is no create/inspect/change/remove, history or save/reopen result for [write item 19](../roadmap/inprogress/core-musicxml-write-assessment.md).

[Render item 18](../roadmap/inprogress/core-musicxml-render-assessment.md) remains in progress across the rest of the suite. This assessment creates no MNX vocabulary and changes no scenario golden or verification status.
