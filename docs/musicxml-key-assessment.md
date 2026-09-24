# MusicXML 13-series key-signature rendering assessment

**Implementation loop. Agent assessment, application `af7f3401`, 2026-09-24.**
Seven unchanged 13-series originals in the pinned 183-fixture W3C/LilyPond suite were opened through current Workbench and Studio. This extends [render item 18](../roadmap/inprogress/core-musicxml-render-assessment.md), not human scenario verification or a whole-suite verdict. The [machine report](../harness/reports/musicxml-key-assessment.json) records 15 stable feature IDs, 70 source key declarations, 73 source notes, 167 source-control/note variants and 30 feature × shell × view rows. Nonvisual mode values have explicit **not applicable** rows rather than rendering passes.

## Evidence and method

The [pinned manifest](../converters/fixtures/musicxml-suite/manifest.json) gives source paths, descriptions, revision and SHA-256 hashes. The [source/import verifier](../harness/verify/musicxml-key-assessment.py) checks exact original key order, quarter-note onset, fifths, mode, cancellation, nontraditional alterations, key octaves, visibility and every source/imported note pitch. The [retained browser evidence](../harness/fixtures/musicxml-key-evidence/manifest.json) hashes each shell's imported MNX, observations, complete Notation SVG and screenshots. Both original-file entry routes succeeded. Studio promoted each XML version through Saved → Versions → View → Make current and bound the desktop editor; the captured editable versions were not suspended.

Chrome 153.0.8010.36 ran at 1440×1000, device scale 1, staff scale 1 and density 2. Clefs and time signatures were explicitly **Show**. `13a` needed two overlapping Workbench scroll tiles; its Studio score and every other score fit one tile. Both shells offered only Notation because no source declares known strings. Tab/Both are inapplicable. Neither shell had a projection exception. `13a`'s warning about a common time symbol on 2/4 concerns the meter, not the key; `13b`'s two underfill badges concern source bar lengths, not the mode labels.

Reproduce in an isolated worktree after `npm ci` and `npm run build`:

~~~sh
MUSICXML_CAPTURE_FILTER='^13[a-f]-' MUSICXML_CAPTURE_TIME_SIGNATURES=show MUSICXML_CAPTURE_DIR=/tmp/mnx-musicxml-key-workbench node harness/verify/musicxml-editor-capture.mjs
MUSICXML_CAPTURE_SHELL=studio MUSICXML_CAPTURE_FILTER='^13[a-f]-' MUSICXML_CAPTURE_TIME_SIGNATURES=show MUSICXML_CAPTURE_DIR=/tmp/mnx-musicxml-key-studio node harness/verify/musicxml-editor-capture.mjs
python3 harness/verify/musicxml-key-assessment.py
~~~

The capture commands recapture to `/tmp`; the verifier checks the committed evidence. Replacing retained captures requires reviewing and rehashing them. The official [MusicXML key definition](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/key/) distinguishes traditional and nontraditional keys and defines `print-object="no"`; [cancel](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/cancel/) and [cancel location](https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/cancel-location/) define the natural-run cases.

## Source → imported MNX → visible result

Every verdict below applies to **Notation in both shells**. The machine report has separate shell rows and stable source IDs such as `13e-KeySignatures-MidMeasure-Change/m01/k03` or `13c-KeySignatures-NonTraditional/m02/k01/a05`. Verdicts are agent review of complete visible scores paired with structural comparison; successful import alone is not a pass.

| Feature IDs | Original, imported MNX and visible result | Verdict / cause |
|---|---|---|
| `13a.conventional-fifths` | Thirty major/minor bars from -7 through +7 retain their fifth counts and corresponding flat/sharp or zero-key ink. | **Correct** for key ink. |
| `13a.extreme-fifths` | Sixteen bars request -11 through -8 or +8 through +11. MNX retains each integer, but layout draws at most seven key symbols, so each extreme is visibly reduced to its seven-sign counterpart. | **Incorrect / layout/SVG engine.** Exact >7 glyph spelling needs a reference policy. |
| `13a.major-minor-values` | Each fifth count occurs in major and minor; the signature ink is identical for the pair. MNX drops the mode value. | **Not applicable** as a separate visible mark / importer semantic loss. No authoring claim. |
| `13b.two-sharp-ink`, `13b.mode-labels` | Ten named modes share two sharps. The ten G4 notes and their mode-name lyrics appear in both shells; no different key ink is requested by a mode-only change. | **Correct** for the two visible features. |
| `13b.mode-values` | The ten mode values themselves have no distinct glyph and are lost from MNX; the lyrics are independent text. | **Not applicable** for rendering / importer semantic loss. |
| `13c.nontraditional-alterations`, `13c.explicit-key-octaves` | The first key lists F-sharp/A-flat/B-flat; the second lists five mixed alterations with octaves 2–6. Neither key or octave position survives into MNX, and neither shell prints a signature or warns. | **Missing / importer and MNX representation.** |
| `13d.microtonal-alterations` | Seven nontraditional values include -1.5, -0.5, +0.5 and +1.5. The whole signature vanishes without warning. | **Missing / importer and MNX representation.** This is a key-signature carrier question, separate from item 22's note-pitch diagnostics. |
| `13e.cancel.new-fifths` | The five new fifth counts, 3, -5, -3, 2, -2, remain in MNX and appear as new signatures. | **Correct** for the replacement signatures. |
| `13e.cancel.explicit-natural-placement` | Four source cancellations request left, right, before-barline and left positions; the last deliberately cancels four despite the previous key having two sharps. None of these values or locations survives, and no cancellation natural run appears. | **Incorrect / importer and MNX representation.** |
| `13e.midmeasure.initial-key`, `13e.midmeasure.later-keys` | The first 2-sharp key appears. The 2-flat, zero and 7-sharp changes at quarter onsets 1, 2 and 3 vanish; only their lyric labels remain. | **Correct** initial key; **missing** three later changes / importer and MNX representation. |
| `13f.hidden-key-ink`, `13f.hidden-key-note-context` | The source's second-bar -4 key is `print-object="no"`. MNX keeps -4 but loses visibility, so both shells print four flats. D-flat, E-flat, A-flat and B-flat pitches survive and require no individual flat signs. | **Incorrect** hidden-key ink / importer and representation; **correct** note-pitch/accidental context. |

The [published MNX key](../spec/mnx-schema.json) contains `fifths` and optional color. It can carry the `13a` numeric extremes; the renderer currently truncates their glyph count. It cannot yet express the nontraditional alteration list, key octaves, explicit cancellation placement, midmeasure position or hidden-key display flag. The assessment creates no vendor vocabulary. Exact >7 accidental spelling and the glyph choices for a fractional nontraditional signature remain explicit unresolved design cases; their visible omission is still a definite failure.

## Ownership and remaining work

[Completed item 22](../roadmap/complete/core-musicxml-render-gaps.md) repaired selected fractional **note** diagnostics, clefs and meter cases; it did not cover these key-signature losses. [Completed item 23](../roadmap/complete/core-musicxml-write-gaps.md) owns the Studio title workflow used here. The bounded [proposed item 28](../roadmap/proposed/core-musicxml-key-fidelity.md) covers the representable extreme-fifths rendering gap and source-located diagnostics for the carrier-dependent keys, cancellation, timing and visibility losses.

This render review does not credit editor creation, change, removal, undo/redo or persistence for [write item 19](../roadmap/inprogress/core-musicxml-write-assessment.md). Render item 18 remains in progress for the unreviewed suite and explicit unresolved cases.
