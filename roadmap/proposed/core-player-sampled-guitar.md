# A sampled guitar — timbre, and the asset question that is the whole item

> **Status: proposed 2026-09-08, revised the same day.** Campaign:
> [core-campaign-player.md](core-campaign-player.md), item 12. Needs item 7. A
> practice item.

## Agreement block (campaign contract)

- **Pure before audible (§1).** Nothing musical changes; a voice's source swaps from
  oscillator to buffer. **Precondition, from the spike**: the chosen sampler must offer
  per-voice pitch control (detune or `playbackRate` automation) and re-pitch without
  re-attack, or bends and hammer-ons stop working the moment samples are switched on.
  If Tone's `Sampler` does not (item 4 checks), the sampled voice is a native
  `AudioBufferSourceNode` per string regardless of backend.
- **Proof (§4).** Ear, stated plainly; plus the item 6 Offline smoke re-run with
  samples to prove onsets still land.
- **Dependencies (§5) — the real question.** Samples are assets; no R2, no asset
  pipeline. Argued here before anything is built:
  1. **Bundled** minimal set (one sample per string, pitch-shifted): ~1 MB on every
     face, including the IIFE embed, which cannot split it out. Probably wrong.
  2. **Fetched on demand** from the deployed site's static output — the workbench's
     "static build output alone" rule holds; the library and embed faces then depend
     on a URL or a host-supplied loader.
  3. **User-supplied** via practice settings — nothing shipped, no licence question,
     least convenient.
  A shipped set's licence is verified before vendoring, the MusicXML campaign's rule.
- **Practice gain.** "A guitar playing the tab" rather than "a synth playing the
  pitches" — where per-string timbre first becomes audible.

## Design

A `voicePreset` on the sink selects synth or samples per part; palm mute and harmonic
sample layers only if the set has them, else the compiler's approximation stands.

## Start condition

The dependencies named above are technical prerequisites. Campaign clause 7 additionally
requires reviewer items 1–10 to be verified before this practice item starts.
