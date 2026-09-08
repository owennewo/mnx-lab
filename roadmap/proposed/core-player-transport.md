# Transport and the Tone renderer — play, pause, seek, loop, and six voices per guitar

> **Status: proposed 2026-09-08.** Campaign:
> [core-campaign-player.md](core-campaign-player.md), item 6. Needs items 4 and 5.

## Agreement block (campaign contract)

- **Pure before audible (§1).** Two modules with a hard line between them.
  `src/audio/transport.ts` is pure: it owns state, position and scheduling decisions,
  and talks to the outside through two injected interfaces — a `Clock` (`now()`,
  `setTimeout`) and a `Sink` (`schedule`, `cancel`, `bend`). The `assist/` loop's
  injected `ChatTransport` is the precedent: the injection is what makes it testable.
  `src/audio/tone/` implements `Sink` and is the only module that imports `tone`.
- **Ticks (§2).** The transport's position is a tick. `secondsAt(tick)` and
  `tickAt(seconds)` derive through the tempo map times a **rate** scalar, so a speed
  trainer (item 12) is one number.
- **Identity (§3).** The transport reports `{ noteKey, pass }` per onset and
  `{ ordinal, measureIndex, pass }` per bar boundary; nothing else reaches the UI.
- **Proof (§4).** Transport conformance tests under a fake clock: play from tick 0
  schedules the first window; pause then resume does not double-schedule; seek cancels
  and reschedules; a loop region wraps at the right tick with no gap; rate 0.5 doubles
  every derived second. The Tone adapter has **no automated test** unless the spike
  found Offline rendering works under Node — in which case one smoke test renders one
  scenario and asserts energy at the first onset's second.
- **Dependencies (§5).** **Adds `tone`** — the campaign's one admitted runtime
  dependency — behind `import()` on first play, confined by a dependency-cruiser rule
  (`tone-only-in-audio-tone`), never reachable from `engine/headless.ts`.
- **Reviewer gain (§7).** Sound, for the first time, through item 7's element.

## Design

- **Transport.** States `stopped | playing | paused`. Lookahead scheduling in windows
  (the classic two-clocks pattern: a short timer asks the transport for
  `eventsBetween(tick0, tick1)` and hands them to the sink with audio-clock times).
  Loop region in ticks; `seek(ordinal)` and `seek(tick)`; `setRate(x)`; an event
  emitter for onsets and bars, driven from the same window pass so the cursor cannot
  drift from the sound.
- **Voices.** For each track with `strings`, the adapter allocates **one mono voice
  per string**; a note on string 3 plays on voice 3, its `bend` curve automates that
  voice's detune, and a chord is six independent voices — which is the only way a
  bent note inside a chord can be rendered, and is the same shape as item 4's
  channel-per-string MIDI file. Pitch-only tracks get a `PolySynth`. The synth patch
  is deliberately plain (a plucked-string-ish envelope); timbre is item 11.
- **Rate changes mid-play** cancel and reschedule from the current tick — simpler and
  more honest than automating Tone's bpm, and it keeps the tempo map ours.
- **Unlocking audio** needs a user gesture; the adapter exposes `unlock()` and item 7's
  play button calls it. The transport never knows.

## Done bar

- The fake-clock suite passes; the boundary rule is red if `tone` is imported anywhere
  else; `npm run smoke:lib` still renders SVG in Node — proof the library face did not
  grow an AudioContext.
- `npm run build` reports the embed face's size before and after; the lazy chunk is the
  only growth.
