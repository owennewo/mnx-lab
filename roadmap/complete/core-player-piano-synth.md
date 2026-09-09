# A piano pack, and a synth worth hearing

> **Status: BUILT 2026-09-09.** Campaign:
> [core-campaign-player.md](../inprogress/core-campaign-player.md), item 14.
> Three changes that arrived together because they answer one complaint — *"the
> synth sounds super bad"* — from three directions: the oscillator voice is
> rebuilt, a piano pack is added, and the sampled-instrument vocabulary stops
> calling everything a guitar.
>
> 1620 tests pass, `check:scenarios` OK, `npm run build` green, `smoke:audio`,
> `smoke:lib` and `smoke:embed` all pass. `git diff -- scenarios/` clean.
>
> **Listening review is owed**, as for item 12. Everything below is measured;
> none of it is heard. Registered in
> [lab-verify.md](../inprogress/lab-verify.md).

## Why the synth sounded bad, precisely

An `OscillatorNode` of type `sine` (a triangle for harmonics) with a 5 ms ramp
up, a level hold and a 5 ms ramp down, at a fixed amplitude of 0.2. That is a
test tone gated on and off, and it failed in four separable ways:

| Fault | Consequence |
|---|---|
| One partial | Simultaneous notes beat against each other instead of separating; chords turn to mush |
| No onset transient | Rhythm is carried by the noise burst at a note's onset, so fast passages smear |
| No spectral movement | Nothing distinguishes a struck instrument from a drone |
| One level for every register | A pure sine at E2 is near-inaudible on a laptop speaker: no harmonics to imply a fundamental the speaker cannot reproduce |

The fourth is the one most likely to have prompted the complaint, and it is
invisible on monitors — it only bites on the speaker most people review on.

## What was done, and what was deliberately not

Three of the four are fixed **without touching amplitude over time**:

- **Spectrum.** A `PeriodicWave` of sixteen partials at `1/n^1.6` with the even
  partials halved — body without an untouched saw's nasal edge. Cached per
  `BaseAudioContext`, since a `PeriodicWave` is immutable and rebuilding it per
  note would allocate on the critical path for nothing.
- **Onset.** A per-voice lowpass opening at `14 × f0` and falling to `5 × f0`
  over 250 ms, bounded to 400 Hz–16 kHz. Bright-then-dull is the gesture every
  struck or plucked instrument shares, and it reads as *struck* even at a
  constant level.
- **Register.** Level tilted by `(440/f0)^0.32`, clamped to 0.7–2, anchored at
  A4 so it redistributes rather than raising everything.

**The amplitude envelope stays flat, and that was a finding rather than a
preference.** A decay to a sustain floor was built first. It broke a measured
contract: `smoke:audio` reads a hammer-on's velocity as a plain RMS ratio
between two fixed windows, and that ratio equals the velocity ratio **only while
the envelope is flat**. Measured, the decay moved it from 0.687 to 0.905 — not
because velocity stopped being applied, but because the two windows then sit at
different phases of their own envelopes. The release is likewise pinned: a
released voice must be silent within 5 ms, which a ringing synth is not.

The decay could be had by making that assertion phase-aligned to each attack. It
was not worth redefining a velocity contract for a fourth improvement when the
filter already supplies the struck character, and repeated notes were never the
argument for it — the gate already closes between them.

## The piano

`public/samples/upright-piano-v1`, from FreePats **Upright Piano KW** — a Kawai
upright recorded in a living room, CC0, small SFZ+FLAC distribution dated
2019-07-03. **26 files, 1,500,324 bytes, roots MIDI 24–107.**

The range is the point. Every guitar pack covers 36–85; a keyboard or vocal
score played on one is transposed to the edge of its compass. The piano is the
first pack that covers the staff at both ends, and it is the instrument notation
is *read* on.

Sourcing followed item 12's form exactly: the manifest pins the upstream page,
the distribution date, the archive SHA-256, the exact ffmpeg conversion, and per
sample the original filename, source and derived SHA-256, byte count and
duration; `LICENSE`, `SOURCE.txt` and `mapping.sfz.txt` sit beside it. Root
pitches are read from the SFZ's `pitch_keycenter`, never inferred from filenames.
The upstream bass sustain loops are not implemented, as with the other packs.

Gain **0.205504**, chosen by measuring every pack's energy over the shared
register MIDI 55–67 and putting the piano at the four guitars' mean. The two
grands on the same FreePats page are **CC-BY 3.0, not CC0**, so they were
rejected: every pack here is CC0 and that uniformity is worth more than a
brighter recording.

**Synth stays the default.** The property that ordinary playback downloads
nothing is worth more than a better first impression, and it is now a much
smaller sacrifice.

## The rename

The vocabulary said `guitar` from `sampleSelection.ts` all the way out to the
published `mnx-lab/audio` face. A piano made nine exported names wrong.

`SAMPLE_PRESETS`, `isSamplePreset`, `SamplePreset`, `InstrumentSample`,
`loadSamplePack`, `setSampleBase`, `SamplePackBank`, `DecodedSample`,
`SamplePackLoader`; `guitarSamples.ts` → `samplePacks.ts`;
`guitar-samples.test.ts` → `sample-packs.test.ts`; `guitar-smoke.ts` →
`sample-pack-smoke.ts`; `docs/player-sampled-guitar.md` →
`docs/player-sample-packs.md`.

Every old name is re-exported from `src/entries/lib/audio.ts` as a deprecated
alias, **and only from there** — nothing in `src/` reaches for one. `smoke:lib`
asserts each alias is the *same binding* as the name it aliases, not merely that
both exist, which is the only version of that test that catches a drifted alias.

## Two tests were changed, both because they pinned more than their subject

Recorded because "the change broke a test, so the test changed" is exactly the
move that needs its reasoning in the open:

1. **`sample-packs.test.ts` sliced its preset list positionally** —
   `SAMPLE_PRESETS.slice(1)` meant "every pack except the archtop, which the
   detailed assertions above cover". Putting the piano at the head silently
   changed *which* pack was skipped, and the archtop has no `SOURCE.txt`, so the
   loop failed on a file that was never missing. Now selected by id.
2. **The same file capped each pack at 1.5 MB.** That read as a size budget but
   was really a root-count cap: it broke on a pack covering 84 semitones instead
   of 49. Replaced by a per-*sample* weight cap, which is what actually guards
   against someone shipping 48 kHz stereo, plus a new assertion on the whole
   tree's size — the number that actually matters on a free Workers plan with no
   object store behind it.
3. **`smoke:audio` asserted master volume against `0.2 × 0.25 ÷ √2`.** Amplitude
   times volume over a *sine's* crest factor — which made the waveform part of a
   contract about `setVolume`. It now renders at two volumes and asserts the
   ratio is 2, which tests the intent and is immune to timbre.

## What is owed

A human has to listen. The synth's spectrum, its filter sweep and the register
tilt are all measured and none of them is *heard*; the piano's gain matches the
guitars by energy in a shared register, which is not the same as sounding equally
loud. The exponents (`1/n^1.6`, `0.32`) and the filter's `14 × f0` → `5 × f0`
are the obvious knobs if it is wrong.
