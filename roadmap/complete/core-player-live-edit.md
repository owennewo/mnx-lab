# Live edit — the player keeps its session when the score changes

> **Status: complete 2026-09-19** (opened and landed the same day, 1579bcf2). Implementation
> loop. Reference: [docs/player-element.md](../../docs/player-element.md) → *An edit keeps the
> session*. [Player campaign](../inprogress/core-campaign-player.md) item 22; follows the
> editor's promotion into studio ([core-editor-element-promotion](core-editor-element-promotion.md)),
> which is what exposed this, and the sync bar ([studio-sync-bar](../complete/studio-sync-bar.md),
> 21), which it must not disturb.

Every edit hands the player a new performance, and the player treats a new performance the
way it treats a new file: it disposes the playback session and starts a fresh one on the
synth. That path was written for opening a piece. With the editor in studio it now runs on
every keystroke, and the owner met it on 2026-09-19: a `2` typed in the tab view put the
note on the right string and the YouTube video vanished, while the Source button still said
video.

What one keystroke threw away: the session and its play intent; the synth's sink, whose
AudioContext was closed and whose sample packs — cached per context — were fetched and
decoded again on the next play; the recording backend's media port, an audio element or the
YouTube iframe; and the chosen source, silently reset to the synth so the host's own record
of it was left lying. Even on the synth, playback stopped and returned to the start.

What actually changes on an edit is the performance and the bar durations. Everything derived
from them is cheap and pure: the transport's tempo map and indexes, the recording backend's
written-occurrence index, the sync map. None of it owns a resource.

## Agreement

- **An edit is not a new document.** The player tells them apart by `documentId`. The same
  id with a new performance is an edit and takes the **replace** path; a new id, a
  performance appearing from nothing or vanishing, or a change to the sample options is a
  new document and takes today's install path unchanged. The playback host
  (`src/elements/playbackHost.ts`) makes the same distinction and no longer stops the player
  or nulls its performance on an edit.
- **The session survives; the backend takes the new performance in place.** Each backend
  gains `replacePerformance`. The recording backend rebuilds its written index and swaps the
  sync map — the media port is not touched, and position is media time, so nothing moves. The
  synth backend rebuilds its transport, which is pure derivation, over the **same sink**, so
  the context and the sample banks are kept; the place carries over by score position (bar
  and offset), since positions in performance time may have shifted, and the state — playing,
  paused or stopped — carries with it. A place the new performance no longer has falls back
  to the start, stopped, never to a different source.
- **The source, rate, volume, sync mode and live segments are untouched.** A recording's
  sync is derived again against the bars as they are now — the sync bar's segments, live or
  stored, and an imported sync's tuples as they were — exactly as the factory does when the
  source is first selected, and the host is told through `sync-refresh` when the stored
  tuples no longer match, as [studio-sync-rederive](../complete/studio-sync-rederive.md) requires.
- **Later selects see the new score.** The session's factory reads the player's current
  performance when it is called, never the one captured when the session was made.
- **Pure before audible.** Where playback continues is a pure decision,
  `carryPlace` in `src/audio/carryPlace.ts`, proven under Node: bar and offset carried with
  the state, re-resolved when earlier bars changed length, nothing carried when stopped or
  when the bar is gone. The recording backend's `replacePerformance` is proven against the
  fake media port (no dispose, no second play, highlights from the new index). The sink's
  survival cannot be proven under Node — `harness/conformance/` may not import
  `src/audio/native/`, by the campaign's own fence — so the player's two paths are proven by
  the production-Studio sync-bar smoke: on the synth an edit keeps the sink object and a
  paused place; on a recording an edit mid-playback keeps the source, the playing state, the
  media time and the sync bar.

## Out of scope, named so they are not rediscovered

Making the transport itself accept a new performance while scheduling ahead (the rebuild is
cheap; the sink was the cost). A loop region carried across an edit — loops are dropped by
the replace, as the safe reading of a score whose bars may have moved. Studio's stale
`selectedRecordingId` when the player *does* reset to the synth: that reset now happens only
on a new document, where studio clears it anyway.
