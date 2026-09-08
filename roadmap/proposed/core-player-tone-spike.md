# Tone.js spike — what the renderer can and cannot be asked to do

> **Status: proposed 2026-09-08.** Campaign:
> [core-campaign-player.md](core-campaign-player.md), item 5. **Research, not a
> feature.** Runs any time, must land before item 6. Its output is a findings entry in
> the campaign log and the signature of the adapter item 6 builds; any code it writes is
> thrown away.

## Why a spike and not a guess

The campaign's second decision — Tone as a renderer, never the model — was taken from
memory of the Tone API. Four things in that memory decide item 6's shape and none of
them has been checked in this repo:

1. **Does `import 'tone'` throw under Node?** The layer rule says `audio/` stays
   Node-importable. If the bare import touches `window` or `AudioContext`, the adapter
   must be behind a dynamic import in a module `engine/headless.ts` and the harness
   never reach — and the dependency-cruiser rule is written to enforce exactly that.
   If it does not throw, the rule can be looser and a fake-context smoke test becomes
   possible.
2. **Can `Tone.Offline` render under Node** with a standardised-audio-context polyfill?
   If yes, a smoke test can render one scenario to a buffer and assert *something
   sounded at the right second* — the only automated check of the adapter the campaign
   would ever have. If no, the adapter is manual-only, and the doc says so.
3. **Per-voice pitch.** Does a mono synth's `detune` (or `frequency`) signal ramp
   without clicks at the rates a bend needs (a whole tone over 200 ms; vibrato at
   5 Hz)? Does `PolySynth` really lack per-voice detune? This decides whether
   string-per-voice is six `Synth`s, six `MonoSynth`s, or something else.
4. **Scheduling model.** Schedule in **our** seconds (Transport at a fixed tempo,
   `Part` events at absolute offsets, rate changes handled by rescheduling) versus
   Tone's ticks with `bpm` automation from our tempo map. The first keeps the tempo
   map ours; the second gets pause/seek/loop for free but makes Tone's `position`
   the truth about bars, which contract §2 forbids. Measure the cost of the first.

Also: the installed size of the ESM build, and what `import()` on first play costs the
embed face — the embed is the face that pays for a dependency.

## Deliverable

A **findings** entry under the campaign's *Progress + learnings*, answering the four
questions with the version pinned, plus:

- the `src/audio/tone/` module boundary and its dependency-cruiser rule, drafted;
- the adapter interface item 6 implements — `Sink` with `schedule(events, at)`,
  `cancel()`, `setRate()`, per-voice `bend(voice, cents, at)`;
- a go / no-go on Offline rendering under Node.

No product code. No change to `package.json` on `main` — the spike installs Tone in its
own worktree and item 6 adds the dependency for real.
