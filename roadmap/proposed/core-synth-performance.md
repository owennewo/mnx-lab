# Synth performance on slower devices

**Status:** proposed, from roadmap/complete/core-campaign-synth.md (9 Oct 2026); steps agreed
with the lead on 9 Oct 2026. The lead: "there may be room for synth optimisations but that will
be for a later plan." Sound may change where a different approach gives similar quality for less
compute; the current engine need not be reproduced bit for bit.

## What is known

- **Where the guitar shows strain.** The guitar is a physical model computing six strings per
  part every block. On a laptop, Classical Gas costs 6–7% of real time; the twelve-bar blues
  (guitar and keys) peaks near a third of the worklet's time in headless Chrome. On the lead's
  Pixel 10 Pro and tablet the play button's strain signal shows on dense passages (Anji,
  Classical Gas), and on the tablet the audio sometimes breaks up there.
- **The first ten seconds.** Playback is most unsteady in the first ~10 s, then settles. The
  cause is not known. The candidates:
  - The planner is JavaScript run on the audio thread, called about twice a second, so it
    reaches V8's optimising compiler only after many calls.
  - WebAssembly runs on V8's baseline tier until the optimised code arrives. The module is
    compiled from bytes (`WebAssembly.compile`), so Chrome's code cache never helps.
  - The audio thread's garbage collector settles as its heap grows.
  - The main thread competes with the audio while the page loads.
- **Average cost per component.** On a laptop (i7-8750H), in ms per audio second (Phase 5 log,
  guitar-faust `plans/chain-campaign.md`, 8 Oct 2026):

  | Component | ms per audio second |
  |---|---|
  | Guitar part | 44.5 |
  | … of which thwack shadows | ~13 |
  | Room bus (zita_rev1) | 15 |
  | Keys | 8 |
  | Kit | 3.8 |

  These are averages; peaks, which are what break up the audio, have not been measured, and
  nothing has been measured on the phone or tablet.
- **The thwack is the most expensive part of the guitar, and mostly quiet.** Each pluck clones
  a full copy of the guitar engine (643 KB of DSP state) and runs it for 100 ms to window a
  knock. Rendering strums and fingerpicking with each factory design, thwack as shipped
  against thwack 0 (Node, room off, 9 Oct):
  - Strums cost 1.7–1.8× as much with thwack on; fingerpicking costs about 1.25×.
  - Six of the ten designs (thwack 0.05–0.15) put it 45–55 dB below the guitar in RMS.
  - It is louder (−31 to −38 dB) on bright-metallic, bridge-electric, muted-jazz and
    soft-nylon.
- **A hard pluck on a real guitar is not a loud soft pluck.** In the Iowa recordings
  (guitar-faust `references/iowa/`; E2, A2 and G3 at pp and ff), each frequency band of the ff
  note was matched to the pp note on its own tail (0.8–1.6 s). The ff note then has extra
  energy that dies away within ~0.3 s:
  - +20 to +46 dB at 4–12 kHz in the first 50 ms
  - +10 to +19 dB in the fundamental region (A2, G3) for the first 200 ms
  - a pitch that starts 18–20 cents sharp and glides down over ~300 ms; pp stays roughly flat

  After that, ff looks like pp scaled up. This is the signature of tension modulation: a hard
  pluck stretches the string, raising its pitch, generating upper partials and pulling on the
  bridge (shaking the body), all in proportion to amplitude squared, so it fades as the note
  decays. The current thwack is an artificial stand-in for this missing physics.
  Caveats: one guitar, one sample per dynamic, and the player may have changed technique for ff.

## How the steps are tried

Each step is an independent experiment against one fixed baseline, and adoption is decided
at the end:

1. **Baseline first.** Pin the starting commit and a benchmark set:
   - the host benchmark workloads, guitar strums and fingerpicking, Classical Gas, Anji and the
     twelve-bar blues
   - measured in Node, in headless Chrome and on the lead's phone and tablet
     (`HostCore.profile`, reported from the page on demand)
   - metrics: mean ms per audio second, worst and 99th-percentile block time, over-budget
     blocks in a live run, and a load timeline over the first 30 s
   - the first-ten-seconds experiment: play a piece straight after load, play it again
     without reloading, and start playback 30 s after load. This tells JIT and heap warm-up
     apart from page-load contention.
2. **Each step in isolation**, on its own branch from the baseline. DSP changes go in new
   isolated stage files (`instrument-stage7-*.dsp`, the engine's own convention) and leave the
   published engine untouched. Each step records its cost against the baseline and, when the
   sound changes, before/after renders for listening.
3. **Adoption at the end.**
   - Steps that leave the sound unchanged are adopted on their measurements.
   - Steps that change the sound go to one listening session together.
   - The adopted steps are then stacked into one candidate and measured and heard again,
     because steps interact: removing the shadows makes every other cost a larger share, and
     a compiler change applies to every DSP variant.
   - The engine is published once, as a new generation; factory designs are re-tuned and
     references re-captured.

Determinism stays a constraint throughout: the worklet stays bit-identical to Node, and
reference renders stay reproducible at a given sample rate (synth/docs/contract.md).

## Steps

1. **A physical thwack: tension modulation.** For each string, keep a running sum of the
   squared signal over its delay line (the stretch), and shorten the loop delay in proportion
   to it, giving the pitch glide and the bright, decaying upper partials. Sum the six strings'
   tension as a bridge force into one shared, gated bank of body modes (each design's 12 modes,
   unused today because the body mix is 0), giving the thud that fades as the strings settle.
   Remove the thwack shadows.
   - **Cost to check:** the fractional-delay coefficients become per-sample instead of
     per-block.
   - **Proof:** rendered pp/ff pairs, run through the Iowa analysis above, should show a
     similar pitch glide and band-by-band excess. Cost is measured against the shadows, and
     the sound is A/B'd against the current thwack per design.
   - **Risk:** the glide moves the start of each note's tuning and needs an amount control.
2. **Playback latency.** `latencyHint: 'playback'` (or a fixed larger latency) for score
   playback in mnx-lab: more buffer and fewer missed deadlines, at no cost to a player. No
   sound change.
3. **Start-up warmth.** Compile the WebAssembly with `compileStreaming(fetch(url))` so Chrome
   caches optimised code across visits, and warm long enough to reach the optimised tier. This
   is judged on the first-ten-seconds timeline. No sound change.
4. **Planning off the audio thread.** Re-plan in a Worker with the same deterministic code, or
   incrementally, so the twice-a-second batch no longer costs the audio thread a spike. No
   sound change.
5. **A better compiler.** Build the same FAUST source through C++ and clang `-O3` to
   WebAssembly and benchmark it against FAUST's direct WebAssembly output. Without fast-math
   the output may stay bit-identical.
6. **One polarisation where two are identical.** On designs with beating 0, exchange 0 and
   loss ratio 1 (dry-small, nail-nylon, muted-jazz), the second loop of each string is a scaled
   copy of the first; computing one halves the strings' cost there. Equal to float rounding.
7. **A leaner string loop.**
   - (a) Fold the dispersion allpass, loss shelf and gain into one filter, and smooth the loss
     targets at control rate.
   - (b) Separately, a first-order allpass instead of 4-tap Lagrange interpolation, checked
     on the bends piece.
8. **A cheaper room.** Size the reverb for 48 kHz (it is built for 96 kHz: 1.9 MB of state),
   then try it at half rate, or a 4-line delay network instead of zita's 8.
9. **Work done only for diagnostics.** In live playback, stop writing the six per-string
   diagnostic outputs, summing their energy every block (`plucked.js`), and generating
   excitation noise for strings whose excitation is off. No sound change.
10. **A 32 kHz context on constrained devices**, chosen before playback starts: ~⅓ less
    compute everywhere, with a 16 kHz bandwidth that phone speakers do not reproduce anyway.
    References are kept per rate.

**Held back unless the steps above are not enough:**
- Rendering ahead in a Worker per part, into a buffer the worklet mixes. This gives hundreds
  of milliseconds of slack and uses more cores.
- A hand-written SIMD string engine with sleeping idle strings.
- A level of detail for quiet or old notes.

## Considered and rejected

- **fp16 or fp8 arithmetic.** fp8 cannot represent a feedback gain like 0.9993 (its largest
  value below 1 is 0.9375), so strings would die within samples. fp16 coarsens long decays and
  raises loop noise. WebAssembly has no shipping 16-bit arithmetic, so neither would be faster.
  Every DSP already runs in 32-bit float with denormals flushed (`-single -ftz 2`).
- **The GPU.** A waveguide is serial per sample, a guitar is 12 parallel loops (a GPU wants
  thousands), a block's 2.7 ms deadline is about one GPU round trip, and WebGPU is not
  available in an AudioWorklet.
- **Quality that adapts to strain mid-piece.** Output would then depend on the device's
  timing and stop being reproducible. Any lighter mode is chosen before playback starts.
