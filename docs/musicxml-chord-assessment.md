# MusicXML 21-series chord rendering assessment

**Implementation loop. Agent assessment, application `b970e686`, 2026-09-24.**
Nine unchanged `21a`–`21i` originals in the pinned 183-fixture W3C/LilyPond suite were opened through the current Workbench and Studio. This extends [render item 18](../roadmap/inprogress/core-musicxml-render-assessment.md), not human scenario verification or a whole-suite verdict. The [machine report](../harness/reports/musicxml-chord-assessment.json) contains 27 stable feature IDs, 95 source notes, 40 source events, 32 source controls, 167 source variants and 54 feature × shell × view rows. Its 34 correct, 8 incorrect, 8 missing and 4 unresolved rows are agent verdicts about this slice only.

## Evidence and method

The [pinned suite manifest](../converters/fixtures/musicxml-suite/manifest.json) supplies original paths, SHA-256 hashes, descriptions and revision. The [source/import verifier](../harness/verify/musicxml-chord-assessment.py) derives measure, note, event and control variants from each original XML file, checks every source note pitch and the ordinary chord grouping/durations against the browser-imported MNX, and verifies the retained capture hashes. The [evidence manifest](../harness/fixtures/musicxml-chord-evidence/manifest.json) indexes both shells' imported MNX, observations, complete Notation SVGs and PNG screenshots. All nine original-file entry routes succeeded in each shell. Studio's XML versions were made current and editable through its Versions workflow; this is a viewing prerequisite, not an item 19 authoring or GP-storage pass.

Chrome 153.0.8010.36 ran at 1440×1000, device scale 1, staff scale 1 and density 2. Clefs and time signatures were explicitly **Show**. Each entire score fit one viewport tile in each shell; the capture verifier checks both scroll dimensions and the one-tile screenshot list. The imported MNX was identical across shells. There were no importer warnings, browser console errors or render exceptions. No source declares known strings or tuning, so Tab/Both are inapplicable; each verdict applies to **Notation in both desktop shells**.

Reproduce the browser capture in an isolated worktree after `npm ci` and `npm run build`:

~~~sh
MUSICXML_CAPTURE_FILTER='^21[a-i]-' MUSICXML_CAPTURE_TIME_SIGNATURES=show MUSICXML_CAPTURE_DIR=/tmp/mnx-musicxml-chords-current-workbench node harness/verify/musicxml-editor-capture.mjs
MUSICXML_CAPTURE_SHELL=studio MUSICXML_CAPTURE_FILTER='^21[a-i]-' MUSICXML_CAPTURE_TIME_SIGNATURES=show MUSICXML_CAPTURE_DIR=/tmp/mnx-musicxml-chords-current-studio node harness/verify/musicxml-editor-capture.mjs
python3 harness/verify/musicxml-chord-assessment.py
~~~

The capture commands write fresh observations to `/tmp`; the verifier checks the committed evidence. Replace retained captures only after visual review and rehashing. The original `<chord>` [does not advance the MusicXML cursor](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/chord/); [tied placement and orientation](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/tied/), [single and unmeasured tremolos](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/tremolo/) and [implicit pickup measures](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/measure-partwise/) are judged against the official definitions. The [accidental definition](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/accidental/) leaves absent enclosure attributes to application defaults.

## Source → imported MNX → visible result

| Feature IDs | Original, imported MNX and both-shell Notation result | Verdict / cause |
|---|---|---|
| `21a.two-note-chord`, `21a.following-rest` | A4/F4 share one quarter chord, followed by a quarter rest. Both appear with the intended grouping and values. The source leaves the rest of 4/4 empty, and the underfill badge reflects that source-short bar. | **Correct.** |
| `21b.repeated-two-note-chords`, `21b.tie-targets` | All 24 notes stay in twelve two-note quarter chords. Eight note-level tie starts resolve to the correct following pitches, and the curves appear. | **Correct.** |
| `21b.forced-tie-placement`, `21b.forced-tie-orientation` | The third bar requests above/below tie placement, then overhand/underhand orientation. Neither attribute survives import; the visible curves use default sides/shapes. Published MNX `tie.side` can carry the placement request. Exact orientation mapping needs a stated policy. | **Incorrect / importer; orientation also needs a representation decision.** |
| `21c.three-note-chord-members`, `21c.chord-duration-variants` | Seven three-note events retain all 21 pitches and their dotted-quarter, eighth, quarter and half values. The corresponding stems, heads and dot appear. | **Correct.** |
| `21d.words-and-dynamics`, `21d.second-bar-chords` | Largo, `fp` and `p` directions survive; the four second-bar two-note chords keep all eight pitches and written values. The fine pixel position of `fp` is not separately approved. | **Correct** for these features. |
| `21d.first-bar-accent`, `21d.first-bar-fermata` | The source first whole note has an accent below and upright fermata. Both are absent from imported MNX and visible ink, although published MNX has event-level carriers. | **Missing / importer.** |
| `21e.pickup-note`, `21e.after-pickup-chords` | The quarter C5 pickup and the subsequent three-note then two-note chords survive. The numbered second bar is also source-short. | **Correct** for note/chord content. |
| `21e.pickup-implicit-state` | Source measure zero is `implicit="yes"` and holds one quarter in 4/4. Import loses that status; both shells display a red underfill badge on the deliberate pickup. | **Incorrect / importer and missing MNX pickup representation, surfaced by layout diagnostics.** |
| `21f.interleaved-chord-members`, `21f.directions-after-chord`, `21f.following-rests` | Segno and `p` occur between XML chord notes but belong to the following rest. The A4/F-sharp4/D4 chord remains one event; both marks appear at quarter 1, followed by quarter and half rests. | **Correct.** |
| `21g.chord-member-pitches`, `21g.final-rest` | Five chords retain their 19 pitches, grouping and values; the final eighth rest survives. | **Correct** for pitches/rhythm. |
| `21g.measured-member-tremolos`, `21g.unmeasured-member-tremolo` | Four member-specific single tremolos request 4, 2, 1 and 3 marks; the fifth member requests unmeasured type with zero marks. All five ornaments vanish without warning. Published MNX's event-level positive mark count does not identify a chord member or carry this unmeasured zero case. | **Missing / importer and MNX representation.** |
| `21h.chord-pitches-and-glyphs` | The D-flat, F-sharp and A-natural chord retains all three pitches and ordinary flat/sharp/natural glyphs. | **Correct** for pitch and basic glyph. |
| `21h.cautionary-editorial-identity` | The sharp is marked cautionary and natural editorial in the source. Import drops both flags; all signs look ordinary. The source requests no parentheses or bracket, so the exact enclosure style is application-dependent. | **Unresolved** visible styling / **importer** semantic loss; already owned by item 24. |
| `21i.four-pitches-present` | The intentionally nonsensical cross-voice chord retains E5/C5/A4/F4 as visible pitches. | **Correct** for pitch presence alone. |
| `21i.simultaneous-onset`, `21i.cross-voice-engraving-policy` | Three chord-tagged notes must stay at the first note's onset despite mixed X/Y voice labels. Import splits voices, inserts a Y rest and moves A4/F4 to quarter 1. The fixture permits application-specific graceful visual handling, so ideal grouping/stems remain open. | **Incorrect / importer** onset; **unresolved / source-reference ambiguity** for engraving policy. |

The machine report has separate feature × shell rows and source variants such as `21b-Chords-TwoNotes/p01/m03/n02/tied01`, `21g-Chords-Tremolos/p01/m01/n17/tremolo01` and `21e-Chords-PickupMeasures/p01/m01/implicit`. Every source note, event and control variant belongs to at least one feature. Overlapping variants are intentional where one note tests pitch, duration and an attached control.

## Ownership and remaining work

[Completed item 22](../roadmap/complete/core-musicxml-render-gaps.md) fixed selected piano, fractional-pitch, clef and meter cases; its diagnostic containment does not cover these newly observed chord losses. [Completed item 23](../roadmap/complete/core-musicxml-write-gaps.md) fixed Studio's editable-version title path, used for these captures, without fixing GP storage. `21h` confirms [proposed item 24](../roadmap/proposed/core-musicxml-accidental-fidelity.md)'s cautionary/editorial carrier and default-policy issue, so it does not warrant another accidental proposal. [Proposed item 29](../roadmap/proposed/core-musicxml-chord-fidelity.md) owns the new tie, ornament, pickup and cross-voice findings.

This is render evidence only. It grants no create/inspect/change/remove, undo/redo, saved GP or download-reopen pass under [write item 19](../roadmap/inprogress/core-musicxml-write-assessment.md). Both assessment items remain open until the full 183-original inventory has explicit feature and task dispositions, including unresolved cases.
