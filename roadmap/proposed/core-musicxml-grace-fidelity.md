# MusicXML grace fidelity — links, staff and directions

> **Status: proposed, 2026-09-24.** MusicXML campaign item 32, from the
> [24a–24h render assessment](../../docs/musicxml-grace-assessment.md).
> Serves the implementation loop. [Campaign contract](../inprogress/core-campaign-musicxml.md).

## Agreement

1. **Oracle:** the eight unchanged pinned MusicXML originals, their manifest descriptions, original-file source-to-MNX assertions and the current Workbench/Studio captures. The [machine report](../../harness/reports/musicxml-grace-assessment.json) pins 40 feature IDs, 157 source variants and 80 feature × shell × Notation verdicts. Small visible grace heads alone do not prove their staff, spanner or direction attachments.
2. **MNX verdict:** the imported grace children already carry staff numbers and note-target slur/tie links; use those existing fields for rendering. Published dynamic groups currently locate a direction by rhythmic fraction, which does not distinguish a zero-duration grace from its principal at the same beat. Resolve that carrier question as the named spec-loop topic `grace-dynamic-anchor` before adding vocabulary; this proposal does not invent an `_x.mnxLab` field.
3. **Dependencies:** no new runtime dependency, notation library, second editor or touch editing. Use the existing importer, shared viewer and SMuFL engine.
4. **Matrix:** regenerate converter support observations if import/export behavior changes. A capture is evidence of the current visible result, not authority to hand-upgrade a support cell.
5. **Losslessness:** preserve every source pitch, written value, existing grace group, staff and unrelated voice while fixing the selected links and marks. Unrepresentable source placement receives a source-located diagnostic. Model/engine changes re-earn primitives and register moved goldens in [lab-verify](../inprogress/lab-verify.md); scenario verification remains human-owned.

## P0: draw grace-origin slurs and ties

`24a` has three grace-to-principal slurs, `24f` has one, and `24b` has two note-level ties across grace chord members and into a principal chord. The importer already resolves these into MNX note targets. Current notation SVGs in **both** shells contain no corresponding slur/tie curves. This is a renderer defect in handling grace-container notes, not an absent MusicXML or MNX spanner.

Acceptance: minimal MNX probes draw a slur from a grace child to its principal, a tie between grace chord members, and a tie from grace to principal, with the correct source/target pitch and curvature. Re-import all three original fixtures and see four slurs and two ties across their respective scores in both shells; verify their note targets structurally and preserve other notes. Run engine behavior tests, re-earn primitives, and capture both desktop shells.

## P0: project cross-staff grace children to their declared staff

The three graces in `24e` declare staff 2, and the imported MNX grace events retain `staff: 2`. Workbench and Studio draw their heads on staff 1. Meanwhile `24h`'s three groups already draw on the expected part/staff, so a fix must retain that behavior.

Acceptance: render `24e`'s two grace groups on staff 2, with stems/beams and their principal notes still attached appropriately. Assert the imported staff numbers and visible staff-relative coordinates, then replay `24h` to prevent cross-part or empty-voice regressions. Keep the layout's placeholder/diagnostic behavior for genuinely unsupported staff references.

## P1: distinguish grace-local and principal directions

`24g` places `f` at the first grace, a diminuendo over the grace run and `p` at the main beat. All three imported MNX directions have fraction zero. Both dynamic glyphs draw at identical x/y and the wedge has no ink. `24h`'s `fp` belongs to the first main note, but draws next to its leading grace head. These are distinct source placements at one metric beat; a fraction alone cannot tell them apart after import.

Acceptance starts with a `grace-dynamic-anchor` representation decision against published MNX: identify whether source-relative attachment can be expressed by existing references or requires a standard proposal, and give unsupported inputs a source-located diagnostic until then. Then test a first-grace dynamic, a main-note dynamic, a wedge spanning grace events and a simultaneous multistaff case. Each must import with a distinguishable attachment and display under its intended note or span in both shells without overprinting. Preserve ordinary timed dynamics, including item 17's existing round trips. Do not guess horizontal offsets in SVG to stand in for missing source order.

## Scope boundaries and dependencies

The original `24d` carries two 20-percent playback stealing attributes; its importer loses the numbers. Their audible timing needs a separate playback/representation assessment, and item 19 must judge whether they can be authored and saved. No render pass is claimed for them. `24c` supplies no stealing attribute and `24f` supplies no slash attribute; the latter's manifest explicitly leaves slash display to the application. The absent slash defaults in `24a` bar 3 are likewise not a forced regression target.

[Completed item 22](../complete/core-musicxml-render-gaps.md) owns ordinary clef/meter containment and related diagnostics, not these grace links or staff placement. [Completed item 23](../complete/core-musicxml-write-gaps.md) owns the Studio editable-version workflow, not grace authoring or GP preservation. [Proposed item 31](core-musicxml-tuplet-fidelity.md) owns positive single-note staccato and tremolo marks; it does not address grace links or zero-time direction attachment. [Write assessment item 19](../inprogress/core-musicxml-write-assessment.md) must evaluate the same feature IDs through actual Workbench and Studio controls, undo/redo and each save/reopen route. No direct editor support is inferred from this render assessment.
