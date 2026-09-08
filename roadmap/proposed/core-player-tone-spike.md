# Audio backend spike — Tone.js versus a native Web Audio sink, measured

> **Status: proposed 2026-09-08, revised the same day.** Campaign:
> [core-campaign-player.md](core-campaign-player.md), item 4. **Research, not a
> feature.** Runs any time, lands before item 6. Output: a findings entry in the
> campaign log, the `Sink` interface, and a backend decision. Any code is thrown away;
> `package.json` on `main` does not change.

## Why a spike and not a guess

The first draft chose Tone.js from memory and promised a lazy chunk it had not built.
Once the transport, tempo map and scheduling are ours (contract §§1–2, 8), what Tone
still provides is: voice objects with envelopes and a detune signal, `Offline`
rendering, and the audio-context unlock dance. A native sink is a few hundred lines
of `OscillatorNode`/`GainNode`/`AudioBufferSourceNode`. The question is which is
cheaper *for this repo*, and it has to be measured.

## Questions, each with a pass/fail

1. **Node import.** Does `import 'tone'` throw under Node? Decides where the
   dependency-cruiser fence goes and whether `engine/headless.ts` needs a dynamic
   import guard. (A native sink has no import cost; its fence is `AudioContext` at
   module top level.)
2. **Offline rendering.** Can either backend render one scenario to a buffer under
   **browser** `OfflineAudioContext`, driven the way `harness/render/render-png.ts`
   drives `google-chrome`? This is the sink's automated test; "not under Node" is not
   "manual only".
3. **Per-voice pitch.** For each backend: does a mono voice's detune ramp a whole
   tone over 200 ms and vibrato at 5 Hz without clicks; can voices be re-pitched
   **without re-attack** (item 8's hammer-on flag)? Confirm — not from memory — whether
   Tone's `Sampler` exposes any per-voice detune, since item 12 depends on it.
4. **Bundle cost on both embed formats.** Build `build:embed` (IIFE **and** ESM) with
   each backend and report sizes. Vite does not split an IIFE, so the options are:
   audio bundled into the IIFE, a separate optional module the host loads, or the host
   supplying an audio context. The spike recommends one.
5. **Scheduling.** With the transport ours, confirm each backend accepts absolute
   audio-clock times for `start`/`stop`/`setValueAtTime` and cancels cleanly
   (`cancel(from)` semantics), which is all the transport needs.

## Deliverable

- The findings entry: five answers, versions pinned, sizes in a table.
- `Sink`: `schedule(events, audioTime)`, `cancel(fromAudioTime)`, `release(voice,
  audioTime)`, `bend(voice, cents, audioTime)`, `setRate` not here (rate is the
  transport's), `unlock()`, and `now()` from the audio clock.
- A recommendation with the one-line reason, for the campaign to adopt in item 6.
