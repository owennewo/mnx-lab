# Playback context and the iteration cursor — a position that knows its repeat index

> **Status: proposed 2026-09-08, revised the same day.** Campaign:
> [core-campaign-player.md](core-campaign-player.md), item 2. Needs item 1;
> independent of everything else. **The edit session and the selection are not
> touched**; this is a separate, host-coordinated playback context.

## Agreement block (campaign contract)

- **Pure before audible (§1).** A resolver in `model/`: given a pass model, a written
  measure and a chosen iteration, answer `{ performed: boolean, occurrence?, ordinal? }`
  and the reverse (`ordinal → { measureIndex, occurrence, iteration }`). No DOM decides
  anything.
- **Identities (§3) — the clause this item exists to honour.** The context carries an
  **ordinal** (where playback is) and an **iteration** (which time through, for
  inspection). Choosing iteration 2 and standing on the first ending yields
  `performed: false`, and the chip says *not performed on iteration 2*. **Nothing
  clamps**: the chosen iteration is kept while the cursor moves through bars that skip
  it, because the skip is the fact the reviewer wants to see. The editor cursor stays a
  written position; `elements/` never imports `edit/`; the workbench maps the edit
  cursor's measure into the context and the context's chip into the ladder.
- **Proof (§4).** Conformance tests on the resolver over the 14 navigation scenarios;
  the chip is DOM. No golden moves.
- **Dependencies (§5).** None.
- **Reviewer gain (§7).** The traversal becomes something a reviewer interrogates bar by
  bar — pick iteration 2, walk the score, watch which bars go grey — before any sound.

## Design

- **The context replaces the dormant shape.** `elements/mnxContext.ts` already declares
  `PlaybackState` (`playheadTime`, `activeNoteIds`, …) and the viewer already consumes
  it for highlight. This item replaces that shape with
  `{ ordinal: number | null; iteration: number; highlight: WrittenOccurrence[] }` and
  keeps the viewer's consumption; item 7 provides `ordinal`/`highlight` live, this item
  provides `iteration` from the host. Being a Lit context, it is provided by the host
  (workbench, studio, the embed host) and read by any element — the host coordination
  the contract asks for, with the machinery already in place.
- **Navigation stays written-order.** Arrow keys move the written cursor; the context
  follows its measure. Following the *performed* order is `seek(ordinal)` (item 7).
  Recorded so it is not re-argued.
- **Surface.** One chip in the selection chip ladder
  ([workbench-selection-chip-ladder.md](../complete/workbench-selection-chip-ladder.md)):
  hidden when the document has no repeat structure (`hasRepeatStructure`), else
  `iteration 2 of 3`, greyed with *not performed* when the bar skips it. Click cycles;
  the inspector accepts a typed `iteration 2`. No keystroke is allocated here.
- **The verse hook.** [core-display-settings.md](../complete/core-display-settings.md)
  shipped `selected-verse` on the viewer and deliberately never stored it. The host
  sets it from the iteration when the document's verse ordering has an entry at that
  index, else leaves the viewer's documented fallback in force. The context is the
  "transient current-verse context" that doc anticipated; it is still never persisted.

## Done bar

- Resolver tests: iteration kept across a skipped ending; `performed` false there;
  ordinal ↔ triple round-trips over the whole corpus; no chip without repeat structure.
- `git diff -- scenarios/` clean.
