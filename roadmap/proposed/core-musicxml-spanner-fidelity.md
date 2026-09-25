# MusicXML spanner fidelity — endpoints, style and invalid input

> **Status: proposed, 2026-09-25.** MusicXML campaign item 35, from the
> [eleven-source 33a–33k render assessment](../../docs/musicxml-spanners-assessment.md).
> Serves the implementation loop. [Campaign contract](../inprogress/core-campaign-musicxml.md).

## Agreement

1. **Oracle:** the eleven unchanged pinned originals, their manifest descriptions, source-derived start/stop IDs and [126 current feature × shell × Notation rows](../../harness/reports/musicxml-spanners-assessment.json). [Retained original-file evidence](../../harness/fixtures/musicxml-spanners-evidence/manifest.json) includes matching imported MNX, complete SVGs and screenshots. A visible straight stroke or octave label alone is not an endpoint/style pass.
2. **MNX verdict:** published note ties, event slurs and part ottavas already carry ordinary targets/ranges. Use them before changing vocabulary. Glissando versus slide, line type/inline text, double-note tremolo membership and let-ring have no proven lossless carrier in the current imported shape; name spec-loop carrier decisions before adding vocabulary. Preserve existing \`_x.mnxLab\` usage unless its contract is explicitly revised.
3. **Dependencies:** no new runtime dependency, notation library, second editor or touch editing. Use the existing converter, model and shared renderer.
4. **Matrix:** regenerate converter observations when import/export changes; no support cell upgrades from screenshots alone.
5. **Losslessness:** retain the 164 original pitched notes, 11 source files, ordinary ties/slurs/wedges/tuplets and known successful chord-member targets. Model/engine changes re-earn primitives and register moved goldens in [lab-verify](../inprogress/lab-verify.md); scenario verification stays human-owned.

## P0: preserve valid octave ranges and reject misleading invalid sizes

\`33d\` supplies all four valid 15ma/15mb/8va/8vb forms with negative MusicXML direction offsets. The imported values are right, but stop positions collapse or shorten the source ranges. \`33a\` is a separate renderer failure: its 8va and 15mb import into the right bars with half-bar endpoints, then appear in unrelated bars on the multi-system canvas. \`33e\` intentionally uses invalid display sizes 27 and 11. These silently become ±1 octave and draw credible 8va/8vb signs, with no relevant warning. A warning or source-specific rejection must identify each unsupported size; the unrelated time-symbol warning is insufficient.

Acceptance: an independent MNX probe draws ottavas at bar 8 and bar 9 on a wrapped score with correct start/end coordinates. Source-to-MNX checks for \`33d\` compute positions from direction cursor plus signed offset and assert all four end fractions; both shell captures then show the four labels and full ranges over their intended notes. Importing \`33e\` names sizes 27 and 11 with part/measure locations and does not silently substitute valid one-octave marks. Include the documented valid 22-size policy before broadening this feature. Preserve pitches and ordinary meter.

## P0: resolve ties by note and musical time

\`33k\` loses the G4 tie from voice 1 into voice 2 and the enharmonic A-sharp/B-flat link while correctly drawing three staggered E4/G4/C5 ties into a chord. Its single \`let-ring\` tied mark disappears. \`33c\` loses the lower-to-upper cross-voice slur whose stop precedes its start in XML order but follows it in score order. \`33i\` supplies an intentionally unended tie from C: diagnose the unmatched start instead of silently dropping it or inventing an endpoint.

Acceptance: structural assertions resolve each source endpoint to the intended imported note/event ID across voice, chord and measure order; preserve \`33c\`'s five existing links and \`33k\`'s three existing chord links. Minimal MNX probes draw the cross-voice and enharmonic curves without a spurious curve on another note. The \`33i\` open start emits a source-located diagnostic; no visual pass is claimed for its unspecified end. For let-ring, choose a published/extension carrier or a named spec-loop proposal and supply a one-note outgoing-curve probe before calling it supported.

## P1: restore visible spanner identity and stroke counts

\`33h\` preserves ten note pairs but turns default/wavy glissandi and every dashed/dotted/wavy slide into the same straight \`shift\` slide. Two inline texts are omitted. \`33a\` repeats wavy gliss and straight slide, while its two-stroke double-note tremolo disappears. \`33j\` loses all double-note tremolo stroke counts; first-bar beam declarations become generic beams and a source tuplet is split into multiple displayed groups. The retained ordinary second-bar beams are a positive control.

Acceptance: source-to-import assertions preserve glissando versus slide, each source line type and inline text or issue a source-located diagnostic for a distinction without a carrier. Independent MNX probes render default/wavy, solid, dashed and dotted styles and text between the right noteheads; both original-file shell captures must match the ten \`33h\` pairs. Double-note tremolo acceptance checks each start/stop count, chord member when relevant, and visible beams/strokes in \`33a\` and \`33j\` without extra tuplet groups. Set a named carrier policy for two-note tremolo before implementing it; the generic single-event mark is not a substitute.

## Existing ownership and deferrals

[Item 33](core-musicxml-direction-fidelity.md) already covers the five \`33a\` bracket forms, dashes, pedal line/change/stop and pedal symbols. [Item 34](core-musicxml-notation-fidelity.md) owns the \`33a\`/\`33f\` trill and ornament omissions and hammer/pull identity; its work should use the \`33f\` after-grace wavy stop as a regression once a carrier exists. [Item 31](core-musicxml-tuplet-fidelity.md) owns \`33j\`'s source-tuplet splitting and display, and [item 29](core-musicxml-chord-fidelity.md) owns different chord-member tremolo and forced tie-side cases. Completed [item 22](../complete/core-musicxml-render-gaps.md) fixed earlier import containment; completed [item 23](../complete/core-musicxml-write-gaps.md) permits editable Studio XML versions. Neither proves these spanners or their GP storage.

Full analytical \`33a\` grouping is deferred because the source requests no visible mark. An unended \`33i\` tie has no reference final curve and remains an explicit unresolved visual case after diagnostic work. [Write item 19](../inprogress/core-musicxml-write-assessment.md) must test create/inspect/change/remove, undo/redo and each persistence route against the same IDs; this render evidence grants none of those passes.
