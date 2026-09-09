# Sampled guitar

Choose **Sound → Guitar** in the player, then Play. Synth remains the default.
Changing sound during playback pauses at the current position, prepares the new
preset and resumes there. Stop cancels that pending start. A load error is visible;
retry Play or choose Synth. No samples are downloaded for ordinary synth playback.

## Source and delivery

The shipped microphone pack is derived from Karoryfer **Shinyguitar**, an archtop
guitar recorded by D. Smolken. The upstream publisher declares its free libraries
CC0: <https://shop.karoryfer.com/pages/free-samples>.
Pinned repository: <https://github.com/sfzinstruments/karoryfer.shinyguitar>,
revision `57243cca85277dbcc120ce17c6178032f93c80f3`.
`public/samples/shinyguitar-v1/LICENSE` preserves the CC0 text.
The pack's `manifest.json` records every original filename, source SHA-256,
derived SHA-256, byte count, root pitch, velocity layer and alternate take.

**48 FLAC files, 3,575,730 bytes** before HTTP overhead: 12 root pitches, source
velocity layers 2 and 4, and takes 1 and 2. Roots span MIDI 37–84. Files are mono,
24 kHz, 16-bit, at most five seconds with a final 100 ms fade. The manifest records
the exact ffmpeg conversion; samples are not normalized individually, preserving
recorded level differences. ffmpeg is an authoring tool, never a build/runtime
requirement. No sampler package, account, CDN or service is required.

Vite copies the pack as static files beside both the workbench and embed outputs.
The JS contains no sample payload. A four-request loader fetches and decodes the
pack on first Guitar play; concurrent loads and decoded buffers are shared within
an audio context. Failed loads are evicted for retry. Closing a player releases its
context; browser HTTP caching may reuse downloaded files for a new player.

## Playback contract and limits

Each logical voice gets its own AudioBufferSourceNode, preserving the compiler's
string ownership. The original mappings have **no recorded string identity**:
different strings share the same recorded pitch bank. Nearest-root selection
limits pitch shifting; velocity below 0.5 selects layer 2, otherwise layer 4, with
continuous gain scaling. Each voice alternates the two takes on successive attacks.
Bends/vibrato automate detune; legato changes playbackRate on the same source,
preserving its phase and envelope. Rate changes remain the transport's job.

Choosing Guitar explicitly requests that timbre for melodic parts, including
scores without instrument metadata. Kit voices retain the synth. The library
can choose presets per voice/part. No instrument or tuning is inferred from pitch.

Samples retain their natural decay and do not loop. A very long sustained note
can outlast its recording; transposition also changes the remaining decay time.
Seeking into a sustained note re-strikes the sample at the seek position, consistent
with the transport's reconstruction policy. Harmonic and palm-mute recordings,
release noises and recorded legato transitions are not included. Existing pitch,
velocity and duration interpretation remains; the sampled preset does not claim
the synth's triangle harmonic patch or a realistic specialized articulation.
Far outside the recorded range, pitch remains correct but timbre is more shifted.

## Hosts and library

The ESM and IIFE embeds derive the default sample directory from their own script
URL, independently of any SMuFL override. A host serving assets on another origin
must permit CORS and allow it in the host's connect-src policy.

Elements accept `voice-preset="guitar"` and
`sample-base="https://example.test/samples/shinyguitar-v1"`.
The `sampleLoader` property can instead supply decoded buffers:

```ts
import { NativeSink } from 'mnx-lab/audio';

const sink = new NativeSink({
  voicePreset: 'guitar', // or (voiceId) => a preset chosen from performance.voices
  sampleBase: '/my-assets/shinyguitar-v1',
});
// Call unlock from the Play gesture before scheduling.
await sink.unlock();
```

`GuitarSampleLoader` receives the sink's context and returns a bank containing
`{ file, midi, layer, take, buffer }` samples. `loadGuitarSamples(context, base)`
provides the standard cached loader; `setGuitarSampleBase(base)` changes the
default for future loads. The npm package exports files through
`mnx-lab/samples/shinyguitar-v1/*`; hosts copy/serve them or supply their own loader.
Bare Node imports and idle construction perform no fetch or context creation.

## Evidence

`guitar-samples.test.ts` pins asset integrity, provenance, complete layers/takes,
nearest-root selection and the download budget. `smoke:audio` decodes all 48 real
samples and measures onsets, +200-cent bend, legato without re-attack, independent
voice pitch, cancellation, release and sustained-note seek reconstruction. It also
checks player stop-during-load and visible failure/recovery. Existing oscillator
checks run unchanged. Both embed-format smokes load Guitar from the artifact's
origin and prove zero sample requests before selection; the package smoke checks
the installed assets and lazy API.

These checks are not a human listening approval. The existing performance,
traversal and unrolled review obligations remain in the standing ledger.
