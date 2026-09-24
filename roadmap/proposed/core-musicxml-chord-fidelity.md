# MusicXML chord fidelity — tie shape, ornaments and source timing

> **Status: proposed, 2026-09-24.** MusicXML campaign item 29, from the bounded
> [21a–21i render assessment](../../docs/musicxml-chord-assessment.md). Serves the
> implementation loop. [Campaign contract](../inprogress/core-campaign-musicxml.md).

## Agreement

1. **Oracle:** the nine pinned MusicXML originals and manifest descriptions, official MusicXML chord/tie/tremolo/pickup semantics, source-to-imported-MNX assertions and retained current both-shell notation captures in the assessment. Successful import and nonempty SVG are not verdicts.
2. **MNX verdict:** published `tie.side` can carry forced above/below placement; event `markings.accent` and `fermata` can carry the two `21d` ornaments. Published event-level counted tremolo cannot identify a selected chord member or carry unmeasured zero; measure-global MNX has no MusicXML `implicit` pickup state. Full member/pickup support is a spec-loop question under proposed topics `chord-member-tremolo` and `pickup-measure-state`, not a new ad hoc vendor field in this implementation item. Overhand/underhand tie shape needs an explicit mapping decision before declaring support.
3. **Dependencies:** no new runtime dependency or notation library. Use the existing converter, headless layout and both desktop shell surfaces.
4. **Matrix:** regenerate converter support evidence after converter behavior changes. Do not hand-upgrade a cell from screenshots.
5. **Losslessness:** every selected representable control survives source → MNX → visible both-shell result; source controls awaiting a carrier receive precise warnings, never silent omission or a falsely successful verdict. Any model/engine change re-earns primitives and registers verification debt under [lab-verify](../inprogress/lab-verify.md). No scenario verification block is hand-edited.

## P1: import forced tie placement and the first-bar ornaments

`21b` has eight correct tie targets, but the third bar's lower F4 `placement="above"` and upper D5 `placement="below"` are dropped. Set the corresponding published MNX `tie.side` and confirm the engine draws the requested sides without changing endpoints. The following pair uses `orientation="over"` and `orientation="under"`; resolve whether those shape requests map to `side` or need a separate carrier, and issue a source-located warning until the mapping is agreed. Do not count a default curve that happens to look similar as attribute preservation.

`21d` loses the first whole note's below accent and upright fermata despite existing published MNX event carriers. Import both with correct event attachment, then render them in both shells. The source's Largo, `fp`, `p` and second-bar chords already survive; preserve them. Structural assertions must distinguish absence, present on the wrong event and correct attachment. Use `21b` and `21d` original-file browser captures plus a small independently authored MNX probe if import versus layout ownership is unclear.

## P1: contain tremolo and pickup losses before full representation

`21g` supplies four single tremolos with 4, 2, 1 and 3 marks on distinct chord members and one unmeasured tremolo with zero marks. All five currently vanish without warning. Published event-level counted marks do not encode which member was selected, and a positive count does not encode the zero unmeasured case. First add warnings naming part, measure, source note, tremolo type and marks. Preserve the chord pitches/durations and final rest. Do not apply an event-level tremolo to every chord member as a substitute. Full import/render/export depends on the `chord-member-tremolo` carrier decision and an acceptance case for each of the five originals' controls.

`21e` marks its quarter pickup as measure zero, `implicit="yes"`; import currently loses that fact and the viewer issues a red 4/4 underfill badge. The numbered following bar is independently source-short and must retain its own diagnostic. First distinguish the source-located implicit pickup in import warnings or diagnostic metadata so the editor does not tell a reader that the deliberate pickup is malformed. A true saved/editable pickup representation and badge policy depend on the `pickup-measure-state` spec-loop decision. Acceptance uses both-bar source spans and both-shell captures, not blanket suppression of underfill warnings.

## P1: retain cross-voice chord onsets without inventing a visual rule

`21i` is intentionally nonsensical: the four chord members carry X/Y voice labels. MusicXML's `<chord>` marker keeps the three following notes at the first note's onset even here. Import preserves the four pitches but moves A4/F4 to quarter 1 in a new Y event behind an inserted rest. Contain this invalid combination without silently changing onset, and give a source-located diagnostic if no faithful mapping is possible. The fixture explicitly leaves graceful visual grouping to applications; select and document that policy before an engraving acceptance verdict. Regression asserts the original four source onsets, imported event positions, diagnostics, non-crashing both-shell display and unrelated score preservation.

## Deduplication and authoring limit

The ordinary chord grouping, tie endpoints, interleaved directions and conventional accidental glyphs in this slice already pass. [Completed item 22](../complete/core-musicxml-render-gaps.md) addressed different piano, fractional-pitch, clef and meter failures; its completed containment is not repeated. [Completed item 23](../complete/core-musicxml-write-gaps.md) fixed Studio version promotion used by the captures, without making Studio GP storage lossless. `21h`'s vanished cautionary/editorial identity and unspecified default enclosure reinforce [proposed item 24](core-musicxml-accidental-fidelity.md); this item does not duplicate it.

The assessment performed no direct editor mutation, history or save/reopen task on the `21` feature IDs. [Write item 19](../inprogress/core-musicxml-write-assessment.md) still owns create/inspect/change/remove and route-specific persistence, including these features. A future authoring implementation must use the single desktop `bindEditor` surface, assert structural changes and unrelated-content preservation, exercise undo/redo and test Workbench MNX reopen and Studio editable-version versus canonical GP/download routes separately. No raw JSON edit is a user-facing control.
