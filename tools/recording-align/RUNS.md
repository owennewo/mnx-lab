# Recording alignment runs

The `sync-recording` skill's memory: one entry per run, newest last, each ending with what
it taught. The skill reads this before every run and appends to it after (its Step 8).
Numbers come from `report.md`; "improvised" lists everything done that the skill did not say
to do — each is a gap to close.

## Lessons so far

- The score's marked tempo is not to be trusted (220 marked, 202 played): the search's
  tempo range is wide on purpose.
- A forced full-score alignment fails loudly with impossible tempos (330–440 bpm); that is
  the signal that the recording does not cover what was assumed.
- The key check's runner-up is often a fourth or fifth away and scores ~0.8 on a modal tune;
  only a near tie means anything.
- A transcription's repeat structure can be wrong (an ending no pass reaches); `score` prints
  it as a pass diagnostic, and it is worth telling the owner.
- Judge a transcription by notes found **minus chance**, not found alone: a denser
  transcription (half speed, run 3) finds more of the score and matches more by accident.
- **The owner's tolerance is ~80 ms** (2026-10-15: "I'm unlikely to notice anything under
  80ms time sync being incorrect"). Timing differences of tens of milliseconds between two
  methods decide nothing; what matters is a bar or a beat in the wrong place — the order, the
  margin over chance, the weak bars. Run 3's ±11 ms between speeds was measured against
  full speed's own sync, so it says neither is more precise.

## Open questions

- A recording that departs from the score's order: which of the three options do owners
  choose, and should the tool help edit the score's repeats?
- A singer: Basic Pitch transcribes the voice too. Is pitch-class matching enough, or is a
  source-separation step needed?
- Recordings longer than ~4 minutes: the search drops to 20 ms frames there; is that enough?
- **Half-speed transcription** (`transcribe --half-speed`): on a fast piece with triplets, does
  it beat full speed on found − chance, weak bars or bar placement? Run 3 is the control at
  ~200 bpm, where it does not. Owner's question, 2026-10-15: "this song is quite fast and has
  triplets. Perhaps if we do fast and slow we can compare both".

---

## Run 1 — 2026-10-14 — The First Time Ever I Saw Your Face (Bert Jansch)

- **Piece** `66384ce413d05771` — a GP4 transcription (John Sejer), DADGAD, imported with
  *From a file*, capo set to 1 by the owner. 31 written bars, 56 performed (1–21, 1–20, 22–24,
  26–31 ×2; bar 25's "2nd and 3rd" ending unreachable).
- **Recording** YouTube `MlDVbPBl45Q`, 55 s, solo guitar, close-up, capo 1. No voice.
- **Method**: improvised end to end in a session — this run is what the skill was written from.
- **Found**: 1–21, 1–20, 22–24 (44 of 56 performed bars; the clip ends there). 86% of score
  notes by pitch class (85% exact) against 19% chance; downbeats median 5 ms; 198–209 bpm.
- **Gates**: key fit +0 (capo 1 confirmed); a first, forced full-score alignment failed with
  330–440 bpm and was abandoned for the free-order search.
- **Written**: 45 cuts, 38 snapped to a heard downbeat; studio sync segments, one per bar.
- **Owner**: "You've done an excellent job of syncing a recording to a track — it really was superb."
- **Lessons**: the seven habits now in SKILL.md.

## Run 2 — 2026-10-15 — regression of run 1 with the committed tools

- **Purpose**: the skill's tools must reproduce run 1 without improvisation.
- **Result**: the same order; 86% / 85% against 19% chance; 45 cuts, 38 snapped; every sync
  point within 20 ms of run 1's stored sync (mean 2 ms). Bar search 3 s (run 1: 86 s).
- **Fixed on the way**: the key check compared twelve shifts instead of seven, and a fifth's
  0.83 tripped the ambiguity flag; the flag now needs a near tie (< 0.05).
- **Not written** (dry run): the piece already has run 1's sync.

## Run 3 — 2026-10-15 — half-speed transcription, controlled on run 1's recording

- **Question** (owner): does slowing the audio to half speed before Basic Pitch help a fast
  song with triplets? Tested first where the right sync is known: run 1's recording, ~200 bpm,
  few triplets. Half speed = a pitch-preserving stretch, times scaled back after.
- **Result** (bar lines compared with run 1's stored sync, which slightly favours full speed):

  | | full speed | half, ffmpeg `atempo` | half, Rubber Band crisp |
  |---|---|---|---|
  | notes heard | 472 | 784 | 909 |
  | score notes found (pitch class / exact) | 86% / 85% | 87% / 81% | 91% / 88% |
  | chance | 19% | 28% | 32% |
  | found − chance | **67** | 59 | 59 |
  | weak bars | 2 | 3 | **1** |
  | bar lines vs stored: median / max | 0 / 20 ms | 11 / 70 ms | 11 / 50 ms |
  | systematic offset (signed median) | — | 1 ms | 1 ms |

  Same order in all three. Slowed, Basic Pitch hears more of everything: more of the score
  (Rubber Band recovers two of three weak bars) and more that is not there, so the margin over
  chance falls and bar lines scatter ~±11 ms with no bias.
- **Verdict at this tempo**: full speed for the sync; half speed (Rubber Band) as a second
  opinion on which bars the transcription got wrong. Not yet a reason to change the default.
- **Kept**: `transcribe --half-speed [--audio <wav>]` (Rubber Band, crisp, percussive
  detector) and a `transcription.json` beside `notes.json` saying which speed made it; the
  skill's Step 3 runs both on a fast or triplet-heavy piece and compares found − chance.
- **Next**: the owner's fast song with triplets is the real test.
