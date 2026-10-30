---
name: sync-recording
description: Sync a recording (a YouTube video or an uploaded audio file) to a studio piece automatically — transcribe the audio with MuScriptor, find which written bar is played when, report how well it matches, and write the sync the sync bar edits once the owner has seen the analysis. Ends with a reflection that improves this skill. Use when the user asks to sync, align or line up a recording with a piece, find the bar lines in a video, or invokes /sync-recording.
---

# /sync-recording — align a recording to a piece, then learn from the run

You find where each bar of a studio piece falls in a recording and write that as the
piece's sync. The method has worked because of seven habits, and every step below exists
to keep one of them:

1. **The score comes from studio's own code** — the performed bar order, capo-adjusted
   pitches and bar ordinals are what sync points mean. Never reconstruct repeats or capo.
2. **Cheap checks before the expensive one** — key/capo, tuning and density first.
3. **Matching that forgives the transcriber** — pitch class, onsets, ±70 ms.
4. **The bar order is found, not assumed** — the search may jump anywhere; an impossible
   tempo means an assumption is wrong.
5. **Every number has a chance baseline** — "86% found" means nothing without "19% by chance".
6. **Bar lines land on heard notes** — cuts snap to a downbeat note within 40 ms.
7. **Written in studio's format, after the owner has seen the analysis** — and never over
   an existing sync without being told.

**Read [tools/recording-align/RUNS.md](../../../tools/recording-align/RUNS.md) first**: the
lessons of earlier runs, and the open questions this run might answer.

## Ground rules

- **Analysis before writing, always.** Steps 1–6 change nothing. Step 7 writes only after
  the owner has seen the report and said to.
- **An existing sync is the owner's.** `sync --write` refuses one; `--replace` only when the
  owner has said to replace it.
- **Audio stays in the session scratchpad**, in its run directory (`<scratchpad>/runs/<slug>/`).
  Nothing downloaded or derived from it is committed.
- **Run the tools from the checkout whose dev server holds the library** — normally the
  primary checkout on port 5173 — or pass `--origin` and `--secrets` to point at it. Running
  them changes no tracked file, so no worktree is needed to *use* the skill.
- **Improving the skill is a code change**: the reflection's edits to this file or the tools
  go through a worktree and the landing sequence in CLAUDE.md.

## The commands

```bash
OUT=<scratchpad>/runs/<slug>                      # one directory per run
T="npx vite-node --config vitest.config.ts tools/recording-align/align.ts --"
PY="$HOME/.venvs/muscriptor/bin/python -I tools/recording-align/align.py"
SCREEN="$HOME/.venvs/muscriptor/bin/python -I tools/recording-align/screen.py"
```

Every command reads and writes files in `$OUT`; each step can be rerun alone.

## Step 0 — preflight

- `curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/studio/` answers (the owner's
  dev server; if not, ask them to start `npm run dev`).
- `$PY selftest` passes (no audio needed; seconds). A failure is a tool bug: stop and fix it.
- `which yt-dlp ffmpeg` both exist; the MuScriptor environment exists (`~/.venvs/muscriptor`,
  set up as in the [README](../../../tools/recording-align/README.md#the-muscriptor-environment)),
  and its weights download — they are gated on Hugging Face (`hf auth login`, licence accepted).
  If it is missing, say so — do not substitute another transcriber silently. Its weights are
  **CC-BY-NC**: the owner's own library and research only, never a commercial use.

## Step 0b — no piece yet: read it off the screen

When the owner wants a piece made from a video that shows its notation (lesson and cover
videos often scroll the arranger's score along the bottom), read that rather than
transcribing the audio — tab names string and fret outright. Say first that an on-screen
arrangement is usually the arranger's sold work, and that reading it into the private
library is the owner's call. When the owner has bought the score, its PDF is the oracle:
check the reading against it bar by bar before making the piece.

1. **Pages.** Download the best stream (`yt-dlp -f 'bv*[height<=2160]'`) to `$OUT/video/`,
   then `$SCREEN pages --video <file> --out $OUT`. Note when the score is on screen: a panel
   that disappears halfway usually means the rest is a repeat.
2. **Read** into `$OUT/score.tab.txt` (format: `tools/recording-align/tabText.ts`). Habits
   that kept run 5's 33 bars right: calibrate the six tab lines on every page against a bar
   you can check in the notation, and zoom ×2 on a page half whenever a digit could sit on
   either of two lines; the rhythm row above the tab is the upper voice's, the row below the
   lower voice's — place each digit by its x against those; cross-check a bar's digits against
   the treble staff (an octave above sounding); write `bar N = M` only after comparing digit
   by digit.
3. **Write what is played, not what is printed.** Run 5 played a first ending back to bar 5,
   which had no repeat sign; written as segno + D.S. al Coda, since `passes.ts` does not nest
   repeats. The bar search (step 4) finds such a departure if the text guesses wrong. Note any
   departure in the file's header comment.
4. **Build and judge**: `$T build --out $OUT`, then hold `preview.png` against the pages.
   `build` writes `score.mnx.json`, so Steps 2–5 (`score`, `audio --video <url>`, `transcribe`,
   `check`, `structure`) judge the transcription against the recording **before** the piece
   exists. A weak bar here is a
   misreading until shown otherwise.
5. **Make the piece** once the numbers are good and the owner has asked for it: `$T create`,
   then `$T attach --video <url>` (dry runs; `--write` to do it). `piece.json` then stands in
   for Step 1; carry on from Step 6.

## Step 1 — the piece: `$T fetch --piece <id> --out $OUT [--recording <id>]`

The piece id is the last part of its studio URL (`#/piece/<id>`). With more than one
recording on the piece, the command lists them; ask which. **ALREADY SYNCED** in the output:
ask the owner whether this run may replace that sync before going further (analysis is fine
either way).

## Step 2 — the score: `$T score --out $OUT`

Read what it prints: the performed order, the capo, the marked tempo and how long the score
lasts at it, and any **pass diagnostic** (an ending that cannot be reached, say). Pass
diagnostics are findings about the transcription worth telling the owner; they also mean the
performed order may not be what the transcriber meant.

## Step 3 — the audio and its notes

`$T audio --out $OUT`, then `$PY transcribe --out $OUT` (MuScriptor, ~1 min per 3-minute
recording on the GPU; deterministic; `--instruments acoustic_guitar` is the default). What plays
with the guitar decides whether to separate it first — the table, the models and their traps are
in the [README](../../../tools/recording-align/README.md#separating-the-guitar):

- **Guitar alone** → transcribe as it is. Separating changes nothing.
- **A singer** → separate with Gabox INSTV7N, the default, and transcribe its instrumental
  (`--audio`, guitar only). It beats the unseparated mix by about 1.5 points, at about a minute
  per minute of recording:
  ```bash
  mkdir -p $OUT/sep/in && ffmpeg -loglevel error -y -i $OUT/audio/source.wav -ar 44100 -ac 2 $OUT/sep/in/mix.wav
  ~/.venvs/separation/bin/audio-separator $OUT/sep/in/mix.wav -m mel_band_roformer_instrumental_instv7n_gabox.ckpt \
    --model_file_dir <scratchpad>/models --output_dir $OUT/sep/instv7n --output_format WAV
  $PY transcribe --out $OUT --audio "$OUT/sep/instv7n/mix_(Instrumental)_mel_band_roformer_instrumental_instv7n_gabox.wav"
  ```
  **HyperACE v2** is the quality choice, offered only for a more challenging piece: dense or
  fast playing, a voice that buries the guitar, or an INSTV7N draft with many weak bars. It is
  about 1 point better and about 16× the recording's length to run (~48 min for 3 minutes), so
  offer it with the time and run it only when the owner says to:
  ```bash
  ~/.venvs/sepnext/bin/python -I tools/recording-align/separate_hyperace.py ~/.cache/sepnext/hyperace $OUT/sep/in $OUT/sep/hyperace
  $PY transcribe --out $OUT --audio $OUT/sep/hyperace/mix_instrument.wav   # _instrument, not _instrumental (the voice)
  ```
- **A band** (drums, keys) under the guitar → SW's guitar stem (`bs-roformer-infer`, its default
  model; ~5× the recording's length). Not htdemucs_6s, which files guitar as piano or other:
  ```bash
  mkdir -p $OUT/sep/in && ffmpeg -loglevel error -y -i $OUT/audio/source.wav -ar 44100 -ac 2 $OUT/sep/in/mix.wav
  ~/.venvs/sepnext/bin/bs-roformer-infer --input_folder $OUT/sep/in --store_dir $OUT/sep/sw
  $PY transcribe --out $OUT --audio $OUT/sep/sw/mix_guitar.wav
  ```

Both instrumental models leave a ghost of the voice where only the voice sounds, and MuScriptor
hears it as stray guitar notes. Note the recording's length against the score's length at its
marked tempo: a much shorter recording usually stops early; a much longer one plays more than
the score lays out (verses, an intro, talking).

**Experiment — half speed (open question in RUNS.md; measured with Basic Pitch, untried with
MuScriptor).** When the piece is fast or full of triplets, also transcribe a half-speed stretch in a sibling directory and run Steps 4–5 there:

```bash
mkdir -p $OUT-half && cp $OUT/piece.json $OUT/score.json $OUT-half/
$PY transcribe --out $OUT-half --half-speed --audio $OUT/audio/mono.wav
```

Decide between them on what a listener would notice — **a bar or a beat in the wrong place**
— not on milliseconds:

1. **The order** must be right in the one you choose.
2. **Notes found minus chance** — the margin that keeps a plausible wrong alignment out (not
   found alone: slowed audio hears more of everything, real and spurious, so chance rises too).
3. **Weak bars** — where the transcription missed the music; fewer is better.

Bar-line timing differences well under ~50 ms decide nothing: the owner does not notice a
sync off by less than ~80 ms, and neither speed has been shown the more precise. Sync from
full speed unless half speed clears weak bars **without** losing margin; say which you used
and why, and record both columns in the run entry.

## Step 4 — does it sound like the score? `$PY check --out $OUT`

- **Key fit not at +0**: the recording's capo or tuning differs from the score's. **Stop and
  ask** — usually the score's capo needs changing (Step 2's capo against the video).
- **Tuning beyond ±35 cents**: matches slip a semitone, and near a quarter-tone most do, so the key
  fit reads ±1 as well (run 9: a player at A=428, −48 cents). Transcribe again with `--retune` (after
  any separation, on its `--audio`): the recording is pitched onto the grid, its notes named in the
  score's pitch, and `check` then says how far it sounds from the score. If that differs from its
  stored tuning `check` flags it with the command to set it: `$T tuning --cents <c> --write`, once
  the owner has seen it, so the synth following the recording matches it.
- **Ambiguous key fit**: the recording may not be this piece. Say so before going on.

## Step 5 — which bar is played when: `$PY structure --out $OUT`

Two searches. The **free search** (the default) finds the order: any bar may follow any other,
at a cost. The **fixed-order search** (`--fixed-order`) holds to the score's own performed order
and only finds the timing; with `--near-sync [s]` each bar line also stays within `s` (0.3) of
the recording's existing sync. Use the fixed order when the order is known and the free search
cannot see it:

- **Tightening an existing sync** whose order is right but timing is off (the Soundslice
  imports: run 6's was early, run 9's 100–200 ms early) → `--fixed-order --near-sync`.
- **An unfinished score** — empty bars fit anywhere in the free search (run 9: 20 departures on
  a half-written score). Empty bars are placed by heard onsets and the tempo; a long run of them
  needs `--near-sync`, or it stretches to fill whatever audio follows (run 9: up to 7 s).
- **Lookalike bars** (riffs, run 4's repeated parts), where the free search's departures are
  only it choosing between identical bars.

The fixed order cannot report a departure; it says so instead with **weak runs** (three or more
weak bars in a row) and **unexplained** notes before its first bar or after its last. Either
one: run the free search and compare before believing the fixed one. Where both run, they
should agree (the Jansch run: identical bar lines).

Then read `$OUT/report.md`. Judge, in this order:

1. **Notes found against chance.** Found by pitch class should be well above chance (the
   first runs: 86% against 19%). Close to chance, or under ~50%: the recording does not
   follow this score — **stop and tell the owner**; do not write.
2. **Tempo.** A range that is musically impossible (a doubling, 400 bpm) means the search was
   forced; look at where the rows go wrong before believing anything after it.
3. **Order.** *Follows the score's performed order* — yes is the case a sync can express.
   (Fixed order: assumed, so read weak runs and unexplained notes here instead.)
   **Departures** (the performer repeated a section the score does not, skipped one, started
   mid-score) — **stop and present the options**: change the score's repeats so its performed
   order is what was played, then rerun; or sync only the stretch up to the departure; or (if
   it starts mid-score) a plain sync-point list that the sync bar cannot edit. The owner chooses.
4. **Weak bars** — bars where the transcription and the performance (or the transcriber)
   disagree. Not a reason to stop; worth listing for the owner to check by ear.
5. **Downbeats** — median under ~30 ms means bar lines sit on notes. This confirms the bar
   lines are anchored; it is not a contest. Under the owner's ~80 ms, a few milliseconds
   either way never outweigh a wrong bar.

## Step 6 — tell the owner, then wait

Report plainly: the order found and how much of the score the recording covers; notes found
against chance; downbeat timing; the tempo played against the tempo marked; weak bars; pass
diagnostics and other findings about the transcription. Then `$T sync --out $OUT` (a dry run)
and say what it would write (segments, cuts, how many snapped). **Ask before writing.**

## Step 7 — write: `$T sync --out $OUT --write`

Read the **whole** structure report before writing — every flag, not a filtered few lines (run 9
wrote an 80-bar sync over a 111-bar one past an UNEXPLAINED flag).

`sync` checks what it is about to write as the player would play it (`verifySync.ts`), and refuses
to write when: the player's bars would leave the recording (`verify` FAILED; `--unverified` only when
that is meant), bars do not fill their time signature (`--misfit`; fix the placeholders first), it
reaches fewer bars than the sync it replaces (`--shorter`), or the score was saved since this run
fetched it. It verifies again what was stored. `$T verify` checks a stored sync at any time, in
seconds, given this run's notes.

A scripted edit to the score goes through `$T checkpoint --edited <file.mnx.json> --bars 1,5-8 --name
<text> [--write]`, never a hand-made save: it refuses a bar changed that it does not name, a bar named
that did not change, a tuning or bar count that moves (`--settings`, `--resize`) and anything the export
newly loses, and draws the bars (`checkpoint.png`). An edit that moves a bar's length says STALE SYNC and
does not rewrite it: finish the edits, then fetch and write the sync once. Edit string and fret with the
pitch: the string is the authority, so a pitch alone does not survive the export.

**A sync counts beats per bar, so it goes stale when a bar's length changes** — a copy into a
placeholder bar, a time signature fixed. The player then runs those bars at the wrong speed (run 9:
copied bars of 12 eighths over segments of 8 played 1.5× fast). After any such edit, rerun `score`:
it reports STALE SYNC, and `structure --fixed-order --near-sync` then `sync --write --replace`
writes the same bar lines with the right beats (`score` reads them from the sync's cuts, which a
length change does not move).

Then tell the owner to **reload the piece page before touching it** — an open page holds the
old revision, and a sync edit from it would replace this one. Point them at the weak bars to
check by ear.

## Step 8 — reflect, and improve the skill

After the owner has had a chance to listen, ask how it lines up (a sentence is enough). Then:

1. **Append a run entry to `tools/recording-align/RUNS.md`** in its format: the piece and
   recording, the numbers from the report, which gates fired, **everything you had to do that
   this skill did not tell you to do** (each improvisation is a gap), the owner's verdict, and
   time spent.
   When a sync was written, also update the piece's row and Log in
   [GLOWUP_LOG.md](../../../GLOWUP_LOG.md), linking the run.
2. **Turn each lesson into a change, by kind**:
   - a bug or a limit in the tools → fix it, with a `selftest` case when it is about the
     search (a synthetic performance that fails before the fix);
   - a judgement this file did not give → write it into the step where it was needed;
   - a threshold → change only with evidence from at least two runs, and record why in RUNS.md;
   - a safety rule (analysis before writing, the overwrite guard, audio out of the repo) →
     never loosen it without the owner saying so.
3. **Rerun the regression**: the Jansch run in RUNS.md must still reproduce — the same order
   (1–21, 1–20, 22–24), 86% / 86% found against 11% chance, and cuts within ~40 ms of the stored
   sync (MuScriptor's baseline, run 7: mean 12 ms, max 39 ms; its notes are deterministic, so the
   notes themselves must come out identical).
4. **Land it** through a worktree (CLAUDE.md's landing sequence), and say in one line what the
   next run will do better.

Keep the improvements small and evidenced. A skill that grows a rule for every run's
accident becomes one nobody follows; a rule earns its place when a second run needs it too.
