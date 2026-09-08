# The player element over the written score — the first reviewer milestone

> **Status: proposed 2026-09-08, revised the same day.** Campaign:
> [core-campaign-player.md](core-campaign-player.md), item 7. Needs items 2, 5 and
> 6. Deliberately **not** waiting for the unrolled engraving (item 10): the written
> score, a performed-order table and sound prove the player with far less layout work.

## Agreement block (campaign contract)

- **Pure before audible (§1).** The element holds no musical logic; position
  formatting (`bar 5 · iteration 2 · beat 3`) is a pure helper with its own test.
- **Identities (§3).** Playback highlight is **separate from selection**: the element
  provides the playback context (item 2's shape) with `highlight` as written
  occurrences, and the viewer draws it in its own style beside — never instead of —
  the selection enclosure. `elements/` does not import `edit/`; click-to-seek is a
  `note-selected` event the host turns into `seek(ordinal)` on the element, and the
  host chooses which occurrence (first on the current iteration; click again for the
  next). Auto-scroll is a **public** reveal on the viewer taking a written occurrence;
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
  tokens. Inputs: a `Performance`; outputs: the playback context (provided, not
  dispatched — the viewer already consumes it) and `seek`/`onset`/`bar` events for
  hosts that want them. Controls: play/pause, stop, position readout, rate
  (0.5–1.5), volume, and a loop seam item 13 fills. No mute/solo here.
- **Written view only.** The cursor walks the written score in performed order; on a
  repeat it goes back, and the iteration chip (item 2) changes with it. That is enough
  for the reviewer to hear a D.S. return and see where it landed.
- **Where it mounts.** The scenario page (check the five-band frame's tray before
  adding a band, [docs/workbench.md](../../docs/workbench.md)); the `/verify` review
  page; `entries/embed.ts` registers it. Studio consumes it unchanged.
- **No backend; no persistence** beyond localStorage UI preferences (volume, rate).

## Done bar

A reviewer opens any performance-opt-in scenario, presses play, watches the cursor
walk the bars in performed order in all three views with the table alongside, and
hears the D.S. return. The embed mock host does the same on the IIFE and the ESM build.
