# Score frame — edge grips for play, zoom and settings, one element for both shells

> **Status: proposed and started 2026-09-11.** Implementation loop. Serves studio first
> (the piece page has no zoom or settings at all, and its player dock fades on a pointer
> timer that touch never restarts) and the workbench second (the same element replaces its
> corner cluster and moves the player out of the side panel). Design locked on the
> *Studio Controls* canvas, 2026-09-11 — four directions, then three variants of the
> fullscreen one, then **edge grips**, drawn in the library page's vocabulary.

## The problem

Studio's piece page is fullscreen by rule — the score is the page — with two thin overlays
that fade when the pointer is idle. Three things are wrong with it on glass:

1. **Zoom and settings do not exist there.** The workbench's zoom pad and settings card are
   `src/workbench/` components, so the shell that most needs a touch-sized zoom has none.
2. **The overlays wake on `pointermove` and `keydown`**, which a tap does not send. Once the
   bars have faded on a tablet they return only on a scroll.
3. **A tap on the score must stay navigation.** The obvious touch fix — tap the page to show
   the chrome — was drawn and rejected: it takes the tap that seeking to a bar (and, when the
   editor is promoted, selecting a note) needs.

## The design (locked)

The score pane owns **two grips**, one on each horizontal edge, and a hairline progress
line along the bottom edge. Nothing on the page listens for a tap to show chrome.

- **Quiet.** A title grip on the top edge (title · a muted sub-line · a chevron); a pause
  grip on the bottom edge (pause/play · the position readout · a chevron); the progress
  line. Pause/play and the way back to the chrome are on screen at 44px at all times —
  the table stakes for a focused view.
- **Drawn out.** The top grip becomes the library page's *tools row*: the borderless
  `← Library` line, the title at h1 weight with the sub-line muted, the piece's tag chips
  on the grey ground, then on the right the **staff view as the library's sort control**
  (Notation · Tab · Both), **Zoom** and **Settings** — which open the shared pads under
  their buttons — a `…` menu and the collapse chevron. The bottom grip becomes the
  player's tray in the same buttons. Below ~1000px of pane the tools row and the tray
  each wrap to a stacked form (three lines); the phone and the workbench's pane beside
  its rail and side panel both hit that breakpoint.
- **One element, two hosts.** Studio mounts it on the piece page; the workbench mounts it
  on the scenario page's score pane, between the rail and the side panel, where the top
  strip carries the scenario id and provenance and an extra **Focus** button. In document
  focus the workbench's chrome goes and what is left is exactly studio's quiet view.
- **The pads keep their frame.** The zoom pad and settings card are the components both
  shells share; they are promoted, not restyled. The staff view is duplicated on purpose —
  the strip's segmented control and the card's STAFF row are the same setting — because
  it is the switch a guitarist flips most and the strip is one tap nearer.

## Phases

1. **Promote the pads.** `src/workbench/{ZoomPad,SettingsPad}.ts` → `src/elements/`,
   with `DEFAULT_DISPLAY_PREFERENCES` lifted beside them (the localStorage read/write stays
   in the workbench — it is a shell decision). The workbench re-imports; no behaviour
   changes; the boundary check is the proof.
2. **`<mnx-score-frame>`** in `src/elements/`: the two grips, the two strips, the progress
   line, the segmented staff view, the Zoom/Settings buttons hosting the pads, and a slot
   for the score. It takes the `<mnx-player>` (the tray is the player's own render; the
   grip's pause and readout come from its `playback-state-changed` frames and call its
   `play()`/`pause()`), and slots for the back link, chips, extra strip buttons and the
   `…` menu. Open/closed state per strip is the element's; the host stores nothing.
3. **Studio adopts it.** `StudioApp`'s header/footer and the idle timer go on the piece
   page; the library and alias pages keep the header. The staff view, display preferences
   and zoom become per-browser preferences like today's `mnx-studio.view`.
4. **The workbench adopts it.** The corner cluster and the side panel's player move into
   the frame; Focus is a strip button; document focus keeps the grips. The zoom pad's
   footer focus toggle stays as it is (the pad is shared and the toggle is harmless in
   studio, where it is simply not wired).
5. **Tap a bar to seek.** The quiet view's promise. Needs the viewer to report the measure
   under a point (it hit-tests notes today for `note-selected`); the frame forwards it to
   the player's `seek`. Scoped last because 1–4 stand without it.

## Out of scope

Practice features (loop, speed trainer — [studio-player-practice.md](../proposed/studio-player-practice.md));
the editor's promotion ([core-editor-element-promotion.md](../proposed/core-editor-element-promotion.md));
restyling the pads; dark theme work beyond what `light-dark()` already gives the strips.

## Build record

- 2026-09-11 — worktree `core-score-frame` taken; phase 1 started.
