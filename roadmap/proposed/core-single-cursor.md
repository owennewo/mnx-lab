# One cursor — the edit cursor walks the performance, and the playhead is where it stands

> **Status: proposed 2026-09-22.** Serves the **implementation loop**.
> [Studio authoring campaign](../inprogress/studio-campaign-authoring.md) item 10; inherits
> the campaign contract (clauses 12–14 bite). **Reverses two recorded decisions** — the
> player campaign's contract clause 3 and pointer placement's decision 1 — deliberately,
> and says so below so neither is re-argued from the old side.

## The gap, exactly

The owner met it on 2026-09-22, editing against a YouTube recording with the video pane at
75%: **a click on a note moves the video; moving the edit cursor with the keys does not.**

That is the design as built, not a bug in it. Pointer placement
([core-editor-pointer-placement](../complete/core-editor-pointer-placement.md)) kept the
edit cursor and the playback position as two states and joined them with *seeding rules*;
only the click rules were built. Keyboard movement has no rule, so after arrowing the edit
cursor and the playhead disagree, and Play starts from wherever the last click left the
playhead. The two remaining rules — *play starts from the edit cursor*, *stop parks the
cursor at the playhead* — were deferred until the owner had lived with two cursors. Having
lived with them, the owner asked for one.

Today there are three positions:

| Position | What it is | Where it lives |
| --- | --- | --- |
| Edit cursor | A written address: measure, onset, line, voice, part, staff | `src/edit/cursor.ts`, the session |
| Playhead | A performed ordinal plus a metric offset; the recording's clock when one plays | the player, `PlaybackState` |
| Inspection iteration | Which pass a reviewer is looking at, deliberately unclamped | `PlaybackPositionState`, the workbench's chip |

The playhead and the recording time are already one: with a recording selected its clock
drives the score through the sync. Studio never shows the inspection iteration. So the
question is the first two, and this item makes them one.

## The decisions, taken 2026-09-22

Recorded from the conversation that opened this, so the design is not re-argued:

1. **One cursor, strongly tied.** The cursor is a *performed* position: a pass-model entry
   plus the written address inside it. There is no separate "which pass" state — the pass
   is a property of the cursor. The inspection iteration folds into it.
2. **Paused, the arrows walk the performance.** → at a repeat end that is not on its last
   pass goes to the repeat start; on the last pass it continues. Endings, D.S., D.C. and
   *To Coda* follow from the same walk.
3. **Jumping out of a repeat resets the pass.** A move that is not a step lands on the
   target bar's first performance unless the current pass also performs it.
4. **Play with a bar (or wider) selection collapses to its first event** on the selection's
   own pass, then plays.
5. **Editing is disabled while playing.** Nothing mutates during playback: the edit keys,
   undo/redo, paste and the inspector are refused until the player pauses, and a refused
   key says *Pause to edit* near the cursor.
6. **A pass change is announced.** Whenever a move changes the pass or arrives by a loop or
   a jump, a brief *Pass 2* shows near the cursor.
7. **While playing, the arrows seek a bar at a time, always to a bar's start.** ← goes to the
   start of the bar playing, and each further ← one bar back; → to the start of the next
   bar. Presses in quick succession add up before the seek fires, so ← four times goes
   back three bars in one seek. Anything finer is done paused.

What this reverses:

- **Player campaign contract clause 3** ([core-campaign-player](../inprogress/core-campaign-player.md)):
  *"The editor cursor stays a written rhythmic position … Live playback and inspection
  iteration never overwrite each other; neither writes the edit session."* After this item
  the cursor is performed, pausing writes the session, and inspection is the cursor's pass.
  The clause's other halves stand: ordinal, occurrence and iteration stay distinct and
  named, and `elements/` below the editor's host binding still does not import `edit/`.
- **Pointer placement decision 1**, *"the two cursors stay two"*. The reasons it gave are
  answered below, one by one (written vs performed time → the cursor *is* performed and
  still carries a written address; the cursor's vertical and voice → kept; the settle
  path's cost per move → the playing cursor is drawn, not settled; live edit → remap;
  undo → remap; the `elements → edit` boundary → unchanged).
- **The workbench's reviewer mode** from
  [core-player-pass-cursor](../complete/core-player-pass-cursor.md) — pick iteration 2 and
  walk the score watching which bars go grey. The cursor can no longer stand on a pass that
  does not perform its bar, so that walk is gone. Kept on purpose; see *Not in scope*.

## The model

**State.** `EditorCursor` gains `ordinal?: number`: the pass-model entry
(`src/model/passes.ts`, `PerformedEntry`) the cursor stands in. `measureIndex` becomes
derived from it wherever it is present. Everything else on the cursor — onset, line, voice,
part, staff, slot — is unchanged, so the vertical axis, the ladder and entry are untouched.
`edit → model` is an allowed import, so the session computes the pass model itself.

**Who is the truth.**

- **Paused:** the session's cursor. The player follows it: every settled cursor move is a
  seek to `{ ordinal, onset }`, and Play starts there.
- **Playing:** the player's clock. The cursor is *drawn* at the playhead and is not written
  into the session per event: settling the editor's cursor on every onset (grid, slots,
  selection, inspector) is the cost pointer placement named, and it is avoided by not
  paying it. The session is written once, on pause.

To a person that is one cursor: it moves with the music while playing and stays where the
music stopped.

### The rules

1. **Steps walk the performance.** ←/→, next/previous bar and the event skips move through
   positions in `PassModel.entries` order. The last position of entry *k* steps to the first
   position of entry *k+1*; the first steps back to the last of *k−1*. An entry with
   `from`/`until` (a jump that fires mid-bar) offers only the positions inside its slice, so
   a mid-bar *To Coda* is a step like any other. ↑/↓ on lines and voices are unchanged.
2. **Jumps choose a pass.** A click, *go to bar*, system up/down, Home/End: of the target
   bar's performances, take the one **with the current entry's iteration, nearest the
   current ordinal**; if none has it, take the bar's **first** performance. That is the
   reset: from bar 3 on pass 2, a click on bar 5 of the same repeat stays on pass 2, and a
   click on bar 9 after the repeat lands after the repeat. It replaces `chooseOrdinal`'s
   *next candidate, else wrap* for the editor, which walks the wrong way when going back.
3. **Selections stay written.** A range is a written block (copy, cut, delete and the ladder
   operate on it), so Shift+→ extends in written order and never crosses a loop-back. The
   anchor keeps its pass. This is the one place a person will feel the two orders differ:
   → at bar 8's `:|` goes to bar 1, Shift+→ goes to bar 9. It is inherent, not a choice.
4. **Play collapses a selection.** With any rung above the event selected, Play moves the
   cursor to the selection's first event on the anchor's pass, closes the selection, then
   plays. (A loop over a selection is [studio-player-practice](studio-player-practice.md)'s
   job and gets its own control.)
5. **Pause parks the cursor.** On pause or stop, the cursor moves to the event sounding at
   the playhead (the last onset at or before it) on the cursor's own part, staff and voice,
   and keeps its line. **It also keeps the exact media time until the cursor next moves**,
   so pause → play resumes where it paused rather than snapping back to the note's onset
   and replaying a fragment.
6. **Editing waits for pause.** While playing, `readOnly()` answers true. That seam already
   exists on `bindEditor` and is asked per key: navigation still works and nothing
   mutates. A refused edit key shows *Pause to edit* in the cursor label (rule 8), through
   the binding's existing `onRefused` seam.
7. **Arrows while playing seek by bar.** ←/→ step whole performance entries — the same
   order as rule 1, so a ← at a repeat start on pass 2 goes back to the repeat end on
   pass 1 — and always land on an entry's start (`from` when the entry is a mid-bar
   slice). The first ← goes to the start of the bar playing, not the one before it, so
   "back to the top of this bar" is one press.
   - **Presses accumulate.** Each press moves a *pending target* one entry from the last
     pending target, not from the playhead; the seek fires once, about 300 ms after the
     last press. So ← ×4 is one seek, three bars back, and a playhead crossing a barline
     mid-sequence cannot shift the count. The drawn cursor jumps to the pending target at
     once, so the count is visible while it is being made; the music keeps playing until
     the seek fires.
   - ↑/↓, Home/End and clicks while playing keep their paused meaning as seeks (a click
     already seeks today). Only the event-level walk is paused-only.
8. **One label near the cursor.** A single short-lived label beside the cursor carries every
   message of this item, for about a second, in the editor's overlay:
   - ***Pass 2*** when a move the person made changes the cursor's iteration or arrives by a
     loop, an ending or a jump (`PerformedEntry.via`), paused or playing. Playback crossing
     a repeat on its own does not flash; the tray's pass lanes already show that. Never on
     a document without repeat structure (`hasRepeatStructure`).
   - ***Not played*** when the cursor lands written-only (below).
   - ***Pause to edit*** when an edit key is refused during playback.

### The fallbacks the rules need

- **Bars that are never played.** A half-built repeat structure (a first ending with no
  second, `unmatched-ending`), a walk that hit its safety cap (`truncated`), or bars a
  performance never reaches have no entry. The cursor may stand there **written-only**
  (`ordinal` absent): steps walk written order until they reach a performed bar and then
  take its first performance, and Play starts at the first performance of the next
  performed bar. The flash names it: *Not played*.
- **The ghost bar past the end.** It is written-only by definition. It is reached by End,
  by a click, and by → from the final position of the *performance*. That matters when a
  D.C. al Fine ends the performance before the last written bar: → from bar 16 on its only
  pass goes to bar 1, because that is the D.C.
- **An edit that renumbers the performance.** Adding or removing a `:|`, an ending or a jump
  rebuilds the pass model. The cursor is re-found by `(measureIndex, iteration,
  occurrence)`, falling back to the bar's first performance, then to written-only. Undo and
  redo do the same with the cursor their snapshot restores. `setDocument`'s existing
  `withPlaybackOrdinal` becomes this one remap rather than a second copy.
- **A recording that does not cover the bar.** A seek into a bar the source's sync does not
  map (before the first cut, after the last) cannot move the video. The video holds, the
  tray says *not synced here*, and the synth, which covers everything, is unaffected.
- **Held keys.** The seek follows the cursor on settle (a trailing ~150 ms), not per key
  repeat: the cursor redraws instantly and the video catches up once. A YouTube seek per
  auto-repeat is the other cost pointer placement named.

## Where it lives

- **`src/edit/`** owns the rules: the performed walk, the chooser, the written-only fallback,
  the remap, and `ordinal` on the cursor. Pure and tested in `harness/conformance/`.
- **`src/elements/editorHost.ts`** reports where the cursor settled, and accepts "park at
  this performed position" on pause. **`playbackHost.ts`** already has the mapping from a
  written place to a seek (`place`) and keeps it. The join is **one** piece of wiring both
  shells use, not a copy in `PiecePage` and another in `ScenarioPage`. Whether it is a
  `bindEditor` option that takes the playback binding or a small `bindCursor(editor,
  playback)` beside them is for the item to decide. `playbackHost` still imports no `edit/`.
- **The flash** is an editor surface in the overlay the binding already mounts, which is
  why both shells get it.
- **The workbench** keeps its iteration chip, which now **reads** the cursor's pass;
  cycling it moves the cursor to the same bar's next performance. The chip's greyed *not
  performed* state goes, because the cursor can no longer be on such a pass. The verse hook
  follows the cursor's pass, so Shift+L on pass 2 edits verse 2.
- **Studio touch is unchanged.** No editor is bound on a coarse pointer, so there is no
  cursor there: a tap seeks, as it does now.

## Decisions still open

None of substance. Settled by the owner on 2026-09-22, after filing: arrows seek by bar
while playing, accumulating presses (decision 7, rule 7); a refused edit says *Pause to
edit*; the pass reads *Pass 2*, and both labels sit near the cursor (rule 8). The
accumulation window (~300 ms) and the label's duration (~1 s) are starting values to tune
by hand, not decisions.

## Proof (campaign clause 13)

- **Conformance, over the navigation scenarios** (the 14 the pass cursor used): the
  accumulated bar seek is a pure function (playhead ordinal, presses → target entry) and
  is tested there; stepping →
  from the first position visits the entries in `PassModel.entries` order at bar grain;
  ← is its inverse; mid-bar slices offer only their own positions; the chooser keeps the
  pass within a repeat and resets outside it, including a D.S. bar with two candidates on
  one iteration; written-only cursors on an unmatched ending and past a truncated walk; the
  ghost bar after a D.C. al Fine; the remap after adding and removing a `:|`, and under
  undo.
- **A real-browser smoke** on studio with the YouTube stand-in
  (`harness/verify/youtube-smoke.mjs`'s): arrows move the video once they settle; → at a
  `:|` loops and shows the flash; Play from a bar selection starts at its first event;
  edit keys refuse while playing and the label says *Pause to edit*; ← ×4 while playing is
  one seek to the start of the bar three back, including across a repeat start; pause
  parks the cursor at the playhead, and play resumes at the exact time. `smoke:workbench-editor` gains the chip reading the cursor's pass.
- **No golden moves.** Nothing here reaches layout.

## Not in scope

- **Keeping the reviewer's unclamped walk.** It could return as a workbench-only mode that
  detaches inspection from the cursor. Nobody has asked for it since it shipped; build it
  when someone misses it.
- **Loop playback of a selection** — [studio-player-practice](studio-player-practice.md).
  Its selection-to-loop policy starts "on the inspection iteration"; after this item that
  reads "on the selection anchor's pass", and whoever picks it up amends it.
- **Performance-ordered selection ranges.** Rule 3 is why they do not exist.
- **The unrolled view.** It already draws one bar per performance entry, so this model fits
  it without change. Making it the default for editing is a separate question.
