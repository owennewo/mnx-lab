# recording-align

Find where each bar of a studio piece falls in a recording, and write that as the piece's
sync. Driven by the [`sync-recording` skill](../../.claude/skills/sync-recording/SKILL.md),
which holds the judgement; these scripts hold the mechanics. [RUNS.md](RUNS.md) is the
record of every run and what it taught.

Two halves, split by what each needs:

- **`align.ts`** (vite-node) speaks studio's language through studio's modules: the piece as
  the library stores it (`fetch`), the score as the player performs it (`score`), the
  recording's audio (`audio`), and the sync as the sync bar edits it (`sync`, built with
  `segmentsFromBarStarts` in `src/model/syncSegments.ts` and checked by studio's decoders).
- **`align.py`** (the MuScriptor environment's Python, below) does the audio: `transcribe`
  (MuScriptor), `check` (key/capo, tuning, density), `structure` (the bar search and its report: free order by
  default, or held to the score's order with `--fixed-order [--near-sync [s]]`) and `selftest` (the search on synthetic performances).

Each command reads and writes files in `--out`:

| file | written by | what |
|---|---|---|
| `piece.json`, `score.mnx.json` | `fetch` | the piece, its recording, its stored score |
| `score.json` | `score` | performed order, bars (with the length their time signature gives), notes, the score's own jumps, the recording's existing sync as bar-line seconds |
| `audio/mono.wav` | `audio` | 22.05 kHz mono; downloaded data, kept apart |
| `notes.json`, `transcription.mid`, `transcription.json`, `transcription.events.json` | `transcribe` | what MuScriptor heard (its raw events too), which instruments were asked for and kept, the tuning measured from the audio, and at which speed (`--half-speed`: a pitch-preserving stretch, times scaled back) |
| `check.json` | `check` | key fit by shift, tuning, density, flags |
| `structure.json`, `report.md` | `structure` | bar by bar: when, how fast, notes found; which search, bars placed by onsets only, weak runs, unexplained notes, how far the bar lines moved from the existing sync |
| `sync-payload.json` | `sync` | the segments and sync points that would be written |
| `verify.json` | `sync`, `verify` | the sync as the player would play it, bar by bar: written notes heard, against chance; bars that went stale, bar lines it would miss, stretches that leave the recording |
| `screen/pages.json`, `screen/page-NN*.png` | `screen.py pages` | the notation a video shows: when each page is on screen, each page and overlapping slices of it |
| `score.gp`, `score.built.mnx.json`, `score.storage.json`, `score.mnx.json`, `preview.png` | `build` | from `score.tab.txt`: the `.gp` studio would store, the built document, its storage check, the document read back from the `.gp` (what `score` reads), a picture of it |
| `piece.json` | `create`, `attach` | the piece made from `score.gp`, then the recording put on it |

## The MuScriptor environment

`transcribe` runs [MuScriptor](https://github.com/muscriptor/muscriptor) (Kyutai and Mirelo,
2026) — it replaced Basic Pitch on 2026-10-27 (RUNS.md run 7: a wider margin over chance on all
four recorded runs). Its code is MIT; **its weights are CC-BY-NC: non-commercial use only**, so
it serves the owner's own library and research, never anything sold or commercially hosted. The
weights are gated: log in to Hugging Face once and accept the licence on the
[medium](https://huggingface.co/MuScriptor/muscriptor-medium) model's page.

```bash
git clone https://github.com/muscriptor/muscriptor ~/src/muscriptor && git -C ~/src/muscriptor checkout 8a1ef88   # 0.4.0
uv venv --python 3.12 ~/.venvs/muscriptor
VIRTUAL_ENV=~/.venvs/muscriptor uv pip install torch==2.14.1 --index-url https://download.pytorch.org/whl/cu126   # cu126 still runs a GTX 10-series (sm_61)
VIRTUAL_ENV=~/.venvs/muscriptor uv pip install ~/src/muscriptor librosa
uvx --from huggingface_hub hf auth login
```

What to know about its output, all measured (RUNS.md runs 6–7): it is deterministic (two runs,
byte-identical); it gives no loudness, so `amp` is 1; and **a note's end is the next onset of any
note** (961 of 961 within 30 ms), so it says nothing about how long a note is written.

## Separating the guitar

What to separate depends on what plays with the guitar. Measured 2026-10-28 on benches with a
known answer, as MuScriptor medium's fretless note accuracy (the owner's priority; RUNS.md run 8):

| recording | separate with | accuracy | time here (GTX 1060 Max-Q) |
|---|---|---|---|
| guitar alone | nothing — separators pass solo guitar through unchanged | same with or without | — |
| guitar + voice | **Gabox Mel-Band INSTV7N** (the default) | 94.25% (unseparated 92.8%) | ~0.7–1.3× the recording |
| guitar + voice, a hard piece | **HyperACE v2** (the quality choice, opt-in) | 95.3% | **~16×** (~48 min a 3-minute song) |
| a band under the guitar | **BS-RoFormer SW**, its guitar stem | 93.4% | ~5× |

Every separator reads 44.1 kHz stereo (`ffmpeg -i audio/source.wav -ar 44100 -ac 2 …`);
`bs-roformer-infer` does not resample. None of these weights states a licence (community
RoFormer weights); like MuScriptor's, they serve the owner's own library and research.

- **INSTV7N** is in [audio-separator](https://github.com/nomadkaraoke/python-audio-separator)'s
  registry: `audio-separator <wav> -m mel_band_roformer_instrumental_instv7n_gabox.ckpt`; use the
  `(Instrumental)` file. Gabox's other Mel-Band instrumentals (v5n, FV8, FV8b, Bleedless V3) are
  the same architecture and scored 93.6–94.1%: one tier, not worth choosing between.
- **HyperACE v2** ([pcunwa/BS-Roformer-HyperACE](https://huggingface.co/pcunwa/BS-Roformer-HyperACE),
  `v2_inst/`: `bs_roformer.py`, `config.yaml`, `bs_roformer_inst_hyperacev2.ckpt`, kept in
  `~/.cache/sepnext/hyperace/`) ships its own model code, read before it was allowed to run;
  [separate_hyperace.py](separate_hyperace.py) refuses any other version of it. Use its
  `_instrument.wav` — the `_instrumental.wav` beside it is the voice.
- **SW** (`enerjazzer/BS-ROFO-SW-Fixed`, `bs-roformer-infer`'s default model) — use its
  `_guitar.wav`. Not htdemucs_6s, which files guitar as "piano" or "other" (half of one voice +
  guitar recording). Never use `bs-roformer-infer`'s `_instrumental.wav`: it is the mix minus the
  model's *first* stem, which for SW is the bass — in effect the unseparated mix.
- Both instrumental models leave a ghost of the voice where only the voice sounds, and MuScriptor
  hears it as guitar (~250 notes in 14 s of unaccompanied singing). Expect strays there.

The environments here: `~/.venvs/separation` (Python 3.11, audio-separator 0.47.1, torch
2.14.1+cu126) and `~/.venvs/sepnext` (Python 3.12, bs-roformer-infer 0.1.5, torch 2.14.1+cu126).

## A piece that does not exist yet

Some videos show the arranger's notation on screen. `screen.py pages --video <file>` finds
the panel (bright, unsaturated, steady across frames), cuts the video where the page changes
and saves each page at full resolution with overlapping slices; download the best stream
(`yt-dlp -f 'bv*[height<=2160]'`). The reading is done by eye, into **tab text**
(`score.tab.txt`, format in [tabText.ts](tabText.ts)): a header, then each bar's voices as
`duration:string/fret` events —

```
title: Smells Like Teen Spirit
key: 1
tempo: 96

bar 5 segno section="Verse"
  v1: q:r 8:2/0 q:2/3 q:1/0 8:3/0~
  v2: 8:6/0 q.:3/0 q:5/0 q:4/2
bar 10 = 6
bar 32 = 30 ds-al-coda
```

`build` refuses a bar whose voice does not fill it and a tie that lands nowhere or on another
pitch, then makes what studio would store and reads it back, so `score`, `check` and
`structure` can judge the transcription against the recording **before** the piece exists.
`create` and `attach` (each a dry run without `--write`) make the piece and put the video on
it; from there the run is an ordinary sync.

## The bar search

States are (written bar, tempo, frame). A bar scores the notes of its first visit found near
where they should fall (60% pitch class, 40% exact pitch, an onset within ~80 ms) minus a
cost for each one missing. A bar follows the score's own performed order for free, jumps to
a bar the score itself jumps to (a repeat start, an ending) for a little, anywhere else for
more; tempo moves a step or two a bar; audio before the first bar and after the last costs
a little a second. Two passes: coarse and wide (40–320 bpm — the marking is not trusted),
then fine around what the first heard. The best path is the report.

A held-back ending — a final ritardando, a last chord placed late — is beyond tempo steps of
a step or two a bar, so the search stops a bar or two short. When the path otherwise follows
the score's order, `close_ending` places each missing bar at the first onset where most of
its downbeat's exact pitches sound together, and the report says so.

Promotion: the search is ~300 lines of numpy and could become TypeScript in `src/audio/`
for an in-app "sync automatically" — once a few more runs say it generalises.
