# The pass-aware cursor — a position that knows its repeat index

> **Status: proposed 2026-09-08.** Campaign:
> [core-campaign-player.md](core-campaign-player.md), item 2. Independent of item 3
> and of the sound source; needs item 1.

## Agreement block (campaign contract)

- **Pure before audible (§1).** The pass lives in `edit/session.ts` as session state
  beside the cursor, resolved through `model/traversal.ts`. No DOM decides anything.
- **Identity (§3) — the clause this item exists to honour.** The editor cursor stays a
  rhythmic position in the written score (`edit/cursor.ts`). The pass is a **view
  position** layered over it: `{ pass, cursor }`. Editing never consults the pass;
  selection identity never changes with it. The display-settings contract already
  requires exactly this ("do not equate repeat count with verse ID or persist
  transient playback state").
- **Proof (§4).** Session conformance tests; the cursor overlay is DOM, not a golden,
  so nothing under `scenarios/` moves.
- **Dependencies (§5).** None.
- **Reviewer gain (§7).** On a volta scenario, set the pass to 2 and the cursor on the
  first ending reads *not performed on pass 2*. The traversal becomes something a
  reviewer can interrogate bar by bar, before any sound exists.

## Design

- **State.** The session gains `pass` (default 1) and a derived `passContext()`:
  `{ pass, passes: passesOf(cursor.measure), performed: boolean }`. Moving the cursor
  to a bar performed fewer times than the current pass **clamps** the pass down, and
  the chip says so; it never silently keeps a pass the bar does not have.
- **Navigation stays written-order.** Right from the last bar of a repeat goes to the
  next *written* bar, not back to the repeat start. Following the performed order is
  the player's job (item 7 seeks by ordinal); making the arrow keys do it would give
  two navigation semantics for one key. Recorded so it is not re-argued.
- **Surface.** One chip in the selection chip ladder
  ([workbench-selection-chip-ladder.md](../complete/workbench-selection-chip-ladder.md)):
  hidden when the bar is performed once, `pass 2 of 3` otherwise, greyed with *not
  performed* when the ending is skipped on this pass. Click cycles; the inspector
  accepts a typed `pass 2`. A keystroke is **not** allocated in this item — the keymap
  is dense and `keymap-docs.test.ts` pins it; if one is wanted it comes with its own
  census row.
- **The verse hook.** `core-display-settings.md`'s *current verse* takes its verse id
  from the pass when the document's verse ordering has one at that index, else falls
  back as that doc already specifies. This item provides the input; that item consumes
  it.
- **Player seam.** `session.seek(ordinal)` sets both halves from a `PerformedMeasure`;
  item 7 calls it and nothing else does yet.

## Done bar

- Tests: pass clamps on move; `performed` false on a skipped ending; `seek` round-trips
  through the traversal; a document with no repeats never shows the chip.
- `git diff -- scenarios/` clean after `update:primitives`.
