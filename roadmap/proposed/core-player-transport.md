# Transport — play, pause, seek and loop, with the cursor on the audio clock

> **Status: proposed 2026-09-08, revised the same day.** Campaign:
> [core-campaign-player.md](core-campaign-player.md), item 6. Needs items 4 and 5.

## Agreement block (campaign contract)

- **Pure before audible (§1).** `src/audio/transport.ts` owns state, position and every
  scheduling decision, through two injected interfaces: a `Clock` (`now()` in audio
  seconds, `setTimeout`) and item 4's `Sink`. The `assist/` loop's injected
  `ChatTransport` is the precedent. `src/audio/<backend>/` implements `Sink` and is the
  only module that imports the backend.
- **Rational time (§2).** Position is a rational; `secondsAt(position) / rate` is the
  only conversion, from item 3.
- **The cursor follows the audio clock (§8).** The window pass hands the sink events
  with audio times **and** queues `{ writtenId, ordinal, audioTime }` for the UI; the
  UI-facing emitter fires each when `clock.now()` reaches its time, never when it was
  scheduled. Under the fake clock the test asserts an onset is *not* reported before
  its time.
- **Proof (§4).** Fake-clock conformance suite (below). The sink gets a browser
  `OfflineAudioContext` smoke if item 4 found one works: render one scenario, assert
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

## Done bar

The suite green; the fence red if the backend is imported elsewhere;
`npm run smoke:lib` and `smoke:embed` green — the library and embed faces did not grow
an `AudioContext` at import time.
