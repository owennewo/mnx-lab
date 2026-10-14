# Sounding a note as the cursor lands on it

> **Status: complete 2026-10-14.** Implementation loop. No golden moved; no verification debt.
> Shared by both editors: studio's piece page and the workbench's scenario page.

## Why

Checking a transcription against a recording note by note (the owner's Bert Jansch piece,
synced the same day) wants each note heard as it is selected, the way a notation editor
plays a clicked note. The editor placed its cursor and seeked the player; nothing sounded.

## What was built

- **`HostBackend.audition(noteKey, ordinal)`** (`src/audio/hostBackend.ts`): the written
  occurrence's sounding events on that visit — so a tied note sounds for its whole tie,
  from its head — retimed for the rate through the same `placed` playback uses, sent a
  little past the plucked instrument's commit horizon (0.12 s, D15) rather than the
  transport's 0.25 s lead. A newer press or play silences it; when it has rung out the
  port may idle, as after a stop. Refused while playing.
- **A paused seek no longer silences the host.** Playback's pause already did; with nothing
  of playback's sounding, the only thing a paused seek could cut was the note the cursor's
  own seek had just sounded.
- **`CursorPlayback.audition?`** (`src/elements/cursorPlayback.ts`), implemented by
  `bindPlayback` (studio) and the workbench's scenario page; **`Player.audition`** sounds
  only when the synth is the source and `auditionNotes` is on.
- **`bindEditor`** sounds the note under the cursor (`slotAt`, the cursor's line — just
  that note of a chord) after a press or an arrow move that lands on one, stopped only. An
  arrow that stays on the same note does not sound it again; a press always does.
- **Studio's Instruments sheet**: *Sound notes as you select them*, on by default,
  remembered per browser (`mnx-studio.audition-notes`, stored only when off).

## Decisions (owner, 2026-10-14)

- ~~With a recording as the source the synth does not exist, and clicks are **silent**.~~
  Reversed the same day (owner: "I've changed my mind"): see *Any source, and edits* below.
- **Click and arrow keys** both sound; **just the note** clicked, not its chord;
  **on by default with a toggle** in the Instruments sheet.

## Proof

- `harness/conformance/host-backend.test.ts` — *auditions one written note*: against the
  real HostCore, the tied-to half sounds the one tied note at its full length ÷ rate, past
  the commit horizon and heard; a paused seek cancels nothing; a newer press and play each
  silence; playing and an unsounded visit refuse; the port idles once it has rung out.
- `npm run smoke -- studio-editor` — in a real browser, an arrow onto each of two notes and
  a mouse press on the first send the host exactly one note each, the press the note
  pressed; switched off in the Instruments sheet, the arrows send nothing.

## Any source, and edits (2026-10-14, later)

The owner asked for notes to sound with a recording as the source too, and for a note to
sound when one is written or its pitch changed.

- **A synth the player keeps for auditions.** With a recording as the source the session
  has no synth (`PlaybackSession.select` disposes it), so `Player` makes a stopped
  `HostBackend` of its own on the first note to sound — its own `NativeHostPort`, the same
  mix, volume and sample rate — keeps it in step with edits, the mix and the volume, and
  drops it when the synth is the source again, the sample rate changes, or the player
  tears down. It never plays; only `audition` reaches it. The first note waits for the
  synth to load. Touch devices bind no editor, so never load it.
- **An edit sounds the note it made or changed.** `bindEditor` reads the cursor's note and
  what decides its sound (pitch, string, fret) before and after every edit intent, and the
  inspector's; when the note is new or sounds different it asks with `edited: true`.
  `Player` holds that request until the edit's performance arrives (`updated`, at most
  2 s), so a changed pitch sounds as it now is, not as it was. A two-digit fret sounds
  once, when the digit window commits it. Deleting, or an edit leaving the cursor's note
  as it was, sounds nothing; an undo that changes it back sounds it.
- Proof: `npm run smoke -- single-cursor` — with the (stand-in) YouTube video as the
  source, arrows onto a note send the kept synth one note each, and fret 3 then fret 5
  typed over it sound two semitones apart; `npm run smoke -- studio-editor` — with the
  synth as the source, a fret typed over a pressed note sounds it once, and its undo once.
