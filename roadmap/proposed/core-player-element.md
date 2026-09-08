# The player element — a transport bar that knows where it is

> **Status: proposed 2026-09-08.** Campaign:
> [core-campaign-player.md](core-campaign-player.md), item 7. Needs items 2, 3, 4 and
> 6. The last reviewer item: after it, a reviewer can listen.

## Agreement block (campaign contract)

- **Pure before audible (§1).** The element holds no musical logic: it renders the
  transport's state and forwards gestures. Position formatting (`m5 · pass 2 · beat 3`)
  is a pure helper in `audio/` with its own test.
- **Identity (§3).** Highlight is driven by the transport's `{ noteKey, pass }` through
  item 3's pass-qualified keys, so in the unrolled view exactly one occurrence lights
  and in the written view the written note lights with its pass shown on the cursor
  chip (item 2). Click a note → `seek` to that note's first occurrence on the current
  pass; click it again → next pass.
- **Proof (§4).** `element-census.test.ts` registers it; the deep link
  `#/scenario/<id>?view=…&t=<ordinal>` is pinned by the routing test. No golden.
- **Dependencies (§5).** None beyond item 6's.
- **Reviewer gain (§7).** The `/verify` review page grows a **Listen** control beside
  the engraving, so the performance golden (item 4) and the unrolled goldens (item 3)
  are approved with the sound they describe.

## Design

- **`<mnx-player>`** in `src/elements/`, plain Lit, shadow DOM, `light-dark()` theming
  via the existing tokens. Props: a `Performance`; events: `seek`, `onset`, `bar`.
  Controls: play/pause, stop, position readout, tempo scalar (0.5–1.5), volume, loop
  toggle for the current selection when the host supplies one (item 12 makes this a
  feature; here it is a seam). Mute/solo are **not** in this item.
- **Cursor sync** goes through `<mnx-document-viewer>`'s existing highlight input and
  the reveal-scroll helper that selection already uses, so auto-scroll is the same code
  path as "reveal the cursor". The pass cursor (item 2) is set on every bar boundary,
  which is what makes the *current verse* follow the music when display settings land.
- **Where it mounts.** The scenario page's frame gains a band (the five-band frame in
  [docs/workbench.md](../../docs/workbench.md) — this is a sixth only if none of the
  existing ones fits; check the tray first); the `/verify` review page; the embed face
  registers the element in `entries/embed.ts`. Studio consumes it unchanged.
- **No backend, no persistence** beyond the existing localStorage UI preferences
  (volume, tempo scalar).

## Done bar

- A reviewer opens any performance-opt-in scenario, presses play, sees the cursor walk
  the bars in performed order in all three views with the unrolled toggle on or off,
  and hears the D.S. return.
- The embed mock host (`apps/viewer-embedded/`) plays the same document with no
  workbench code present — the embeddability guarantee, exercised.
