# Entry mode — advancement and resolved entry keystrokes

Serves the **implementation loop**. Proposed 2026-08-16, graduated from the
orthogonal entry axis parked by
[core-selection-ladder.md](../complete/core-selection-ladder.md) when the ladder
itself completed.

## The boundary

Three adjacent items now own three different questions:

| Item | Owns |
|---|---|
| selection ladder | **where the cursor/selection is** and what its gestures mean |
| [entry surface](core-entry-surface.md) | **where a write lands** — part, staff, voice and sequence-creation policy |
| this item | **when entry advances** and how raw entry keystrokes resolve into deterministic intents |

Advance is not a selection rung and not a projection. It is session state that
changes what happens *after* an entry addition. The same mode applies in
notation, tab and the combined view; changing the active projection must never
silently change it.

This split matters because the two proposed items are independent. Advance mode
can operate against today's voice-0 entry surface, and part/staff/voice-aware
writing can land without auto-advance. Neither should wait for the other or
smuggle the other's policy into its implementation.

## The current gap, in code

`EditorSession` has a pending entry duration and dots, but no advancement mode.
`toggleNote` and `fretDigit` mutate in place; the user must press an arrow after
every addition.

Tab's two-digit entry also crosses the wrong boundary today:

- the keymap emits the raw `fretDigit {digit}` intent;
- `EditorSession.lastDigit` treats every consecutive digit on an unmoved cursor
  as one number;
- the second digit undoes the first document edit and applies the combined fret.

That is timer-free and traceable, but ambiguous: after entering fret 1, typing 2
at the same cell always means 12, so fret 1 cannot be corrected to fret 2 without
an unrelated intervening intent. It also makes raw keyboard timing a concern of
the deterministic edit session.

The mount already owns environment-dependent stage-1 interpretation: it chooses
the active pane layers and resolves wrapped-system arrows into concrete
`goToMeasure` intents. Digit grouping belongs beside that work. The session must
receive a resolved fret, never a clock reading or timeout.

## Contract

### 1. Advance mode is recorded session state

The state is `advance: on | off`, changed by a recorded intent and exposed by a
read-only session getter. Traces record the resolved mode change and assert the
final mode beside cursor and selection, so replay never depends on a shell
preference.

- **On** — after an entry action *adds* ink, move to the next rhythmic position.
  Reindex first, then use the cursor grid created by the addition; the landing is
  the inserted event's release, so pending duration remains the one source of
  rhythmic step size. At the end of the document it stops; advance mode never
  synthesizes a measure.
- **Off** — leave the cursor at the entered cell, making chord/stack entry a
  plain sequence of spatial moves and additions.
- **Removal never advances.** `toggleNote` on occupied notation deletes and
  stays put.
- **Editing existing ink never advances.** Re-fretting an existing note,
  respelling, transposing and every non-entry mutation stay put. The mode is
  about materializing a new thing, not about every key that can alter a note.
- A failed/refused addition does not move.

The cursor move is part of handling the resolved entry intent, not a synthetic
`nextPosition` intent. One user action remains one intent in the trace and one
document-history entry. Undo reverses the document edit; it does not masquerade
as cursor history.

### 2. Raw digits resolve in stage 1

Replace `fretDigit {digit}` at the session boundary with a resolved intent such
as `enterFret {fret}`. A small mount-owned resolver buffers at most one pending
digit and emits the complete fret:

- a second digit inside `ENTRY_DIGIT_WINDOW_MS` combines when the result is at
  or below the shared maximum fret;
- expiry commits the pending digit;
- any non-digit editor action flushes the pending digit first, then continues —
  navigation never waits or disappears;
- changing document/session, losing editor ownership or disconnecting the mount
  synchronously flushes to the still-current session before detaching, then
  cancels the timer; a later callback may never mutate an abandoned session;
- a digit that cannot extend the pending value commits that value, then begins
  a new candidate against the cursor resulting from that commit. This makes the
  maximum-fret boundary agree with advance mode instead of silently replacing a
  valid first digit.

The resolver owns transient timing only. The session remains timer-free and the
trace contains only `enterFret {fret: 12}`, never `1`, `2` plus elapsed time.
The current `lastDigit` field and history-undo combination retire together.
When an arrow flushes a digit in advance-on mode, the automatic step happens
first and the explicit arrow happens second: two requested actions remain two
visible moves rather than one silently suppressing the other.

Commit on expiry means the first digit is transient for one short window. The
review should show that pending digit at the cursor/HUD rather than mutate the
document early; preview state is presentation, not a provisional edit or an
undo entry.

### 3. The entry action and mode control need visible bindings

Space is the provisional notation action key, but it conflicts with the common
play/pause convention. The mode itself also needs a binding or command surface
and a visible `advance on|off` indication. These are one review because a mode
that changes post-entry movement must be discoverable beside the action it
modifies.

Bindings stay declarative in `src/edit/keymap.ts`; the HUD/cheatsheet consumes
the same data. Nothing grows a second `keydown` switch. Shell preferences may
choose the *initial* mode, but the session owns the live value after creation.
The combined view has one initial value, not competing notation/tab defaults.

Parked for hands-on review:

- whether Space remains the notation action;
- the mode-toggle binding/surface;
- the initial mode (one default for a session; projection changes do not reset
  it);
- `ENTRY_DIGIT_WINDOW_MS`.

### 4. Letter accelerators are a later layer, not seven casual bindings

The notation cursor already separates pitch-space navigation from mutation, so
the leading design remains **letters as navigation**: A–G moves the cursor to
the nearest matching diatonic staff position and the action key remains the
only mutator. If hands-on review instead chooses letters as entry, successful
materialization follows advance mode and inherits its chord behavior.

Either choice must first settle key ownership. Bare `B` already means beam in
notation and bend in tab, while other bare letters own tie, respelling, slur and
technique. Therefore an A–G accelerator cannot simply precede `EDIT_LAYER` or
silently steal the established dialect. Its activation/layer and the displaced
mnemonics are an explicit design verdict, mirrored in `keymapDocs.ts` and its
join tests.

Letter review follows advance + digit entry. It is not allowed to block those
two coherent stages.

## Implementation sequence

1. **Resolved intent vocabulary.** Add `setAdvanceMode` and resolved fret entry;
   extend trace expectations with final advance state. Remove raw digit
   combination from `EditorSession` only when the stage-1 resolver is ready.
2. **Pure digit resolver + mount lifecycle.** Implement the buffer as a small
   testable state machine with an injected/manual clock seam, then wire timer,
   flush ordering and teardown in the workbench mount.
3. **Session advancement.** Classify entry outcomes as added/edited/removed,
   advance only the added case after reindex, and pin on/off behavior in both
   projections. Keep one resolved intent and one history entry per addition.
4. **Presentation and bindings.** Show the mode and pending digit, wire the mode
   control through declarative key data, update the HUD/cheatsheet and perform
   the Space/default/window hands-on review.
5. **Letter accelerator review.** Decide navigation vs entry and the layer/key
   conflicts, then implement only the chosen dialect with keymap join tests.
6. **Browser review.** Exercise repeated notation entry, tab frets 1/12/24,
   correction after the window, explicit navigation during a pending digit,
   advance toggling, projection switching and chord entry in the navigation
   playground and twelve-bar blues.

## Evidence when it lands

- Pure resolver tests: one digit, in-window combination, expiry, maximum-fret
  split, non-digit flush order and teardown.
- Session tests: both modes, notation and tab additions, deletion/edit no-move,
  failed addition, bar boundary, undo and trace replay including final mode.
- Keymap documentation joins for every new binding/layer.
- Hands-on browser review with no console errors and the chosen timings/defaults
  recorded back into this document.
- No primitive/SVG golden movement: this is editor state and overlay chrome,
  not notation layout.

## Relationship to the entry surface

[core-entry-surface.md](core-entry-surface.md) remains the authority for part,
staff and voice targeting, new-sequence padding and which part structural ops
extend. When it lands, the resolved entry intents here acquire those cursor
addresses through that one policy. This item must not introduce an interim
voice-creation rule.

## Not this

- Not Dorico-style **Insert mode**, which shifts later music; advance changes
  the cursor after an addition and never retimes the document.
- Not notation-pane digit durations; this resolver groups tab fret digits only.
- Not a new selection rung, closure or ghost-member rule.
- Not part/staff/voice entry targeting — the sibling entry-surface item owns it.
- Not arbitrary text, lyrics or popover input.
- Not editor-element promotion; the mount owns stage 1 until a second consumer
  triggers that separate move.
