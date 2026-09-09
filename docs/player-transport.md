# Player transport and native sink

Implementation loop, player campaign item 6. The public `mnx-lab/audio` entry exports
`Transport`, `eventsBetween`, `centsAt`, `NativeSink`, `nativeClock`, and their types.
The [player element](player-element.md) supplies the controls and host wiring.

```ts
import { compilePerformance, Transport, NativeSink, nativeClock } from 'mnx-lab/audio';
const result = compilePerformance(document);
if (!result.ok) throw new Error(result.diagnostics.map(d => d.message).join('\n'));
const sink = new NativeSink();
const transport = new Transport(result.performance, nativeClock(sink), sink, {
  onEvent(event) { /* host updates its separate playback state */ }
});
// From a user gesture:
await transport.play();
// On host teardown:
transport.dispose();
sink.dispose();
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
requests; they do not silently change musical durations. Timbral hints remain for
later campaign items; this sink is a plain sine patch.

## Native renderer and ownership

`audio/native/sink.ts` is the only production browser-audio implementation. Neither
module import nor `new NativeSink()` accesses an `AudioContext`; `unlock()` creates
one lazily or resumes the supplied live context. An offline context needs no resume.
The sink accepts a host context and optional destination from that context; a
host-owned context is never closed. A sink-created context is closed on disposal.

Each attack owns an oscillator, gain and automation histories. Voices are addressed
by their compiler identity, so declared strings remain independently bendable.
Attack and release use 5 ms linear amplitude ramps, with peak amplitude
`0.2 * velocity`. Retuning preserves phase, envelope and the current bend.

Queued actions resolve the generation active at their timestamp, including when a
future attack was scheduled before a bend on an earlier note. Cancel truncates
crossing automation using owned timeline values, silences future starts and fades
active sources within 5 ms. Cancelled future generations cannot shorten replacement
voices, and old `onended` cleanup only removes its own source. Ended/disposed nodes
are disconnected. Parameter scheduling follows the
[Web Audio scheduling contract](https://www.w3.org/TR/2021/REC-webaudio-20210617/#AudioScheduledSourceNode).

The dependency-cruiser fence rejects native imports from pure audio, model, engine,
worker and Node conformance code. Only the native backend, elements, entries and
`harness/browser/` may import it. The conformance test proves both a rejected pure
import and an admitted browser test import.

## Proof and bundle budget

`harness/conformance/transport.test.ts` uses a fake clock and recording sink. It
covers half-open fractions, onset timing, pause/resume, stop, seek through ties and
tempo/bends, stale callbacks/unlocks, rate changes, loop reconstruction, legato,
rests, combined controllers, final note ends and the inverse-clock rounding boundary.

`npm run smoke:audio` renders the real compiler → transport → native sink in Chrome's
48 kHz `OfflineAudioContext`. It checks hello-world C4 and onset/release energy;
independent 440/220 Hz voices; +200-cent bend; envelope-preserving re-pitch to 660 Hz;
crossing-ramp cancellation; cancelled future attacks; replacement lifetime and disposal.
This is a signal test, not a human listening approval or a browser/device coverage claim.
`smoke:lib` also instantiates/disposes the idle native sink under bare Node.

`node harness/verify/audio-bundle-cost.mjs` rebuilds the real embed configuration in
IIFE and ESM, retaining exports to prevent tree shaking. It compares the unchanged
viewer, viewer plus the complete sink, and viewer plus compiler/transport/sink. The
measurement is preparation for item 7's bundled player, not a claim that this item
has added player UI or changed the viewer payload. Results are recorded in the
[campaign log](../roadmap/inprogress/core-campaign-player.md).

No scenario golden or human verification record changes in this item. Item 5's
performance/MIDI review batch remains pending in the standing ledger.

The same NativeSink also supports [sample packs](player-sample-packs.md) through
independent buffer sources. Pitch automation and cancellation remain shared with
the oscillator backend; the compiler and transport timeline are unchanged.
