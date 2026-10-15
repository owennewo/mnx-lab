---
name: sync-recording
description: Sync a recording (a YouTube video or an uploaded audio file) to a studio piece automatically — transcribe the audio with Basic Pitch, find which written bar is played when, report how well it matches, and write the sync the sync bar edits once the owner has seen the analysis. Ends with a reflection that improves this skill. Use when the user asks to sync, align or line up a recording with a piece, find the bar lines in a video, or invokes /sync-recording.
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
PY="$HOME/dev/guitar-nn/.venv-basic-pitch/bin/python -I tools/recording-align/align.py"
```

Every command reads and writes files in `$OUT`; each step can be rerun alone.

## Step 0 — preflight

- `curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/studio/` answers (the owner's
  dev server; if not, ask them to start `npm run dev`).
- `$PY selftest` passes (no audio needed; seconds). A failure is a tool bug: stop and fix it.
- `which yt-dlp ffmpeg` both exist; the Basic Pitch Python exists. If it is missing, say so —
  do not substitute another transcriber silently.

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

`$T audio --out $OUT`, then `$PY transcribe --out $OUT`. Note the recording's length against
the score's length at its marked tempo: a much shorter recording usually stops early; a much
longer one plays more than the score lays out (verses, an intro, talking).

**Experiment — half speed (open question in RUNS.md).** When the piece is fast or full of
triplets, also transcribe a half-speed stretch in a sibling directory and run Steps 4–5 there:

```bash
mkdir -p $OUT-half && cp $OUT/piece.json $OUT/score.json $OUT-half/
$PY transcribe --out $OUT-half --half-speed --audio $OUT/audio/mono.wav
```

Compare the two reports on **notes found minus chance** (not found alone — slowed audio hears
more of everything, real and spurious, so chance rises too), weak bars, downbeat timing and
order. Sync from full speed unless this run's evidence says otherwise, say which you used,
and record both columns in the run entry.

## Step 4 — does it sound like the score? `$PY check --out $OUT`

- **Key fit not at +0**: the recording's capo or tuning differs from the score's. **Stop and
  ask** — usually the score's capo needs changing (Step 2's capo against the video).
- **Tuning beyond ±35 cents**: matches may slip a semitone; carry on, but say so.
- **Ambiguous key fit**: the recording may not be this piece. Say so before going on.

## Step 5 — which bar is played when: `$PY structure --out $OUT`

Then read `$OUT/report.md`. Judge, in this order:

1. **Notes found against chance.** Found by pitch class should be well above chance (the
   first runs: 86% against 19%). Close to chance, or under ~50%: the recording does not
   follow this score — **stop and tell the owner**; do not write.
2. **Tempo.** A range that is musically impossible (a doubling, 400 bpm) means the search was
   forced; look at where the rows go wrong before believing anything after it.
3. **Order.** *Follows the score's performed order* — yes is the case a sync can express.
   **Departures** (the performer repeated a section the score does not, skipped one, started
   mid-score) — **stop and present the options**: change the score's repeats so its performed
   order is what was played, then rerun; or sync only the stretch up to the departure; or (if
   it starts mid-score) a plain sync-point list that the sync bar cannot edit. The owner chooses.
4. **Weak bars** — bars where the transcription and the performance (or the transcriber)
   disagree. Not a reason to stop; worth listing for the owner to check by ear.
5. **Downbeats** — median under ~30 ms means bar lines sit on notes.

## Step 6 — tell the owner, then wait

Report plainly: the order found and how much of the score the recording covers; notes found
against chance; downbeat timing; the tempo played against the tempo marked; weak bars; pass
diagnostics and other findings about the transcription. Then `$T sync --out $OUT` (a dry run)
and say what it would write (segments, cuts, how many snapped). **Ask before writing.**

## Step 7 — write: `$T sync --out $OUT --write`

Then tell the owner to **reload the piece page before touching it** — an open page holds the
old revision, and a sync edit from it would replace this one. Point them at the weak bars to
check by ear.

## Step 8 — reflect, and improve the skill

After the owner has had a chance to listen, ask how it lines up (a sentence is enough). Then:

1. **Append a run entry to `tools/recording-align/RUNS.md`** in its format: the piece and
   recording, the numbers from the report, which gates fired, **everything you had to do that
   this skill did not tell you to do** (each improvisation is a gap), the owner's verdict, and
   time spent.
2. **Turn each lesson into a change, by kind**:
   - a bug or a limit in the tools → fix it, with a `selftest` case when it is about the
     search (a synthetic performance that fails before the fix);
   - a judgement this file did not give → write it into the step where it was needed;
   - a threshold → change only with evidence from at least two runs, and record why in RUNS.md;
   - a safety rule (analysis before writing, the overwrite guard, audio out of the repo) →
     never loosen it without the owner saying so.
3. **Rerun the regression**: the Jansch run in RUNS.md must still reproduce (same order,
   cuts within ~20 ms of the stored sync).
4. **Land it** through a worktree (CLAUDE.md's landing sequence), and say in one line what the
   next run will do better.

Keep the improvements small and evidenced. A skill that grows a rule for every run's
accident becomes one nobody follows; a rule earns its place when a second run needs it too.
