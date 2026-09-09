# A sampled guitar — timbre, and the asset question that is the whole item

> **Status: in progress 2026-09-08, revised the same day.** Campaign:
> [core-campaign-player.md](../inprogress/core-campaign-player.md), item 12. Needs item 7. A
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

## Accepted implementation agreement — 2026-09-09

The user authorized item 12 ahead of outstanding reviewer approvals; those approvals
remain owed. Item 11 is explicitly won't-do. Native buffer voices reuse the existing
transport and automation, with per-voice playbackRate and detune. No audio dependency.

Use a reduced, pinned CC0 Karoryfer Shinyguitar microphone pack, fetched on selection
from static public assets. Several root pitches, two velocity layers and two alternate
takes limit shifting and repeated attacks. The upstream mapping has no string identity:
voices are independent per string but recorded timbre is shared. No claim of recorded
palm-mute, harmonic or legato layers. No infinite sustain loop; recorded decay is retained.
The default synth stays available, and selecting Guitar explicitly chooses guitar
timbre even for scores with no instrument metadata. Kit voices stay on the synth.

The embed resolves samples alongside its script, the library accepts a base URL or
host loader, and the player exposes loading/error states without silently substituting
synth. No sample download on ordinary page load. Record source hashes, CC0 text and
conversion command before shipping. Offline tests cover onsets, independent bends,
legato, cancellation and release with real samples; browser checks cover loading,
switching, failures and both embed formats. Musical evidence remains byte-identical.

## Implementation

The [public contract](../../docs/player-sampled-guitar.md) records the 3.6 MB CC0
microphone pack, static delivery, host overrides, per-voice automation and decay/
articulation limits. Synth remains available through the Sound selector.
The [listening obligation](lab-verify.md#sampled-guitar-listening--2026-09-09) is
registered separately from existing performance approvals. No golden changed.

Real-buffer audio checks, both cross-origin embed formats, the workbench/Listen
smoke and an installed Node package check pass. The package excludes the library
build's duplicate public-directory copy. An existing embed metadata assertion
needed to write the newly adopted document work metadata instead of wrapper fields.
