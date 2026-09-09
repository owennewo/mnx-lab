# Sampled guitar

Choose a guitar from the **Sound** menu, then Play. Synth remains the default.
Changing sound during playback pauses at the current position, prepares the new
preset and resumes there. Stop cancels that pending start. A load error is visible;
retry Play or choose Synth. No samples are downloaded for ordinary synth playback.

## Guitar 1: source and delivery

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
selected pack on first play; concurrent loads and decoded buffers are shared within
an audio context, independently for each preset. Failed loads are evicted for retry.
Closing a player releases its context; browser HTTP caching may reuse downloaded files for a new player.

## Guitar 2, 3 and 4: separate recordings

| Sound menu | Recording source | Converted pack |
|---|---|---|
| Guitar 1 · Archtop | Karoryfer Shinyguitar microphone | 48 samples · 3.58 MB |
| Guitar 2 · Nylon | [FreePats Spanish classical guitar](https://freepats.zenvoid.org/Guitar/acoustic-guitar.html), Roberto, 2019-06-18 | 15 roots · 0.68 MB |
| Guitar 3 · Steel | Jeff Learman's 2017 Martin HD28 Vintage Series, [Discord SFZ GM instrument](https://github.com/sfzinstruments/Discord-SFZ-GM-Bank/blob/7a9c478fe331f94f246d33332f0adedb25bbbe27/Discord%20GM/Melodic/026-Acoustic%20Guitar%20(steel).sfz) | 15 roots · 0.68 MB |
| Guitar 4 · Clean electric | [FreePats Fender FSBS clean bridge](https://github.com/freepats/electric-guitar-FSBS-clean/tree/192cf0d9bf2c4ba6ead8e3524ba3f78818e4fe91) | 13 roots · 1.31 MB |

All three new sources explicitly declare CC0. Their pack directories
(spanish-guitar-v1, martin-guitar-v1, fender-guitar-v1) preserve the declaration
in SOURCE.txt, the full licence, and source SFZ mappings. Manifests pin source
and derived SHA-256 hashes; nylon additionally pins the original archive hash,
and steel/electric pin immutable Git tree revisions.

The additional packs use mono 24 kHz/16-bit FLAC, retaining up to eight seconds
of the recording with an 80 ms final fade. They contain one recorded layer/take
per root, with continuous velocity gain, rather than duplicated fake layers.
They do not implement the upstream SFZ sustain loops or synthesized envelopes.
A single measured gain per pack approximately matches mid-register body levels:
nylon 0.220283, steel 0.3697, electric 0.172295. Guitar 1 keeps its original 0.65.
These are level adjustments to different recordings, not EQ variants of Guitar 1.

Only the chosen pack loads. Switching presets retains playback position; a later
selection wins even if an earlier download finishes afterward. Returning to a
loaded preset reuses its decoded bank. Switching while loading continues the
pending playback intent; Stop clears that intent.

## Playback contract and limits

Each logical voice gets its own AudioBufferSourceNode, preserving the compiler's
string ownership. Sample selection uses pitch rather than physical string:
different strings share the same recorded pitch bank. Nearest-root selection
limits pitch shifting. For Guitar 1, velocity below 0.5 selects layer 2, otherwise
layer 4, with
continuous gain scaling. Guitar 1 alternates its two takes on successive attacks.
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

Elements accept `voice-preset="guitar"`, `guitar2`, `guitar3`, or `guitar4`, and
`sample-base="https://example.test/samples/shinyguitar-v1"`.
The legacy sample-base overrides Guitar 1. The sampleBases property accepts a
map from preset ids to pack URLs. The sampleLoader property can instead supply
decoded buffers, receiving (context, presetId):

```ts
import { NativeSink } from 'mnx-lab/audio';

const sink = new NativeSink({
  voicePreset: 'guitar2',
  sampleBases: { guitar2: '/my-assets/spanish-guitar-v1' },
});
// Call unlock from the Play gesture before scheduling.
await sink.unlock();
```

`GuitarSampleLoader` receives the sink's context and selected preset id and returns a bank containing
`{ file, midi, layer, take, buffer }` samples. `loadGuitarSamples(context, base?, preset?)`
provides the standard cached loader; `setGuitarSampleBase(base, preset?)` changes that preset's
default for future loads. Both preset arguments default to Guitar 1. A native
voicePreset callback requires samplePresets to name its needed banks before
unlock (legacy default: ['guitar']). The npm package exports files through
`mnx-lab/samples/<pack-directory>/*`; hosts copy/serve them or supply their own loader.
Bare Node imports and idle construction perform no fetch or context creation.

## Evidence

`guitar-samples.test.ts` pins asset integrity, provenance, complete layers/takes,
nearest-root selection and the download budget. `smoke:audio` decodes all 91 real
samples across the four banks and measures onsets, +200-cent bend, legato without
re-attack, independent voice pitch, cancellation and release. Sustained-note seek
reconstruction is also checked on Guitar 1. It also
checks player stop-during-load, out-of-order bank loading, cache reuse and visible
failure/recovery. Existing oscillator
checks run unchanged. Both embed-format smokes load Guitar from the artifact's
origin and prove zero sample requests before selection; the package smoke checks
the installed assets and lazy API.

These checks are not a human listening approval. The existing performance,
traversal and unrolled review obligations remain in the standing ledger.
