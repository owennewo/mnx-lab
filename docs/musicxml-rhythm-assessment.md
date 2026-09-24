# MusicXML 03-series rhythm rendering assessment

**Implementation loop. Agent assessment, application `4817af90`, 2026-09-24.**
Seven unchanged 03-series originals from the pinned 183-fixture W3C/LilyPond
suite were opened through current Workbench and Studio. This continues
[render item 18](../roadmap/inprogress/core-musicxml-render-assessment.md);
it is not human scenario verification or a whole-suite verdict. The
[machine report](../harness/reports/musicxml-rhythm-assessment.json) records
14 stable feature IDs, 110 source-note and 41 source-control variants, and
28 feature × shell × view rows.

## Evidence and method

- The [pinned manifest](../converters/fixtures/musicxml-suite/manifest.json)
  owns original paths, descriptions, versions and SHA-256 hashes. The
  [reviewed source/import inventory](../harness/verify/musicxml-rhythm-assessment.py)
  tracks XML note and control IDs, exact quarter-note onsets and durations,
  browser-imported MNX events, and secondary beam groups. Its assertions
  check both shell imports and the concrete mismatches; the verdict text is
  agent review of visible output, not an automatic import pass.
- [Retained browser evidence](../harness/fixtures/musicxml-rhythm-evidence/manifest.json)
  hashes both shells' imported MNX, observations, complete Notation SVGs and
  scroll PNGs. Chrome 153.0.8010.36 ran at 1440×1000, device scale 1, staff
  scale 1 and spacing density 2. Time signatures were explicitly **Show**;
  all seven scores fit in each retained score tile. Both Studio versions
  became current with a bound desktop editor. No source declares strings,
  so Tab/Both are inapplicable.
- [The isolated MNX engine probe](../harness/reports/musicxml-rhythm-engine-probe.json)
  tests long noteheads, short flags and invisible `space` items independently
  of the MusicXML importer. This isolates causes; it never upgrades the
  original-file end-to-end result. The [existing independent oracle](../harness/reports/musicxml-independent.json)
  provides a separate note-table comparison with its own declared limits.

Reproduce in an isolated worktree after `npm ci` and `npm run build`:

```sh
MUSICXML_CAPTURE_FILTER='^03' MUSICXML_CAPTURE_TIME_SIGNATURES=show MUSICXML_CAPTURE_DIR=/tmp/mnx-musicxml-rhythm-workbench node harness/verify/musicxml-editor-capture.mjs
MUSICXML_CAPTURE_SHELL=studio MUSICXML_CAPTURE_FILTER='^03' MUSICXML_CAPTURE_TIME_SIGNATURES=show MUSICXML_CAPTURE_DIR=/tmp/mnx-musicxml-rhythm-studio node harness/verify/musicxml-editor-capture.mjs
python3 harness/verify/musicxml-rhythm-assessment.py
npm run build:lib
node harness/verify/musicxml-rhythm-engine-probe.mjs
```

Studio used a private local library and its Saved → Versions → View → Make
current route; Workbench used its original-file input. The sources, scenario
verification, goldens and production library were untouched.

## Source → MNX → visible result

Each verdict below applies to **Notation in both shells**. The machine report
has separate shell rows and exact variant records. [MusicXML's type](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/type/)
is the written note value; [divisions](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/divisions/)
set duration units. [Backup](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/backup/)
and [forward](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/forward/)
move the time cursor without asking for rest ink.

| Feature IDs | Observed source, imported MNX and visible result | Verdict / cause |
|---|---|---|
| `03a.long-values` | Nine maxima/longa/breve notes across plain, dotted and double-dotted forms all become `whole` with three dots; the 16/2, 24/2 and 28/2 bars show false underfill. Even independently authored MNX long values draw black heads. | **Incorrect** / importer and layout/SVG engine. |
| `03a.standard-values` | All 24 whole-through-128th written values and their dots survive, but the preceding long-value errors shift their positions and compress the ladders. | **Partial** / importer; correct individual ink is not a correct bar. |
| `03a.short-values` | Twelve 256th/512th/1024th notes become undotted 128ths, without warnings. The MNX probe shows the higher flag glyphs exist in layout. | **Incorrect** / importer. |
| `03b.partial-backup-onsets`, `03b.unwritten-voice-gap` | The two C4s remain on beats 1–2 and two A3s on beats 2–3 after the partial backup. Import also inserts a quarter rest before voice 2; both shells print ink absent from the source. | **Correct** onsets; **incorrect** unwritten gap / importer. |
| `03c.midmeasure-divisions` | Divisions 1→8 in bar 1 and 8→38 in bar 2 still yield four quarter notes and two half notes at their exact onsets. | **Correct**. |
| `03d.dotted-pitched-values`, `03d.meter-context` | The dotted half and double-dotted half survive; 1/8 through 31/8 meter changes appear with Show enabled. | **Correct** for those features. |
| `03d.full-bar-rest-values` | Eight one-bar multiple-rest markers vanish. Five rest durations match; 5/16 becomes a quarter, 9/8 a whole, and 31/8 a whole with three dots. The visible rest ink and metric lengths are wrong in those bars, with no import warning. | **Partial** / importer; extends proposed rest item 25. |
| `03d.unfilled-bar` | Bar 15 has only a 16th note and no invented rest. Its underfill badge truthfully describes the intentionally incomplete bar. | **Correct** for source ink. |
| `03e.default-divisions` | The description's default of one division per quarter, duration 4 and explicit `type=whole` appear as one C4 whole note. | **Correct for rendering.** The existing music21 note-table oracle disagrees about the default metric duration; that semantic/tool question remains unresolved. |
| `03e.secondary-beam-breaks` | All 32 32nd notes retain their pitches and values. Source and MNX beam groups match at levels 1–3; the four different patterns are visible in both shells. | **Correct**. |
| `03f.note-onsets`, `03f.unwritten-forward-gaps` | The quarter on beat 2, 16th on beat 4 and next-bar quarter keep exact onsets. The first two `<forward>` spans print as quarter rests; the final 3/16-whole empty span disappears, leaving the first bar underfilled in MNX. | **Correct** note onsets; **incorrect** unwritten gaps / importer. |

The end-to-end gaps are source-located in the report. Its 03a note records
show **21 of 45** written durations changed and **39** note onsets changed
after those values collapsed. `03d` has **3 of 19** changed note/rest
durations. The independent oracle separately flags `03a`, `03b`, `03d` and
`03f` as import differences; it reports `03c` and the beam fixture as exact
within its note-table scope. An isolated `space` probe draws zero rest glyphs
and fills `03f`'s first bar without changing its three noteheads. The
remaining underfill diagnostic belongs to source bar 2, which contains only
one quarter note.

## Ownership and remaining work

[Completed item 21](../roadmap/complete/core-musicxml-short-durations.md)
repaired an **export** divisions problem; it did not make the 03a imported
types or long noteheads correct. [Completed item 22](../roadmap/complete/core-musicxml-render-gaps.md)
owns meter totals and compatible common display, which the reviewed bars
retain. [Completed item 23](../roadmap/complete/core-musicxml-write-gaps.md)
owns untitled Studio version promotion. The one-bar rest findings extend
[proposed item 25](../roadmap/proposed/core-musicxml-rest-fidelity.md).
The new long/short **note** and invisible-gap failures warrant
[proposed item 26](../roadmap/proposed/core-musicxml-rhythm-fidelity.md).

This is a render assessment. It does not credit create/change/remove,
undo/redo or save/reopen for [write item 19](../roadmap/inprogress/core-musicxml-write-assessment.md).
Render item 18 remains open for the rest of the pinned suite, including
explicit unresolved cases and exclusions.
