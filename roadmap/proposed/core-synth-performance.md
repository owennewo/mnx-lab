# Synth performance on slower devices

**Status:** proposed (stub), from roadmap/complete/core-campaign-synth.md (9 Oct 2026). The
lead: "there may be room for synth optimisations but that will be for a later plan."

## What is known

- The guitar is a physical model computing six strings per part every block. On a laptop,
  Classical Gas costs 6–7% of real time (after forgetting, Phase 9); the twelve-bar blues
  (guitar and keys) peaks near a third of the worklet's time in headless Chrome.
- On the lead's Pixel 10 Pro and tablet the play button's strain signal shows on dense
  passages (Anji, Classical Gas); on the tablet the audio sometimes suffers there.
- Start-up is solved (warm-up, ready before play); what remains is steady-state cost.

## Candidate work (to be planned, not committed)

1. **Measure on the devices**: per-part cost from the host's profile (`HostCore.profile`),
   reported from the page on demand, on the lead's phone and tablet, for a small set of
   pieces — so changes are judged on real numbers.
2. **Idle strings**: skip computing a string whose energy has fallen below audibility until it
   is plucked again (the keys already compute only inside a voice's active windows).
3. **A lighter guitar mode** for constrained devices: fewer partials or a cheaper body, chosen
   when strain persists, with the listening comparison the synth's campaigns use.
4. **Effects cost**: the room and any rig chains per part; share or simplify where inaudible.
5. **Larger render blocks or a higher-latency context** (`latencyHint: 'playback'`) on devices
   that struggle: more buffer, fewer deadline misses, at no cost to a score player.
6. **The keys**: the piano is Basic keys since the sample packs went (S25); a better piano is
   its own plan, with its own cost.

Determinism stays a constraint: whatever changes must keep the worklet bit-identical to Node
and the reference renders reproducible (synth/docs/contract.md).
