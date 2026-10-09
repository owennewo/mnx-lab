# Player transport

Implementation loop, player campaign item 6. The public `mnx-lab/audio` entry exports
`Transport`, `eventsBetween`, `centsAt` and their types. The
[player element](player-element.md) supplies the controls and host wiring.

The transport is the player's musical clock: position, highlights, loops, rate, seeking.
Sound is the synth's (since 2026-10-09; [player synth](player-synth.md)): `HostBackend`
runs a transport over a sink that makes no sound and sends the score to the synth's
instrument host as contract notes, a lead ahead. The old Web Audio sink — oscillators and
sample packs — is retired (roadmap/complete/core-campaign-synth.md).

```ts
import { compilePerformance, HostBackend, NativeHostPort } from 'mnx-lab/audio';
const result = compilePerformance(document);
if (!result.ok) throw new Error(result.diagnostics.map(d => d.message).join('\n'));
const backend = new HostBackend(result.performance, document, new NativeHostPort(), {}, event => {
  /* onset / end / state, as the transport reports them */
});
// From a user gesture:
await backend.play();
// On host teardown:
backend.dispose();
```

## Musical state and the audio clock

The transport imports no browser backend. Its injected `Clock` supplies `now()` in
raw audio seconds, `setTimeout` and `clearTimeout`; its injected `Sink` renders timed
actions. They must share the same clock origin. Defaults are a 100 ms scheduling
window and a 20 ms polling interval. Polling schedules sound ahead; it does not
announce an onset early. Written `onset`/`end` notifications carry `writtenId`,
performed `ordinal` and the actual scheduled `audioTime`, and are delivered only
when the audio clock reaches that time. A delayed poll may deliver them late.

`position` and `snapshot.position` are expanded whole-note rationals. Exact seek
anchors are retained; positions between anchors use the existing tempo map's
1/2^20-whole-note inverse-clock approximation. That display rounding never selects
sound events or decides when the final release has happened. `eventsBetween(p,a,b)`
selects sounding onsets in the exact half-open interval `[a,b)`.

`snapshot` includes state, rate, active written occurrences and the source-map
segment at the playhead. The source segment also locates rests, make-time graces and
holds when no note is sounding. Written spans drive highlights, including tied
continuations; sounding spans drive envelopes. The host maps these to the playback
context without writing the editor cursor or selection.

- `play()` unlocks lazily, then schedules the first window. Repeated calls while
  playing do nothing. A stale unlock promise cannot resume after stop, seek or disposal.
- `pause()` cancels future sound and freezes position/highlights. Resume reconstructs
  sustained sound at the frozen position and schedules each subsequent onset once.
- `seek(position)` cancels the generation and immediately reconstructs the active
  written set. While playing, notes crossing the target start fresh physical sources
  with only their remaining span. Their current combined bend/vibrato value is applied
  after the attack's bend reset, at the same audio time, before future automation.
- `setRate(rate)` seeks to the current position with the new rate. The tempo map
  remains rate 1; only the anchor-relative seconds are divided by rate.
- `setLoop({start,end})` uses a half-open rational region. A target outside the loop
  becomes its start. Boundary releases precede reconstructed attacks; ties crossing
  the end are re-struck at the beginning. `setLoop()` clears the region.
- A contiguous `noReattack` event uses a pitch action on the same physical voice.
  Seeking or looping directly into that transition instead creates a fresh source.
- `stop()` cancels sound, clears highlights and returns to zero. Natural completion
  stops at the final performance position and clears the final written occurrence.
  `dispose()` invalidates callbacks; the host separately owns/disposes the injected sink.

Every reset invalidates both timer and UI queues. If a suspended tab misses its
scheduling window, transport reconstructs at the current audio position instead of
replaying a backlog of late attacks. Poll callbacks never act on a later generation.

Bend breakpoints and tempo changes are exact; vibrato is sampled 32 times per period.
Bends and vibrato sum per logical voice. Rate is bounded to 1/16–16, lookahead to
(0,5] seconds, and polling must be shorter than lookahead. Loops must fit inside the
performance, last at least 1 ms at rate 1, and fit a 10,000-wrap window budget.
A curve is bounded to 100,000 sampled points per sounding event. These bounds reject
requests; they do not silently change musical durations.

## The sink it drives

`Sink` (`src/audio/sink.ts`) is the transport's renderer contract: timed attacks,
releases, pitch and bend actions, `cancel` and `unlock`. In production the only sink is
`HostBackend`'s silent one: its `cancel` marks a restart, its `unlock` gets the synth
ready, and its clock runs the backend's lead behind the host's (player-synth.md).

## Proof

`harness/conformance/transport.test.ts` uses a fake clock and recording sink. It
covers half-open fractions, onset timing, pause/resume, stop, seek through ties and
tempo/bends, stale callbacks/unlocks, rate changes, loop reconstruction, legato,
rests, combined controllers, final note ends and the inverse-clock rounding boundary.

The synth's side — the contract stream, the backend against the synth's real host on a
manual clock, the worklet in Chrome — is proven as player-synth.md lists.

No scenario golden or human verification record changes in this item. Item 5's
performance/MIDI review batch remains pending in the standing ledger.
