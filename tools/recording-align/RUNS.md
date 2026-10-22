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
  choose, and should the tool help edit the score's repeats? Run 4: the owner chose to
  restructure the score, once three recordings showed the score was the outlier; the edit
  needed a hand-written script (gap 6 below), so yes, the tool should help.
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

## Run 4 — 2026-10-15 — Merrily Kissed The Quaker (three candidate recordings)

- **Piece** `8ab33f9e192ee9de` — a GP transcription tagged Pierre Bensusan, DADGAD, capo 4,
  4/4 at a marked 128 bpm in triplet eighths; 45 written bars, no repeats, 45 performed. In
  content it is three 4-bar parts written A B C · A B C · A′ B′ · A B C (A′ and B′ an octave
  down; bars 1–12 = 13–24 = 33–44 nearly note for note).
- **Recording 1** YouTube `TuUnWQV-c8U` (Bensusan, *Merrily Kissed the Quaker/Cunla*, 257 s):
  key +0, tuning +33 cents. 6–105 s is this tune played A A B B C C twice (83% found, 88% at
  half speed); from 107 s it is another tune, *Cunla* (50–59%). Overall 67% / 36% chance,
  44 weak bars, 104–121 bpm. **Owner rejected the pairing** — a medley is not a good pair.
  Half speed, first 105 s: same order, bar lines median 0 / max 40 ms apart, weak bars
  4 → 0, overall margin 31 → 28 points: a tie on what a listener hears; full speed kept.
- **Recording 2** YouTube `eynTWo8xXGs` (Nik Davies, *Celtic Fingerstyle Guitar*, 119 s):
  key +0, +33 cents; 80% / 77% exact against 37% chance, 2 weak bars, downbeats 6 ms,
  116–123 bpm. Played A A B B C C · A′ A′ B′ B′ C C · A A (56 bars, octaves checked by exact
  pitch: low bars 71–92% against their high twins' 12–43%), with first/second-time endings
  that are the score's own pickup-less and pickup bars.
- **Recording 3** YouTube `HhsCSPxFz0c` (Matthias Siegrist, same title): **key fit −2**
  (capo 2 or a whole step down). Against the score shifted −2: 79% / 35%, 5 weak bars, the
  same 56-bar form as Davies — the same arrangement two frets lower.
- **Owner's choice**: Davies, with the score restructured to the doubled form. Written
  as a checkpoint (version "Doubled form: A B C A′ B′ C A, each part repeated"): 32 written
  bars, 57 performed, each part in repeats, voltas where the score had a pickup and a
  pickup-less ending (one copy of bar 44 with fresh note ids); storage check `gains` only
  (explicit `repeatEnd.times`). Bensusan recording removed (unsynced), Davies attached.
- **Against the restructured score**: the free search followed the score's order for all
  57 bars; 80% / 37%; downbeats median 6 ms, 90th percentile 24 ms; 113–123 bpm.
- **Written**: 57 segments, 58 cuts (55 snapped), 0.38–114.57 s; piece revision 5.
- **Owner**: "I think it lines up very well."
- **Improvised** (each a gap to close):
  1. **Assessing a candidate video not on the piece**: `fetch` only reads attached
     recordings, so each candidate got its own run directory with `piece.json`'s
     `external_id` swapped by hand. Wanted: `audio --video <url>` for assessment runs.
  2. **Lookalike bars**: the DEPARTURES list (21 on recording 1, 8 on recording 2) was mostly
     the search choosing between identical bars. I grouped bars by content (exact and by
     pitch class) and mapped the found order to parts by hand. Wanted: the report names
     lookalike bars and prints the order as content classes.
  3. **Finding where a recording stops being this score**: the report has one overall found
     figure. I computed found per stretch (83% / 59% / 50%) and a self-similarity check —
     each later bar against the well-matched first 105 s (0.52–0.62, against 0.87 within the
     first half and 0.49 for bars shifted half a beat). A wrong-key copy of the score as a
     chance baseline **failed**: the search drifted to 32 bpm and is not comparable.
  4. **Octave variants**: pitch class cannot tell A from A′; I compared exact-pitch found
     against each variant per row.
  5. **Assessing a recording at a different capo**: Step 4 says stop; to answer the owner's
     "is it a closer match" I shifted a copy of the score −2 and searched that. Right for
     assessment, never for a sync.
  6. **Restructuring the score**: no tool. A scratchpad script rebuilt the global and part
     measures from a plan of parts (repeats, voltas, a copied bar with renamed ids, slide
     targets checked to stay within their bars), compiled the passes, ran
     `checkStorage`, checked the stored `.gp` reads back in the same order, and posted a
     checkpoint (`POST /pieces/:id/renditions`, tags from `projectPieceTags`). Dry run first.
  7. **Swapping a recording's media**: the library refuses a media change on an existing
     recording ("Attach a new recording to use different media"), so the swap is attach
     (`PUT` with a new `studio-<uuid>` and `video`) then remove (`DELETE`), by hand with
     curl. Claude Code's auto-mode classifier blocked both until the owner said to do them;
     a removal needs the owner's explicit word, like `--replace`.
- **Time**: one session; three candidates downloaded and transcribed.
- **Next**: gaps 1 and 7 are small `align.ts` commands (`audio --video`, `attach`); gap 2
  belongs in the report; gap 6 is the larger one (a plan-of-parts restructure that writes a
  checkpoint) and earns its place when a second run needs it.

## Run 5 — 2026-10-22 — Smells Like Teen Spirit (a piece made from the screen)

- **Recording** YouTube `uJmRqAa9Hrk`, 182 s, Nikola Milovanovic's classical guitar
  arrangement, standard tuning, E minor (Nirvana's F minor a semitone down), ~96 bpm. No piece
  existed: the owner asked for one to be made from the video.
- **Method**: the video shows the arranger's notation + tab for 4–95 s, then nothing (the second
  half is a repeat). `screen.py pages` found the panel and its six pages unaided (4K stream);
  the 33 bars were read by eye into tab text and built (`build`), the preview compared with the
  pages, then judged against the audio **before** the piece was made; `create`, `attach`,
  `fetch` (the stored score read back byte-identical), `sync --write`.
- **The score's notation ≠ the performance**: the first ending's `:|` (bars 29–32) returns, by
  the notation, to the `|:` at bar 21; he plays back to bar 5. Measured first by chroma
  self-similarity (the second half = the first shifted 80.3 s = 32 bars), confirmed by the
  search. Written as segno 5 / To Coda 28 / D.S. al Coda 32 / coda 33, keeping the arranger's
  `|: 21–24 :|` (`passes.ts` does not nest repeats). Sections added: Intro, Verse, Pre-chorus,
  Chorus, Interlude, Ending.
- **Found**: 65 of 65 performed bars in the score's order; 90% of score notes by pitch class
  (89% exact) against 13% chance — the widest margin yet; downbeats median 13 ms, 90th
  percentile 31 ms; 93–100 bpm until a final ritardando (72 bpm). Key fit +0, tuning +33 cents.
  One weak bar: the last bar 28 (2/9), a ritardando no straight stretch fits — its bar lines
  are right.
- **Gates**: none fired. The search first stopped one bar short: the final chord lands 0.8 s
  after the tempo it could reach.
- **Written**: piece `ccef043db55deb0d` (revision 2), 65 segments, 66 cuts (62 snapped),
  5.15–168.68 s.
- **Fixed on the way** (each was improvised first):
  1. No way to make a piece from a transcription → tab text (`tabText.ts`) + `build` /
     `create` / `attach`.
  2. Finding and saving the on-screen score → `screen.py pages`.
  3. `audio` needed a piece (run 4's gap 1) → `audio --video <url>`.
  4. A held-back ending → `close_ending` places the last bar or two at their downbeat's exact
     pitches; a selftest case fails without it. Jansch regression unchanged (45 cuts, max
     20 ms / mean 2 ms from the stored sync).
- **Lessons**: reading errors come from placing a digit on the wrong tab line in a downscaled
  image — calibrate each page on a bar the notation confirms, and zoom ×2 when in doubt (one
  page here needed it). Build and run the bar search before making the piece: the numbers say
  whether the reading is right while it is still a text file.
- **Owner**: (pending)
- **Time**: one session; reading the 33 bars was most of it.
