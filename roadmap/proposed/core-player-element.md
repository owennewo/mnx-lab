# The player element over the written score — the first reviewer milestone

> **Status: implemented 2026-09-09; landing checks in progress.** Campaign:
> [core-campaign-player.md](../inprogress/core-campaign-player.md), item 7. Needs items 2, 5 and
> 6. Deliberately **not** waiting for the unrolled engraving (item 10): the written
> score, a performed-order table and sound prove the player with far less layout work.

## Agreement block (campaign contract)

- **Pure before audible (§1).** The element holds no musical logic; position
  formatting (`bar 5 · iteration 2 · beat 3`) is a pure helper with its own test.
- **Identities (§3).** Playback highlight is **separate from selection**: the element
  emits playback-state changes (item 2's live fields) with `highlight` as written
  occurrences; the common host provides the context. The viewer draws playback in its
  own style alongside the selection enclosure. `elements/` does not import `edit/`; click-to-seek is a
  `note-selected` event the host turns into `seek(ordinal)` on the element, and the
  host selects from item 2's candidate ordinals relative to the current position;
  click again cycles candidates, including repeated visits on the same iteration.
  Auto-scroll is a **public** reveal on the viewer taking a written occurrence;
  the existing `revealSelection` is private and selection-driven, so it is extracted
  into a shared helper rather than reused.
- **Proof (§4).** `element-census.test.ts` registers it; routing pins
  `#/scenario/<id>?view=…&at=<ordinal>`; `smoke:embed` on **both** formats plays one
  document in the mock host with no workbench code. No golden.
- **Dependencies (§5).** None beyond item 6's.
- **Reviewer gain (§7).** Listen on the `/verify` review page, and the
  **performed-order table** (item 1's entries, with bar numbers and iterations) as a
  band beside the engraving — the table the reviewer reads while the cursor walks it.

## Design

- **`<mnx-player>`** in `src/elements/`, plain Lit, shadow DOM, `light-dark()`
  tokens. Inputs: a `Performance`; outputs: `playback-state-changed` and
  `seek`/`onset`/`bar` events. It never provides the shared context itself. The host
  listens and updates one `ContextProvider` on an ancestor of player and viewer;
  the viewer keeps consuming the context it already knows. Both embed examples show
  that plain-DOM wiring and click-to-seek without importing workbench/edit modules.
  Controls: play/pause, stop, position readout, rate
  (0.5–1.5), volume, and a loop seam item 13 fills. No mute/solo here.
- **Written view only.** The cursor walks the written score in performed order; on a
  repeat it goes back, and the live playback iteration changes with it. The
  inspection chip retains its separate value; Follow controls reveal and verse choice.
  That is enough for the reviewer to hear a D.S. return and see where it landed.
- **Where it mounts.** The scenario page (check the five-band frame's tray before
  adding a band, [docs/workbench.md](../../docs/workbench.md)); the `/verify` review
  page; `entries/embed.ts` registers it. Studio consumes it unchanged.
- **No backend; no persistence** beyond localStorage UI preferences (volume, rate).

## Host lifecycle

Document replacement or editing invalidates ordinals and positional keys. The host stops
playback, clears the live context and pending reveal requests, compiles the new document,
and installs the new performance before allowing play. It does not reinterpret an old
ordinal against a changed score. Disconnect disposes scheduled callbacks and active
voices. Embed checks cover sibling player/viewer context delivery, inspection during
playback, document replacement and disposal as well as first play.

## Done bar

A reviewer opens any performance-opt-in scenario, presses play, watches the cursor
walk the bars in performed order in all three views with the table alongside, and
hears the D.S. return. The embed mock host does the same on the IIFE and the ESM build.

## Implementation

[Player element/API documentation](../../docs/player-element.md) records the host lifecycle,
static Listen, ordinal routing, reveal and paint overlays. Both embed formats have
permanent playback/lifecycle smokes; the workbench smoke covers edits and D.S. return.
No goldens or verification records changed; the standing performance review debt remains.
