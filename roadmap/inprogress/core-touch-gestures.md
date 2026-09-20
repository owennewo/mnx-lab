# Touch gestures on the score — the minimal three

> **Status: built 2026-09-12; device-checked 2026-09-15; pinch added the same
> day as a fourth gesture (two-finger on touch, ctrl+wheel on a trackpad),
> with the four performance items below landed — awaiting the pinch's own
> device check.** Opened
> from a design conversation that started at "pinch should control staff and
> space zoom" and narrowed once the costs were counted — the record of what was
> dropped, and why, is as much the point of this doc as what survived.
>
> **The device check passed** (a real Android tablet, 2026-09-15): one-finger
> scrolling stays native, the double tap is claimed, the drag zooms. Two
> defects came back with it, both fixed here: nothing showed that zoom mode had
> been entered until the first step landed, and every step of the drag was too
> slow to follow. The second is only partly a gesture problem — see
> *Performance, measured* below — and it is what reopened the pinch: on a
> touchscreen two fingers are two points, so the objection that a pinch is a
> single scalar was only ever true of trackpads.

## The three

| Gesture | Does | Knob |
|---|---|---|
| Double tap | Zoom reset | `zoom = null`, `densityH = null` — back to **fitted**, not to 1.0 |
| Double tap, hold, drag | Staff × space zoom, diagonal drives both | `zoom` (0.4–4sp), `densityH` (0–8sp) |
| Two-finger tap | Play/pause | a `transport-toggle` event, not the player |
| Space (keyboard) | Play/pause | the same event — see Carried forward 3 |
| Pinch (touch) | Staff × space zoom: fingers apart vertically grows the staff, apart horizontally opens the spacing; a diagonal drives both | the same two knobs, the same ladder, stepped by the change in the fingers' span at half the drag's rate (`PINCH_PX_PER_STEP = 12`) |
| Pinch (trackpad) | Staff; **Shift**+pinch → space | arrives as `wheel` with `ctrlKey` — the browser's encoding of a pinch, which is why Ctrl cannot be the modifier — 10 units per step, mouse-wheel notches clamped |

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

Pinch was added on 2026-09-15 as exactly that later addition, but two-axis
rather than single: the span between two fingers on a touchscreen is a 2D
vector, so the vertical and horizontal spans map onto staff and space through
the same snap cone the drag uses. The single-pointer path stays the primary
one and the trackpad keeps the pad, so the first two findings still hold; the
third is why a pinch steps the drag's ladder rather than owning a rate curve.
The two-finger-tap cost it re-opens is paid in `gestures.ts`: a second finger
opens a pinch *candidate* and a two-finger-tap candidate at once, and the
first span change past the snap threshold settles it as a pinch.

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

## Performance, measured (2026-09-15)

Kind Hearted Woman (61 bars, two parts, 6,342 primitives in the both view),
dev build, this laptop, the viewer at tablet-like widths:

| | JS per paint | browser style+layout+paint |
|---|---|---|
| both view, zoom step | 300–540ms | 20–45ms |
| notation, zoom step | 150–390ms | ~25ms |
| tab, zoom step | 80–180ms | ~25ms |

The browser is not the bottleneck; our JavaScript is, and it splits four ways:

1. **Layout ran twice on every zoomed paint.** Every renderer lays out square
   to find the fit, then again at the ink ratio. Each is ~170ms in Node for
   this score; the profile is flat (`assembleSegment` 67% inclusive, no single
   hot spot). **Landed**: `render/layoutCache.ts`, a caller-owned memo of the
   square layout keyed on the document's identity, which the viewer hands over
   only for the length of a gesture — the one span in which it can vouch the
   document is not mutated underneath. A staff-only step is one layout.
2. **The SVG emitter was `setAttribute`-bound**: 60% of `renderSvg`'s self
   time, ~330ms for 6,345 nodes where the equivalent raw DOM build measures
   ~40ms. **Landed, in two commits**: the emitter builds markup the browser
   parses (`innerHTML`), byte-identical to the goldens; then each kind's
   shared attributes moved into one `<style>` at the top of the SVG and
   numbers print at four decimals. Measured attached to the page, same score:
   322ms → 237ms per emit, 919KB → 643KB of markup, the paint after it
   unchanged. The second commit moved every SVG golden and no primitives
   golden; ten rasterised before and after differ in zero pixels; registered
   in [lab-verify.md](lab-verify.md) (2026-09-15).
3. **A third of a zoomed paint was selection chrome**: `drawEnclosure`'s
   `getBBox` (22%) and the anchor event's `getBoundingClientRect` (9%), each
   forcing layout on the fresh 7,000-node SVG, plus a smooth reveal scroll
   queued on every step. **Landed**: while a gesture is active the viewer
   re-engraves the score and skips the chrome; the release paints once with
   everything and does not reveal.
4. **The layout engine itself** — the remaining ~170ms — is the real ceiling.
   **Landed**: it is DOM-free by guarantee (`engine/headless.ts`), so
   `render/plan.ts` splits every render into a plan and an emit, and for the
   length of a gesture the viewer runs the plan in
   `src/elements/layout.worker.ts` — the document posted once per gesture so
   the memo in 1 hits there, requests coalesced to latest-wins, a main-thread
   paint bumping an epoch so a stale reply is never drawn over the release.
   Synthetic pinches in headless Chrome show 0ms of main-thread paint per
   step during a gesture and a ~250ms release paint. What this buys on a slow
   device is not a faster frame but a main thread that never blocks: the
   finger, the readout and the scroll keep responding while a plan is in
   flight. A worker is never required — if it cannot be built or throws, the
   viewer paints on the main thread as before.

What none of this reaches on a slow tablet is a *glued* pinch: the step every
other app takes is a CSS `transform: scale()` preview of the existing SVG
between real engraves, which is approximate (the horizontal axis re-fits on
the real paint) but never blind. Not built; the candidate next step if 1–4
are not enough on the device.

## Carried forward (known, deliberate)

1. **`ZoomPad.ts` still has its own copy of the ladder walk.** The pure functions
   now live in `spacing.ts` and the pad should adopt them. Not done here: the pad
   is a tuned control with no tests, and moving it was not worth the blast radius
   of a first cut that may be backed out wholesale.
2. **No anchor-preserving zoom.** The drag does not hold the tapped note under
   the finger. `densityH` reflows, so a real anchor means re-scrolling to a
   `data-source-id` each frame. ~~Related pre-existing defect: `revealBox`'s
   `this.scrollBy` scrolls the viewer host, which is no longer the scroller in
   either shell.~~ **Wrong, checked 2026-09-20.** Measured in a real browser, the
   viewer IS the scroller: `overflow-y: auto` with a live `scrollTop`, inside the
   frame's `.score`, which does not scroll. `revealBox` scrolls the right element.
   The reveal defect this suspicion was standing in for was elsewhere and is
   fixed — a parked playhead outranked the selection on every paint, so nothing
   ever followed the cursor (`docs/core-viewer-surface.md` → who owns the scroll).
3. ~~**No keyboard play/pause.**~~ **Resolved 2026-09-20.** The negotiation with
   the editor keymap went the way the convention does: `Space` is play/pause and
   `toggleNote` moved to `N`, the letter MuseScore and Sibelius give note input.
   The viewer emits `transport-toggle` on Space — **this gesture's own event**,
   so the keyboard path and the two-finger tap are the same seam and the host
   wiring was already in place. The button remains the accessible path.
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

- **No two-axis pinch on a trackpad.** A trackpad pinch is a `wheel` with
  `ctrlKey`, a scalar — so it drives one axis at a time, staff by default and
  space with Shift, and the pad remains the two-axis control there.
- **No clearance gesture.** Two-finger horizontal was considered for it and
  dropped: [core-lowvision-reflow.md](../proposed/low-priority/core-lowvision-reflow.md)
  measures a system at ×2.6 the line width at 640% staff scale, so horizontal
  scrolling is a real reading need and must keep that axis. Clearance is 9
  detents (`clearance.ts:6`, 0–4 in halves) — a stepper, not a zoom, and it
  belongs in a settings surface.
- **No rotate, no three-finger anything** — OS-reserved on macOS and iPadOS, and
  rotation has no meaning on a score.
- **No gesture customisation or remapping.** Three fixed gestures.
