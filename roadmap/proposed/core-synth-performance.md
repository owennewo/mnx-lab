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

## Progress

- **9 Oct 2026: step 1 signed off acoustically** by the lead ("The thwack is signed off
  acoustically, I like it"). It waits on branch `synth-perf-thwack` for adoption at the end.
  - **What it became.** In-loop tension modulation was tried first (kept as
    `dsp/engine2-experiments/stage7-tension.dsp`). It cost 20–25% because the loop delay
    became per-sample, and the planner already had the same pitch glide for free (the
    setup's tension law).
  - **The adopted form, an "attack soak"** (`stage7-soak.dsp`):
    - a velocity² envelope per string drains a hard pluck's extra energy (treble faster);
    - the drained signal sounds through the design's body modes, pitched with the note;
    - the glide is the planner's tension law.
  - **The editor's Attack tab** holds Thwack, Thwack time, Thwack body, Thwack treble, Glide
    and Glide time, with a Thwack On/Off button for A/B listening.
  - **Thwack body is calibrated per design** from its resonance table
    (`plucked-body.js`): averages at body 1 span 5.4–7.8 dB across the factory designs,
    where they spanned 2.5–7.9 uncalibrated (bright metallic's resonances sit above most
    of a note's energy).
  - **Cost** (Node, i7, median ms per audio second and 99th-percentile block):

    | Workload | Old thwack | Thwack off | New thwack |
    |---|---|---|---|
    | Guitar strums | 61.8 · 0.84 ms | 43.0 · 0.24 ms | 47.1 · 0.25 ms |
    | Fingerpicking | 47.8 · 0.28 ms | 42.1 · 0.22 ms | 47.5 · 0.27 ms |
    | Band groove | 91.6 · 1.03 ms | 59.1 · 0.37 ms | 63.8 · 0.38 ms |
    | Reference session | 81.1 · 0.70 ms | 65.7 · 0.32 ms | 71.2 · 0.37 ms |

    The old thwack's spikes are gone. The new one costs 8–13% over none: the body is 6–9%,
    the soak about 2%. Pausing the body while nothing soaks saves only ~1%, because an
    envelope lasts ~1.4 s and real music plucks more often than that.
  - **Learnings.**
    - A loss in a waveguide loop is met once per pass (f times a second), not once per
      sample.
    - FAUST's WASM backend turns `x*x` into a per-sample `pow` call; `x*max(0,x)` avoids it.
    - Synth tests run one file at a time under a memory cap when the engine is replaced: a
      failing `deepEqual` on two wasm Buffers once grew to 12 GB.
- **9 Oct 2026: the master limiter landed on main** (c192f6b6), outside this plan's steps:
  3 ms look-ahead, soft knee and two-stage release, signed off by the lead while listening
  to step 1. All output is 3 ms later than its scheduled frame (`MASTER_LOOKAHEAD_SECONDS`).
- **9 Oct 2026: the device baseline and step 2.** Traces from the lead's phone and tablet
  (`?trace`, `src/audio/playbackTrace.ts`):
  - **Average load is fine:** phone 25–30%, tablet 35–45% of real time. The room bus is
    40–45% of the guitar's cost on both.
  - **The skips are stalls, not load.** Most are planner `schedule` batches on the audio
    thread (10–38 ms on the tablet), plus `configure` (105–185 ms) at the start of a page's
    first play, and 2–5 underruns about 0.7 s into every play. This is step 4's target.
  - **Step 2 settled on `balanced`, now the studio's default** (`hostPort.ts`). On the
    tablet the browser's default buffer gave 12 underruns in the first 10 s and 5 after;
    `balanced` gave 2, then none.
  - **`playback` was rejected.** It halved the audio thread's cost per second on both
    devices, and the phone played it clean. But on the tablet it skipped below the page
    (the audio thread never missed a deadline) and the delay measured at the speaker grew
    from 1.8 to 2.8 s over 30 s.
  - **Browsers misreport output latency.** The tablet reported 40 ms for `playback` while
    the sound came 2 s late. The cursor now follows `getOutputTimestamp()` (15a8cc57).
  - **A chunky audio clock needs a lookahead.** With big buffers, `currentTime` advances in
    chunks; the transport's backlog guard then restarted playback in a loop until its
    lookahead became 1 s (9cf5f81c).
  - **The remaining steps are measured on the laptop**, with one Android round at the end to
    confirm them together. Stalls on the laptop are about a quarter of the tablet's, so a
    step is judged by the stall times the trace records, not by whether the laptop skips.
- **9 Oct 2026: step 4, first part: a cheaper re-plan, still on the audio thread.** Every
  `schedule` batch re-plans the guitar's remembered notes (about 20: two seconds back, a
  second and a half ahead). Measured on Vestapol (`harness/tools/plan-stalls.ts`, with
  `plan-bench.ts` replaying the captured planner inputs):
  - **Where the time went:** 55% was `latestPluckEvents`, mostly a regular expression and a
    built string per event; most of the rest was re-making pitch events already in the past,
    which the engine throws away.
  - **The changes:** strings are read by character code; there is one copy per event; the
    planner skips pitch events before the engine's position. The worklet's warm-up re-plans
    five small batches, with a vibrato and a bend, so the planner is compiled before the
    first note.
  - **The engine's events are identical** (hashed over 177 captured re-plans, and a test).
  - **Results on the laptop:**

    | | Before | After |
    |---|---|---|
    | Re-plan alone (warm) | 1.1 ms | 0.21 ms |
    | `schedule` median | 1.7 ms | 0.5 ms |
    | `schedule` p90 | 2.5 ms | 0.7 ms |
    | Worst first-seconds batch | 3.1 ms | 1.4 ms |

    The warm-up costs about 17 ms more, once per page.
  - **Expected on the tablet:** the tablet ran about 4–8× the laptop's times, so a 10–38 ms
    stall should now be about 3–10 ms. Moving planning to a Worker stays on the list in case
    the end-of-plan Android round still shows stalls.
- **9 Oct 2026: step 8, first part: the room recomputed its filters every sample.** Its
  decay and damping were smoothed inside the DSP, so FAUST rebuilt zita's eight delay-line
  filters every sample: 8 `exp`, 8 `sqrt` and a `cos` a sample, each a call out of the
  WebAssembly. Drive (gain, tone) and echo (tone) had smaller versions of the same thing.
  - **The change:** the DSP takes those controls as they are, once per block. The host glides
    them a block at a time with the same 40 ms time constant (`Glides`, the types' `glide`
    lists in `blocks.js`).
  - **Results** (Node, ms per audio second):

    | | Before | After |
    |---|---|---|
    | Room | 13.7 | 3.7 |
    | Drive | 4.2 | 2.8 |
    | Echo | 1.9 | 1.4 |
    | Reference session, whole | 87 | 69 (−21%) |

    The room was about 40% of the guitar's cost on the phone and tablet.
  - **Sound:** the 15 references with a room or those effects were re-captured. Each
    differs only from about 0.16 s on, at −65 to −86 dB. The old smoothing started from
    zero, so a room began short and dark for its first ~0.2 s; it now starts as set. On
    the multi-part mix the difference is −134 dB (rounding).
  - **Not done:** sizing the room for 48 kHz saved only another 5%, and would break devices
    that run at 96 kHz. A half-rate room or a 4-line network can wait for the device round.
- **9 Oct 2026: the guitar loop (steps 5 and 7), measured on the stage 7 soak engine.** It
  costs about 29 ms per audio second on the laptop, guitar alone. Unlike the room, there
  are no transcendental calls in its sample loop. Switching parts off one at a time
  (strums and fingerpicking):

  | Part switched off | Saving |
  |---|---|
  | Loss-target smoothing | 8% |
  | 4-tap Lagrange delay, made linear | 8% |
  | Thwack body | 6–8% |
  | Bridge scatter | 3% |
  | Radiation modes | 2–4% |
  | Output filters | 1–2% |
  | Diagnostic outputs | 0% |
  | Denormal flushing (`-ftz 0`) | 2.4–4× slower |

  The rest, about two thirds, is the 12 string loops' plain arithmetic.
  - **Excitation.** Removing it "saved" 20%, but that was strings left silent. It is on for
    only 8.5% of string-blocks (about 1.5 ms/s), and its 0.1 s window floor does not
    matter.
  - **Loss smoothing stays:** without it, renders differ by −12 to −19 dB.
  - **Taken, on the experiment branch:** plain notes' pitch events now fall on
    render-quantum boundaries (a 256-frame grid in host frames). Before, they split the
    engine's blocks, and each split re-ran the DSP's per-call setup (about 5 µs). Calls per
    audio second fell from 680–830 to about 385, about 7%; renders differ by −55 to −62 dB.
  - **Step 5 rejected.** I built FAUST's C output with clang 21 for WebAssembly, with the
    same math imports.

    | clang build | Saving |
    |---|---|
    | `-O3` | 1–2% |
    | with SIMD | about 2% |
    | with fast-math (a sound change at −56 to −70 dB) | 3–5% |

    V8 already optimises FAUST's WebAssembly about as well, so a second pinned toolchain,
    and redoing the knock-guard and memo transforms, is not worth it. (FAUST 2.81.10's C
    backend also writes a malformed cast for `-ftz 2`.)
  - **Step 1 adoption note:** with the soak engine, a dead-muted note is −34 dB after
    80 ms where the conformance test wants −40. Two plucked tests fail on the branch for
    this.
- **9 Oct 2026: step 10, a Light sound in the studio.** The Instruments sheet has a Sound
  choice, Full (the device's rate) or Light (32 kHz), kept per browser
  (`mnx-studio.sound`). A change rebuilds the synth, since a context's rate is fixed.
  - **Cost:** at 32 kHz the whole host costs 31–34% less (guitar, keys, kit and room alike).
  - **Sound, against 48 kHz:**
    - tuning matches within 0.15 cents, and 63–500 Hz within ±0.6 dB;
    - sustained notes lose 1–6 dB at 2–8 kHz on most designs: the 4-tap Lagrange
      interpolation takes more treble per loop pass at the lower rate;
    - above 12 kHz drops 7–13 dB (bandwidth).
    The lead listened to pairs of the same pieces and kept it as an option.
  - **A bug it found:** the guitar's fixed 18 kHz output low-pass was unstable at 32 kHz
    (every note turned to NaN within 20 ms). It is now min(18000, 0.45·SR), bit-identical
    at 44.1 and 48 kHz; the engine is republished with that one change.
  - **Not done:** compensating the interpolation's extra treble loss at 32 kHz in the
    loss filter.
