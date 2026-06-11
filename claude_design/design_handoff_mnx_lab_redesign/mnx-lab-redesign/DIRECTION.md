# MNX Lab — front-end redesign direction (2026-06-11)

## The call

**"The reading room."** MNX Lab is a corpus you read, not an editor you operate.
The redesign reframes the app around that fact:

1. **The library is the navigation.** The scenario rail is permanent (left, ~310px),
   not a panel you toggle into. Browsing `lab/` and `spec/`, filtering by status and
   facet, and jumping scenario-to-scenario (↑/↓, `/` to filter) is the primary loop.
2. **The scenario is the page.** Title (serif), id (mono path), dual verdict chips
   (standard MNX / `_x.tab`), lifecycle pips, source, description, spec refs — then
   the rendered output and the document side by side.
3. **JSON-beside-rendering is the core interaction, not a fourth view mode.** The old
   `notation | tab | both | json` segmented control conflated *what music to draw*
   with *whether to see the document*. Now: view modes are Notation / Tab / Both;
   JSON is a persistent split pane with **two-way note ↔ JSON cross-highlighting**
   (click a notehead → the document line lights up; click an anchored line → the
   notehead lights up). That is the renderer-proving gesture, so it costs one click,
   not a mode switch.
4. **Paper.** The score always renders on a warm paper card — even in dark chrome.
   Bravura's engraved character is a fixed ingredient; the chrome treats the document
   like a specimen on a bench, and never recolors it per theme.
5. **Status is a language.** draft → valid → rendered → verified as 4 lifecycle pips,
   used identically in rail rows, scenario headers, category bars, and the dashboard.
   **Invalid-by-design is not red.** Spec gaps are first-class exhibits (oxide diamond,
   pinned-error table, notes) — they're findings for w3c-cg/mnx#63, not failures.
6. **Editor features demote to context.** Playback: compact play + bpm in the score
   toolbar (pure function of the document; works on any rendered scenario). AI chat:
   an "Assist" drawer that refuses corpus documents and instead offers **fork to
   sketch** — an editable transient copy — keeping the existing invariant that chat
   can never mutate the corpus.
7. **The empty state is the coverage dashboard.** Scenario counts, status breakdown,
   feature-defs coverage bar (the backlog list *is* the uncovered defs), per-category
   stacked bars. Spec coverage is the progress metric; show it when nothing is selected.

## Visual system

- **Type:** IBM Plex Sans (UI) · IBM Plex Mono (ids, JSON, chips, numbers) ·
  IBM Plex Serif (scenario titles, dashboard headline). Technical-document character
  that sits naturally next to engraved Bravura.
- **Color:** warm near-whites and warm near-blacks (chroma ≤ 0.015). One accent —
  engraving-plate blue `oklch(0.46 0.09 250)` — plus a status ramp sharing chroma:
  draft gray, valid amber, rendered green, verified blue, spec-gap oxide.
- **Dark mode:** chrome inverts to warm charcoal; paper stays paper.

## Mapping to the Lit implementation

- All tokens are CSS custom properties → set them on `:host` of `<mnx-editor-app>`
  (shadow-root safe, themeable by embedders; restyle `wa-*` via the same vars).
- Components: `mnx-library-rail`, `mnx-scenario-header`, `mnx-score-toolbar`,
  `mnx-document-pane` (JSON), `mnx-coverage-dashboard`, `mnx-assist-drawer` — same
  ReactiveController/state pattern; new events: `scenario-selected`,
  `note-selected` (existing), `document-line-selected`, `fork-requested`.
- The note↔JSON linkage needs note ids (or stable JSON pointers) from the renderer's
  primitives — the layout engine already carries note ids for selection.
- Rename: header wordmark becomes **MNX Lab** (the `index.html` title already says it).

## Prototype caveats

This is a React-based design prototype (the real app stays Lit + Web Awesome).
The score "renderer" here is a stand-in that draws plausible Bravura engraving so
the chrome can be judged; treat its output as placeholder for the real
layout→primitives→SVG pipeline. Corpus counts/statuses mirror the live repo
(53 scenarios, 47 rendered) with representative spec/ names.
