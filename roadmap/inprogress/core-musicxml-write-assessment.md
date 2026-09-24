# MusicXML write-path assessment — can a person author the data?

> **Status: in progress, 2026-09-22.** Side quest, item 19 of
> [core-campaign-musicxml.md](core-campaign-musicxml.md). Serves the implementation loop.
> Requested 2026-09-22 as a companion to the
> [render assessment](core-musicxml-render-assessment.md): for each corpus feature,
> does the desktop editor offer the means and UX surface to create, change and remove
> its data? Deliver an assessment and a bounded proposal to fill the demonstrated gaps.

## The agreement block

1. **The oracle** — explicit authoring tasks derived from the pinned external fixtures'
   feature descriptions and source semantics. Prove them through the real editor UI,
   structural before/after assertions, undo/redo and applicable save/reopen checks.
   Rendering alone cannot prove the intended data was written; an internal edit operation
   alone cannot prove a user can reach it.
2. **The MNX verdict** — map each task to standard MNX, an existing `_x.mnxLab` carrier,
   or a representation gap. Any future extension follows the campaign's spec-loop
   contract and names its proposal topic. This assessment creates no new vocabulary.
3. **The dependency budget** — no new runtime dependencies; reuse item 13's pinned corpus,
   the shared editor binding and existing browser/conformance harnesses.
4. **The matrix row** — maintain distinct authoring evidence linked to the same fixture
   and feature identifiers as item 18. Neither a working UI nor a failed save silently
   changes converter support cells; implementation changes regenerate those separately.
5. **The losslessness bar** — every inventoried feature has explicit operation-level
   dispositions, with evidence for exercised tasks and honest blockers elsewhere. A pass
   requires the intended mutation and preservation of unrelated musical content, with
   undo/redo restoring the respective states. Assessment completion does not require
   fixing the discovered gaps or claim human scenario verification.

## Scope and shared inventory

Reuse item 13's pinned, licensed W3C/LilyPond corpus and item 18's complete inventory.
Share feature IDs and provenance so a reader can compare **imports**, **renders** and
**can be authored** without conflating them. This work can proceed alongside item 18
once the inventory exists; it does not wait for rendering fixes.

Include semantic data with no visible mark, where it is in scope for authoring: a
nonvisual disposition in the render assessment does not exclude it here. Identify
format-only, derived and intentionally read-only data explicitly, with rationale.
Invalid fixture encodings need not be authorable; assess the valid underlying feature
where one exists. Record uncertain mappings as unresolved rather than inventing a task.

Assess studio and workbench on desktop through their actual entry points into
`bindEditor`. Reuse shared behavior tests where justified, but check shell-specific
reachability and save routes separately. Record shell, application commit, browser,
selection context, document/session mode and prerequisites. A read-only session is not
proof that the editing feature is absent; repeat in the intended editable session.
Touch authoring is excluded by the standing product rule: studio plays on touch.

## Operation-level assessment

For each fixture feature, define concrete tasks covering applicable operations:

- **Create** it in a document or selection that lacks it; imported content alone cannot
  demonstrate this. Use a minimal starting document with the required parts/staves.
- **Inspect and change** its meaningful values, scope, targets and endpoints. Cover
  distinctions exercised by the fixture, not just the simplest available control.
- **Remove** it without deleting unrelated content or leaving dangling references.
- **Undo and redo** each mutation, checking the intended document states and selection
  behavior where relevant.
- **Persist and reopen** the edited result through each applicable user-facing save or
  export route, recording survival separately from editing capability. Studio's stored
  Guitar Pro path and downloaded MusicXML are different contracts; do not assume that
  either preserves everything, or that MusicXML export is exposed in both shells.

For each task record:

1. The MNX field/object and expected structural change; how defaults and generated IDs
   are normalized without hiding meaningful losses.
2. Whether the model and edit operation support it, whether the operation is bound to a
   command, and whether a user can reach that command from the necessary selection.
3. The actual UX path: menu/inspector/control labels, keyboard shortcut or command
   palette entry, required focus and selection, and screenshots or action traces.
4. Actual before/after MNX, validation result, preservation checks, undo/redo evidence,
   and applicable persisted/reopened result. Render evidence is a separate cross-link.
5. Any discovery or usability obstacle: hidden selection requirements, misleading labels,
   missing current-value feedback, disabled controls without explanation, or an action
   that only works in one shell. Distinguish functional reachability from discoverability;
   agent inspection is not a human usability study.

A raw JSON edit, developer-console call, test-only dispatch or AI-assisted edit is recorded
as an alternative route, never credited as a normal direct editor control. An existing
operation with no reachable binding is an identified UX gap. Conversely, a visible control
that writes the wrong field is not support. Document intentional keyboard-only commands
accurately; keyboard access is a valid desktop surface.

If import loses the feature, mark the fixture's end-to-end task blocked and assess the
editor independently with a minimal valid MNX probe. Keep those verdicts separate so an
importer defect neither hides working authoring nor excuses missing controls. Likewise,
a renderer defect need not block structural assessment, but can impair selection or
feedback; record that dependency explicitly.

## Report and gap attribution

Commit a machine-readable report and readable summary, with one row per feature × task
× relevant shell. Deduplicate equivalent tasks across fixtures only with explicit evidence
links and a stated equivalence; retain coverage of distinct scopes and feature variants.
Use **supported**, **partial**, **unavailable**, **incorrect**, **blocked**, **unresolved**
and **not applicable**, with an explanation for every non-pass. Track persistence and
UX observations separately so a working edit with a lossy save remains visible as both.

Attribute each gap to representation, edit operation, command/binding, selection or
inspector UX, shell integration, renderer feedback, import, or persistence/export; allow
multiple causes. Link related item 18 findings rather than filing duplicate fixes.
Include fixture/task counts, coverage exclusions, exact reproduction steps and retained
artifact locations. Agent findings are labelled as such; no scenario `status` or
`verification` records are hand-edited and no existing goldens are changed for this audit.

## Output and completion

The first bounded proposal became [item 23](../complete/core-musicxml-write-gaps.md)
and its selected fixes landed. The corpus-wide assessment is still open. When
remaining evidence reveals additional actionable gaps, file a new, deduplicated
proposal under `roadmap/proposed/`, add its roadmap/campaign links, and append
findings to the campaign log. The requested follow-up names for every selected
gap:

- Evidence, affected features/shells and an independently reproducible authoring task.
- The missing model/operation/binding/UI/persistence capability and dependencies.
- A concrete proposed user interaction and observable acceptance criteria, including
  structural correctness, unrelated-content preservation, undo/redo and applicable
  persistence. Name the relevant browser smoke and meaningful operation tests.
- Overlap with existing authoring work or the render-gap proposal, explicit deferrals,
  and spec-loop treatment for representation gaps.

Prioritize inability to author or preserve musical meaning, then incomplete manipulation
and discoverability problems. Respect the single shared editor binding: do not propose a
second editor or touch editing. Follow the campaign agreement and golden/verification-debt
rules for subsequent implementation. Fixes are separate work, not part of this assessment.

Complete when the inventory has operation-level dispositions, supported claims have real
UI and data evidence, blockers are explicit, and the gap proposal is linked. If there are
no actionable gaps, publish the evidence and conclusion rather than inventing a backlog.

## Initial evidence landed, 2026-09-22

See [the assessment report](../../docs/musicxml-editor-assessment.md) for the complete
both-shell browser sweep, selected findings, retained evidence and reproduction. The
requested initial gap proposal exists, but detailed feature/task coverage remains open.
This item is not complete.

## Meter follow-up, 2026-09-22

[All 12 meter sources](../../docs/musicxml-meter-assessment.md) now have explicit
variant findings and retained visible-meter captures in both shells. Five Workbench
meter commands have structural/history evidence, four rejected forms have UI traces,
and the final state has MNX reopen evidence. Initial captures hid time signatures;
absence there is not a rendering verdict. Gap proposals include exact meter import,
display losses and representable inspector ranges. Other families and remaining
meter policy/task/persistence combinations stay open; this item remains in progress.

## Handoff, 2026-09-24

Item 23 resolved the initial Studio title block and numeric-meter inspector
range; those bounded probes are not corpus-wide authoring passes. On `01a`,
Studio GP storage loses 15 of 108 source notes, although the selected edit and
library title survive. Start with the shared `01a`–`01h` feature IDs: define
create/inspect/change/remove tasks, exercise real desktop Workbench and editable
Studio paths, check structural changes and undo/redo, and mark each applicable
save/reopen route separately. Record blocked and unresolved tasks explicitly.
