# MusicXML tuplet fidelity — duration, nesting and requested display

> **Status: proposed, 2026-09-24.** MusicXML campaign item 31, from the
> [23a–23f render assessment](../../docs/musicxml-tuplet-assessment.md).
> Serves the implementation loop. [Campaign contract](../inprogress/core-campaign-musicxml.md).

## Agreement

1. **Oracle:** the six unchanged pinned MusicXML originals, their manifest descriptions, official MusicXML tuplet/time-modification semantics, exact source-to-imported-MNX assertions and retained current both-shell captures. The 65 feature IDs and 268 source variants in the [assessment](../../docs/musicxml-tuplet-assessment.md) are the regression inventory. Nonempty SVG and correct pitch alone do not establish tuplet correctness.
2. **MNX verdict:** published `tuplet` already permits nested sequence content, `inner`/`outer`, `bracket`, `orient`, `showNumber` and `showValue`; published event markings cover staccato and positive single-note tremolo. Preserve source meaning in those standard fields first. Curved/slurred tuplet-line shape has no published MNX field, so full support needs a named spec-loop decision (`tuplet-line-shape`) rather than an ad hoc extension. This item changes no vocabulary by itself.
3. **Dependencies:** no new runtime dependency or notation library. Use the existing importer, shared viewer and SMuFL engine.
4. **Matrix:** regenerate converter support observations if import/export behavior changes; captures alone never upgrade a matrix cell.
5. **Losslessness:** every selected source group either retains performed timing, nesting and declared display in MNX and both shell views or receives a precise source-located diagnostic. Model/engine changes re-earn primitives and register verification debt in [lab-verify](../inprogress/lab-verify.md); scenario status/verification remains human-owned.

## P0: preserve performed duration and nested structure

`23c` bars 2–4 are four quarter beats in the original, but each browser-imported MNX bar totals **18** because `normal-type=breve` is used as the arithmetic unit even though it describes the normal-note display. Each second marked three-note group is also split into two and one. `23d` has seven nested source groups and eight explicit converter warnings; imported MNX contains no tuplets and turns its three 2/4 bars into 13/4, 7/2 and 7/2 quarter spans. This moves notes into wrong performed positions and produces overfill diagnostics, not merely wrong labels.

Acceptance: a minimal independent nested 3:2/5:2 case and an unequal-note 3:2 case must produce the same exact rational bar spans and note onsets as source durations, with nested MNX containers matching start/stop numbers and with every written pitch/value preserved. Re-import all ten `23c` and seven `23d` source group variants through the converter package; capture their actual originals in both desktop shells with no false overfill diagnostic. Distinguish unsupported genuinely unrepresentable input with a precise warning; no silent flattening. Run the affected converter suite, relevant browser import smoke, root tests and build.

## P1: carry explicit tuplet display choices

`23b` requests straight and curved brackets, no number, both numbers, note-value labels, no bracket and below placement across 17 groups. `23c` requests actual/both types and several explicitly displayed 7:5 variants across ten groups. Their imported containers all lack display fields. Both shells print the default inner count alone, and `23f` even draws a hooked bracket over its marker-free upper triplet though the manifest describes bracket-free tuplets. Published MNX fields can carry the bracket, orientation, number and value requests; the current notation emitter must then draw each choice rather than only the inner number.

Acceptance: assert source `bracket`, `placement`, `show-number`, `show-type`, `tuplet-actual` and `tuplet-normal` against MNX and both shell SVGs for every applicable `23b`/`23c` group. Include one independent MNX probe for `showNumber=both`, `showValue=both` and `noNumber` so an importer loss cannot conceal an engine defect. Match source ratio and note-value display without inventing values absent from the source. Decide how an absent `<tuplet>` display marker maps to an MNX bracket policy; `23f`'s upper group must not acquire a bracket against its manifest description. Keep the `23f` six-note 3:2 sequence explicitly unresolved until its manifest “sextuplet” grouping and marker-free MusicXML can be reconciled. A curved/slurred bracket needs the named `tuplet-line-shape` spec decision or a source-located unsupported-style warning; do not silently substitute a straight line.

## P1: import simple note markings around tuplets

The nine `23e` staccato points and eight positive one-slash **single-note** tremolos are dropped, while the 12 tuplet groups and `fp` dynamic survive. Published event `markings.staccato` and `markings.tremolo.marks` are suitable for these source controls. Acceptance: assert all nine staccato and eight tremolo objects in imported MNX, retain five three-quarter bar spans, and see their ink in both original-file shell captures. Check that the dynamic stays attached to its source beat. A minimal event-marking operation test and the relevant browser smoke should protect the path.

## Existing ownership, unresolved source claims and authoring

[Completed item 22](../complete/core-musicxml-render-gaps.md) already diagnoses `23b`'s incompatible common-time symbol on 5/4; its four-beat last bar legitimately produces an underfill diagnostic. [Item 7](../inprogress/core-musicxml-ottavas-tuplets.md) fixed a narrower normal-unit regression in the 27-pair oracle; it does not prove these six complex sources. [Proposed item 29](core-musicxml-chord-fidelity.md) owns the separate `21g` chord-member and zero-mark tremolo carrier question. The eight `23e` controls are ordinary positive single-note markings, not a duplicate representation request. [Completed item 23](../complete/core-musicxml-write-gaps.md) gives Studio an editable XML version path, not an exact GP storage guarantee.

The `23b` manifest says 17:2 for its last group, while the original XML repeatedly states 17:3. Preserve both statements in the report; use the original for the measured ratio and resolve the description upstream before changing behavior to 17:2. `23f` has no graphical tuplet markers, so its six-note grouping remains explicitly qualified. [Write item 19](../inprogress/core-musicxml-write-assessment.md) still needs real create/inspect/change/remove tasks for these feature IDs, structural checks, undo/redo, Workbench MNX reopen, Studio editable-version checks and separate GP/library/download reopen verdicts. No JSON edit or internal operation is a user-facing authoring pass.
