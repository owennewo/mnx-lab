# Score display settings

> **Status: proposed (2026-09-08).** Implementation loop: presentation controls
> over the existing MNX model, shared by the engine and viewer and exposed in
> the workbench's settings pad. No spec changes.

## Outcome

Expand the score-corner settings card beyond its existing Show row. The user
can choose what appears in the score without editing the document, creating
undo entries or changing playback semantics. Use **system**, not line, in the
UI: one horizontal row of music, including notation and tab together in Both.

| Control | Choices |
| --- | --- |
| Show (existing) | Notation / Tab / Both |
| Lyrics | All verses / Current verse / Hide |
| Time signatures | Show / Hide |
| Clefs | Show / Hide |
| Title | Show / Hide |
| Bar numbers | Every bar / Every system / Hide |
| Instrument names | Every system / First system / Hide |

“Clefs” means the treble/bass/percussion glyphs and associated octave marks,
and the TAB designation on tab staves. Staff lines remain visible. Hiding a
clef never changes the pitch-to-staff mapping; hiding time signatures never
changes measure duration, beaming or playback.

## Current implementation and seams

- `src/workbench/SettingsPad.ts` owns the existing Show card;
  `src/workbench/ScenarioPage.ts` mounts it and owns host preferences.
- `src/elements/DocumentViewer.ts` exposes the view projection and a `hide`
  feature list, currently lyrics/badges. Its document heading can fall back
  to a document ID, explaining the hash-like title in the motivating image.
- `src/engine/layout/notation.ts` and `tab.ts` already honor hidden lyrics.
  `lyricRuns.ts` shares verse ordering and geometry; ordering uses
  `global.lyrics.lineOrder`, then remaining used IDs in sorted order.
- Both renders through the notation system walk, sharing tab staff emission
  with `tabStaff.ts`. Keep that single source.
- The notation layout also emits score-block titles. Distinguish those from
  the viewer's document heading before wiring the Title control.

Read the current viewer surface contract in
[core-viewer-surface.md](../complete/core-viewer-surface.md), and the rendering
and workbench docs before implementation. Audit current defaults, bar-number
sources, instrument naming and system boundaries rather than assuming they
all use the same paths.

## Behavioral contract

### Lyrics

All verses preserves current output. Current verse uses a shared selected
lyric-line ID across the rendered document, resolved from the established
ordering; until a playback/repeat context supplies a current ID, use the
first used verse in that ordering. Explain this fallback in the control's
help text. Do not silently substitute another verse in individual bars
where the selected verse has no syllable. A document with no lyrics renders
no lyric band in any mode.

Filter before row allocation, syllable/hyphen emission and lyric-dependent
spacing. Hide releases the lyric band; Current verse allocates only its
selected row. Audit spacing.ts's lyric-width calculation as well as vertical
reservation so hidden verses do not keep widening bars. Both shows one lyric
block anchored to notation, not a duplicate under tab.

Repeat interpretation and automatic verse advancement are out of scope.
Provide a small explicit selected-verse input for future playback integration;
do not equate repeat count with verse ID or persist transient playback state.

### Time signatures, clefs and title

Hide suppresses initial, repeated and changed time signatures or clefs,
including both staves in Both. Keep key signatures, repeat marks and staff
lines. Reclaim only space allocated to the hidden feature, keeping remaining
prefix elements aligned and correctly positioned.

Title hides the visible document title/artist heading block and engraved
score-block title labels; it leaves section/rehearsal labels and application
navigation intact. Keep an accessible document name when the visual heading
is hidden. Do not add standard MNX title fields or alter title fallback rules
as part of this work.

### Bar numbers and instrument names

Every bar emits one bar label per displayed measure position; Every system
emits a label at the first displayed measure of each system. Reflow recalculates
those positions. Both does not double labels. Reuse authoritative displayed
measure numbering, including pickups/custom numbering where supported; never
derive labels from a repeated playback traversal.

Instrument names belong to parts: Every system labels each visible part in
each system; First system labels each part in the first system of its rendered
score block; Hide suppresses the labels. Do not duplicate a part's name for
its notation and tab staves. Reuse existing full/short-name conventions,
leaving unnamed parts unlabeled rather than assuming an instrument. Account
for multi-staff parts, multiple parts and multiple rendered score blocks.

## Implementation sequence

1. **Define pure options and defaults.** Establish typed display options at
   the engine layer and deterministic normalization. Preserve existing
   no-options engine output byte-for-byte. Audit defaults against the visible
   menu choices; explicitly record any mismatch before changing default output.
   Compose the existing `hide="lyrics,badges"` contract with the new options:
   an explicit host hide remains authoritative. Keep badges independent.
2. **Thread through layout.** Carry the same effective options into notation,
   tab and Both, the packing/spacing calculation and primitive generation.
   Filter before measuring; do not hide rendered SVG with CSS while retaining
   empty gutters. Keep all horizontal sizing in spacing.ts. Include options
   in layout memoization/invalidation inputs.
3. **Expose the viewer contract.** Add programmatic display properties and
   appropriate declarative bindings consistent with the existing public
   surface. Keep Node/headless rendering DOM-free. Options are per viewer;
   the embeddable element does not read workbench storage or import its UI.
4. **Extend the settings card.** Reuse the existing Lit styling and selection
   semantics with seven labeled rows. Support keyboard use, selected-state
   announcements, focus return, Escape/click-away, narrow screens and a
   scrollable card when necessary. Preserve availability rules for Tab/Both.
5. **Persist in the host.** Store validated display preferences in the
   workbench's localStorage preference mechanism, independently of documents
   and of transient current-verse context. Recover from invalid/old values.
   Apply consistently to the main score and compare viewer, while preserving
   each viewer's existing projection choice. Preference changes rerender and
   reflow without changing MNX, selection identity or playback position.
6. **Validate and document.** Document defaults, property/attribute precedence,
   persistence scope, current-verse fallback and the meaning of system.

## Acceptance and verification

- Exercise all choices across Notation, Tab and Both with a multi-system,
  multi-verse score, a score without lyrics, a multi-part/grand-staff score,
  and a score with time/clef changes. Cover unnamed parts and title fallback.
- Check hidden or filtered content releases its measured space without
  collisions, clipping, duplicate labels or stale hit targets. Resize to
  change system breaks and verify numbering/name placement follows them.
- Check first/current verse selection with nonnumeric verse IDs, declared
  ordering, missing syllables and empty lyric content. Verify hyphens do not
  connect across verses or systems.
- Add focused harness coverage for pure option normalization, filtered layout
  geometry and label placement. Browser-check the actual card, preference
  reload, keyboard behavior, light/dark themes, focus mode and compare view;
  do not introduce a separate UI test infrastructure.
- Confirm MNX serialization, undo history, pitch mapping, rhythmic timing and
  playback position remain unchanged by display preferences.
- Regenerate primitives and require existing default goldens to remain
  byte-identical. Alternative display output needs explicit option-aware
  harness cases, never replacement of the corpus's default verdicts.
- If an intentional output change becomes necessary, register its scenario
  batch and reviewer guidance in [lab-verify.md](../inprogress/lab-verify.md)
  with a two-way link before closing this item. Never hand-edit verification
  records or statuses, and never hand-edit mirrored scenarios.
- Run the repository landing gates after rebase: `npm test`,
  `npm run check:scenarios`, and `npm run build`. Check library/embed faces
  when modifying their public bindings.

## Boundaries

This work does not implement repeat counters, verse-to-repeat mapping,
notation editing, staff-line visibility, new instrument assumptions, a new
settings framework or a backend. It uses the existing score data and host
preference architecture.
