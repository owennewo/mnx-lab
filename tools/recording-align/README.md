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
- **`align.py`** (the Basic Pitch environment's Python, numpy only beyond Basic Pitch) does
  the audio: `transcribe`, `check` (key/capo, tuning, density), `structure` (the free-order
  bar search and its report) and `selftest` (the search on synthetic performances).

Each command reads and writes files in `--out`:

| file | written by | what |
|---|---|---|
| `piece.json`, `score.mnx.json` | `fetch` | the piece, its recording, its stored score |
| `score.json` | `score` | performed order, bars, notes, the score's own jumps |
| `audio/mono.wav` | `audio` | 22.05 kHz mono; downloaded data, kept apart |
| `notes.json`, `transcription.mid`, `transcription.json` | `transcribe` | what Basic Pitch heard, and at which speed (`--half-speed`: a pitch-preserving stretch, times scaled back) |
| `check.json` | `check` | key fit by shift, tuning, density, flags |
| `structure.json`, `report.md` | `structure` | bar by bar: when, how fast, notes found |
| `sync-payload.json` | `sync` | the segments and sync points that would be written |

## The bar search

States are (written bar, tempo, frame). A bar scores the notes of its first visit found near
where they should fall (60% pitch class, 40% exact pitch, an onset within ~80 ms) minus a
cost for each one missing. A bar follows the score's own performed order for free, jumps to
a bar the score itself jumps to (a repeat start, an ending) for a little, anywhere else for
more; tempo moves a step or two a bar; audio before the first bar and after the last costs
a little a second. Two passes: coarse and wide (40–320 bpm — the marking is not trusted),
then fine around what the first heard. The best path is the report.

Promotion: the search is ~300 lines of numpy and could become TypeScript in `src/audio/`
for an in-app "sync automatically" — once a few more runs say it generalises.
