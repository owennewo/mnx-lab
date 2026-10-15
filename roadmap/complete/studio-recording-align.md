# Syncing a recording automatically: the `sync-recording` skill

> **Status: complete 2026-10-15.** Implementation loop. No golden moved.

The owner's Bert Jansch piece was synced to a YouTube performance by an improvised session on
2026-10-14 — Basic Pitch, studio's own performed score, a free-order bar search, a report
against chance, then the sync bar's own format — and the owner asked for it to be codified,
with "a reflection step which aims to assess the strengths/weaknesses of the skill and update
the skill to make the next run better".

- **[`.claude/skills/sync-recording/SKILL.md`](../../.claude/skills/sync-recording/SKILL.md)** —
  the procedure, its gates (key/capo, chance, tempo, order) and stopping points, analysis
  before any write, and Step 8: a run entry in RUNS.md and evidenced improvements, landed
  like any change.
- **[`tools/recording-align/`](../../tools/recording-align/README.md)** — `align.ts` (fetch,
  score, audio, sync through studio's modules) and `align.py` (transcribe, check, the bar
  search, a synthetic `selftest`). The search is now vectorised and two-pass over 40–320 bpm:
  3 s where the session's took 86 s.
- **`segmentsFromBarStarts`** (`src/model/syncSegments.ts`) — bar starts found in a recording
  → the segments the sync bar edits, beat chosen so every bar counts whole; tested in
  `sync-segments.test.ts`. The piece of the tool an in-app "sync automatically" would need.
- **Regression**: the tools reproduce the session's sync without improvisation — same order,
  every sync point within 20 ms of the stored one ([RUNS.md](../../tools/recording-align/RUNS.md), run 2).
