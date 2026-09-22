# MusicXML authoring gaps — make an untitled source editable in Studio

> **Status: proposed, 2026-09-22.** Campaign item 23. Initial bounded finding from
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

## Explicit deferrals

- Direct local score upload is a separately chosen product feature, previously skipped
  by the Studio campaign. This proposal does not add an upload surface.
- Fractional pitch and staff configurations are representation blockers shared with
  [render gaps](core-musicxml-render-gaps.md), not merely missing inspector controls.
- Workbench's JSON copy plus external file save/reopen works in the bounded chord probe;
  a built-in MusicXML download surface is not established by that evidence.
- Remaining per-feature create/change/remove, selection, discoverability and persistence
  verdicts belong to the ongoing assessment, not an inferred list of missing controls.
