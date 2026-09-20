# Sync bar — authoring recording sync inside the player's tray

> **Status: built 2026-09-17; complete 2026-09-20** — closed by the owner with the two hands-on
> checks (the click against a real YouTube clock; the bar on touch) still being made on the
> live site; see [studio-sync-rederive](studio-sync-rederive.md), which carries them. Implementation loop. Reference: [docs/player-sync-bar.md](../../docs/player-sync-bar.md).
> [Player campaign](../inprogress/core-campaign-player.md) item 21; follows recording sync (15), recording
> playback (16), YouTube (17), recording attachments (18) and bookends (19). Design canvas:
> <https://claude.ai/artifact/6fvpa1Jub6nLPSiVymFBvR> (page "Sync bar"; the full-screen first
> pass on its second page was rejected as far too large).

Studio plays Soundslice sync timings but cannot make them. Soundslice's own authoring flow
is "tap a key on every bar, then a second pass to nudge every tap". This item adds a way to
author a sync from scratch that needs far fewer decisions, and it does it **inside the
player's tray**, at the size of the rail it toggles with.

The idea that carries it: a recording made to a steady pulse is fully described by **where
the beats start, where they stop, and how many there are**. Tempo is not tuned by decimals;
it follows from a whole number of beats between two fixed times, and one beat too many or too
few is half a beat out at the midpoint, where a click over the recording makes it obvious.

## Agreement

- **One slot, two axes.** The tray's bar is the **rail** (`.rail` in
  `src/elements/Player.ts`): one column per written bar, score-shaped. A two-state toggle
  beside the readout swaps it for the **sync bar**, which is time-shaped: the whole recording
  left to right, the same label row and bar height as the rail. The toggle appears only when
  the host opts in (`syncEditable`) and the active source is a recording. In sync mode the
  readout prints recording time. Nothing else in the tray moves; the only added button is
  the click.
- **Cut lines and segments.** The sync bar is divided by **cut lines**. Two of them are
  **trim handles**, parked at the two ends of the bar from the start:
  - placing the **start handle** makes everything to its left unsynced (pre-roll) and opens
    one segment that runs to the end of the recording, with a free tempo;
  - placing the **end handle** makes everything to its right unsynced (post-roll) and closes
    the segment, whose tempo then follows from a **whole beat count**;
  - further cuts **split** a segment at the playhead or at a double-click. A split lands on
    the nearest beat and both halves keep the tempo, so naming sections costs no timing.
- **No cut button, no zoom button.** Handles are dragged, or selected and sent to the
  playhead (Enter) while the recording plays. Split lives in the selected segment's row.
  Selecting a cut zooms the bar around it and beat ticks appear; deselecting returns to the
  whole recording. A hairline under the bar shows where the zoomed window sits.
  **Revised 2026-09-18, from the owner's first hands-on use:** the hairline read as a
  scrollbar and could not be caught, because it was never one. It is now — a 12 px grab
  area round the 2 px line, dragged to move the window — and two fingers over the bar (a
  trackpad's horizontal wheel, or two touches) drag the window too; a vertical wheel still
  scrolls the page. **The window follows the playhead**: a seek made anywhere (the video's
  own scrubber, the score, the rail) brings the bar to the sound, and playback that runs
  off the right edge turns the page. A window placed on purpose — round a selected cut, or
  moved by hand — stays put until the playhead is back inside it or jumps. Still no zoom
  button and no new chrome.
  **And the scale is a pinch** (the owner's suggestion, same day): the zoomed window was a
  fixed 16 s, so moving a cut a minute meant a dozen drags. Two touches, or a trackpad's
  pinch (which arrives as Ctrl+wheel), change the scale about the point under them, from 2 s
  out to the whole recording; the scale sticks across selections because it is the person's,
  not the cut's. Beat ticks drop out when there would be more than 160 of them.
  **A bug found by the same session:** a drag was captured by the handle's own button, and
  placing a parked handle replaces that button — the pointerup went with it, the drag stayed
  armed, and every later hover over the cut moved it. Drags are captured and heard by the bar
  now, and a mouse move with no button down ends one rather than following it.
- **Editing is one row above the tray**, in the rate and volume overlays' vocabulary. A
  selected segment: name, beats or tempo with minus and plus, Tap, Split at playhead. A
  selected cut: time, four nudges (±25 ms, ±100 ms — the audible floor, not the clock's), To playhead, Loop, Remove. Dragging is
  coarse, nudging is fine. Moving a cut keeps each neighbour's tempo as nearly as a whole
  beat count allows, so a nudge never changes a count and a long drag re-counts.
- **The click is the proof.** A click sounds on every beat of every segment that has a
  tempo, and on every cut line, scheduled on the Web Audio clock from a smoothed estimate of
  the media clock. A constant offset between a source's reported time and its audible time
  is harmless: score following reads the same clock. The click's schedule is a pure function
  under Node; only the oscillator is browser-side (campaign contract clause 1).
- **Steady segments only.** Tempo ramps, a tapped (rubato) segment type, an unsynced gap in
  the middle of a recording, and the beat unit's own control are deliberately out of this
  first implementation. A slow ending is handled by placing the end handle before it.
- **What is stored.** The authoring model (`SyncSegments`: cut times, per-segment name and
  beat count or open tempo, the beat unit) is score-independent and is what the editor
  reopens. It is saved through the existing recording route as `rawSync` with
  `format: 'studio-sync-segments'` and lands in the existing `provenance` column — honest
  provenance for the syncpoints beside it, and **no migration**. The derived Soundslice
  tuples go in `syncpoints` as before, so everything that reads a sync is unchanged.
- **Deriving syncpoints needs bars.** Syncpoints are `[performed bar, seconds]`, so they are
  derived by the client from the segments and the score's written bar durations: one point
  per performed bar start that the beats reach, plus an inner-bar point where the beats end.
  One point per bar, never a sparse pair: the map gives sparse bars equal time, which is
  wrong across a pickup or a meter change. A score with no bars yet keeps its segments and
  stores `syncpoints: null`; the sync appears when the bars do. The beat unit defaults from
  the first time signature (dotted quarter in compound meters, otherwise the denominator).
- **Live, without restarting the source.** While editing, the player swaps the recording
  backend's sync map in place, so the score follows the edit without a pause. A host save
  that returns the same syncpoints must not reselect the source.
- **The workbench is untouched** and stays backend-free; it never sets `syncEditable`.
- No golden moves. No scenario is added. Rendering and performance goldens stay
  byte-identical, so this item registers nothing in [lab-verify.md](../inprogress/lab-verify.md).

## Proof

- `harness/conformance/sync-segments.test.ts` — the pure model: every operation's
  invariants, beat snapping, tempo-preserving moves, merge on removal, the decoder's limits,
  and syncpoint derivation across a pickup bar, a 2/4 bar inside 4/4, a segment that ends
  inside a bar, a tempo-less segment and an empty score. Derived points round-trip through
  `createRecordingSync` with full coverage.
- `harness/conformance/click-schedule.test.ts` — the clock estimator (jitter absorbed, a
  seek re-anchors, rate respected) and the beat window (no beat scheduled twice, none lost
  across windows).
- `harness/conformance/recording-playback.test.ts` — media-time seek, media-time loop and
  in-place sync replacement on the fake media port.
- `harness/conformance/recording-management.test.ts` — the new `rawSync` format through
  `attachmentSync`: accepted, malformed rejected, provenance shape.
- `harness/verify/sync-bar-smoke.mjs` (after `npm run build`) — production Studio with a
  fixture client and real PCM: toggle, place both handles, set the count, split, nudge,
  score follows the new sync, the save payload carries segments and one point per bar.

## Log

- 2026-09-19 — Space plays or pauses anywhere focus is inside the player: the sync bar, the rail
  (now focusable by click) and the tray's buttons, a text field excepted. Bound on `<mnx-player>`,
  not the bar, so the rail gets it too and the editor's provisional Space (toggleNote, score-focused)
  is untouched. Owner's first hands-on note: after clicking in the bar there was no way to play
  without leaving it.
- 2026-09-19 — Beat ticks draw whenever 160 or fewer fit the window, not only when zoomed; a
  mouse over the track shows a card (beat n of m, time, bpm) over the label strip, the one
  place it cannot collide with the selection row. Owner asked why the whole-recording view had
  no ticks and for hover information, then dropped the segment name from the card.

## Out of scope, named so they are not rediscovered

Ramps and tapped segments; a beat-unit control; creating empty bars from a sync (needs the
editor, [core-editor-element-promotion.md](../complete/core-editor-element-promotion.md));
marking an odd bar from the sync bar; beat tracking or score-to-audio alignment for uploaded
audio; tab-audio capture for YouTube. Each was discussed on the canvas or in the design
conversation and none is filed as a proposal.
