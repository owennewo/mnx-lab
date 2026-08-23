# Resolved tab digit entry — keystrokes stop at the mount

> **Status: COMPLETE 2026-08-23.** Graduated from the selection ladder as
> `core-entry-mode` on 2026-08-16, then deliberately narrowed before work
> began. The proposed persistent `advance: on | off` state does **not** land:
> this workbench has a minimal input surface, explicit `→` already advances,
> and a sticky mode would need a control and permanent indication while making
> chord entry pay for melody-entry convenience. The provisional Space review
> and A–G accelerators leave with it. What remained when work began was one
> concrete defect: raw tab digits crossed the deterministic session boundary.

Serves the **implementation loop**. This item owns how physical tab digit
keystrokes become one resolved fret. [core-entry-surface.md](../proposed/core-entry-surface.md)
separately owns which part, staff and voice receive that fret.

## The gap

Before this item, the tab keymap emitted `fretDigit {digit}` directly into
`EditorSession`. The session remembered the previous digit at the cursor, applied the first edit,
then undoes and replaces it when another digit follows. With no time boundary,
typing `1`, then `2` at an unmoved cursor always means fret 12; correcting fret
1 to fret 2 requires an unrelated intervening intent.

Timing is an environment fact, not document state. A trace should contain
`enterFret {fret: 12}`, never two keypresses plus elapsed time, and one resolved
fret should create at most one history entry.

## Contract

### 1. A 500 ms two-digit composition window

The workbench mount owns a small resolver that buffers at most one digit.
`ENTRY_DIGIT_WINDOW_MS` is **500 ms**.

- The first digit becomes a pending candidate and does not mutate the document.
- A second digit inside 500 ms combines immediately when the result is a valid
  two-digit fret, 10–24, and emits one `enterFret`.
- Expiry emits the pending one-digit fret.
- When the second digit cannot extend the first (`3,4` or `2,5`), the resolver
  commits the first, then starts the second against the resulting cursor. With
  no auto-advance this is also the natural correction path.
- A recognized non-digit editor action flushes the pending fret first, then
  continues. Navigation never waits or disappears.
- Losing editor ownership, changing view/document/session, or disconnecting
  flushes synchronously to the still-current session and cancels the timer. A
  later callback may never mutate a replacement session.

This is composition, not debounce: `enterFret` itself has no timer and applies
immediately.

### 2. The session receives only resolved frets

Replace the session intent `fretDigit {digit}` with `enterFret {fret}`. The
keymap may still declare physical digit actions, but those actions end at the
mount. `EditorSession.lastDigit` and its undo/reapply path retire together.

`enterFret` preserves the existing semantics: on an occupied tab cell it
re-frets that note; on an empty string × beat cell it inserts a note using the
pending duration. It does not move the cursor.

### 3. Pending input is visible at the cursor

During the 500 ms window, draw the candidate fret directly in the existing
cursor-ghost overlay on the current string and rhythmic column. It is transient
paper feedback, not a HUD row, popover, history entry or document mutation.
The final fret replaces it as soon as the resolver commits.

## Implementation sequence

1. Introduce a pure, clock-injected tab digit resolver and pin the 500 ms
   composition, split, flush and cancellation rules.
2. Separate raw keymap digit actions from `EditorIntent`; add resolved
   `enterFret` and remove digit state from `EditorSession`.
3. Wire the resolver into the workbench mount, including focus, route/view and
   disconnect lifecycle flushes.
4. Extend the cursor presentation context with the pending candidate and draw
   it in the existing SVG overlay.
5. Migrate traces from raw digits to resolved frets and review tab entry in the
   navigation playground and twelve-bar blues.

## Evidence

- Resolver tests: one digit, `12`, `24`, expiry at 500 ms, invalid extension,
  non-digit flush order, explicit flush and stale-timer cancellation.
- Session tests: insert, re-fret, refusal outside a fingerboard, one history
  entry, undo and trace replay containing only `enterFret`.
- Keymap joins continue to prove that 0–9 belong only to a visible tab pane.
- Browser review: pending candidate is legible on empty and occupied cells;
  `1`, `12`, `24`, `2` then `5`, arrow-during-pending, focus loss and view
  switching produce no console errors or abandoned-session writes.
- No primitive/SVG golden movement: the candidate is editor overlay chrome.

## Completion note — 2026-08-23

Landed as `enterFret {fret}` plus a clock-injected `TabDigitResolver` in
`edit/`. The physical `tabDigit` action is visible to the workbench mount but
filtered out of the replayable intent API. The mount flushes a candidate before
recognized editor and shell actions, projection changes, focus loss and session
lifecycle edges; the score overlay paints the candidate without touching the
layout primitives.

The browser pass pinned the interaction rather than reopening the removed mode:
single digits resolve at 500 ms, 12 and 24 resolve immediately, `2,5` commits 2
before displaying 5, and arrows/focus/view changes preserve ordering. The full
landing gates passed with 946 tests, 108 scenario checks and a clean production
build. No scenario or renderer golden changed.

## Not this

- No automatic advancement, entry-mode state, toggle, default or indicator.
- No notation-entry change and no decision about Space versus playback.
- No A–G accelerator layer.
- No part/staff/voice entry policy; `core-entry-surface` owns it.
- No editor-element promotion; stage-1 timing remains in the workbench until a
  real second editing consumer triggers that separate move.
