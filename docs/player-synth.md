# Player synth

The player plays scores on the synth (`synth/`, its own workspace and app at `/synth/`)
through the synth's instrument host. This replaced the old Web Audio sink — oscillators and
sample packs — on 2026-10-09 (roadmap/complete/core-campaign-synth.md). The contract between
mnx-lab and the synth is `synth/docs/contract.md` (mnx-sound/2).

## From score to sound

| Step | Where | What |
|---|---|---|
| Score → performance | `src/audio/performance.ts` | the compiler (unchanged): sounding events per voice, curves, legato, tempo map |
| Performance → contract stream | `src/audio/contractStream.ts` | notes in seconds with fingering, bend/vibrato, legato, palm/dead mutes and harmonics as intent (the compiler's lowering undone), kit pieces, tempo controls |
| Parts → setup | `src/audio/hostSetup.ts` | the part router: kit, guitar on the score's own strings and capo, Basic keys otherwise; the person's instrument choice (a factory design or an imported part rig); level and mute as channel strips; one room and master per piece |
| Playback | `src/audio/hostBackend.ts` | a `PlaybackBackend`: a transport (player-transport.md) over a silent sink keeps position, highlights, loop, rate and seek; notes go to the host a second ahead, a 0.25 s lead past the guitar's commit horizon |
| The browser | `src/audio/native/hostPort.ts` | `NativeHostPort`: an `AudioContext`, a master gain and the synth's `InstrumentHost`, loaded at run time from the synth's runtime (`setSynthBase`) |

Instrument choices are per person, kept with the piece's view preferences (`PartMixEntry.instrument`,
studio's Instruments sheet; docs/studio-storage.md). Studio never edits an instrument: sounds
are made in `/synth/` and come back as a part rig file (Export part → Import rig…).

## Ready before play

- **Preload.** As the score opens, the port fetches and compiles the host and its DSP, makes
  an `AudioContext` (it starts suspended without a gesture), loads the worklet into it and
  configures the instruments. Play only resumes the context: it resolves in tens of
  milliseconds and the first note sounds at the lead.
- **Warm-up.** Configuring the worklet plays one note per new instrument kind and chain
  through a throwaway host, so V8's lazy WebAssembly compilation happens before the music,
  not in the first audio callbacks (`synth/web/host/host-processor.js warm`).
- **Many players.** The host's download and compile are shared by every player on a page;
  only the first two players prepare their audio ahead of play (a page of many — the review
  page — would otherwise make a context and a worklet each), the rest when played.
- **Idle.** Three seconds after playback stops the context is suspended: a silent host still
  computes every block, which a phone pays for in battery.
- **Forgetting.** The host folds notes that ended two seconds ago into its planners' carried
  state, so each batch plans only the last few seconds — sample-identical to planning the
  whole piece (`synth/tests/forgetting.test.mjs`).

## Strain

The worklet reports its load twice a second. `src/audio/hostStrain.ts` calls it strain when
the host takes more than 70% of the audio thread, or stalls for more than 8 ms, in two
reports running, or Chrome counts an output underrun; reports count only once the music has
sounded for half a second (start-up stalls fall in silence). The play button's border pulses
while strained (`button.primary.strained`).

## Embedding: the player with the synth

The embed (`npm run build:embed` → `dist/embed/`) is one script tag. It locates its own
assets beside its script: `smufl/` (fonts, glyph data) and `synth/` (the synth's runtime:
host code, AudioWorklet, DSP and data — copied by `vite.embed.config.ts` from
`synth/scripts/build_app.mjs`). A page that only shows scores never loads `synth/`.

```html
<script src="https://scores.example/mnx-lab/mnx-lab.js"></script>
<!-- or point at the synth elsewhere: -->
<script src="…/mnx-lab.js" synth-base="https://cdn.example/mnx-synth/"></script>
```

On a page of another origin than the files:

- **The files' server must send CORS headers** for `synth/` (for example
  `Access-Control-Allow-Origin: *`): the host module and the AudioWorklet load in cors mode,
  and the DSP and data are fetched. The `embed` smoke serves the artifact and the page from
  two origins and plays through the synth, in both formats.
- **A page CSP must admit** the files' origin in `script-src` and `connect-src`, and
  `'wasm-unsafe-eval'` (WebAssembly compilation; not `eval`).

The embed is not deployed today. Serving it from mnx-lab's site would need those CORS
headers on `/synth/` in `public/_headers`.

The library build (`mnx-lab/audio`) exports the same pieces — `performanceToStream`,
`hostSetup`, `HostBackend`, `NativeHostPort`, `setSynthBase` — for an application that
bundles mnx-lab: serve the synth's runtime (`synth/scripts/build_app.mjs`) and call
`setSynthBase(url)` before the first player.

## Proof

- `harness/conformance/contract-stream.test.ts` — every valid corpus scenario becomes an
  event log the synth accepts; techniques travel as intent; a scenario renders without warnings.
- `harness/conformance/host-backend.test.ts` — the backend against the synth's real `HostCore`
  on a manual clock: seven scenarios play every note once, on time, past the horizon; rate,
  seek, pause, loop, mix, rigs, strain and idle.
- `harness/conformance/host-instruments.test.ts` — instrument choices, rig files, stored choices.
- `synth-host` smoke — the worklet in Chrome: notes sounding, highlights, load reports, strain,
  and the multi-part twelve-bar blues at a moderate, flat load.
- `studio-instruments` smoke — the Instruments sheet against the local library.
- `embed` smoke — the synth beside the artifact, on another origin, ESM and IIFE.
