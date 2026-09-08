# A sampled guitar — timbre, and the asset question that is the whole item

> **Status: proposed 2026-09-08.** Campaign:
> [core-campaign-player.md](core-campaign-player.md), item 11. Needs item 7. A
> practice item.

## Agreement block (campaign contract)

- **Pure before audible (§1).** Nothing musical changes; the string voice's synth is
  swapped for a sampler per string. The compiler is untouched.
- **Proof (§4).** Ear. The item states that plainly and does not invent a test.
- **Dependencies (§5) — the real question.** Samples are assets, and this repo has
  ruled out R2 and has no asset pipeline. Three options, argued here before any is
  built:
  1. **Bundled**, a minimal set (one sample per string, pitch-shifted by the sampler):
     ~1 MB, paid by every face including the embed. Simplest, and probably wrong for
     the embed.
  2. **Fetched on demand** from the deployed site's static assets — the workbench's
     "static build output alone" rule still holds, since the files are in `dist/`,
     but the library and embed faces would then depend on a URL.
  3. **User-supplied** via the practice settings — no asset shipped, and the
     free-licence question disappears; the least convenient.
  A licence for any shipped set is verified before vendoring, the same rule the
  MusicXML campaign applied to fixtures.
- **Practice gain.** The difference between "a synth playing the pitches" and "a guitar
  playing the tab". Also where per-string timbre first becomes audible, which is the
  payoff of the string-per-voice decision.

## Design

Per-string `Sampler` (or the spike's recommendation) with the same detune-driven bend
path as the synth, so items 6 and 8 need no change; a `voicePreset` on the adapter
selects synth or samples; palm mute and harmonics get their own sample layers only if
the chosen set has them — otherwise they remain the compiler's velocity/duration
approximation.
