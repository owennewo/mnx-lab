# MusicXML notation fidelity — chord signs, fermatas and note marks

> **Status: proposed, 2026-09-24.** MusicXML campaign item 34, from the
> [six-source 32-series render assessment](../../docs/musicxml-notations-assessment.md).
> Serves the implementation loop. [Campaign contract](../inprogress/core-campaign-musicxml.md).

## Agreement

1. **Oracle:** the six unchanged pinned originals, manifest descriptions where present, the original `32e-Fermatas` shape values where its description is absent, official MusicXML semantics, source-derived IDs and [386 current both-shell variant/view rows](../../harness/reports/musicxml-notations-assessment.json). The [retained evidence](../../harness/fixtures/musicxml-notations-evidence/manifest.json) includes each original-file import, imported MNX and complete score captures. Lyric captions naming a sign do not count as sign ink.
2. **MNX verdict:** published `arpeggio`, `non-arpeggio`, event `fermata` and common event markings already carry much of the missing data. Use them before proposing new fields. The existing harmonic and bend extensions carry some technical semantics, but `32a` shows lost base/touching/sounding roles, H/P identity and with-bar meaning; choose a named spec-loop representation or precise source-located diagnostic for information they cannot carry. This item invents no standard or `_x.mnxLab` vocabulary.
3. **Dependencies:** no new runtime dependency, notation library, second editor or touch editing. Use the MusicXML importer, model and shared SMuFL renderer.
4. **Matrix:** regenerate converter support observations if import/export changes. Do not upgrade support cells from a screenshot.
5. **Losslessness:** preserve the 175 source note/rest entries, their pitches and written values, the 166 lyric labels, two staves and three voices where present, and existing harmonic/dynamic ink. Model/engine changes re-earn primitives and register moved goldens in [lab-verify](../inprogress/lab-verify.md); scenario verification remains human-owned.

## P0: import and draw arpeggio groups and fermatas

`32a` has three arpeggiate and two non-arpeggiate endpoints, `32d` has eleven and four, and `32e-Arpeggios-Cross` has thirty numbered arpeggiate declarations. **All fifty** are absent from imported MNX and both SVGs, although published MNX has chord-span lists and the renderer has matching ink. `32d` distinguishes normal, up-arrow, down-arrow, non-arpeggiate bracket and partial-chord variants. `32e` assigns one number across staves in bar 1, numbers per staff in bar 2, and per voice in bar 3; keeping its pitches without the grouping does not preserve the feature.

`32a` adds five note fermatas and one full-rest fermata; `32e-Fermatas` adds seven source shapes. **All thirteen** are absent from imported events and both SVGs. Published event `fermata` and the existing glyph map can carry the normal, angled, square, double-dot, half-curve, double-square and double-angled variants. Retain upright/inverted orientation and attachment to the rest as well as pitched notes.

Acceptance: source-to-MNX assertions resolve each numbered arpeggio into the intended simultaneous note-ID span, preserving up/down and bracket endpoints. An independent MNX probe first confirms the engine's wavy sign, arrow directions, non-arpeggio bracket and cross-staff span when import is out of the path. The six original-file Workbench/Studio captures then show the corresponding ink without displaced staff/voice grouping. All thirteen source fermatas must have the right event and symbol/orientation in MNX and visible SVG; separately test the full-rest attachment and seven-shape ladder. Unhandled number/shape cases receive source-located diagnostics, not a silent default.

## P1: import representable event markings; diagnose the rest

`32c` provides six ordinary accent/staccato controls across three valid wrapper shapes: two `<notations>` elements, two `<articulations>` children, and one child with both signs. All six are lost. `32a` loses 21 articulation and 26 ornament controls without source-located warnings. Published event markings can carry ordinary accent, strong accent, staccato, tenuto, bow direction and several other source signs; they should be imported regardless of wrapper shape and drawn once at the correct note. `32a` bar 24 deliberately combines above and below marks, so placement and stacking need a source-aware decision, not one default. Its turn/trill accidentals and many specialist ornaments do not have an established carrier in the current model.

Acceptance: import and render each representable `32c` accent/staccato and `32a` ordinary marking, asserting exact event attachment, multiplicity where meaningful and preserved unrelated notes. A minimal event-marking probe separates importer and engine failures. Inventory the other `32a` ornament and technical controls by whether published MNX, the existing extension or neither can express them; emit a bar/note/type diagnostic for each unsupported one. For unrepresented compound ornaments, choose a named spec-loop topic before adding a carrier. Do not treat lyric text as a substituted mark or claim support for every listed specialist technique.

## P1: repair retained techniques without erasing their distinctions

The first three simple `32a` harmonics render, but thirteen explicit base/touching/sounding roles in bars 13–14 collapse to natural/artificial type. The positive four-semitone bend draws; two release curves survive in MNX but have no ink, and source `-0.5` pre-bend becomes `+0.5` with an upward arrow. One release also loses its with-bar request. Hammer-on and pull-off pairs retain endpoints and curves, but become one indistinguishable `hammerPull` operation with no H/P label. Separately, fingering, pluck, string/fret and other signs are silently omitted.

Acceptance: test source role and bend sign before rendering, then verify note-specific circles, release curves and the negative pre-bend in both original-file shell captures. Preserve the already correct simple harmonics and positive bend. Decide how the harmonic role, H/P identity and with-bar sign are represented; until then, warn at each affected note rather than silently implying a complete import. Record standalone fret without a known string/tuning as a representation question, not an excuse to invent a Tab view. For the other unsupported technical signs, the P1 diagnostic inventory is the bounded deliverable; full engraving is deferred until carriers and priority are chosen.

## Existing ownership and authoring boundary

[Proposed item 31](core-musicxml-tuplet-fidelity.md) already owns `23e` staccato and positive single-note tremolo import; the shared importer fix should satisfy both inventories. [Item 29](core-musicxml-chord-fidelity.md) already owns the `21d` first-note accent and fermata; its case becomes a regression for event attachment, not a second proposal. [Completed item 17](../inprogress/core-musicxml-dynamics.md) supplies the `32a` `f`/`sfp` successes and the explicit `sfffz` warning. [Item 33](core-musicxml-direction-fidelity.md) owns `32b`'s positioned-word formatting and clipping; this item owns note-bound signs. Completed items 22/23 cover selected render containment and Studio's editable XML version workflow, not the losses measured here.

[Write assessment item 19](../inprogress/core-musicxml-write-assessment.md) must use the same feature IDs for actual create/inspect/change/remove, undo/redo and each save/reopen route. No UI authoring or GP storage pass follows from this render evidence.
