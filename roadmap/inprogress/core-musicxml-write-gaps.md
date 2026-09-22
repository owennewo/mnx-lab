# MusicXML authoring gaps — source reachability and meter controls

> **Status: in progress, 2026-09-22.** Campaign item 23. Initial bounded finding from
> [write assessment item 19](../inprogress/core-musicxml-write-assessment.md), which
> remains in progress. [Campaign contract](../inprogress/core-campaign-musicxml.md).

## Agreement

1. **Oracle:** the real Studio Versions controls, API refusal, unchanged original XML
   and retained captures in [the assessment](../../docs/musicxml-editor-assessment.md).
2. **MNX verdict:** title metadata has an existing `_x.mnxLab.work` carrier; no new
   vocabulary. Do not conflate a library display title with source document metadata.
3. **Dependencies:** use the one shared editor binding and current storage API.
4. **Matrix:** this changes shell reachability; no converter support upgrade by inference.
5. **Acceptance:** real UI, structurally checked edits, undo/redo and separate storage
   round-trip evidence. No hand-written scenario verification; any moved goldens follow
   the campaign and [verification ledger](../inprogress/lab-verify.md).

## P1: unblock “Make current” for an untitled imported version

Reproduce with `01a-Pitches-Pitches`, `02a-Rests-Durations` or `61a-Lyrics`: operator
import an unchanged XML original alongside a GP canonical source; open Studio's save
sheet, View the XML version, then Make current. The XML renders, but the API refuses
with **“A piece needs a title”** and editing stays suspended. The piece already has a
library title; the XML does not have document title metadata. The name-validation rule
and the version-restoration projection currently leave no title-entry step here.

Proposed interaction: when promoting a version lacks the required title, offer a
clearly labelled title field, prefilled from the current piece's display title. Explain
whether this names the library piece or writes document metadata; preserve the original
rendition. Once current, the existing metadata editor and note editor should be reachable.
Resolve the projection/metadata ownership policy before implementing the API change.

Acceptance: the original XML stays byte-identical, the user can provide a title and make
it current, and a note edit can be undone/redone without unrelated document changes.
The next Studio checkpoint still uses its declared GP storage path and exposes measured
losses. Reload must preserve the intended title and edited notes. Test cancellation,
blank title, an already titled source, and a stale revision. Extend the Studio editor
smoke; assert the stored/reopened document rather than only the save chip.

## P2: expose representable numeric meters through the shared inspector

The [meter write probe](../../docs/musicxml-meter-assessment.md) creates/changes/removes
ordinary meters and sets common/cut display, with exact undo/redo. It also proves that
`time 3/128` and `time 33/4` are rejected without mutation. Published MNX permits these;
`setupGrammar.ts` restricts denominators to 64 and counts to 32.

Acceptance: permit representable, safely handled count/unit values in the existing bar
inspector, or explicitly document a justified application limit with an actionable
message instead of the generic “not a time signature”. Check rest padding, notes and
other measures, exact undo/redo, and MNX reopen. Prove the real shared inspector in
Workbench and in an editable Studio piece; do not count suspended imported versions as
editing passes. Test invalid denominators, nonpositive/unsafe counts and cancellation.
This does not add additive grouping or single-number display syntax without a carrier.

## Explicit deferrals

- Direct local score upload is a separately chosen product feature, previously skipped
  by the Studio campaign. This proposal does not add an upload surface.
- Fractional pitch and staff configurations are representation blockers shared with
  [render gaps](../complete/core-musicxml-render-gaps.md), not merely missing inspector controls.
- Workbench's JSON copy plus external file save/reopen works in the bounded chord probe;
  a built-in MusicXML download surface is not established by that evidence.
- Remaining per-feature create/change/remove, selection, discoverability and persistence
  verdicts belong to the ongoing assessment, not an inferred list of missing controls.

## Meter implementation policy

Accept units through 128 and positive safe integer counts through 1024 in the shared
inspector. Padding creates one rest per beat, so larger counts remain an explicit
application limit with an actionable inspector message; this is not an MNX schema limit.
Add 128th-note rest padding so a newly selected 3/128 meter can be filled exactly.
Preserve pitched notes when shrinking a bar; existing overfill diagnostics still apply.

## Numeric meter progress — 2026-09-22

The shared grammar now accepts 3/128 and 33/4, through the documented 1024-beat
limit. Padding includes 128th rests. Structural tests prove exact padding, note
preservation, unchanged bars after an explicit meter boundary, and exact history.
The Workbench original-file probe types both commands, rejects invalid/excessive
values, and reopens the final MNX exactly. The extended Studio editor smoke types
both commands into an editable piece with exact undo/redo and cancellation. Its
other bars inherit the meter, so their rest padding changes while musical content
and later declarations remain intact. Studio storage fidelity for these two meters
is not claimed by undoing them before the smoke's existing GP-save check.

The untitled-version workflow above remains open.
