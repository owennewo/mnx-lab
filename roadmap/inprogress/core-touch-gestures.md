# Touch gestures on the score — the minimal three

> **Status: built 2026-09-12, awaiting the device checks.** Deliberately the
> smallest set that is worth shipping: three gestures, no pinch. Opened from a
> design conversation that started at "pinch should control staff and space
> zoom" and narrowed once the costs were counted — the record of what was
> dropped, and why, is as much the point of this doc as the three that survived.
>
> It sits in `inprogress/` rather than `complete/` because the one thing that
> decides whether the approach is sound **cannot be checked from this machine**:
> whether `touch-action: pan-y` plus a non-passive `preventDefault()` really does
> claim the second tap without costing native scrolling. See *The spike, skipped
> on purpose* below.

## The three

| Gesture | Does | Knob |
|---|---|---|
| Double tap | Zoom reset | `zoom = null`, `densityH = null` — back to **fitted**, not to 1.0 |
| Double tap, hold, drag | Staff × space zoom, diagonal drives both | `zoom` (0.6–6.4, `scale.ts:99`), `densityH` (0.01–8, `spacing.ts:172`) |
| Two-finger tap | Play/pause | a `transport-toggle` event, not the player |

A double-tap-drag is one finger: tap, lift, tap again within ~300ms and *don't*
lift — the drag that follows is the control. The double-tap is only the unlock.

## Why one finger, and why not pinch

Pinch was the starting point and is not in the set. Three findings moved it out:

- **A trackpad pinch is a single scalar.** It arrives as `wheel` with
  `ctrlKey: true`, with no x/y decomposition, so the diagonal that motivated the
  whole idea is physically unrepresentable on the input device half the users
  have. A one-finger drag is a clean 2D vector on touch, trackpad and mouse alike.
- **Pinch fails WCAG 2.5.1 (Pointer Gestures) alone**; a single-pointer path is
  required. Double-tap-drag *is* that path, so building it first means the
  accessible route is the primary route rather than a retrofit.
- **The rate curve already existed and was tuned.** `ZoomPad.ts:933` `beginDrag`
  / `:960` `onPointerMove` is this gesture minus the pad, with
  `DRAG_PX_PER_STEP = 6` (`:84`), `STAFF_STEP_RATIO = 1.1` (`:76`),
  `SPACE_STEP = 0.04` (`:77`). `src/elements/gestures.ts` carries those constants
  over unchanged, so a gesture and a click agree on what a step is.

Pinch remains a reasonable *later* addition as a single-axis (staff)
convenience — but see the two-finger-tap cost below, which it re-opens.

## The spike, skipped on purpose

The plan opened with a spike as item 0: prove the `touch-action` question before
building anything, because the answer separates a weekend from hand-writing a
scroller. It was **deliberately skipped**, and the reasoning is worth keeping.

The spike needs a real touchscreen. No agent has one, so it was always going to
be a human running something on a phone — and given that, testing the real
feature beats testing a throwaway harness that proves the same platform fact.
The optimistic branch was built directly:

- `:host { touch-action: pan-y }` on the viewer, so the browser keeps one-finger
  vertical scrolling, which on a score is most of what a reader does.
- A **non-passive `touchstart`** listener that calls `preventDefault()` only
  while a second tap is armed and only while it is the sole contact
  (`gestures.ts`, `onTouchStart`). Suppressing more than that would take
  scrolling away wholesale, which is the outcome `pan-y` exists to avoid.

**If a platform disagrees**, the fallback is unchanged and recorded here: take
`touch-action: none` and hand-write pan/momentum, or — better — drop the drag,
keep double-tap = reset, and move the 2D zoom onto a pinch after all, since two
fingers do not compete with one-finger scrolling at all.

**What to check on device** (real Android Chrome and real iOS Safari; DevTools
emulation does not model the compositor's scroll hand-off and will give a false
pass): one-finger scrolling still feels native; a double-tap-drag zooms without
the page also scrolling; a double tap returns to fitted; a two-finger tap toggles
play/pause; and a single tap still selects a note with no added latency.

> **Correction to the original plan.** It asserted that nothing in the tree
> declared `touch-action`. That was wrong — `src/workbench/ScenarioPage.ts:1093`
> and `src/workbench/ZoomPad.ts:222` both declare `touch-action: none`. Neither
> is on the viewer, so the design held, but the claim was false when written.

## The collisions, decided

**Single tap vs. double tap.** Selection fires on `pointerdown` inside the SVG
(`src/engine/render/svg.ts:140`), so tap one selects a note before a second tap
could be known. **Selection is deliberately not deferred** — a 300ms lag on note
selection is a worse defect than the collision. Tap one selects immediately; a
double-tap-reset also leaves a note selected, which is harmless because selection
is non-destructive. The gesture stays unambiguous because reset fires on the
second tap's *release*.

**Double tap vs. double-tap-drag.** Discriminated on whether the second tap lifts
within 220ms without passing slop (`SECOND_TAP_MS`).

**Two-finger tap is cheap *because* pinch is absent.** With no pinch in the set it
only has to be told from a two-finger scroll — a movement threshold. Adding pinch
later re-introduces the degenerate-pinch discriminator (a pinch that never moved),
which is the real reason that gesture is usually fiddly. Note the dependency
before adding pinch, not after.

**The axis lock became a snap.** `ZoomPad.ts:974-983` *locks* to one axis past 8px
at a 20° tangent, per
[core-zoom-density-pad.md](../complete/core-zoom-density-pad.md)'s ruling that the
two axes stay decoupled. Diagonal drive deliberately reverses that — **inside the
drag only**. The near-axis cone remains as a snap so pure-staff and pure-space
stay easy targets; a genuinely diagonal drag drives both. The pad is untouched.

**`user-select: none`** on the viewer, or a mouse double-click-drag selects text
by word.

## What was built

- **`src/elements/gestures.ts`** (new) — `ScoreGestures`, the recogniser. Pointer
  events for the state machine, one non-passive `touchstart` for the scroll
  claim. Constants carried from `ZoomPad.ts`.
- **`src/engine/layout/spacing.ts`** — `nextDensity` / `walkDensity` / 
  `DENSITY_STEP`, the ladder walk as pure functions, so the gesture steps rungs
  rather than a flat percentage (most density values engrave identically).
- **`src/elements/DocumentViewer.ts`** — `touch-action: pan-y`,
  `user-select: none`, the `no-gestures` opt-out, the transient HUD, and the
  wiring. The element **applies the gesture to itself and then announces it** via
  `zoom-change`: applying locally is what makes a bare viewer (embed, studio)
  zoomable with no host JavaScript, and announcing is what stops a host that owns
  the state (the workbench) from overwriting it on the next render. The detail is
  shaped exactly like `ZoomPadChange`, so the workbench binds the handler it
  already had.
- **`src/elements/Player.ts`** — `toggle()`, play/pause as one verb for callers
  with no view of the state.
- **`src/elements/playbackHost.ts`** — `transport-toggle` → `player.toggle()`,
  covering studio and the embed face in one place.
- **`src/workbench/ScenarioPage.ts`** — `@zoom-change` and `@transport-toggle` on
  the viewer.

**The viewer does not know about the player.** It reports a two-finger tap and
the host decides what that means, exactly as `note-selected` becomes a seek
(`playbackHost.ts:58`). With no player bound the gesture is a no-op, never an
error.

**Studio gained zoom state for the first time** — and it is per-element and
transient, not persisted. The workbench's keys (`ScenarioPage.ts:209-211`) stay
workbench-scoped, and studio deliberately gets no persistence in this cut; a
gesture that silently writes a preference the shell has no control for would be
worse than one that forgets.

## Carried forward (known, deliberate)

1. **`ZoomPad.ts` still has its own copy of the ladder walk.** The pure functions
   now live in `spacing.ts` and the pad should adopt them. Not done here: the pad
   is a tuned control with no tests, and moving it was not worth the blast radius
   of a first cut that may be backed out wholesale.
2. **No anchor-preserving zoom.** The drag does not hold the tapped note under
   the finger. `densityH` reflows, so a real anchor means re-scrolling to a
   `data-source-id` each frame. Related pre-existing defect: `revealBox`'s
   `this.scrollBy` (`DocumentViewer.ts:1160`) scrolls the viewer host, which is
   no longer the scroller in either shell — see 5.
3. **No keyboard play/pause.** The button (`Player.ts:331`) remains the
   non-gesture path, which satisfies the accessibility requirement; a key binding
   would have to negotiate with the editor keymap, where `Space` is `toggleNote`
   (`src/edit/keymap.ts:169`).
4. **No tests**, by convention — `harness/` may not import `elements/`, and this
   is timing-and-threshold code against real PointerEvents. It ships the way
   `ZoomPad.ts` ships.
5. **`<mnx-score-frame>` now owns the scroll, and this was built before it
   landed.** Rebasing onto `5ec2341` / `16619dd` put both shells' viewers inside
   the frame, whose `.score` is the scroll container
   (`ScoreFrame.ts:130-136`, `overflow: auto`) — where the design assumed the
   viewer's own `:host` (workbench) or studio's `main`. The gestures should still
   work, because `touch-action: pan-y` on the viewer permits the vertical pan and
   the nearest scrollable ancestor performs it, and nothing here scrolls by hand.
   But it is untested, it is the most likely place for the scroll claim to behave
   differently from the design, and **it is the first thing to check on device**.
   The frame also runs a document-level `pointerdown` click-away
   (`ScoreFrame.ts:576`) and owns its own play/pause on the bottom grip
   (`:612`) — a second route to the same verb as the two-finger tap, which is
   fine, but means the two must not fight.

## Not this

- **No pinch.** Its cost is recorded above; adding it is a separate item that
  must re-open the two-finger-tap discriminator.
- **No clearance gesture.** Two-finger horizontal was considered for it and
  dropped: [core-lowvision-reflow.md](../proposed/low-priority/core-lowvision-reflow.md)
  measures a system at ×2.6 the line width at 640% staff scale, so horizontal
  scrolling is a real reading need and must keep that axis. Clearance is 9
  detents (`clearance.ts:6`, 0–4 in halves) — a stepper, not a zoom, and it
  belongs in a settings surface.
- **No rotate, no three-finger anything** — OS-reserved on macOS and iPadOS, and
  rotation has no meaning on a score.
- **No gesture customisation or remapping.** Three fixed gestures.
