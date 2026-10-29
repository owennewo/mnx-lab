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
- **Tuning readings of +33 cents were Basic Pitch's**, not the recordings': +33 is one of its
  pitch-bend steps (a third of a semitone). Measured from the audio (run 7), Teen Spirit is +7
  and the Quaker +0.
- A transcriber that hears fewer stray notes is worth more than one that finds a few more of
  the score's: it lowers chance, and the margin is what keeps a lookalike passage out (run 7:
  Sun Did Glide's outro, which Basic Pitch took for bars 9–14).

- **A sync with the right order can be tightened without searching for the order** (run 9):
  `--fixed-order --near-sync` held to the existing sync's bar lines finds the timing even on a
  half-written score, where the free search wanders. Two of two Soundslice syncs measured were
  early (runs 6, 9); whether that is general is the next thing to measure.

## Open questions

- A recording that departs from the score's order: which of the three options do owners
  choose, and should the tool help edit the score's repeats? Run 4: the owner chose to
  restructure the score, once three recordings showed the score was the outlier; the edit
  needed a hand-written script (gap 6 below), so yes, the tool should help.
- A singer: answered in run 8, revising runs 6–7. Those found the unseparated mix as good as
  separating, but the stem they compared against had been damaged by htdemucs_6s. Against a
  vocal model's instrumental, the mix loses about 1.5 points of notes; Step 3 now separates a
  singer with Gabox INSTV7N (HyperACE v2 on request), and a band with SW.
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
- **Checked against the arranger's PDF** (the owner bought it, after the run): all 33 bars
  match — every string, fret, rhythm, tie and voice. The PDF has no `|:` at bar 5 either, so
  the return to bar 5 is the performer's, not a misreading. The screen-reading method's first
  oracle check: no errors in 33 bars.
- **Owner**: "Wow - you did brilliantly" (2026-10-22, after the PDF check).
- **Time**: one session; reading the 33 bars was most of it.

## Run 6 — 2026-10-27 — Sun Did Glide (Chris Brain), the owner's own transcription

- **Piece** `dcbc40c2dcd33f45` — the owner's transcription (the only one there is), EADGAE capo 4,
  160 bpm marked; vocal + guitar. **Recording** YouTube `iol5eETQsqw`, 231 s, synced earlier in
  Soundslice (154 points).
- **The score's notation ≠ studio's reading**: the Interlude (bars 47–68) was a lone "2." ending
  holding the `:|x3` of the 9–68 strain. Soundslice and the performer read A, A + Interlude, A
  (153 bars); `passes.ts` took the skipped ending's repeat sign with it (55 bars), so in studio
  the sync was right only through bar 46. Fixed in `passes.ts` at the owner's word (c4205727,
  then 5721c252 for a loop it introduced on "1.3. / 2."). MuseScore reads the old way (55 bars);
  tested on tiny scores, the notation all three agree on is "1.3." on bar 46 with `:|`, a copy of
  bar 46 starting "2." through the Interlude — written so at the owner's choice (78 bars).
- **Method**: vocals out (BS-RoFormer) then htdemucs_6s's guitar stem; the bar search on the
  stem with the recording's 153-bar order (score.json's `order`, `edges` and the never-performed
  bars 47–68 in `written` filled in by hand, before the `passes.ts` fix); bars 75–77, a
  ritardando to ~107 bpm outside the search's tempo range, placed by hand on heard downbeats.
- **Found** (Basic Pitch): 88% exact against 21% chance; downbeats median 7 ms; 154–175 bpm.
- **The Soundslice sync was early**: MuScriptor's notes (not used in the fit) within ±70 ms of
  it 51%, of the new sync 92% (±40 ms: 27% → 91%).
- **Written**: `sync --write --replace` at the owner's word — 153 segments, 154 cuts (148
  snapped); rewritten with the same cuts when bar 46 was split, to rename the segments.
- **Checking the transcription**: written notes no listener hears in any pass, and notes ≥ 2
  listeners hear in every pass but not written (`disagreements.py` in the session's research
  code), each shown to the owner as score bar + pass with the video time and per-pass evidence.
  The owner settled them by ear: 14 changes, 4 left as written (heard by eye, too quiet to
  hear), one dead note marked (an attack with no pitch: a low thud plus a high click).
- **Improvised** (each a gap to close):
  1. A recording that plays more of the score than `passes.ts` performs: no way to give the
     search another order → score.json edited by hand. Fixed at the root (`passes.ts`).
  2. A ritardando ending beyond the search's tempo range → bars placed by hand. Run 5 had one
     too; `close_ending` places one or two bars, not three slowing bars.
  3. Editing the owner's score (add, remove, retune notes; split a bar; mark a dead note) →
     hand-written scripts over the MNX document, each checked by a storage round trip and a
     bar-by-bar diff before saving. The tool should help (run 4's gap 6 again).
- **Owner**: settled every finding by ear; the sync itself not yet judged.

## Run 7 — 2026-10-27 — MuScriptor in place of Basic Pitch, against the recorded runs

- **Why**: on drafting tests MuScriptor (medium) found 92–95% of notes where Basic Pitch found
  79–84%, held on Sun Did Glide, which no model can have trained on. The owner chose to replace
  Basic Pitch outright.
- **Regression**, the same audio through both (dry runs):

  | run | order (Basic Pitch / MuScriptor) | found exact vs chance | margin | weak bars | vs stored sync |
  |---|---|---|---|---|---|
  | 1 Jansch | 44/56 both | 85/19 → 86/11 | 66 → 75 | 2 / 2 | 2/20 ms → mean 12, max 39 ms |
  | 4 Quaker | 57/57 · 56/57 | 77/37 → 71/25 | 40 → 46 | 2 / 4 | last bar unplaced; one point 130 ms |
  | 5 Teen Spirit | 65/65 both | 89/13 → 92/9 | 76 → 83 | 1 / 1 | last bar + end 250–270 ms |
  | 6 Sun Did Glide | departs at the outro · follows | 88/21 → 92/13 | 67 → 79 | 2 / 0 | bar 76 200 ms |

  Mid-piece the two place bar lines within ~40 ms of each other everywhere; every larger
  difference is a final bar in a ritardando. MuScriptor is weaker on the Quaker's fast triplet
  eighths (half as many notes heard) and leaves its last bar unplaced.
- **Changed**: `align.py transcribe` runs MuScriptor (`--instruments`, `--keep`), `check` reads
  tuning measured from the audio, the skill's environment is `~/.venvs/muscriptor`, and the Jansch
  gate is re-baselined (Step 8). MuScriptor is deterministic: two runs, byte-identical notes.


## Run 8 — 2026-10-28 — which separator, per kind of recording (a drafting experiment, no sync written)

- **Why**: separation was chosen by hand and inconsistently: an htdemucs_6s guitar stem for a band,
  none for a singer. The question was asked three times, once per kind of recording, with the
  decision rule set before anything ran: the best fretless note F1 (MuScriptor medium, with the
  repeat vote), and a 0.5-point tie margin.
- **Benches**: guitar alone (Teen Spirit, Jansch); guitar + voice (Teen Spirit with Cormorant's
  vocal laid over it; Sun Did Glide, live); a band (Teen Spirit with Cormorant's vocal, drums
  and keys). The truth for each is its studio piece. Bar lines were fixed and identical for every
  candidate.

  | recording | candidates (F1 averaged over the benches) | time for a 3-minute song |
  |---|---|---|
  | guitar alone | unseparated 88.6% = Gabox 88.6% = HyperACE 88.6% (identical) | — |
  | guitar + voice | unseparated 92.8 · ep_317 instrumental 94.0 · Gabox Mel-Band v5n 94.05 · **INSTV7N 94.25** · FV8 93.8 · FV8b 93.7 · Bleedless V3 93.6 · SW 94.6 · **HyperACE v2 95.3** | 0 · 9 · 2–3 (every Gabox) · 15 · 48 min |
  | a band | **SW guitar 93.4** · ep_317 then SW 93.8 (a tie) | 15 · 25 min |

  On Sun Did Glide, HyperACE got 62% of bars right ignoring string; INSTV7N got 44%, SW 50%.
- **Owner's choice** (2026-10-28): "lets make the INSTV7N the default choice with HyperACE v2 as
  the quality choice offered only for more challenging pieces". INSTV7N won among four siblings
  of one architecture, by an amount inside the tie margin. It is unconfirmed until it holds on a
  voice + guitar recording it was not chosen on.
- **Traps found**: `bs-roformer-infer`'s `_instrumental.wav` is the mix minus the model's
  first stem, so for SW it is in effect the unseparated mix, and for HyperACE it is the voice. Both
  instrumental models leave a ghost of the voice where only the voice sounds, which MuScriptor
  hears as guitar notes.
- **Changed**: Step 3 separates by kind of recording; README "Separating the guitar" has the table,
  the models and the environments; `separate_hyperace.py` runs HyperACE and refuses any model
  code other than the version that was audited.

## Run 9 — 2026-10-29 — Everybody Wants To Rule The World (Gabriella Quevedo): the fixed-order search

- **Piece** `2b156138db0c7716` r4 — the owner's transcription of Gabriella Quevedo's arrangement,
  Open E♭ (D♯ A♯ D♯ G A♯ D♯), 12/8; 111 bars laid out from Soundslice with sections, bars 1–45
  and 52–57 written, the rest placeholder rests. **Recording** YouTube `aqx5AO4fxDU`, 250 s, guitar
  alone; Soundslice sync on every bar. First piece of the glow-up log.
- **Tuning**: she tunes to A=428 (her description). `check` read −48 cents and **key fit −1**:
  near a quarter-tone flat, most notes round down. Retuned +48 cents (Rubber Band) and transcribed
  again: +3 cents, key +0, 3213 notes heard instead of 2330.
- **The free search wandered**: 87% / 79% found against 49% chance, but 20 departures — the empty
  bars score nothing anywhere, and the riff bars (6–13, 28–31, the outro) are lookalikes.
- **The existing sync** (measured per bar against the written notes): 100 ms early at the start,
  200 ms by bar 40 — past the owner's 80 ms. On it, the written bars score 57%; with each bar's
  best offset, 84% exact against 4% chance.
- **Built: the fixed-order search** (`structure --fixed-order [--near-sync [s]]`): the score's
  performed order, timing only; unwritten bars placed by heard onsets and measured by their time
  signature; weak runs and unexplained notes flag a recording that leaves the order; the report
  says how far bar lines moved from the existing sync. `score` now writes the existing sync
  (through `createRecordingSync`) and each bar's time-signature length, and lists bars whose
  contents do not fill it. Selftest: the free cases unchanged, the same five in fixed order (the
  skipped repeat flagged), lookalike bars, unwritten bars with misfit placeholders, an early sync
  tightened. Jansch: free search unchanged (86/86 against 11%, within 39 ms of the stored sync);
  fixed order identical to it, with and without `--near-sync`.
- **On this piece**: `--fixed-order --near-sync`: 111 of 111 bars, 86% / 82% found against 44%
  chance (the riff makes chance high), downbeats median 10 ms; bar lines moved +100 ms median,
  90% within 182 ms. Without the window, the 54 unwritten bars after bar 57 stretched up to 7 s
  to fill the recording's tail — hence the UNWRITTEN STRETCH warning.
- **Findings about the score**: the pickup is wrong — she plays six eighths (D♯5 A♯4 D♯4 G4 D♯4
  G4, 1.34–2.45 s), bar 1 holds four sixteenths and is a sixteenth over its 4/8; so bar 2 starts
  ~150 ms early and the sync's beat unit falls to 1/16. Placeholder rests misfit 12/8 in 46–51
  (2 wholes), 80–84 and 102–111 (1 whole).
- **Improvised** (gaps): retuning (now in Step 4; a `transcribe --retune` would save the
  command); measuring the existing sync's offset per bar (now the report's "from the existing
  sync"); the lookalike map of unwritten bars against written ones (which written bar an empty
  bar sounds like — the copy list for an unfinished score) and the recording's self-similarity by
  section (does she repeat closely enough for repeat signs) — both one-off scripts, kept out until
  a second piece wants them.
- **Not written**: the owner has the analysis; the sync waits for their word.
