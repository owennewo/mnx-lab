# Transport — play, pause, seek and loop, with the cursor on the audio clock

> **Status: implemented 2026-09-09; landing checks in progress.** Campaign:
> [core-campaign-player.md](../inprogress/core-campaign-player.md), item 6. Needs items 4 and 5.

## Agreement block (campaign contract)

- **Pure before audible (§1).** `src/audio/transport.ts` owns state, position and every
  scheduling decision, through two injected interfaces: a `Clock` (`now()` in audio
  seconds, `setTimeout`) and item 4's `Sink`. The `assist/` loop's injected
  `ChatTransport` is the precedent. `src/audio/<backend>/` implements `Sink` and is the
  only module that imports the backend.
- **Rational time (§2).** Position is an expanded performance rational; `secondsAt(position)` is item 3's
  rate-1 conversion. Schedule relative to the play/seek anchor:
  `audioAnchor + (secondsAt(position) - secondsAt(positionAnchor)) / rate`.
  UI beat formatting uses item 3's source map, including hold/grace intervals.
- **The cursor follows the audio clock (§8).** The window pass hands the sink events
  with audio times **and** queues `{ writtenId, ordinal, audioTime }` for the UI; the
  UI-facing emitter fires each when `clock.now()` reaches its time, never when it was
  scheduled. Under the fake clock the test asserts an onset is *not* reported before
  its time.
- **Proof (§4).** Fake-clock conformance suite (below). The sink gets a browser
  `OfflineAudioContext` smoke, required for the chosen backend: render one scenario, assert
  energy at the first onset's second.
- **Dependencies (§5).** Adds the backend item 4 chose, fenced by a dependency-cruiser
  rule, cost measured on both embed formats per the spike's recommendation.
- **Reviewer gain (§7).** Sound, through item 7.

## Contracts the suite pins

- Play from a position schedules the first window; pause then resume schedules no
  event twice; stop releases every active voice.
- **Seek** cancels scheduled sound from the seek's audio time, releases voices, and
  **reconstructs state at the target**: a sustained note whose onset is before the
  target is started at its remaining duration; the bend/controller value in force at
  the target is set before the first event; the tempo in force is the map's.
- **Rate change** mid-play is a seek to the current position with the new rate.
- **Loop region** in rationals wraps with no dropped onset and no doubled one; a tie
  across the loop end is released at the boundary and re-struck at the start (the
  reconstruction rule again).
- `eventsBetween(a, b)` is half-open and exact.

## Voices

Independently addressable voices (`start`, `release`, `bend`, `retune` without
re-attack). A fretted part's voices are owned by strings, so a bend on string 3 in a
chord touches one voice; unfretted parts draw from a pool. The synth patch is plain;
timbre is item 12.

## Cancellation and logical transitions

Each play/seek/rate-change generation invalidates queued UI and scheduling callbacks as
well as sink events. Reconstruct the active written-occurrence set immediately at a
seek target, including tied continuations; remove highlights at written-span ends.
During rests/holds, the rational playhead and source map still locate the cursor even
when there is no active note. A logical voice transition (`noReattack`) inside a legato
chain does not create a second envelope attack, but seeking into it starts a fresh
physical source with the remaining logical span. Fake-clock tests cover stale callbacks,
these transitions and the end of the final note as well as onset timing.

## Done bar

The suite green; the fence red if the backend is imported elsewhere;
`npm run smoke:lib` and `smoke:embed` green — the library and embed faces did not grow
an `AudioContext` at import time.

## Backend decision from item 4

Use `audio/native/`, with no runtime audio dependency, behind the
[type-only Sink contract](../../src/audio/sink.ts). The
[spike report](../../research/player-backend-spike.md) supplies buffer criteria and
measured bundle baselines. Fence backend imports from pure audio/model/headless code,
even though there is no third-party package to fence. Re-measure both embed formats
with the complete implementation and own the permanent offline smoke.

## Implementation

The [transport and sink documentation](../../docs/player-transport.md) records the public
API, resource bounds, generation cancellation, exact seek anchors, native ownership
and permanent offline smoke. No runtime dependency or scenario evidence change.
The complete sink and compiler/transport bundle costs are recorded in the campaign log.
