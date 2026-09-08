# Playback context and the iteration cursor — a position that knows its repeat index

> **Status: proposed 2026-09-08, revised the same day.** Campaign:
> [core-campaign-player.md](../inprogress/core-campaign-player.md), item 2. Needs item 1;
> independent of everything else. **The edit session and the selection are not
> touched**; this is a separate, host-coordinated playback context.

## Agreement block (campaign contract)

- **Pure before audible (§1).** A resolver in `model/`: given a pass model, a written
  measure and a chosen iteration, answer `{ performed: boolean, ordinals: number[] }`
  in performance order, and the reverse (`ordinal → { measureIndex, occurrence,
  iteration }`). A separate pure chooser prefers the current ordinal if it is a
  candidate, otherwise the next candidate, wrapping to the first only for an explicit
  click-to-seek. Repeated clicks cycle candidates. D.S. can revisit the same measure
  on the same iteration; no resolver silently treats that pair as unique.
- **Identities (§3) — the clause this item exists to honour.** The context carries a live
  **ordinal** and derived **playbackIteration**, separately from the chosen
  **inspectionIteration**. Playback never overwrites inspection state. Choosing
  iteration 2 and standing on the first ending yields
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
  `{ ordinal: number | null; playbackIteration: number | null;
  inspectionIteration: number; followPlayback: boolean; highlight: WrittenOccurrence[] }`.
  The host is the **sole provider**, on a common ancestor of player and viewer;
  item 7 emits state changes which the host forwards into that provider. A provider
  on a sibling player cannot serve the viewer ([Lit context protocol](https://lit.dev/docs/data/context/#context-protocol)). The embed example installs the same
  provider on its plain host DOM element using `ContextProvider`, without workbench
  or edit imports. Define the small presentation occurrence type here so this item
  does not depend on item 5's compiler.
  `followPlayback` defaults true: verse/reveal follows live playback when active;
  explicit inspection switches it off without seeking or changing the edit selection.
  A Follow control restores it. Stopped playback falls back to inspection state;
  inspection and playback labels remain distinct.
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
  sets it from the active playback iteration when following, otherwise from the
  inspection iteration. If the document's verse ordering has no entry at that index,
  clear the previous selected verse explicitly so the viewer's fallback takes effect.
  The context is the "transient current-verse context" that doc anticipated; it is still never persisted.

## Done bar

- Resolver tests: iteration kept across a skipped ending; `performed` false there;
  every ordinal round-trips through `(measureIndex, occurrence)`; iteration queries
  retain all D.S. candidates; inspection during playback never changes the live ordinal;
  no chip without repeat structure.
- `git diff -- scenarios/` clean.
