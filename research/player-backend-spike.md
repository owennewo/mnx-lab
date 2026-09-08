# Player backend spike — 2026-09-08

**Decision: native Web Audio for item 6**, bundled with the player in both embed
formats. It passes the required oscillator checks at a much smaller measured
bundle cost; Tone does not remove our scheduling/cancellation bookkeeping and
its Sampler cannot provide the required public per-voice pitch control.

This is implementation-loop research, campaign item 4. It adds the type-only
[`Sink` contract](../src/audio/sink.ts), not a production backend. Temporary adapters,
probe page and dependency install are discarded. No package manifest, scenario,
golden or verification record changes. Item 6 owns the lasting automated offline
smoke, voice lifecycle/resource cleanup, automation bookkeeping and transport.

## Versions and method

Base: `5860863`. Node 22.22.1, Vite 8.0.14, Linux Chrome 152 (browser UA reports
152.0.0.0; installed executable 152.0.7977.82). Tone **15.1.22**, with resolved
standardized-audio-context **25.3.77**, automation-events **7.1.19**,
@babel/runtime **7.29.7**, tslib **2.8.1**. Tone installed in a temporary prefix;
project dependencies were not edited. Native uses the browser's Web Audio API.

A local Vite page, driven with browser automation, creates two-channel, 48,000 Hz
OfflineAudioContexts. Native: OscillatorNode → GainNode → StereoPannerNode.
Tone: Synth (sine, linear amplitude envelope) → native cancellation gate → panner;
explicit `OfflineContext(raw)` and `context.render()`. Both receive absolute seconds,
5 ms attack/release and amplitude 0.2. No Tone Transport or musical-time parsing.
The adapter functions receive their contexts; neither accesses browser globals on
module import. A mono source is created for each attack, with a logical voice id.

The offline scenario is `spec/hello-world`: its C4 whole note is manually scheduled
at 0.1 s for 2 s (120 quarter BPM). This deliberately tests the sink, not the future
compiler; the fixture pitch is asserted before scheduling. Render length 2.3 s.
The test derives pitch by interpolated rising zero crossings, not by reading back
AudioParam values. RMS uses bounded integer sample ranges (an initial probe bug
read one sample beyond a fractional render length; fixed before these verdicts).

## Five answers

1. **Node import: both pass.** `node --input-type=module` importing `tone` reports
   version 15.1.22 without throwing; importing the native adapter also succeeds.
   Tone's Global module uses a dummy context until a real context is requested.
   This says nothing about constructing browser audio nodes in Node. Keep the
   actual backend under `audio/native/`, with lazy context creation; headless
   rendering and pure conformance never need that backend.
2. **Browser offline render: both pass.** The scenario yields C4 at 261.62557 Hz
   and zero RMS after its release. Buffer assertions, not listening, decide it.
3. **Independent pitch/re-pitch: both oscillator paths pass.** The left voice bends
   +200 cents over 200 ms and then vibrates ±25 cents at 5 Hz; the right stays at
   220 Hz. Changing the left base frequency from 440 to 660 Hz preserves its bend,
   phase and envelope. Tone uses `Synth.detune` and `setNote`, not another attack.
   Its **Sampler fails the public per-voice-control prerequisite**: it computes a
   playbackRate on attack and keeps active ToneBufferSources in a private map;
   no public detune/source-handle API reaches an individual running sample. Item
   12 therefore needs native AudioBufferSourceNode voices and its own sample test.
4. **Bundle cost: native wins; table below.** Bundle the small native sink into the
   player face rather than require a second optional script/host implementation.
   This accepts the IIFE's lack of code splitting. A host may still inject a Sink;
   supplying only an AudioContext does not eliminate backend code. Re-measure the
   complete production sink in item 6: prototype size is not a final-size promise.
5. **Absolute scheduling/cancellation: both pass with adapter bookkeeping.** Start
   at 0.1 s, release at explicit times, and parameter automation all reach the
   offline buffer correctly. Cancel at 0.4 s silences the active note and the
   already-queued 0.7 s attack, including a queued later bend. Releasing the left
   voice leaves the right sounding. Tone's wrapper still needs an output gate,
   source ownership and stop/cancel handling; it supplies no score-wide cancellation
   primitive with our semantics. Both unlock from a button gesture, reach `running`,
   advance their clocks, and report zero difference from raw `currentTime`.
   **Do not use default Tone.now()**: it adds lookahead. The tested Tone adapter
   sets lookAhead to zero for live contexts and returns raw time explicitly.

Tone supplies ready-made envelopes, waveform choices, parameter timelines, browser
normalization and convenient Offline/context wrappers. This spike only exercised
sine synthesis; it does not claim those other facilities are worthless. For the
chosen small renderer, they do not offset the payload and remaining ownership work.

## Measured buffers

Two-second pitch probe: both voices start at 0.1 s, sustain to 1.8 s. Bend 0.3–0.5 s,
vibrato 0.6–1.2 s, re-pitch at 1.3 s. Frequency windows: 0.15–0.25, 0.51–0.59,
1.4–1.5 s. Vibrato estimated from cycle periods over 0.61–1.19 s.

| Measurement | Native | Tone | Pass criterion |
|---|---:|---:|---|
| Base Hz | 439.99999 | 439.99999 | 440 ±1 Hz |
| Bent Hz | 493.88329 | 493.88329 | 440 × 2^(200/1200) ±1 Hz |
| Re-pitched Hz | 740.82495 | 740.82494 | 660 × 2^(200/1200) ±1 Hz |
| Other voice Hz | 219.99999 | 219.99999 | 220 ±1 Hz |
| Vibrato Hz | 4.98914 | 4.98914 | 5 ±0.15 Hz |
| Vibrato extent, cents | −24.99146 / +24.99544 | −24.99146 / +24.99544 | observed ±25-cent modulation |
| Largest adjacent-sample delta, 0.15–1.7 s | 0.01938729 | 0.01938718 | <0.03 at amplitude 0.2 |
| RMS after/before re-pitch, 20 ms windows | 0.99097064 | 0.99097064 | 0.9–1.1; no envelope restart/dip |
| Pre-onset RMS | 0 | 0 | exact zero |
| Cancelled tail RMS, 0.42–1.2 s | 0 | 0 | <1e−7 |
| Released voice RMS, 0.42–1.1 s | 8.66e−18 | 8.66e−18 | <1e−7 |
| Other voice RMS after release | 0.14142133 | 0.14142132 | >0.05 |
| Scenario pitch Hz | 261.62557 | 261.62557 | C4 ±1 Hz |
| Scenario tail RMS, 2.12–2.3 s | 0 | 0 | <1e−7 |

These are bounded signal-continuity checks on sine voices, **not** a listening
approval or a guarantee for every waveform/device. The probe did not measure
real-time scheduling jitter, mobile/Safari behavior, sampled timbre or CPU scaling.
Those are not reasons to skip the required deterministic test for the production sink.

## Embed cost in bytes

Used the actual `vite.embed.config.ts` via Vite's config loader and `build`, with
only entry/outDir replaced. Baseline imports the unchanged embed entry; each
variant also exports its adapter so tree shaking cannot discard it. Tone uses
named Synth/Context/OfflineContext imports. Both formats use identical functionality,
including unlock, pitch, bend, vibrato, cancellation, release and disposal. Gzip is
Node zlib `gzipSync` default compression; sizes exclude unchanged copied SMuFL assets.
The measurement helpers/page are not bundled into these entries.

| Variant | IIFE raw | IIFE gzip | ESM raw | ESM gzip |
|---|---:|---:|---:|---:|
| Baseline viewer | 195,433 | 63,638 | 252,810 | 72,250 |
| Viewer + native prototype | 196,968 | 64,211 | 254,623 | 72,869 |
| Viewer + Tone prototype | 427,007 | 121,250 | 545,974 | 137,434 |
| Native increment | 1,535 | 573 | 1,813 | 619 |
| Tone increment | 231,574 | 57,612 | 293,164 | 65,184 |

This Tone figure includes its Offline wrapper because the comparable test adapter
exports it; no Sampler/effects or full Tone namespace was deliberately retained.
The native prototype does not yet implement production-grade voice reuse, seeking,
all automation replacement cases, lifecycle validation or the performance compiler.

## Contract adopted for item 6

`Sink.schedule(events, audioTime)` accepts ordered actions with offsets in seconds,
plus release/bend conveniences, cancellation, unlock, raw now and disposal. Separate
pitch actions preserve the envelope (`noReattack`); attacks start a new generation.
There is no setRate: the transport converts rational positions/curves to these times.
Cancel truncates crossing automation, suppresses future starts and fades active voices
within 5 ms; seeking reconstructs new voices explicitly. Future actions address the
generation at their timestamp, and old cleanup callbacks cannot kill replacements.

The 5 ms tail is a lab de-click convention, not an MNX duration change. Item 6 must
own param timeline values when truncating ramps (a future native AudioParam `.value`
is not a general scheduled-value query), release generation identity, and cleanup.
The spike's simple one-generation probes do not discharge those transport tests.

Sources checked against the installed version: [Tone Synth API](https://tonejs.github.io/docs/15.1.22/classes/Synth.html),
[Sampler source](https://github.com/Tonejs/Tone.js/blob/15.1.22/Tone/instrument/Sampler.ts),
[Context raw/adjusted clock implementation](https://github.com/Tonejs/Tone.js/blob/15.1.22/Tone/core/context/Context.ts),
and [Web Audio scheduling specification](https://www.w3.org/TR/webaudio/#AudioScheduledSourceNode).
